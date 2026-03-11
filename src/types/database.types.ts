export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  salim_et: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          avatar_url: string | null
          role: 'coordinator' | 'server'
          email: string | null
          is_admin: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          avatar_url?: string | null
          role?: 'coordinator' | 'server'
          email?: string | null
          is_admin?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'coordinator' | 'server'
          email?: string | null
          is_admin?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          coordinator_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          coordinator_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          coordinator_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          joined_at?: string
        }
      }
      checklist_templates: {
        Row: {
          id: string
          group_id: string
          name: string
          description: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          name: string
          description?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          description?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      checklist_sections: {
        Row: {
          id: string
          template_id: string
          name: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          name: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          name?: string
          position?: number
          created_at?: string
        }
      }
      checklist_items: {
        Row: {
          id: string
          section_id: string
          description: string
          weight: number
          position: number
          is_omittable: boolean
          created_at: string
        }
        Insert: {
          id?: string
          section_id: string
          description: string
          weight?: number
          position?: number
          is_omittable?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          description?: string
          weight?: number
          position?: number
          is_omittable?: boolean
          created_at?: string
        }
      }
      services: {
        Row: {
          id: string
          group_id: string
          date: string
          name: string | null
          notes: string | null
          status: 'scheduled' | 'in_progress' | 'completed'
          schedule_id: string | null
          is_recurring: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          date: string
          name?: string | null
          notes?: string | null
          status?: 'scheduled' | 'in_progress' | 'completed'
          schedule_id?: string | null
          is_recurring?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          date?: string
          name?: string | null
          notes?: string | null
          status?: 'scheduled' | 'in_progress' | 'completed'
          schedule_id?: string | null
          is_recurring?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      service_assignments: {
        Row: {
          id: string
          service_id: string
          user_id: string
          template_id: string | null
        }
        Insert: {
          id?: string
          service_id: string
          user_id: string
          template_id?: string | null
        }
        Update: {
          id?: string
          service_id?: string
          user_id?: string
          template_id?: string | null
        }
      }
      service_evaluations: {
        Row: {
          id: string
          service_id: string
          user_id: string
          total_score: number | null
          notes: string | null
          evaluated_by: string
          evaluated_at: string
        }
        Insert: {
          id?: string
          service_id: string
          user_id: string
          total_score?: number | null
          notes?: string | null
          evaluated_by: string
          evaluated_at?: string
        }
        Update: {
          id?: string
          service_id?: string
          user_id?: string
          total_score?: number | null
          notes?: string | null
          evaluated_by?: string
          evaluated_at?: string
        }
      }
      service_schedules: {
        Row: {
          id: string
          group_id: string
          name: string
          day_of_week: number
          start_date: string
          end_date: string | null
          is_active: boolean
          default_server_assignments: { user_id: string; template_id: string | null }[]
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          name: string
          day_of_week: number
          start_date: string
          end_date?: string | null
          is_active?: boolean
          default_server_assignments?: { user_id: string; template_id: string | null }[]
          notes?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          day_of_week?: number
          start_date?: string
          end_date?: string | null
          is_active?: boolean
          default_server_assignments?: { user_id: string; template_id: string | null }[]
          notes?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      invitations: {
        Row: {
          id: string
          group_id: string
          email: string
          invited_by: string
          status: 'pending' | 'accepted' | 'expired'
          token: string
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          group_id: string
          email: string
          invited_by: string
          status?: 'pending' | 'accepted' | 'expired'
          token: string
          created_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          group_id?: string
          email?: string
          invited_by?: string
          status?: 'pending' | 'accepted' | 'expired'
          token?: string
          created_at?: string
          expires_at?: string
        }
      }
      coordinator_invitations: {
        Row: {
          id: string
          email: string
          token: string
          invited_by: string | null
          accepted_by: string | null
          status: 'pending' | 'accepted' | 'expired'
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          token?: string
          invited_by?: string | null
          accepted_by?: string | null
          status?: 'pending' | 'accepted' | 'expired'
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          token?: string
          invited_by?: string | null
          accepted_by?: string | null
          status?: 'pending' | 'accepted' | 'expired'
          expires_at?: string
          created_at?: string
        }
      }
      evaluation_items: {
        Row: {
          id: string
          evaluation_id: string
          checklist_item_id: string
          completed: boolean
          omitted: boolean
          notes: string | null
          score: number
        }
        Insert: {
          id?: string
          evaluation_id: string
          checklist_item_id: string
          completed?: boolean
          omitted?: boolean
          notes?: string | null
          score?: number
        }
        Update: {
          id?: string
          evaluation_id?: string
          checklist_item_id?: string
          completed?: boolean
          omitted?: boolean
          notes?: string | null
          score?: number
        }
      }
      email_templates: {
        Row: {
          id: string
          name: string
          subject: string
          html_body: string
          variables: string[]
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          subject: string
          html_body: string
          variables?: string[]
          updated_at?: string
        }
        Update: {
          subject?: string
          html_body?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['salim_et']['Tables']> =
  Database['salim_et']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['salim_et']['Tables']> =
  Database['salim_et']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['salim_et']['Tables']> =
  Database['salim_et']['Tables'][T]['Update']
