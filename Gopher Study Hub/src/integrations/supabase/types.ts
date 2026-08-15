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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      courses: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          id: string
          is_active: boolean
          name: string
          number: string
          university_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: string
          id?: string
          is_active?: boolean
          name: string
          number: string
          university_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          id?: string
          is_active?: boolean
          name?: string
          number?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invited_user_id: string
          inviter_id: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invited_user_id: string
          inviter_id: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invited_user_id?: string
          inviter_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          sender_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string
          group_id: string
          id: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetup_attendance: {
        Row: {
          id: string
          meetup_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          meetup_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          meetup_id?: string
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetup_attendance_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetup_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          cancellation_reason: string | null
          cancelled: boolean
          created_at: string
          creator_id: string | null
          format: Database["public"]["Enums"]["meetup_format"]
          group_id: string
          id: string
          location: string | null
          meeting_link: string | null
          scheduled_at: string
          title: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled?: boolean
          created_at?: string
          creator_id?: string | null
          format: Database["public"]["Enums"]["meetup_format"]
          group_id: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          scheduled_at: string
          title: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled?: boolean
          created_at?: string
          creator_id?: string | null
          format?: Database["public"]["Enums"]["meetup_format"]
          group_id?: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          scheduled_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetups_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          buddy_available: boolean
          college: string | null
          created_at: string
          display_name: string | null
          email: string
          graduation_month: number | null
          graduation_year: number | null
          id: string
          is_admin: boolean
          last_login_at: string | null
          major: string | null
          onboarded_at: string | null
          privacy: Json
          social_links: Json
          status: Database["public"]["Enums"]["account_status"]
          university_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          buddy_available?: boolean
          college?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          graduation_month?: number | null
          graduation_year?: number | null
          id: string
          is_admin?: boolean
          last_login_at?: string | null
          major?: string | null
          onboarded_at?: string | null
          privacy?: Json
          social_links?: Json
          status?: Database["public"]["Enums"]["account_status"]
          university_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          buddy_available?: boolean
          college?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          graduation_month?: number | null
          graduation_year?: number | null
          id?: string
          is_admin?: boolean
          last_login_at?: string | null
          major?: string | null
          onboarded_at?: string | null
          privacy?: Json
          social_links?: Json
          status?: Database["public"]["Enums"]["account_status"]
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          capacity: number
          course_id: string
          created_at: string
          id: string
          last_activity_at: string
          manager_id: string | null
          member_count: number
          mode: Database["public"]["Enums"]["group_mode"]
          name: string
          status: Database["public"]["Enums"]["group_status"]
          updated_at: string
        }
        Insert: {
          capacity?: number
          course_id: string
          created_at?: string
          id?: string
          last_activity_at?: string
          manager_id?: string | null
          member_count?: number
          mode?: Database["public"]["Enums"]["group_mode"]
          name: string
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Update: {
          capacity?: number
          course_id?: string
          created_at?: string
          id?: string
          last_activity_at?: string
          manager_id?: string | null
          member_count?: number
          mode?: Database["public"]["Enums"]["group_mode"]
          name?: string
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_groups_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          created_at: string
          email_domain: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          email_domain: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          email_domain?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      user_courses: {
        Row: {
          course_id: string
          created_at: string
          enrollment: Database["public"]["Enums"]["enrollment_type"]
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          enrollment?: Database["public"]["Enums"]["enrollment_type"]
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          enrollment?: Database["public"]["Enums"]["enrollment_type"]
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_successor: { Args: { _group: string }; Returns: undefined }
      cancel_meetup: {
        Args: { _meetup: string; _reason: string }
        Returns: undefined
      }
      create_meetup: {
        Args: {
          _at: string
          _format: Database["public"]["Enums"]["meetup_format"]
          _group: string
          _link: string
          _location: string
          _title: string
        }
        Returns: string
      }
      create_study_group: {
        Args: {
          _capacity: number
          _course: string
          _invitees?: string[]
          _mode: Database["public"]["Enums"]["group_mode"]
          _name: string
        }
        Returns: string
      }
      decide_join_request: {
        Args: { _approve: boolean; _request: string }
        Returns: undefined
      }
      disband_group: { Args: { _group: string }; Returns: undefined }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      join_or_request_group: { Args: { _group: string }; Returns: string }
      leave_group: { Args: { _group: string }; Returns: undefined }
      notify: {
        Args: { _payload: Json; _type: string; _user: string }
        Returns: undefined
      }
      post_group_message: {
        Args: { _content: string; _group: string }
        Returns: string
      }
      remove_member: {
        Args: { _group: string; _member: string }
        Returns: undefined
      }
      rename_group: {
        Args: { _group: string; _name: string }
        Returns: undefined
      }
      respond_invitation: {
        Args: { _accept: boolean; _invitation: string }
        Returns: undefined
      }
      set_group_mode: {
        Args: {
          _group: string
          _mode: Database["public"]["Enums"]["group_mode"]
        }
        Returns: number
      }
      set_rsvp: {
        Args: {
          _meetup: string
          _status: Database["public"]["Enums"]["rsvp_status"]
        }
        Returns: undefined
      }
      upsert_course: {
        Args: { _department: string; _name: string; _number: string }
        Returns: string
      }
      withdraw_join_request: { Args: { _group: string }; Returns: undefined }
    }
    Enums: {
      account_status: "active" | "suspended" | "banned"
      enrollment_type: "current" | "taken" | "future"
      group_mode: "open" | "closed"
      group_status: "active" | "inactive" | "archived" | "disbanded"
      meetup_format: "online" | "in_person"
      request_status:
        | "pending"
        | "approved"
        | "denied"
        | "withdrawn"
        | "cancelled"
        | "accepted"
        | "declined"
      rsvp_status: "attending" | "maybe" | "not_attending"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      account_status: ["active", "suspended", "banned"],
      enrollment_type: ["current", "taken", "future"],
      group_mode: ["open", "closed"],
      group_status: ["active", "inactive", "archived", "disbanded"],
      meetup_format: ["online", "in_person"],
      request_status: [
        "pending",
        "approved",
        "denied",
        "withdrawn",
        "cancelled",
        "accepted",
        "declined",
      ],
      rsvp_status: ["attending", "maybe", "not_attending"],
    },
  },
} as const
