-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table projects (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  location text,
  building_type text,
  size_sqft numeric,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_projects_org_id on projects(org_id);

-- ============================================================
-- RFPS
-- ============================================================
create table rfps (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  rfp_type text not null default 'consultant' check (rfp_type in ('consultant', 'gc', 'other')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'closed', 'awarded')),
  due_date date,
  questions_due date,
  scope_summary text,
  instructions text,
  budget_total numeric,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_rfps_project_id on rfps(project_id);
create index idx_rfps_org_id on rfps(org_id);

-- ============================================================
-- RFP FILES (issuer-uploaded documents)
-- ============================================================
create table rfp_files (
  id uuid primary key default uuid_generate_v4(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz default now() not null
);

create index idx_rfp_files_rfp_id on rfp_files(rfp_id);

-- ============================================================
-- RECIPIENTS (vendors invited to bid)
-- ============================================================
create table recipients (
  id uuid primary key default uuid_generate_v4(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  contact_name text,
  company_name text,
  token text not null unique,
  status text not null default 'invited' check (status in ('invited', 'viewed', 'submitted', 'declined')),
  invited_at timestamptz,
  viewed_at timestamptz,
  submitted_at timestamptz,
  decline_reason text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_recipients_rfp_id on recipients(rfp_id);
create index idx_recipients_token on recipients(token);
create unique index idx_recipients_rfp_email on recipients(rfp_id, email);

-- ============================================================
-- PROPOSALS
-- ============================================================
create table proposals (
  id uuid primary key default uuid_generate_v4(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  recipient_id uuid not null references recipients(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  total_fee numeric,
  currency text not null default 'CAD',
  notes text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'processing', 'done', 'failed')),
  extraction_error text,
  raw_extraction jsonb,
  submitted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_proposals_rfp_id on proposals(rfp_id);
create index idx_proposals_recipient_id on proposals(recipient_id);

-- ============================================================
-- PROPOSAL FILES (vendor-uploaded documents)
-- ============================================================
create table proposal_files (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz default now() not null
);

create index idx_proposal_files_proposal_id on proposal_files(proposal_id);

-- ============================================================
-- LINE ITEMS (leveling table rows)
-- ============================================================
create table line_items (
  id uuid primary key default uuid_generate_v4(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  category text,
  description text,
  sort_order integer not null default 0,
  is_header boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_line_items_rfp_id on line_items(rfp_id);

-- ============================================================
-- LEVELING CELLS (grid values)
-- recipient_id = null → budget column
-- ============================================================
create table leveling_cells (
  id uuid primary key default uuid_generate_v4(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  line_item_id uuid not null references line_items(id) on delete cascade,
  recipient_id uuid references recipients(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  value numeric,
  text_value text,
  notes text,
  is_override boolean not null default false,
  source_text text,
  source_page integer,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (line_item_id, recipient_id)
);

create index idx_leveling_cells_rfp_id on leveling_cells(rfp_id);
create index idx_leveling_cells_line_item_id on leveling_cells(line_item_id);

-- ============================================================
-- VENDOR QUESTIONS
-- ============================================================
create table vendor_questions (
  id uuid primary key default uuid_generate_v4(),
  rfp_id uuid not null references rfps(id) on delete cascade,
  recipient_id uuid not null references recipients(id) on delete cascade,
  question text not null,
  answer text,
  is_public boolean not null default false,
  asked_at timestamptz default now() not null,
  answered_at timestamptz
);

create index idx_vendor_questions_rfp_id on vendor_questions(rfp_id);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  rfp_id uuid references rfps(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz default now() not null
);

create index idx_activity_log_org_id on activity_log(org_id);
create index idx_activity_log_rfp_id on activity_log(rfp_id);

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_organizations_updated_at before update on organizations for each row execute function update_updated_at();
create trigger trg_profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger trg_projects_updated_at before update on projects for each row execute function update_updated_at();
create trigger trg_rfps_updated_at before update on rfps for each row execute function update_updated_at();
create trigger trg_recipients_updated_at before update on recipients for each row execute function update_updated_at();
create trigger trg_proposals_updated_at before update on proposals for each row execute function update_updated_at();
create trigger trg_line_items_updated_at before update on line_items for each row execute function update_updated_at();
create trigger trg_leveling_cells_updated_at before update on leveling_cells for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table projects enable row level security;
alter table rfps enable row level security;
alter table rfp_files enable row level security;
alter table recipients enable row level security;
alter table proposals enable row level security;
alter table proposal_files enable row level security;
alter table line_items enable row level security;
alter table leveling_cells enable row level security;
alter table vendor_questions enable row level security;
alter table activity_log enable row level security;

-- Helper: get the org_id for the current user
create or replace function get_my_org_id()
returns uuid as $$
  select org_id from profiles where id = auth.uid()
$$ language sql security definer;

-- Organizations: users see their own org
create policy "org_select" on organizations for select using (id = get_my_org_id());

-- Profiles: users see profiles in their org
create policy "profiles_select" on profiles for select using (org_id = get_my_org_id());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- Projects: org-scoped
create policy "projects_select" on projects for select using (org_id = get_my_org_id());
create policy "projects_insert" on projects for insert with check (org_id = get_my_org_id());
create policy "projects_update" on projects for update using (org_id = get_my_org_id());
create policy "projects_delete" on projects for delete using (org_id = get_my_org_id() and created_by = auth.uid());

-- RFPs: org-scoped
create policy "rfps_select" on rfps for select using (org_id = get_my_org_id());
create policy "rfps_insert" on rfps for insert with check (org_id = get_my_org_id());
create policy "rfps_update" on rfps for update using (org_id = get_my_org_id());
create policy "rfps_delete" on rfps for delete using (org_id = get_my_org_id());

-- RFP files: org-scoped
create policy "rfp_files_select" on rfp_files for select using (
  rfp_id in (select id from rfps where org_id = get_my_org_id())
);
create policy "rfp_files_insert" on rfp_files for insert with check (
  rfp_id in (select id from rfps where org_id = get_my_org_id())
);

-- Recipients: org-scoped
create policy "recipients_select" on recipients for select using (org_id = get_my_org_id());
create policy "recipients_insert" on recipients for insert with check (org_id = get_my_org_id());
create policy "recipients_update" on recipients for update using (org_id = get_my_org_id());
create policy "recipients_delete" on recipients for delete using (org_id = get_my_org_id());

-- Proposals: org-scoped
create policy "proposals_select" on proposals for select using (org_id = get_my_org_id());
create policy "proposals_insert" on proposals for insert with check (org_id = get_my_org_id());
create policy "proposals_update" on proposals for update using (org_id = get_my_org_id());

-- Proposal files: via org
create policy "proposal_files_select" on proposal_files for select using (
  proposal_id in (select id from proposals where org_id = get_my_org_id())
);

-- Line items: org-scoped
create policy "line_items_select" on line_items for select using (org_id = get_my_org_id());
create policy "line_items_insert" on line_items for insert with check (org_id = get_my_org_id());
create policy "line_items_update" on line_items for update using (org_id = get_my_org_id());
create policy "line_items_delete" on line_items for delete using (org_id = get_my_org_id());

-- Leveling cells: org-scoped
create policy "leveling_cells_select" on leveling_cells for select using (org_id = get_my_org_id());
create policy "leveling_cells_insert" on leveling_cells for insert with check (org_id = get_my_org_id());
create policy "leveling_cells_update" on leveling_cells for update using (org_id = get_my_org_id());
create policy "leveling_cells_delete" on leveling_cells for delete using (org_id = get_my_org_id());

-- Vendor questions: org-scoped for issuers
create policy "vendor_questions_select" on vendor_questions for select using (
  rfp_id in (select id from rfps where org_id = get_my_org_id())
);
create policy "vendor_questions_update" on vendor_questions for update using (
  rfp_id in (select id from rfps where org_id = get_my_org_id())
);

-- Activity log: org-scoped
create policy "activity_log_select" on activity_log for select using (org_id = get_my_org_id());
create policy "activity_log_insert" on activity_log for insert with check (org_id = get_my_org_id());

-- ============================================================
-- VENDOR ACCESS (service role bypass for vendor portal API)
-- These are handled via API routes using service role key
-- ============================================================
