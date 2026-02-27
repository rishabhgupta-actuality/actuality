import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FolderOpen, FileText, Users, TrendingUp, Plus } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, full_name")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/auth/login")

  const [{ data: projects }, { data: rfps }, { data: recipients }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("org_id", profile.org_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("rfps")
      .select("*, projects(name)")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("recipients")
      .select("status")
      .eq("org_id", profile.org_id),
  ])

  const submittedCount = recipients?.filter((r) => r.status === "submitted").length ?? 0
  const invitedCount = recipients?.length ?? 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Here&apos;s what&apos;s happening across your projects.</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Projects", value: projects?.length ?? 0, icon: FolderOpen, color: "text-blue-600" },
          { label: "Open RFPs", value: rfps?.filter((r) => r.status === "sent").length ?? 0, icon: FileText, color: "text-amber-600" },
          { label: "Bids Invited", value: invitedCount, icon: Users, color: "text-violet-600" },
          { label: "Bids Received", value: submittedCount, icon: TrendingUp, color: "text-emerald-600" },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} bg-slate-100 rounded-xl p-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Projects</CardTitle>
            <Link href="/projects" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {!projects?.length ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-3">No projects yet</p>
                <Link href="/projects/new">
                  <Button size="sm" variant="outline">Create your first project</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 group-hover:text-primary">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.location ?? "No location"} · {formatDate(p.created_at)}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{p.building_type ?? "Project"}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent RFPs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent RFPs</CardTitle>
          </CardHeader>
          <CardContent>
            {!rfps?.length ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">No RFPs yet. Create a project first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rfps.map((rfp) => {
                  const project = rfp.projects as { name: string } | null
                  return (
                    <Link
                      key={rfp.id}
                      href={`/projects/${rfp.project_id}/rfps/${rfp.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 group-hover:text-primary truncate">{rfp.title}</p>
                        <p className="text-xs text-slate-400">{project?.name} · Due {formatDate(rfp.due_date)}</p>
                      </div>
                      <RfpStatusBadge status={rfp.status} />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RfpStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "info" }> = {
    draft: { label: "Draft", variant: "secondary" },
    sent: { label: "Open", variant: "info" },
    closed: { label: "Closed", variant: "warning" },
    awarded: { label: "Awarded", variant: "success" },
  }
  const { label, variant } = map[status] ?? { label: status, variant: "secondary" }
  return <Badge variant={variant}>{label}</Badge>
}
