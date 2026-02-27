import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(name, created_at)")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/auth/login")

  const org = profile.organizations as { name: string; created_at: string } | null

  const { data: members } = await supabase
    .from("profiles")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("created_at")

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your organization and account settings.</p>
      </div>

      <div className="space-y-5">
        {/* Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your workspace details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Name</p>
              <p className="text-sm font-medium text-slate-900">{org?.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Org ID</p>
              <p className="text-xs font-mono text-slate-400">{profile.org_id}</p>
            </div>
          </CardContent>
        </Card>

        {/* Your profile */}
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Name</p>
              <p className="text-sm text-slate-900">{profile.full_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</p>
              <p className="text-sm text-slate-900">{profile.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Role</p>
              <Badge variant={profile.role === "admin" ? "default" : "secondary"} className="capitalize">
                {profile.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Team members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members ({members?.length ?? 0})</CardTitle>
            <CardDescription>Everyone in your organization workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {members?.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.full_name ?? m.email}</p>
                    {m.full_name && <p className="text-xs text-slate-400">{m.email}</p>}
                  </div>
                  <Badge variant={m.role === "admin" ? "default" : "secondary"} className="capitalize text-xs">
                    {m.role}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Integrations info */}
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Connected services and API keys.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "Supabase", desc: "Database & file storage", status: "connected" },
              { name: "Anthropic Claude", desc: "AI extraction & analysis", status: "connected" },
              { name: "Resend", desc: "Email delivery", status: "connected" },
            ].map((int) => (
              <div key={int.name} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-slate-900">{int.name}</p>
                  <p className="text-xs text-slate-400">{int.desc}</p>
                </div>
                <Badge variant="success" className="text-xs">{int.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
