import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const adminClient = getAdminClient()
  try {
    const { orgName, fullName, email, password } = await req.json()

    if (!orgName || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 400 })
    }

    // 2. Create organization
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({ name: orgName })
      .select()
      .single()

    if (orgError || !org) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: orgError?.message ?? "Failed to create organization" }, { status: 500 })
    }

    // 3. Create profile
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: authData.user.id,
      org_id: org.id,
      email,
      full_name: fullName || null,
      role: "admin",
    })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      await adminClient.from("organizations").delete().eq("id", org.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Signup error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
