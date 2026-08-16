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
          sex: string | null;
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
          is_online: boolean;
          created_at: string;
          updated_at: string;
          two_factor_enabled: boolean;
          two_factor_secret: string | null;
          two_factor_skipped: boolean | null;
          assigned_counselor_id: string | null;
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
          sex?: string | null;
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
          is_online?: boolean;
          created_at?: string;
          updated_at?: string;
          two_factor_enabled?: boolean;
          two_factor_secret?: string | null;
          two_factor_skipped?: boolean | null;
          assigned_counselor_id?: string | null;
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
          sex?: string | null;
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
          is_online?: boolean;
          created_at?: string;
          updated_at?: string;
          two_factor_enabled?: boolean;
          two_factor_secret?: string | null;
          two_factor_skipped?: boolean | null;
          assigned_counselor_id?: string | null;
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
          sentiment: string | null;
          sentiment_score: number | null;
          positive_percentage: number | null;
          negative_percentage: number | null;
          distress_percentage: number | null;
          confidence: number | null;
          sentiment_model: string | null;
          sentiment_raw: Json | null;
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
          sentiment?: string | null;
          sentiment_score?: number | null;
          positive_percentage?: number | null;
          negative_percentage?: number | null;
          distress_percentage?: number | null;
          confidence?: number | null;
          sentiment_model?: string | null;
          sentiment_raw?: Json | null;
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
          sentiment?: string | null;
          sentiment_score?: number | null;
          positive_percentage?: number | null;
          negative_percentage?: number | null;
          distress_percentage?: number | null;
          confidence?: number | null;
          sentiment_model?: string | null;
          sentiment_raw?: Json | null;
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
      behavioral_indicators: {
        Row: {
          id: string;
          user_id: string;
          window_end_date: string;
          lookback_days: number;
          behavioral_trend_score: number;
          behavioral_trend_details: Json | null;
          journaling_frequency_score: number;
          total_entries_window: number;
          unique_days_journaled: number;
          journaling_frequency_details: Json | null;
          mood_consistency_score: number;
          sentiment_scores_variance: number | null;
          sentiment_scores_std: number | null;
          mood_consistency_details: Json | null;
          consecutive_negative_count: number;
          consecutive_negative_streak: Json | null;
          entries_analyzed: number;
          computed_at: string;
          updated_at: string;
          wellness_score: number | null;
          wellness_level: string | null;
          wellness_score_details: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          window_end_date: string;
          lookback_days?: number;
          behavioral_trend_score?: number;
          behavioral_trend_details?: Json | null;
          journaling_frequency_score?: number;
          total_entries_window?: number;
          unique_days_journaled?: number;
          journaling_frequency_details?: Json | null;
          mood_consistency_score?: number;
          sentiment_scores_variance?: number | null;
          sentiment_scores_std?: number | null;
          mood_consistency_details?: Json | null;
          consecutive_negative_count?: number;
          consecutive_negative_streak?: Json | null;
          entries_analyzed?: number;
          computed_at?: string;
          updated_at?: string;
          wellness_score?: number | null;
          wellness_level?: string | null;
          wellness_score_details?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          window_end_date?: string;
          lookback_days?: number;
          behavioral_trend_score?: number;
          behavioral_trend_details?: Json | null;
          journaling_frequency_score?: number;
          total_entries_window?: number;
          unique_days_journaled?: number;
          journaling_frequency_details?: Json | null;
          mood_consistency_score?: number;
          sentiment_scores_variance?: number | null;
          sentiment_scores_std?: number | null;
          mood_consistency_details?: Json | null;
          consecutive_negative_count?: number;
          consecutive_negative_streak?: Json | null;
          entries_analyzed?: number;
          computed_at?: string;
          updated_at?: string;
          wellness_score?: number | null;
          wellness_level?: string | null;
          wellness_score_details?: Json | null;
        };
      };
    };
      distress_risk_assessments: {
        Row: {
          id: string;
          user_id: string;
          assessed_date: string;
          lookback_days: number;
          risk_level: string;
          total_points: number;
          latest_sentiment: string | null;
          behavioral_trend_score: number | null;
          consecutive_negative_count: number | null;
          wellness_score: number | null;
          total_entries_window: number | null;
          distress_entries_window: number | null;
          condition_results: Json | null;
          assessment_details: Json | null;
          assessed_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          assessed_date: string;
          lookback_days?: number;
          risk_level: string;
          total_points?: number;
          latest_sentiment?: string | null;
          behavioral_trend_score?: number | null;
          consecutive_negative_count?: number | null;
          wellness_score?: number | null;
          total_entries_window?: number | null;
          distress_entries_window?: number | null;
          condition_results?: Json | null;
          assessment_details?: Json | null;
          assessed_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          assessed_date?: string;
          lookback_days?: number;
          risk_level?: string;
          total_points?: number;
          latest_sentiment?: string | null;
          behavioral_trend_score?: number | null;
          consecutive_negative_count?: number | null;
          wellness_score?: number | null;
          total_entries_window?: number | null;
          distress_entries_window?: number | null;
          condition_results?: Json | null;
          assessment_details?: Json | null;
          assessed_at?: string;
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
