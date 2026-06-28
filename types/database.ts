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
          full_name: string | null;
          email: string | null;
          role: string;
          created_at: string;
          two_factor_enabled: boolean;
          two_factor_secret: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
          created_at?: string;
          two_factor_enabled?: boolean;
          two_factor_secret?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
          created_at?: string;
          two_factor_enabled?: boolean;
          two_factor_secret?: string | null;
        };
      };
    };
  };
}
