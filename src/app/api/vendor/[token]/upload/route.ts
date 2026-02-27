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

  const body = await req.json()
  const { total_fee, notes, uploaded_files } = body as {
    total_fee?: string
    notes?: string
    uploaded_files: Array<{ file_name: string; file_path: string; file_size: number; mime_type: string }>
  }

  // Upsert proposal
  const { data: proposal, error: proposalError } = await adminClient
    .from("proposals")
    .upsert({
      rfp_id: recipient.rfp_id,
      recipient_id: recipient.id,
      org_id: rfp.org_id,
      total_fee: total_fee ? Number(total_fee) : null,
      notes: notes || null,
      extraction_status: "pending",
      submitted_at: new Date().toISOString(),
    }, { onConflict: "recipient_id" })
    .select()
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: proposalError?.message ?? "Failed to create proposal" }, { status: 500 })
  }

  // Insert file records (files are already in Supabase Storage)
  for (const file of uploaded_files ?? []) {
    if (!file.file_path) continue
    await adminClient.from("proposal_files").insert({
      proposal_id: proposal.id,
      file_name: file.file_name,
      file_path: file.file_path,
      file_size: file.file_size ?? null,
      mime_type: file.mime_type ?? null,
    })
  }

  // Update recipient status
  await adminClient
    .from("recipients")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", recipient.id)

  return NextResponse.json({ success: true, proposal_id: proposal.id })
}
