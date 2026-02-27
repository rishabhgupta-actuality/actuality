"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, CheckCircle, Send, Loader2, X, Building2, Clock, DollarSign } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Recipient, Proposal, ProposalFile, Rfp, VendorQuestion } from "@/types/database"

type RfpWithDetails = Rfp & {
  projects: { name: string } | null
  organizations: { name: string } | null
  rfp_files: { id: string; file_name: string; file_path: string }[]
}

type ProposalWithFiles = Proposal & {
  proposal_files: ProposalFile[]
}

interface VendorPortalProps {
  token: string
  recipient: Recipient
  rfp: RfpWithDetails
  existingProposal: ProposalWithFiles | null
  questions: VendorQuestion[]
}

export function VendorPortal({ token, recipient, rfp, existingProposal, questions }: VendorPortalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [totalFee, setTotalFee] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(!!existingProposal?.submitted_at)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Questions
  const [question, setQuestion] = useState("")
  const [sendingQ, setSendingQ] = useState(false)
  const [localQuestions, setLocalQuestions] = useState<VendorQuestion[]>(questions)

  const org = rfp.organizations as { name: string } | null
  const project = rfp.projects as { name: string } | null

  function handleFiles(incoming: File[]) {
    setFiles((prev) => [...prev, ...incoming])
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!files.length && !existingProposal) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Upload each file directly to Supabase Storage using signed URLs
      const uploaded_files: Array<{ file_name: string; file_path: string; file_size: number; mime_type: string }> = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(`Uploading ${file.name} (${i + 1}/${files.length})…`)

        // Get a signed upload URL
        const urlRes = await fetch(`/api/vendor/${token}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_name: file.name, mime_type: file.type }),
        })

        if (!urlRes.ok) {
          const body = await urlRes.json().catch(() => ({}))
          throw new Error(body.error ?? `Failed to get upload URL for ${file.name}`)
        }
        const { signed_url, file_path } = await urlRes.json()

        // Upload file directly to Supabase Storage (no size limit through our server)
        const uploadRes = await fetch(signed_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        })

        if (!uploadRes.ok) throw new Error(`Failed to upload ${file.name}`)

        uploaded_files.push({
          file_name: file.name,
          file_path,
          file_size: file.size,
          mime_type: file.type,
        })
      }

      setUploadProgress("Saving proposal…")

      // Send only metadata to our API — no file blobs
      const res = await fetch(`/api/vendor/${token}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total_fee: totalFee, notes, uploaded_files }),
      })

      if (res.ok) {
        setSubmitted(true)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setUploadProgress(null)
      setSubmitting(false)
    }
  }

  async function sendQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setSendingQ(true)

    const res = await fetch(`/api/vendor/${token}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    })

    if (res.ok) {
      const data = await res.json()
      setLocalQuestions((prev) => [...prev, data])
      setQuestion("")
    }
    setSendingQ(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Proposal Submitted</h1>
          <p className="text-slate-500">
            Thank you! Your proposal for <strong>{rfp.title}</strong> has been received.
            {org?.name && ` ${org.name} will be in touch.`}
          </p>
          {existingProposal?.total_fee && (
            <p className="mt-3 text-sm text-slate-600">
              Total fee submitted:{" "}
              <strong>
                {new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
                  existingProposal.total_fee
                )}
              </strong>
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2.5 mb-1">
            <Building2 className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-slate-400">{org?.name ?? "RFP Portal"}</span>
          </div>
          <h1 className="text-xl font-bold">{rfp.title}</h1>
          {project && <p className="text-sm text-slate-400 mt-0.5">{project.name}</p>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* RFP Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RFP Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rfp.due_date && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Submission deadline:</span>
                <span className="font-medium text-slate-900">{formatDate(rfp.due_date)}</span>
              </div>
            )}
            {rfp.questions_due && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Questions due:</span>
                <span className="font-medium text-slate-900">{formatDate(rfp.questions_due)}</span>
              </div>
            )}
            {rfp.scope_summary && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Scope</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{rfp.scope_summary}</p>
              </div>
            )}
            {rfp.instructions && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Submission Instructions</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{rfp.instructions}</p>
              </div>
            )}
            {rfp.rfp_files?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">RFP Documents</p>
                <div className="space-y-1.5">
                  {rfp.rfp_files.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/files/${f.file_path}`}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {f.file_name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Proposal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit Your Proposal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* File drop zone */}
              <div>
                <Label className="mb-2 block">Proposal Files *</Label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    handleFiles(Array.from(e.dataTransfer.files))
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    dragOver ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Drop files here or click to browse</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel — any format accepted</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg"
                    onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
                  />
                </div>

                {files.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md text-sm">
                        <span className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          {f.name}
                        </span>
                        <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fee */}
              <div className="space-y-1.5">
                <Label htmlFor="fee">Total Fee (CAD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="fee"
                    type="number"
                    placeholder="e.g. 245000"
                    className="pl-8"
                    value={totalFee}
                    onChange={(e) => setTotalFee(e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes / Cover Message</Label>
                <Textarea
                  id="notes"
                  placeholder="Any key assumptions, exclusions, or notes for the issuer…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {submitError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || (!files.length)}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress ?? "Submitting…"}</>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Submit Proposal
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Questions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {localQuestions.length > 0 && (
              <div className="space-y-3 mb-4">
                {localQuestions.map((q) => (
                  <div key={q.id} className="space-y-1.5">
                    <div className="bg-slate-50 rounded-lg p-3 text-sm">
                      <p className="font-medium text-slate-700">Q: {q.question}</p>
                    </div>
                    {q.answer && (
                      <div className="bg-blue-50 rounded-lg p-3 text-sm ml-4">
                        <p className="font-medium text-blue-700">A: {q.answer}</p>
                      </div>
                    )}
                    {!q.answer && (
                      <p className="text-xs text-slate-400 ml-4">Awaiting response…</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={sendQuestion} className="flex gap-2">
              <Input
                placeholder="Ask a question about this RFP…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="outline" size="default" disabled={sendingQ || !question.trim()}>
                {sendingQ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
