import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, BarChart2, Paperclip } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { RecipientsPanel } from "@/components/rfps/recipients-panel"
import { RfpStatusActions } from "@/components/rfps/rfp-status-actions"

export default async function RfpPage({
  params,
}: {
  params: Promise<{ id: string; rfpId: string }>
}) {
  const { id: projectId, rfpId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: rfp } = await supabase
    .from("rfps")
    .select("*, projects(name), rfp_files(*)")
    .eq("id", rfpId)
    .single()

  if (!rfp) notFound()

  const { data: recipients } = await supabase
    .from("recipients")
    .select("*, proposals(id, total_fee, extraction_status, submitted_at)")
    .eq("rfp_id", rfpId)
    .order("created_at", { ascending: true })

  const project = rfp.projects as { name: string } | null
  const submittedCount = recipients?.filter((r) => r.status === "submitted").length ?? 0

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {project?.name ?? "Project"}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{rfp.title}</h1>
              <RfpStatusBadge status={rfp.status} />
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-400">
              <span className="capitalize">{rfp.rfp_type === "gc" ? "GC / Contractor" : rfp.rfp_type}</span>
              {rfp.due_date && <span>Due {formatDate(rfp.due_date)}</span>}
              {rfp.budget_total && <span>Budget: {formatCurrency(rfp.budget_total)}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/projects/${projectId}/rfps/${rfpId}/leveling`}>
              <Button variant="outline">
                <BarChart2 className="w-4 h-4" />
                Leveling Sheet
              </Button>
            </Link>
            <RfpStatusActions rfpId={rfpId} currentStatus={rfp.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Invited", value: recipients?.length ?? 0, color: "text-slate-700" },
          { label: "Submitted", value: submittedCount, color: "text-emerald-700" },
          {
            label: "Pending",
            value: (recipients?.length ?? 0) - submittedCount,
            color: "text-amber-700",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className={`text-3xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scope & Instructions */}
      {(rfp.scope_summary || rfp.instructions) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {rfp.scope_summary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scope Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 whitespace-pre-line">{rfp.scope_summary}</p>
              </CardContent>
            </Card>
          )}
          {rfp.instructions && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Submission Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 whitespace-pre-line">{rfp.instructions}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}


      {rfp.rfp_files?.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">RFP Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rfp.rfp_files.map((file: { id: string; file_name: string; file_path: string }) => (
              <a
                key={file.id}
                href={`/api/files/${file.file_path}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Paperclip className="w-3.5 h-3.5" />
                {file.file_name}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recipients */}
      <RecipientsPanel
        rfpId={rfpId}
        recipients={recipients ?? []}
        rfpStatus={rfp.status}
      />
    </div>
  )
}

function RfpStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "info" }> = {
    draft: { label: "Draft", variant: "secondary" },
    sent: { label: "Open for Bids", variant: "info" },
    closed: { label: "Closed", variant: "warning" },
    awarded: { label: "Awarded", variant: "success" },
  }
  const { label, variant } = map[status] ?? { label: status, variant: "secondary" }
  return <Badge variant={variant}>{label}</Badge>
}
