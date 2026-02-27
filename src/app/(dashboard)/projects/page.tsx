import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, MapPin, Building, FileText, ChevronRight } from "lucide-react"
import { formatDate } from "@/lib/utils"

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/auth/login")

  const { data: projects } = await supabase
    .from("projects")
    .select("*, rfps(id, status)")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {!projects?.length ? (
        <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-xl">
          <Building className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-700 mb-1">No projects yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create your first project to start issuing RFPs.</p>
          <Link href="/projects/new">
            <Button>
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => {
            const rfps = project.rfps as { id: string; status: string }[] | null ?? []
            const openRfps = rfps.filter((r) => r.status === "sent").length
            const totalRfps = rfps.length

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">{project.name}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      {project.location && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="w-3 h-3" />
                          {project.location}
                        </span>
                      )}
                      {project.building_type && (
                        <span className="text-xs text-slate-400">{project.building_type}</span>
                      )}
                      <span className="text-xs text-slate-400">Created {formatDate(project.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <FileText className="w-4 h-4" />
                    <span>{totalRfps} RFP{totalRfps !== 1 ? "s" : ""}</span>
                    {openRfps > 0 && (
                      <Badge variant="info" className="ml-1">{openRfps} open</Badge>
                    )}
                  </div>
                  <Badge variant={project.status === "active" ? "success" : "secondary"}>
                    {project.status}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
