import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const filePath = path.join("/")

  if (!filePath) {
    return NextResponse.json({ error: "Missing file path" }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const bucket = filePath.startsWith("proposals/") ? "proposal-files" : "rfp-files"

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "File not found" }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
