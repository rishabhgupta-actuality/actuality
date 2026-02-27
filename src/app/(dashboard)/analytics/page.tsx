import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { BarChart3, TrendingUp, Building, Users } from "lucide-react"

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/auth/login")

  const orgId = profile.org_id

  const [
    { data: projects },
    { data: rfps },
    { data: recipients },
    { data: proposals },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("org_id", orgId),
    supabase.from("rfps").select("*").eq("org_id", orgId),
    supabase.from("recipients").select("*").eq("org_id", orgId),
    supabase.from("proposals").select("*").eq("org_id", orgId),
  ])

  const totalInvited = recipients?.length ?? 0
  const totalSubmitted = recipients?.filter((r) => r.status === "submitted").length ?? 0
  const responseRate = totalInvited > 0 ? (totalSubmitted / totalInvited) * 100 : 0

  const proposalsWithFee = proposals?.filter((p) => p.total_fee != null) ?? []
  const avgFee = proposalsWithFee.length > 0
    ? proposalsWithFee.reduce((s, p) => s + Number(p.total_fee), 0) / proposalsWithFee.length
    : null

  // Build vendor leaderboard
  const vendorMap: Record<string, { company: string; email: string; invites: number; submissions: number; wins: number }> = {}
  for (const r of recipients ?? []) {
    const key = r.company_name ?? r.email
    if (!vendorMap[key]) {
      vendorMap[key] = { company: r.company_name ?? r.email, email: r.email, invites: 0, submissions: 0, wins: 0 }
    }
    vendorMap[key].invites++
    if (r.status === "submitted") vendorMap[key].submissions++
  }

  const vendorList = Object.values(vendorMap)
    .sort((a, b) => b.submissions - a.submissions)
    .slice(0, 10)

  // By RFP type
  const byType = rfps?.reduce<Record<string, number>>((acc, r) => {
    acc[r.rfp_type] = (acc[r.rfp_type] ?? 0) + 1
    return acc
  }, {}) ?? {}

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Portfolio-level insights across all projects.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Projects", value: projects?.length ?? 0, icon: Building, color: "text-blue-600" },
          { label: "Total RFPs Issued", value: rfps?.filter(r => r.status !== "draft").length ?? 0, icon: BarChart3, color: "text-violet-600" },
          { label: "Response Rate", value: `${responseRate.toFixed(0)}%`, icon: TrendingUp, color: "text-emerald-600" },
          { label: "Unique Vendors", value: Object.keys(vendorMap).length, icon: Users, color: "text-amber-600" },
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
        {/* Vendor participation table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendor Participation</CardTitle>
          </CardHeader>
          <CardContent>
            {!vendorList.length ? (
              <p className="text-sm text-slate-500 py-4 text-center">No vendor data yet.</p>
            ) : (
              <div className="space-y-0 divide-y divide-slate-100">
                {vendorList.map((v) => (
                  <div key={v.email} className="py-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800 truncate max-w-[200px]">{v.company}</span>
                    <div className="flex items-center gap-4 text-slate-500 shrink-0">
                      <span>{v.invites} invited</span>
                      <span className="text-emerald-600 font-medium">{v.submissions} submitted</span>
                      {v.invites > 0 && (
                        <span className="text-xs text-slate-400 w-10 text-right">
                          {Math.round((v.submissions / v.invites) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RFP type breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RFPs by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {!rfps?.length ? (
              <p className="text-sm text-slate-500 py-4 text-center">No RFP data yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byType).map(([type, count]) => {
                  const total = rfps.length
                  const pct = (count / total) * 100
                  const labels: Record<string, string> = {
                    consultant: "Consultant",
                    gc: "GC / Contractor",
                    other: "Other",
                  }
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{labels[type] ?? type}</span>
                        <span className="text-slate-500">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average proposal fee */}
        {avgFee != null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Average Proposal Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-slate-900">{formatCurrency(avgFee)}</p>
              <p className="text-sm text-slate-500 mt-1">
                Across {proposalsWithFee.length} submitted proposal{proposalsWithFee.length !== 1 ? "s" : ""} with fee data
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
