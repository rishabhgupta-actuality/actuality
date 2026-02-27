"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Trash2 } from "lucide-react"

interface ProjectDeleteButtonProps {
  projectId: string
  projectName: string
}

export function ProjectDeleteButton({ projectId, projectName }: ProjectDeleteButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error ?? "Failed to delete project")
      setLoading(false)
      return
    }

    setOpen(false)
    router.push("/projects")
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setOpen(true)}>
        <Trash2 className="w-4 h-4" />
        Delete Project
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm text-slate-600">
            <p>
              You are about to permanently delete <strong>{projectName}</strong>.
            </p>
            <p>This will also remove all related RFPs, recipients, and submissions.</p>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-red-700">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onDelete} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
