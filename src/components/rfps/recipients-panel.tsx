"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Mail, ExternalLink, CheckCircle, Clock, X, Loader2, Copy } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import type { Recipient, Proposal } from "@/types/database"

type RecipientWithProposals = Recipient & {
  proposals: Pick<Proposal, "id" | "total_fee" | "extraction_status" | "submitted_at">[]
}

interface RecipientsPanelProps {
  rfpId: string
  recipients: RecipientWithProposals[]
  rfpStatus: string
}

export function RecipientsPanel({ rfpId, recipients, rfpStatus }: RecipientsPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sendingAll, setSendingAll] = useState(false)
  const [form, setForm] = useState({ email: "", contact_name: "", company_name: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, rfp_id: rfpId }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Failed to add recipient")
    } else {
      setOpen(false)
      setForm({ email: "", contact_name: "", company_name: "" })
      router.refresh()
    }
    setLoading(false)
  }

  async function sendInvites() {
    setSendingAll(true)
    const res = await fetch("/api/rfps/send-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfp_id: rfpId }),
    })
    setSendingAll(false)
    if (res.ok) router.refresh()
  }

  async function triggerExtraction(proposalId: string) {
    await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposal_id: proposalId }),
    })
    router.refresh()
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/vendor/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const uninvited = recipients.filter((r) => !r.invited_at)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Bidders ({recipients.length})</CardTitle>
        <div className="flex gap-2">
          {uninvited.length > 0 && rfpStatus !== "draft" && (
            <Button variant="outline" size="sm" onClick={sendInvites} disabled={sendingAll}>
              {sendingAll ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
              ) : (
                <><Mail className="w-3.5 h-3.5" /> Send {uninvited.length} invite{uninvited.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          )}
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add Bidder
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!recipients.length ? (
          <div className="text-center py-10">
            <p className="text-sm text-slate-500 mb-3">No bidders added yet.</p>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add first bidder
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recipients.map((r) => {
              const proposal = r.proposals?.[0]
              return (
                <div key={r.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">
                        {r.company_name ?? r.email}
                      </span>
                      {r.company_name && (
                        <span className="text-xs text-slate-400">{r.email}</span>
                      )}
                      <RecipientStatusBadge status={r.status} />
                    </div>
                    {r.contact_name && (
                      <p className="text-xs text-slate-400 mt-0.5">{r.contact_name}</p>
                    )}
                    {proposal && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500">
                          Submitted {formatDate(proposal.submitted_at)}
                        </span>
                        {proposal.total_fee && (
                          <span className="text-xs font-medium text-emerald-700">
                            {formatCurrency(proposal.total_fee)}
                          </span>
                        )}
                        {proposal.extraction_status === "processing" && (
                          <span className="flex items-center gap-1 text-xs text-blue-600">
                            <Loader2 className="w-3 h-3 animate-spin" /> Extracting…
                          </span>
                        )}
                        {proposal.extraction_status === "pending" && (
                          <button
                            onClick={() => triggerExtraction(proposal.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Run AI extraction
                          </button>
                        )}
                        {proposal.extraction_status === "done" && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle className="w-3 h-3" /> Extracted
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyLink(r.token)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      title="Copy vendor link"
                    >
                      {copiedToken === r.token ? (
                        <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> Copy link</>
                      )}
                    </button>
                    <a
                      href={`/vendor/${r.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Add bidder dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bidder</DialogTitle>
          </DialogHeader>
          <form onSubmit={addRecipient} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@company.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                placeholder="ABC Consultants Ltd."
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact">Contact Name</Label>
              <Input
                id="contact"
                placeholder="Jane Smith"
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding…" : "Add Bidder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function RecipientStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "info" }> = {
    invited: { label: "Invited", variant: "info" },
    viewed: { label: "Viewed", variant: "secondary" },
    submitted: { label: "Submitted", variant: "success" },
    declined: { label: "Declined", variant: "outline" },
  }
  const { label, variant } = map[status] ?? { label: status, variant: "secondary" }
  return <Badge variant={variant} className="text-xs">{label}</Badge>
}
