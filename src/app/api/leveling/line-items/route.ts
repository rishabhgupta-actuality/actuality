import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single()

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  const { rfp_id, label, sort_order, is_header } = await req.json()
  if (!rfp_id || !label) {
    return NextResponse.json({ error: "rfp_id and label are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("line_items")
    .insert({
      rfp_id,
      org_id: profile.org_id,
      label,
      sort_order: sort_order ?? 0,
      is_header: is_header ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
