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
    .select("id, rfp_id")
    .eq("token", token)
    .single()

  if (!recipient) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 })
  }

  const { question } = await req.json()
  if (!question?.trim()) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from("vendor_questions")
    .insert({
      rfp_id: recipient.rfp_id,
      recipient_id: recipient.id,
      question: question.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
