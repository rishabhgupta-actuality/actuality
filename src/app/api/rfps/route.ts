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
  const {
    project_id, title, rfp_type, description, scope_summary,
    instructions, due_date, questions_due, budget_total, default_line_items,
  } = body

  if (!project_id || !title) {
    return NextResponse.json({ error: "project_id and title are required" }, { status: 400 })
  }

  // Create RFP
  const { data: rfp, error: rfpError } = await supabase
    .from("rfps")
    .insert({
      project_id,
      org_id: profile.org_id,
      title,
      rfp_type: rfp_type ?? "consultant",
      description: description || null,
      scope_summary: scope_summary || null,
      instructions: instructions || null,
      due_date: due_date || null,
      questions_due: questions_due || null,
      budget_total: budget_total || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (rfpError || !rfp) {
    return NextResponse.json({ error: rfpError?.message ?? "Failed to create RFP" }, { status: 500 })
  }

  // Insert default line items
  if (default_line_items?.length) {
    const lineItemRows = default_line_items.map((label: string, i: number) => ({
      rfp_id: rfp.id,
      org_id: profile.org_id,
      label,
      sort_order: i,
    }))

    await supabase.from("line_items").insert(lineItemRows)
  }

  return NextResponse.json(rfp, { status: 201 })
}
