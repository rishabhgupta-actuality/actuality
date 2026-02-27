export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type RfpType = "consultant" | "gc" | "other"
export type RfpStatus = "draft" | "sent" | "closed" | "awarded"
export type RecipientStatus = "invited" | "viewed" | "submitted" | "declined"
export type ProjectStatus = "active" | "archived"

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          org_id: string
          email: string
          full_name: string | null
          role: "admin" | "member" | "viewer"
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          email: string
          full_name?: string | null
          role?: "admin" | "member" | "viewer"
          created_at?: string
          updated_at?: string
        }
        Update: {
          org_id?: string
          email?: string
          full_name?: string | null
          role?: "admin" | "member" | "viewer"
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          org_id: string
          name: string
          location: string | null
          building_type: string | null
          size_sqft: number | null
          status: ProjectStatus
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          location?: string | null
          building_type?: string | null
          size_sqft?: number | null
          status?: ProjectStatus
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          location?: string | null
          building_type?: string | null
          size_sqft?: number | null
          status?: ProjectStatus
          updated_at?: string
        }
      }
      rfps: {
        Row: {
          id: string
          project_id: string
          org_id: string
          title: string
          description: string | null
          rfp_type: RfpType
          status: RfpStatus
          due_date: string | null
          questions_due: string | null
          scope_summary: string | null
          instructions: string | null
          budget_total: number | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          org_id: string
          title: string
          description?: string | null
          rfp_type?: RfpType
          status?: RfpStatus
          due_date?: string | null
          questions_due?: string | null
          scope_summary?: string | null
          instructions?: string | null
          budget_total?: number | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          rfp_type?: RfpType
          status?: RfpStatus
          due_date?: string | null
          questions_due?: string | null
          scope_summary?: string | null
          instructions?: string | null
          budget_total?: number | null
          updated_at?: string
        }
      }
      rfp_files: {
        Row: {
          id: string
          rfp_id: string
          file_name: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          rfp_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_by: string
          created_at?: string
        }
        Update: never
      }
      recipients: {
        Row: {
          id: string
          rfp_id: string
          org_id: string
          email: string
          contact_name: string | null
          company_name: string | null
          token: string
          status: RecipientStatus
          invited_at: string | null
          viewed_at: string | null
          submitted_at: string | null
          decline_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rfp_id: string
          org_id: string
          email: string
          contact_name?: string | null
          company_name?: string | null
          token: string
          status?: RecipientStatus
          invited_at?: string | null
          viewed_at?: string | null
          submitted_at?: string | null
          decline_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          contact_name?: string | null
          company_name?: string | null
          status?: RecipientStatus
          invited_at?: string | null
          viewed_at?: string | null
          submitted_at?: string | null
          decline_reason?: string | null
          updated_at?: string
        }
      }
      proposals: {
        Row: {
          id: string
          rfp_id: string
          recipient_id: string
          org_id: string
          total_fee: number | null
          currency: string
          notes: string | null
          extraction_status: "pending" | "processing" | "done" | "failed"
          extraction_error: string | null
          raw_extraction: Json | null
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rfp_id: string
          recipient_id: string
          org_id: string
          total_fee?: number | null
          currency?: string
          notes?: string | null
          extraction_status?: "pending" | "processing" | "done" | "failed"
          extraction_error?: string | null
          raw_extraction?: Json | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          total_fee?: number | null
          currency?: string
          notes?: string | null
          extraction_status?: "pending" | "processing" | "done" | "failed"
          extraction_error?: string | null
          raw_extraction?: Json | null
          submitted_at?: string | null
          updated_at?: string
        }
      }
      proposal_files: {
        Row: {
          id: string
          proposal_id: string
          file_name: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          proposal_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Update: never
      }
      line_items: {
        Row: {
          id: string
          rfp_id: string
          org_id: string
          label: string
          category: string | null
          description: string | null
          sort_order: number
          is_header: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rfp_id: string
          org_id: string
          label: string
          category?: string | null
          description?: string | null
          sort_order?: number
          is_header?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          label?: string
          category?: string | null
          description?: string | null
          sort_order?: number
          is_header?: boolean
          updated_at?: string
        }
      }
      leveling_cells: {
        Row: {
          id: string
          rfp_id: string
          line_item_id: string
          recipient_id: string | null
          org_id: string
          value: number | null
          text_value: string | null
          notes: string | null
          is_override: boolean
          source_text: string | null
          source_page: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rfp_id: string
          line_item_id: string
          recipient_id?: string | null
          org_id: string
          value?: number | null
          text_value?: string | null
          notes?: string | null
          is_override?: boolean
          source_text?: string | null
          source_page?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          value?: number | null
          text_value?: string | null
          notes?: string | null
          is_override?: boolean
          source_text?: string | null
          source_page?: number | null
          updated_at?: string
        }
      }
      vendor_questions: {
        Row: {
          id: string
          rfp_id: string
          recipient_id: string
          question: string
          answer: string | null
          is_public: boolean
          asked_at: string
          answered_at: string | null
        }
        Insert: {
          id?: string
          rfp_id: string
          recipient_id: string
          question: string
          answer?: string | null
          is_public?: boolean
          asked_at?: string
          answered_at?: string | null
        }
        Update: {
          answer?: string | null
          is_public?: boolean
          answered_at?: string | null
        }
      }
      activity_log: {
        Row: {
          id: string
          org_id: string
          rfp_id: string | null
          project_id: string | null
          user_id: string | null
          action: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          rfp_id?: string | null
          project_id?: string | null
          user_id?: string | null
          action: string
          details?: Json | null
          created_at?: string
        }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience types
export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type Rfp = Database["public"]["Tables"]["rfps"]["Row"]
export type RfpFile = Database["public"]["Tables"]["rfp_files"]["Row"]
export type Recipient = Database["public"]["Tables"]["recipients"]["Row"]
export type Proposal = Database["public"]["Tables"]["proposals"]["Row"]
export type ProposalFile = Database["public"]["Tables"]["proposal_files"]["Row"]
export type LineItem = Database["public"]["Tables"]["line_items"]["Row"]
export type LevelingCell = Database["public"]["Tables"]["leveling_cells"]["Row"]
export type VendorQuestion = Database["public"]["Tables"]["vendor_questions"]["Row"]

export type RecipientWithProposal = Recipient & {
  proposals: Proposal[]
}

export type RfpWithRecipients = Rfp & {
  recipients: RecipientWithProposal[]
  rfp_files: RfpFile[]
  line_items: LineItem[]
}

export type ProjectWithRfps = Project & {
  rfps: Rfp[]
}
