"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Upload, FileText, X } from "lucide-react"

const BUILDING_TYPES = [
  "Mixed-Use", "Residential", "Commercial", "Industrial", "Office",
  "Retail", "Hospitality", "Healthcare", "Education", "Infrastructure", "Other"
]

export default function NewProjectPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    location: "",
    building_type: "",
    size_sqft: "",
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addFiles(incoming: File[]) {
    if (!incoming.length) return
    setFiles((prev) => [...prev, ...incoming])
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        size_sqft: form.size_sqft ? Number(form.size_sqft) : null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Failed to create project")
      setLoading(false)
      return
    }

    if (files.length > 0) {
      setExtracting(true)
      const fd = new FormData()
      files.forEach((file) => fd.append("files", file))

      const bootstrapRes = await fetch(`/api/projects/${data.id}/bootstrap-rfp`, {
        method: "POST",
        body: fd,
      })

      const bootstrapData = await bootstrapRes.json().catch(() => ({}))
      setExtracting(false)
      setLoading(false)

      if (!bootstrapRes.ok) {
        setError(bootstrapData.error ?? "Project created, but RFP extraction failed")
        return
      }

      router.push(`/projects/${data.id}/rfps/${bootstrapData.rfp_id}`)
      return
    }

    setLoading(false)
    router.push(`/projects/${data.id}`)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/projects" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">New Project</h1>
        <p className="text-sm text-slate-500 mt-1">Set up a project to organize your RFPs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Basic information about the development project.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Burrard Landing Phase 2"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Vancouver, BC"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Building Type</Label>
                <Select value={form.building_type} onValueChange={(v) => update("building_type", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILDING_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="size">Size (sqft)</Label>
                <Input
                  id="size"
                  type="number"
                  placeholder="e.g. 150000"
                  value={form.size_sqft}
                  onChange={(e) => update("size_sqft", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Optional: Upload RFP Document(s)</Label>
              <p className="text-xs text-slate-500">
                If you upload at least one PDF now, we&apos;ll create a draft RFP and auto-extract key details.
              </p>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  addFiles(Array.from(e.dataTransfer.files))
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Drop files here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">At least one PDF is required for extraction</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md text-sm"
                    >
                      <span className="flex items-center gap-2 text-slate-700">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <div className="px-6 pb-6 flex gap-3">
            <Button type="submit" disabled={loading || extracting}>
              {extracting ? "Extracting RFP…" : loading ? "Creating…" : "Create Project"}
            </Button>
            <Link href="/projects">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
