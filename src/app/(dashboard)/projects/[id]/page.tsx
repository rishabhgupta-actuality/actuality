import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ArrowLeft, FileText, Users, CheckCircle, Clock, ChevronRight, MapPin, Ruler } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single()

  if (!project) notFound()

  const { data: rfps } = await supabase
    .from("rfps")
    .select("*, recipients(id, status)")
    .eq("project_id", id)
    .order("created_at", { ascending: false })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/projects" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <div className="flex items-center gap-4 mt-1.5">
              {project.location && (
                <span className="flex items-center gap-1 text-sm text-slate-400">
                  <MapPin className="w-3.5 h-3.5" />
                  {project.location}
                </span>
              )}
              {project.building_type && (
                <span className="text-sm text-slate-400">{project.building_type}</span>
              )}
              {project.size_sqft && (
                <span className="flex items-center gap-1 text-sm text-slate-400">
                  <Ruler className="w-3.5 h-3.5" />
                  {Number(project.size_sqft).toLocaleString()} sqft
                </span>
              )}
            </div>
          </div>
          <Link href={`/projects/${id}/rfps/new`}>
            <Button>
              <Plus className="w-4 h-4" />
              New RFP
            </Button>
          </Link>
        </div>
      </div>

      {/* RFPs */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">RFPs ({rfps?.length ?? 0})</h2>

        {!rfps?.length ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-slate-700 mb-1">No RFPs yet</h3>
            <p className="text-sm text-slate-500 mb-4">Issue your first RFP to start collecting bids.</p>
            <Link href={`/projects/${id}/rfps/new`}>
              <Button>
                <Plus className="w-4 h-4" />
                Create RFP
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {rfps.map((rfp) => {
              const recipients = rfp.recipients as { id: string; status: string }[] | null ?? []
              const submitted = recipients.filter((r) => r.status === "submitted").length

              return (
                <Link
                  key={rfp.id}
                  href={`/projects/${id}/rfps/${rfp.id}`}
                  className="flex items-center justify-between p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">{rfp.title}</h3>
                        <RfpTypeBadge type={rfp.rfp_type} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {recipients.length} invited
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {submitted} submitted
                        </span>
                        {rfp.due_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Due {formatDate(rfp.due_date)}
                          </span>
                        )}
                        {rfp.budget_total && (
                          <span>Budget: {formatCurrency(rfp.budget_total)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RfpStatusBadge status={rfp.status} />
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function RfpTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    consultant: "Consultant",
    gc: "GC / Contractor",
    other: "Other",
  }
  return <Badge variant="outline" className="text-xs">{map[type] ?? type}</Badge>
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
