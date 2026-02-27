import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { proposal_id } = await req.json()
  if (!proposal_id) return NextResponse.json({ error: "proposal_id is required" }, { status: 400 })

  // Get proposal with files and line items
  const { data: proposal } = await adminClient
    .from("proposals")
    .select("*, proposal_files(*), recipients(rfp_id, company_name, email)")
    .eq("id", proposal_id)
    .single()

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })

  const recipient = proposal.recipients as { rfp_id: string; company_name: string | null; email: string } | null
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 })

  // Get RFP line items
  const { data: lineItems } = await adminClient
    .from("line_items")
    .select("*")
    .eq("rfp_id", recipient.rfp_id)
    .order("sort_order")

  // Mark as processing
  await adminClient
    .from("proposals")
    .update({ extraction_status: "processing" })
    .eq("id", proposal_id)

  try {
    // Build context from available text (file names, notes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proposalFiles = (proposal.proposal_files ?? []) as any[]
    const fileList = proposalFiles.map((f) => f.file_name).join(", ")
    const lineItemLabels = lineItems?.map((li) => li.label).join(", ") ?? ""

    // Download and encode files for Claude vision/document processing
    const fileContents: Array<{ name: string; content: string; mimeType: string }> = []

    for (const file of proposalFiles.slice(0, 3)) { // limit to 3 files
      try {
        const { data: fileData } = await adminClient.storage
          .from("proposal-files")
          .download(file.file_path)

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString("base64")
          fileContents.push({
            name: file.file_name,
            content: base64,
            mimeType: file.mime_type ?? "application/octet-stream",
          })
        }
      } catch {
        // Skip files that can't be downloaded
      }
    }

    // Build Claude prompt
    const systemPrompt = `You are an expert bid analyst specializing in construction and consulting RFPs.
Your job is to extract structured fee/cost data from proposal documents.
Always return valid JSON matching the requested schema.
Be precise with numbers — extract exact figures, not estimates.
If a value is not found, use null.`

    const userPrompt = `Extract fee and cost data from this proposal.

VENDOR: ${recipient.company_name ?? recipient.email}
PROPOSAL NOTES: ${proposal.notes ?? "None"}
FILES SUBMITTED: ${fileList}

LINE ITEMS TO EXTRACT (match these categories from the proposal):
${lineItemLabels}

Return a JSON object with:
{
  "total_fee": number | null,
  "currency": "CAD" | "USD",
  "line_items": [
    {
      "label": "exact label from the list above",
      "value": number | null,
      "text_value": "string if non-numeric (e.g. 'Included in Arch fee')" | null,
      "notes": "any relevant context, assumptions, or qualifications" | null,
      "source_text": "exact quote from the proposal where this value was found" | null
    }
  ],
  "key_assumptions": ["assumption 1", "assumption 2"],
  "key_exclusions": ["exclusion 1", "exclusion 2"],
  "separate_prices": [
    {
      "label": "description of optional or separate price",
      "value": number | null
    }
  ],
  "extraction_confidence": "high" | "medium" | "low",
  "notes": "any overall notes about the proposal structure or quality"
}`

    // Build message content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageContent: any[] = []

    // Add PDFs if available
    for (const file of fileContents) {
      if (file.mimeType === "application/pdf") {
        messageContent.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: file.content,
          },
          title: file.name,
        })
      }
    }

    messageContent.push({ type: "text" as const, text: userPrompt })

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: messageContent }],
    })

    const textContent = response.content.find((c) => c.type === "text")
    if (!textContent || textContent.type !== "text") throw new Error("No text response from Claude")

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found in response")

    const extracted = JSON.parse(jsonMatch[0])

    // Update proposal with extracted data
    await adminClient
      .from("proposals")
      .update({
        total_fee: extracted.total_fee ?? proposal.total_fee,
        raw_extraction: extracted,
        extraction_status: "done",
      })
      .eq("id", proposal_id)

    // Populate leveling cells from extracted line items
    if (extracted.line_items?.length && lineItems?.length) {
      for (const extractedItem of extracted.line_items) {
        // Find matching line item (fuzzy match)
        const matchedLineItem = lineItems.find(
          (li) =>
            li.label.toLowerCase().includes(extractedItem.label.toLowerCase()) ||
            extractedItem.label.toLowerCase().includes(li.label.toLowerCase())
        )

        if (matchedLineItem) {
          await adminClient.from("leveling_cells").upsert(
            {
              rfp_id: recipient.rfp_id,
              line_item_id: matchedLineItem.id,
              recipient_id: proposal.recipient_id,
              org_id: proposal.org_id,
              value: extractedItem.value ?? null,
              text_value: extractedItem.text_value ?? null,
              notes: extractedItem.notes ?? null,
              source_text: extractedItem.source_text ?? null,
              is_override: false,
            },
            { onConflict: "line_item_id,recipient_id" }
          )
        }
      }
    }

    return NextResponse.json({ success: true, extracted })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed"
    await adminClient
      .from("proposals")
      .update({ extraction_status: "failed", extraction_error: message })
      .eq("id", proposal_id)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
