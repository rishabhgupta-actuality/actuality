import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { VendorPortal } from "@/components/vendor/vendor-portal"
import type { Recipient, Rfp, RfpFile, Proposal, ProposalFile, VendorQuestion } from "@/types/database"

type RfpWithDetails = Rfp & {
  projects: { name: string } | null
  organizations: { name: string } | null
  rfp_files: RfpFile[]
}

type ProposalWithFiles = Proposal & {
  proposal_files: ProposalFile[]
}

export default async function VendorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Service-role client for vendor portal (bypasses RLS) - created per request
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: recipient } = await adminClient
    .from("recipients")
    .select("*, rfps(*, projects(name), organizations(name), rfp_files(*))")
    .eq("token", token)
    .single()

  if (!recipient) notFound()

  const r = recipient as Recipient & { rfps: RfpWithDetails | null }

  // Mark as viewed if first time
  if (r.status === "invited" && !r.viewed_at) {
    await adminClient
      .from("recipients")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", r.id)
  }

  // Get existing proposal and questions
  const { data: proposal } = await adminClient
    .from("proposals")
    .select("*, proposal_files(*)")
    .eq("recipient_id", r.id)
    .single()

  const { data: questions } = await adminClient
    .from("vendor_questions")
    .select("*")
    .eq("recipient_id", r.id)
    .order("asked_at", { ascending: true })

  if (!r.rfps) notFound()

  return (
    <VendorPortal
      token={token}
      recipient={r}
      rfp={r.rfps}
      existingProposal={proposal as ProposalWithFiles | null}
      questions={(questions ?? []) as VendorQuestion[]}
    />
  )
}
