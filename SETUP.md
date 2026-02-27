# Actuality — Setup Guide

## Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key
- A [Resend](https://resend.com) account

---

## 1. Supabase Setup

### Run the database migration

In your Supabase project, go to **SQL Editor** and run the contents of:
```
supabase/migrations/001_initial_schema.sql
```

### Create a storage bucket

In **Storage**, create a new bucket named `proposal-files` with:
- Public: **No** (private)
- File size limit: 50MB
- Allowed MIME types: `application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, image/*`

### Get your keys

From **Project Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon (public) key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role (secret) key

---

## 2. Environment Variables

Copy and fill in `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic (for AI extraction)
ANTHROPIC_API_KEY=sk-ant-...

# Resend (for invite emails)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=rfp@yourdomain.com

# App URL (for vendor links in emails)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 4. Workflow

### As an owner/PM:

1. **Sign up** — creates your organization workspace
2. **Create a Project** — e.g. "Burrard Landing Phase 2"
3. **Create an RFP** inside the project
   - Choose type: Consultant or GC
   - Fill in scope, instructions, due date, budget
   - Default line items are auto-created based on type
4. **Add Bidders** — email + company name
5. **Issue RFP** — click "Issue RFP" to send invite emails to all bidders
6. **Leveling Sheet** — view the bid leveling grid as proposals come in
7. **Run AI Extraction** — click to extract fees from uploaded PDFs
8. **Compare & Award** — compare bids vs budget, close bidding, mark awarded

### As a vendor/bidder:

1. Receive invite email with unique link
2. Click link → vendor portal (no login required)
3. View RFP details and scope
4. Upload proposal files (PDF, Excel, Word)
5. Enter total fee
6. Ask questions if needed
7. Submit

---

## 5. Architecture

```
src/
  app/
    (dashboard)/          # Protected pages (auth required)
      dashboard/          # Overview & stats
      projects/           # Project list & detail
        [id]/
          rfps/           # RFP management
            [rfpId]/
              leveling/   # Bid leveling grid
    vendor/[token]/       # Public vendor portal (no auth)
    api/
      auth/signup/        # Organization + user creation
      projects/           # CRUD
      rfps/               # CRUD + send invites
      recipients/         # Add bidders
      extract/            # Claude AI extraction
      leveling/
        cells/            # Save grid cell values
        line-items/       # Add/delete rows
      vendor/[token]/
        upload/           # File upload
        questions/        # Q&A
  components/
    layout/               # Sidebar navigation
    rfps/                 # Recipients panel, status actions
    leveling/             # Spreadsheet-like grid
    vendor/               # Vendor portal UI
    ui/                   # shadcn/ui primitives
  lib/
    supabase/             # Client + server Supabase clients
    utils.ts              # Formatting utilities
  types/
    database.ts           # Full schema type definitions
```

---

## 6. Key Features Implemented (Phase 1)

- [x] Multi-tenant organization architecture with RLS
- [x] Project + RFP management
- [x] Recipient management with unique secure tokens
- [x] Branded email invites via Resend
- [x] Vendor portal (no login needed)
- [x] File upload to Supabase Storage
- [x] AI extraction of fees from PDFs (Claude claude-sonnet-4-6)
- [x] Leveling grid with inline editing
- [x] Budget vs bid variance calculation
- [x] Vendor Q&A
- [x] Activity tracking
- [x] Analytics dashboard
- [x] Dashboard with live stats
