// Hand-maintained to match supabase/migrations. Regenerate with:
//   npm run db:types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'customer' | 'cafe_owner' | 'branch_manager' | 'barista' | 'admin';
export type StampRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      cafes: {
        Row: {
          id: string;
          owner_id: string;
          slug: string;
          cafe_name: string;
          contact_email: string;
          contact_phone: string;
          city: string;
          address: string;
          logo_url: string | null;
          card_primary: string;
          card_secondary: string;
          card_text: string;
          card_opacity: number;
          watermark_on: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cafes']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['cafes']['Insert']>;
      };
      branches: {
        Row: {
          id: string;
          cafe_id: string;
          name: string;
          address: string;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['branches']['Insert']>;
      };
      staff: {
        Row: {
          id: string;
          cafe_id: string;
          branch_id: string | null;
          profile_id: string;
          role: UserRole;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['staff']['Row'], 'id' | 'created_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['staff']['Insert']>;
      };
      campaigns: {
        Row: {
          id: string;
          cafe_id: string;
          name: string;
          stamps_required: number;
          reward_text: string;
          status: CampaignStatus;
          starts_at: string;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['campaigns']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>;
      };
      loyalty_cards: {
        Row: {
          id: string;
          customer_id: string;
          cafe_id: string;
          campaign_id: string;
          stamps_count: number;
          rewards_earned: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['loyalty_cards']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['loyalty_cards']['Insert']>;
      };
      stamp_requests: {
        Row: {
          id: string;
          card_id: string;
          cafe_id: string;
          branch_id: string | null;
          customer_id: string;
          status: StampRequestStatus;
          requested_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
          expires_at: string;
          note: string | null;
        };
        Insert: Omit<Database['public']['Tables']['stamp_requests']['Row'], 'id' | 'requested_at'> & {
          id?: string;
          requested_at?: string;
        };
        Update: Partial<Database['public']['Tables']['stamp_requests']['Insert']>;
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          cafe_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'created_at'> & { id?: number };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
      };
    };
    Functions: {
      create_cafe: {
        Args: {
          p_cafe_name: string;
          p_slug: string;
          p_contact_email: string;
          p_contact_phone: string;
          p_city: string;
          p_address: string;
        };
        Returns: string;
      };
      request_stamp: {
        Args: { p_cafe_slug: string; p_branch_id?: string | null };
        Returns: string;
      };
      approve_stamp: {
        Args: { p_request_id: string };
        Returns: { approved: boolean; reward_issued: boolean };
      };
      reject_stamp: {
        Args: { p_request_id: string; p_note?: string | null };
        Returns: void;
      };
    };
    Enums: {
      user_role: UserRole;
      stamp_request_status: StampRequestStatus;
      campaign_status: CampaignStatus;
    };
  };
}
