import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { rfp_id } = await req.json()
  if (!rfp_id) return NextResponse.json({ error: "rfp_id is required" }, { status: 400 })

  // Get RFP and org info
  const { data: rfp } = await supabase
    .from("rfps")
    .select("*, projects(name), organizations(name)")
    .eq("id", rfp_id)
    .single()

  if (!rfp) return NextResponse.json({ error: "RFP not found" }, { status: 404 })

  const project = rfp.projects as { name: string } | null
  const org = rfp.organizations as { name: string } | null

  // Get uninvited recipients
  const { data: recipients } = await supabase
    .from("recipients")
    .select("*")
    .eq("rfp_id", rfp_id)
    .is("invited_at", null)

  if (!recipients?.length) {
    return NextResponse.json({ message: "No uninvited recipients" })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const errors: string[] = []
  const sent: string[] = []

  for (const recipient of recipients) {
    const vendorLink = `${baseUrl}/vendor/${recipient.token}`
    const dueDate = rfp.due_date
      ? new Date(rfp.due_date).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
      : null

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@actuality.app",
        to: recipient.email,
        subject: `RFP Invitation: ${rfp.title}`,
        html: buildInviteEmail({
          recipientName: recipient.contact_name ?? recipient.email,
          companyName: recipient.company_name,
          orgName: org?.name ?? "The Owner",
          projectName: project?.name ?? "Project",
          rfpTitle: rfp.title,
          scopeSummary: rfp.scope_summary,
          instructions: rfp.instructions,
          dueDate,
          vendorLink,
        }),
      })

      await supabase
        .from("recipients")
        .update({ invited_at: new Date().toISOString(), status: "invited" })
        .eq("id", recipient.id)

      sent.push(recipient.email)
    } catch (err) {
      errors.push(recipient.email)
    }
  }

  // Update RFP status to sent if it was draft
  if (rfp.status === "draft") {
    await supabase.from("rfps").update({ status: "sent" }).eq("id", rfp_id)
  }

  return NextResponse.json({ sent, errors })
}

function buildInviteEmail({
  recipientName,
  companyName,
  orgName,
  projectName,
  rfpTitle,
  scopeSummary,
  instructions,
  dueDate,
  vendorLink,
}: {
  recipientName: string
  companyName: string | null
  orgName: string
  projectName: string
  rfpTitle: string
  scopeSummary: string | null
  instructions: string | null
  dueDate: string | null
  vendorLink: string
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; }
.header { background: #1e3a5f; color: white; padding: 24px 32px; border-radius: 8px 8px 0 0; }
.header h1 { margin: 0; font-size: 20px; font-weight: 700; }
.header p { margin: 4px 0 0; font-size: 14px; opacity: 0.8; }
.body { background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
.section { margin-bottom: 20px; }
.label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
.value { font-size: 15px; color: #1e293b; }
.cta { display: block; background: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; text-align: center; font-weight: 600; font-size: 15px; margin: 28px 0; }
.note { font-size: 13px; color: #64748b; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
</style></head>
<body>
  <div class="header">
    <h1>RFP Invitation</h1>
    <p>from ${orgName}</p>
  </div>
  <div class="body">
    <p>Dear ${recipientName}${companyName ? ` (${companyName})` : ""},</p>
    <p>You are invited to submit a proposal for the following RFP:</p>

    <div class="section">
      <div class="label">Project</div>
      <div class="value">${projectName}</div>
    </div>

    <div class="section">
      <div class="label">RFP</div>
      <div class="value">${rfpTitle}</div>
    </div>

    ${scopeSummary ? `<div class="section"><div class="label">Scope</div><div class="value">${scopeSummary.replace(/\n/g, "<br>")}</div></div>` : ""}

    ${dueDate ? `<div class="section"><div class="label">Submission Deadline</div><div class="value"><strong>${dueDate}</strong></div></div>` : ""}

    ${instructions ? `<div class="section"><div class="label">Submission Instructions</div><div class="value">${instructions.replace(/\n/g, "<br>")}</div></div>` : ""}

    <a href="${vendorLink}" class="cta">View RFP & Submit Proposal →</a>

    <div class="note">
      This link is unique to your submission. If you have questions, please use the question form on the proposal portal.
    </div>
  </div>
</body>
</html>
  `.trim()
}
