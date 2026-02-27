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
    .select("id, rfp_id, rfps(org_id)")
    .eq("token", token)
    .single()

  if (!recipient) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 })
  }

  const { file_name, mime_type } = await req.json()
  if (!file_name) {
    return NextResponse.json({ error: "file_name is required" }, { status: 400 })
  }

  const filePath = `proposals/${recipient.rfp_id}/${recipient.id}/${Date.now()}-${file_name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

  const { data, error } = await adminClient.storage
    .from("proposal-files")
    .createSignedUploadUrl(filePath)

  if (error || !data) {
    console.error("[upload-url] Supabase storage error:", error)
    return NextResponse.json({ error: error?.message ?? "Failed to create upload URL" }, { status: 500 })
  }

  return NextResponse.json({
    signed_url: data.signedUrl,
    file_path: filePath,
    token: data.token,
    mime_type: mime_type ?? "application/octet-stream",
  })
}
