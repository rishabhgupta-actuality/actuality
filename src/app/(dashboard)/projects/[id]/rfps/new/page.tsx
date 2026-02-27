"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

const CONSULTANT_LINE_ITEMS = [
  "Architectural",
  "Structural Engineering",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Civil Engineering",
  "Landscape Architecture",
  "Interior Design",
  "Code Consulting",
  "Geotechnical",
  "Environmental",
  "Project Management",
  "Reimbursables / Disbursements",
]

const GC_LINE_ITEMS = [
  "General Conditions",
  "Site Work / Demolition",
  "Concrete",
  "Masonry",
  "Structural Steel",
  "Carpentry / Millwork",
  "Waterproofing / Roofing",
  "Doors, Windows & Glazing",
  "Finishes",
  "Mechanical / Plumbing",
  "HVAC",
  "Electrical",
  "Fire Protection",
  "Elevators",
  "Site Services",
  "General Contractor Fee",
  "Contingency",
]

export default function NewRfpPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: "",
    rfp_type: "consultant",
    description: "",
    scope_summary: "",
    instructions: "",
    due_date: "",
    questions_due: "",
    budget_total: "",
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const lineItems = form.rfp_type === "gc" ? GC_LINE_ITEMS : CONSULTANT_LINE_ITEMS

    const res = await fetch("/api/rfps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        project_id: projectId,
        budget_total: form.budget_total ? Number(form.budget_total) : null,
        due_date: form.due_date || null,
        questions_due: form.questions_due || null,
        default_line_items: lineItems,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Failed to create RFP")
      setLoading(false)
    } else {
      router.push(`/projects/${projectId}/rfps/${data.id}`)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">New RFP</h1>
        <p className="text-sm text-slate-500 mt-1">Configure the RFP and we&apos;ll set up your leveling sheet.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">RFP Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Consulting Services – Burrard Landing Phase 2"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>RFP Type</Label>
              <Select value={form.rfp_type} onValueChange={(v) => update("rfp_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultant">Consultant (Architect, Engineer, etc.)</SelectItem>
                  <SelectItem value="gc">General Contractor / Construction</SelectItem>
                  <SelectItem value="other">Other Services</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                This determines the default line items for your leveling sheet.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope & Instructions</CardTitle>
            <CardDescription>This information is shared with vendors in their invite email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scope_summary">Scope Summary</Label>
              <Textarea
                id="scope_summary"
                placeholder="Brief description of the project and scope being tendered…"
                value={form.scope_summary}
                onChange={(e) => update("scope_summary", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instructions">Submission Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Please submit your proposal as a single PDF. Include fee breakdown by discipline…"
                value={form.instructions}
                onChange={(e) => update("instructions", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline & Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="due_date">Submission Deadline</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => update("due_date", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="questions_due">Questions Due</Label>
                <Input
                  id="questions_due"
                  type="date"
                  value={form.questions_due}
                  onChange={(e) => update("questions_due", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget_total">Internal Budget (CAD) — not shared with vendors</Label>
              <Input
                id="budget_total"
                type="number"
                placeholder="e.g. 2500000"
                value={form.budget_total}
                onChange={(e) => update("budget_total", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create RFP"}
          </Button>
          <Link href={`/projects/${projectId}`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
