import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(name)")
    .eq("id", user.id)
    .single()

  const orgName = (profile?.organizations as { name?: string } | null)?.name ?? "Your Organization"

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar orgName={orgName} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  )
}
