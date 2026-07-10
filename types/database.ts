export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          role: string;
          age: number | null;
          gender: string | null;
          country: string | null;
          bio: string | null;
          avatar_url: string | null;
          mood_baseline: string | null;
          mood_baseline_details: string | null;
          goals: string[] | null;
          language: string | null;
          mood_reminder_enabled: boolean;
          mood_reminder_time: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relation: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          two_factor_enabled: boolean;
          two_factor_secret: string | null;
          two_factor_skipped: boolean | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          role?: string;
          age?: number | null;
          gender?: string | null;
          country?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          mood_baseline?: string | null;
          mood_baseline_details?: string | null;
          goals?: string[] | null;
          language?: string | null;
          mood_reminder_enabled?: boolean;
          mood_reminder_time?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          two_factor_enabled?: boolean;
          two_factor_secret?: string | null;
          two_factor_skipped?: boolean | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          role?: string;
          age?: number | null;
          gender?: string | null;
          country?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          mood_baseline?: string | null;
          mood_baseline_details?: string | null;
          goals?: string[] | null;
          language?: string | null;
          mood_reminder_enabled?: boolean;
          mood_reminder_time?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          two_factor_enabled?: boolean;
          two_factor_secret?: string | null;
          two_factor_skipped?: boolean | null;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          counselor_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          counselor_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          counselor_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          is_read?: boolean;
          created_at?: string;
        };
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          content: string | null;
          mood: string | null;
          emotions: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          content?: string | null;
          mood?: string | null;
          emotions?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          content?: string | null;
          mood?: string | null;
          emotions?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      distress_logs: {
        Row: {
          id: string;
          user_id: string;
          severity: string | null;
          trigger: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          severity?: string | null;
          trigger?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          severity?: string | null;
          trigger?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          admin_id: string | null;
          action: string | null;
          target_id: string | null;
          target_type: string | null;
          details: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id?: string | null;
          action?: string | null;
          target_id?: string | null;
          target_type?: string | null;
          details?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string | null;
          action?: string | null;
          target_id?: string | null;
          target_type?: string | null;
          details?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
      system_settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          updated_at?: string;
        };
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          content: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
