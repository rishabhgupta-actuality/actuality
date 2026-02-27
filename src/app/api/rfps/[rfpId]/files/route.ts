import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  const { rfpId } = await params
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

  const { data: rfp } = await supabase
    .from("rfps")
    .select("id")
    .eq("id", rfpId)
    .eq("org_id", profile.org_id)
    .single()

  if (!rfp) {
    return NextResponse.json({ error: "RFP not found" }, { status: 404 })
  }

  const formData = await req.formData()
  const files = formData.getAll("files") as File[]

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 })
  }

  const uploaded: { file_name: string }[] = []

  for (const file of files) {
    if (!file.name) continue

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const path = `rfps/${rfpId}/${Date.now()}-${sanitizedName}`

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
      rfp_id: rfpId,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
    })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    uploaded.push({ file_name: file.name })
  }

  return NextResponse.json({ success: true, uploaded })
}
