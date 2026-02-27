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

  const body = await req.json()
  const { rfp_id, line_item_id, recipient_id, value, text_value, notes, is_override } = body

  if (!rfp_id || !line_item_id) {
    return NextResponse.json({ error: "rfp_id and line_item_id are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("leveling_cells")
    .upsert(
      {
        rfp_id,
        line_item_id,
        recipient_id: recipient_id ?? null,
        org_id: profile.org_id,
        value: value ?? null,
        text_value: text_value ?? null,
        notes: notes ?? null,
        is_override: is_override ?? true,
      },
      { onConflict: "line_item_id,recipient_id" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
