export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blast_recipients: {
        Row: {
          attempts: number
          blast_id: string
          created_at: string
          error: string | null
          id: string
          message_id: string | null
          name: string | null
          phone: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          blast_id: string
          created_at?: string
          error?: string | null
          id?: string
          message_id?: string | null
          name?: string | null
          phone: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          blast_id?: string
          created_at?: string
          error?: string | null
          id?: string
          message_id?: string | null
          name?: string | null
          phone?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blast_recipients_blast_id_fkey"
            columns: ["blast_id"]
            isOneToOne: false
            referencedRelation: "blasts"
            referencedColumns: ["id"]
          },
        ]
      }
      blasts: {
        Row: {
          attachments: Json
          channel: string
          created_at: string
          created_by: string | null
          duplicate_count: number
          failed_count: number
          id: string
          invalid_count: number
          message: string
          recipient_count: number
          recipients: Json
          send_error: string | null
          sent_at: string | null
          sent_count: number
          status: string
        }
        Insert: {
          attachments?: Json
          channel: string
          created_at?: string
          created_by?: string | null
          duplicate_count?: number
          failed_count?: number
          id?: string
          invalid_count?: number
          message: string
          recipient_count?: number
          recipients?: Json
          send_error?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
        }
        Update: {
          attachments?: Json
          channel?: string
          created_at?: string
          created_by?: string | null
          duplicate_count?: number
          failed_count?: number
          id?: string
          invalid_count?: number
          message?: string
          recipient_count?: number
          recipients?: Json
          send_error?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          connected: boolean
          contact_id: string | null
          created_at: string
          duration_seconds: number
          employee_id: string
          id: string
          outcome: string | null
          phone: string | null
        }
        Insert: {
          connected?: boolean
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number
          employee_id: string
          id?: string
          outcome?: string | null
          phone?: string | null
        }
        Update: {
          connected?: boolean
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number
          employee_id?: string
          id?: string
          outcome?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          created_by: string | null
          dataset_id: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string
          source: string | null
          status: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone: string
          source?: string | null
          status?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          dataset_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dataset_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dataset_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_assignments_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          created_by: string | null
          data_type: string
          description: string | null
          id: string
          location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_type?: string
          description?: string | null
          id?: string
          location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_type?: string
          description?: string | null
          id?: string
          location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          budget: string | null
          configuration: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          dataset_id: string | null
          follow_up_at: string | null
          id: string
          locality: string | null
          looking_for: string | null
          name: string | null
          notes: string | null
          phone: string
          stage: string
          temperature: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          budget?: string | null
          configuration?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          follow_up_at?: string | null
          id?: string
          locality?: string | null
          looking_for?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          stage?: string
          temperature?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          budget?: string | null
          configuration?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          follow_up_at?: string | null
          id?: string
          locality?: string | null
          looking_for?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          stage?: string
          temperature?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch: string | null
          created_at: string
          designation: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          locality: string | null
          name: string
          rera_number: string | null
          rera_valid_till: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          locality?: string | null
          name: string
          rera_number?: string | null
          rera_valid_till?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          locality?: string | null
          name?: string
          rera_number?: string | null
          rera_valid_till?: string | null
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          feedback: string | null
          id: string
          lead_id: string | null
          likelihood: string | null
          project: string | null
          sentiment: string | null
          status: string
          visit_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          feedback?: string | null
          id?: string
          lead_id?: string | null
          likelihood?: string | null
          project?: string | null
          sentiment?: string | null
          status?: string
          visit_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          feedback?: string | null
          id?: string
          lead_id?: string | null
          likelihood?: string | null
          project?: string | null
          sentiment?: string | null
          status?: string
          visit_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          dataset_id: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          missed_reason: string | null
          project: string | null
          status: string
          task_type: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          missed_reason?: string | null
          project?: string | null
          status?: string
          task_type?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          dataset_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          missed_reason?: string | null
          project?: string | null
          status?: string
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          access_token: string | null
          id: boolean
          is_active: boolean
          phone_number_id: string | null
          provider: string
          updated_at: string
          updated_by: string | null
          verify_token: string | null
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          id?: boolean
          is_active?: boolean
          phone_number_id?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
          verify_token?: string | null
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          id?: boolean
          is_active?: boolean
          phone_number_id?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
          verify_token?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "owner" | "supervisor" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "supervisor", "employee"],
    },
  },
} as const
