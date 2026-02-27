import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LevelingGrid } from "@/components/leveling/leveling-grid"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function LevelingPage({
  params,
}: {
  params: Promise<{ id: string; rfpId: string }>
}) {
  const { id: projectId, rfpId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: rfp }, { data: lineItems }, { data: recipients }, { data: cells }] = await Promise.all([
    supabase.from("rfps").select("*, projects(name)").eq("id", rfpId).single(),
    supabase.from("line_items").select("*").eq("rfp_id", rfpId).order("sort_order"),
    supabase
      .from("recipients")
      .select("*, proposals(id, total_fee, extraction_status)")
      .eq("rfp_id", rfpId)
      .order("created_at"),
    supabase.from("leveling_cells").select("*").eq("rfp_id", rfpId),
  ])

  if (!rfp) notFound()

  const project = rfp.projects as { name: string } | null

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}/rfps/${rfpId}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            {rfp.title}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium text-slate-700">Leveling Sheet</span>
        </div>
        <div className="text-xs text-slate-400">
          {lineItems?.length ?? 0} line items · {recipients?.length ?? 0} bidders
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <LevelingGrid
          rfpId={rfpId}
          rfpBudget={rfp.budget_total}
          lineItems={lineItems ?? []}
          recipients={recipients ?? []}
          cells={cells ?? []}
        />
      </div>
    </div>
  )
}
