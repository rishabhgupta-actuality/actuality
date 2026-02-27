import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateToken } from "@/lib/utils"

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

  const { rfp_id, email, contact_name, company_name } = await req.json()

  if (!rfp_id || !email) {
    return NextResponse.json({ error: "rfp_id and email are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("recipients")
    .insert({
      rfp_id,
      org_id: profile.org_id,
      email: email.trim().toLowerCase(),
      contact_name: contact_name || null,
      company_name: company_name || null,
      token: generateToken(),
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This email is already added to this RFP" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
