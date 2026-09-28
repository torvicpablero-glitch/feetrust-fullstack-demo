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
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          role: 'Customer' | 'Worker' | 'Business' | 'Admin';
          avatar_url: string | null;
          level: number;
          gems: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          name: string;
          role?: 'Customer' | 'Worker' | 'Business' | 'Admin';
          avatar_url?: string | null;
          level?: number;
          gems?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          name?: string;
          role?: 'Customer' | 'Worker' | 'Business' | 'Admin';
          avatar_url?: string | null;
          level?: number;
          gems?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: string | null;
          position: string | null;
          workplace: string | null;
          level: number;
          gems: number;
          merits_given: number;
          merits_received: number;
          is_available: boolean;
          avatar: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role?: string | null;
          position?: string | null;
          workplace?: string | null;
          level?: number;
          gems?: number;
          merits_given?: number;
          merits_received?: number;
          is_available?: boolean;
          avatar?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: string | null;
          position?: string | null;
          workplace?: string | null;
          level?: number;
          gems?: number;
          merits_given?: number;
          merits_received?: number;
          is_available?: boolean;
          avatar?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workers: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          position: string;
          category: string;
          workplace: string;
          level: number;
          initials: string;
          lat: number;
          lng: number;
          role: string;
          is_available: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id?: string | null;
          name: string;
          position: string;
          category?: string;
          workplace: string;
          level?: number;
          initials: string;
          lat: number;
          lng: number;
          role?: string;
          is_available?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          position?: string;
          category?: string;
          workplace?: string;
          level?: number;
          initials?: string;
          lat?: number;
          lng?: number;
          role?: string;
          is_available?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workers_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          category: string;
          address: string;
          rating: number;
          qr_code_url: string | null;
          lat: number | null;
          lng: number | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          category: string;
          address: string;
          rating?: number;
          qr_code_url?: string | null;
          lat?: number | null;
          lng?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          address?: string;
          rating?: number;
          qr_code_url?: string | null;
          lat?: number | null;
          lng?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          from_user_id: string;
          from_user_name: string;
          to_user_id: string;
          merit_type: string;
          tip_amount: number;
          review_text: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          from_user_id: string;
          from_user_name: string;
          to_user_id: string;
          merit_type: string;
          tip_amount?: number;
          review_text?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          from_user_id?: string;
          from_user_name?: string;
          to_user_id?: string;
          merit_type?: string;
          tip_amount?: number;
          review_text?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      activity_feed: {
        Row: {
          id: string;
          from_user_name: string;
          to_worker_name: string;
          business_name: string;
          merit_type: string;
          tip_amount: number;
          time_ago: string;
          created_at: string;
        };
        Insert: {
          id: string;
          from_user_name: string;
          to_worker_name: string;
          business_name: string;
          merit_type: string;
          tip_amount?: number;
          time_ago?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          from_user_name?: string;
          to_worker_name?: string;
          business_name?: string;
          merit_type?: string;
          tip_amount?: number;
          time_ago?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      thank_you_notes: {
        Row: {
          id: string;
          review_id: string | null;
          from_worker_name: string;
          to_user_name: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id: string;
          review_id?: string | null;
          from_worker_name: string;
          to_user_name: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string | null;
          from_worker_name?: string;
          to_user_name?: string;
          message?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thank_you_notes_review_id_fkey";
            columns: ["review_id"];
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          }
        ];
      };
      user_coupons: {
        Row: {
          id: string;
          user_id: string;
          coupon_id: string;
          code: string;
          gems_awarded: number;
          claimed_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          coupon_id: string;
          code: string;
          gems_awarded?: number;
          claimed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          coupon_id?: string;
          code?: string;
          gems_awarded?: number;
          claimed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
