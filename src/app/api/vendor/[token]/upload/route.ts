import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { token } = await params

  const { data: recipient } = await adminClient
    .from("recipients")
    .select("*, rfps(org_id)")
    .eq("token", token)
    .single()

  if (!recipient) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 })
  }

  const rfp = recipient.rfps as { org_id: string } | null
  if (!rfp) return NextResponse.json({ error: "RFP not found" }, { status: 404 })

  const formData = await req.formData()
  const totalFee = formData.get("total_fee") as string | null
  const notes = formData.get("notes") as string | null
  const files = formData.getAll("files") as File[]

  // Upsert proposal
  const { data: proposal, error: proposalError } = await adminClient
    .from("proposals")
    .upsert({
      rfp_id: recipient.rfp_id,
      recipient_id: recipient.id,
      org_id: rfp.org_id,
      total_fee: totalFee ? Number(totalFee) : null,
      notes: notes || null,
      extraction_status: "pending",
      submitted_at: new Date().toISOString(),
    }, { onConflict: "recipient_id" })
    .select()
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: proposalError?.message ?? "Failed to create proposal" }, { status: 500 })
  }

  // Upload files to Supabase Storage
  for (const file of files) {
    if (!file.name) continue
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filePath = `proposals/${proposal.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

    const { error: uploadError } = await adminClient.storage
      .from("proposal-files")
      .upload(filePath, buffer, { contentType: file.type, upsert: false })

    if (!uploadError) {
      await adminClient.from("proposal_files").insert({
        proposal_id: proposal.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
      })
    }
  }

  // Update recipient status
  await adminClient
    .from("recipients")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", recipient.id)

  return NextResponse.json({ success: true, proposal_id: proposal.id })
}
