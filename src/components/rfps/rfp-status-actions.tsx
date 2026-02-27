"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Send, Lock, Award } from "lucide-react"

export function RfpStatusActions({
  rfpId,
  currentStatus,
}: {
  rfpId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: string) {
    setLoading(true)
    await fetch(`/api/rfps/${rfpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    router.refresh()
  }

  if (currentStatus === "draft") {
    return (
      <Button onClick={() => updateStatus("sent")} disabled={loading}>
        <Send className="w-4 h-4" />
        {loading ? "Updating…" : "Issue RFP"}
      </Button>
    )
  }

  if (currentStatus === "sent") {
    return (
      <Button variant="outline" onClick={() => updateStatus("closed")} disabled={loading}>
        <Lock className="w-4 h-4" />
        {loading ? "Updating…" : "Close Bidding"}
      </Button>
    )
  }

  if (currentStatus === "closed") {
    return (
      <Button variant="outline" onClick={() => updateStatus("awarded")} disabled={loading}>
        <Award className="w-4 h-4" />
        {loading ? "Updating…" : "Mark Awarded"}
      </Button>
    )
  }

  return null
}
