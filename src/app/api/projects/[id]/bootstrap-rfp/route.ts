import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

const CONSULTANT_LINE_ITEMS = [
  "Architectural",
  "Structural Engineering",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Civil Engineering",
  "Landscape Architecture",
  "Interior Design",
  "Code Consulting",
  "Geotechnical",
  "Environmental",
  "Project Management",
  "Reimbursables / Disbursements",
]

const GC_LINE_ITEMS = [
  "General Conditions",
  "Site Work / Demolition",
  "Concrete",
  "Masonry",
  "Structural Steel",
  "Carpentry / Millwork",
  "Waterproofing / Roofing",
  "Doors, Windows & Glazing",
  "Finishes",
  "Mechanical / Plumbing",
  "HVAC",
  "Electrical",
  "Fire Protection",
  "Elevators",
  "Site Services",
  "General Contractor Fee",
  "Contingency",
]

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("org_id", profile.org_id)
    .single()

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const formData = await req.formData()
  const files = formData.getAll("files") as File[]

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 })
  }

  const pdfFile = files.find((file) => file.type === "application/pdf")
  if (!pdfFile) {
    return NextResponse.json({ error: "At least one PDF is required for extraction" }, { status: 400 })
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicApiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey })

  let extracted: {
    rfp_title?: string | null
    rfp_type?: "consultant" | "gc" | "other" | null
    scope_summary?: string | null
    instructions?: string | null
    due_date?: string | null
    questions_due?: string | null
    budget_total?: number | null
    project_name?: string | null
    location?: string | null
    building_type?: string | null
    size_sqft?: number | null
  } = {}

  try {
    const base64 = Buffer.from(await pdfFile.arrayBuffer()).toString("base64")

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system:
        "Extract structured project and RFP fields from tender/RFP documents. Return only valid JSON with no markdown.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Extract these fields. Use null when unknown. Dates must be YYYY-MM-DD. rfp_type must be one of consultant|gc|other.
{
  "project_name": string | null,
  "location": string | null,
  "building_type": string | null,
  "size_sqft": number | null,
  "rfp_title": string | null,
  "rfp_type": "consultant" | "gc" | "other" | null,
  "scope_summary": string | null,
  "instructions": string | null,
  "due_date": "YYYY-MM-DD" | null,
  "questions_due": "YYYY-MM-DD" | null,
  "budget_total": number | null
}`,
            },
          ],
        },
      ],
    })

    const textPart = response.content.find((c) => c.type === "text")
    if (textPart && textPart.type === "text") {
      const match = textPart.text.match(/\{[\s\S]*\}/)
      if (match) {
        extracted = JSON.parse(match[0])
      }
    }
  } catch {
    return NextResponse.json({ error: "Failed to extract data from uploaded RFP document" }, { status: 500 })
  }

  if (extracted.location || extracted.building_type || extracted.size_sqft || extracted.project_name) {
    await supabase
      .from("projects")
      .update({
        name: extracted.project_name || undefined,
        location: extracted.location || null,
        building_type: extracted.building_type || null,
        size_sqft: extracted.size_sqft || null,
      })
      .eq("id", projectId)
      .eq("org_id", profile.org_id)
  }

  const rfpType = extracted.rfp_type ?? "consultant"
  const lineItems = rfpType === "gc" ? GC_LINE_ITEMS : CONSULTANT_LINE_ITEMS

  const { data: rfp, error: rfpError } = await supabase
    .from("rfps")
    .insert({
      project_id: projectId,
      org_id: profile.org_id,
      title: extracted.rfp_title || "Imported RFP",
      rfp_type: rfpType,
      scope_summary: extracted.scope_summary || null,
      instructions: extracted.instructions || null,
      due_date: extracted.due_date || null,
      questions_due: extracted.questions_due || null,
      budget_total: extracted.budget_total || null,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single()

  if (rfpError || !rfp) {
    return NextResponse.json({ error: rfpError?.message ?? "Failed to create RFP" }, { status: 500 })
  }

  await supabase.from("line_items").insert(
    lineItems.map((label, i) => ({
      rfp_id: rfp.id,
      org_id: profile.org_id,
      label,
      sort_order: i,
    }))
  )

  for (const file of files) {
    if (!file.name) continue
    const path = `rfps/${rfp.id}/${Date.now()}-${sanitizeFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from("rfp-files")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { error: dbError } = await supabase.from("rfp_files").insert({
      rfp_id: rfp.id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
    })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, rfp_id: rfp.id })
}
