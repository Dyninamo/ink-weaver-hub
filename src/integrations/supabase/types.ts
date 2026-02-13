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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      basic_advice: {
        Row: {
          advice_text: string
          avg_precip_mm: number | null
          avg_temp: number | null
          avg_wind_mph: number | null
          created_at: string | null
          expected_rod_average: number | null
          flies_ranked: Json | null
          id: string
          latest_similar: Json | null
          methods_ranked: Json | null
          report_count: number | null
          rod_average_range: string | null
          season: string
          spots_ranked: Json | null
          temp_label: string | null
          temp_range_max: number | null
          temp_range_min: number | null
          updated_at: string | null
          venue: string
          weather_category: string
        }
        Insert: {
          advice_text: string
          avg_precip_mm?: number | null
          avg_temp?: number | null
          avg_wind_mph?: number | null
          created_at?: string | null
          expected_rod_average?: number | null
          flies_ranked?: Json | null
          id?: string
          latest_similar?: Json | null
          methods_ranked?: Json | null
          report_count?: number | null
          rod_average_range?: string | null
          season: string
          spots_ranked?: Json | null
          temp_label?: string | null
          temp_range_max?: number | null
          temp_range_min?: number | null
          updated_at?: string | null
          venue: string
          weather_category: string
        }
        Update: {
          advice_text?: string
          avg_precip_mm?: number | null
          avg_temp?: number | null
          avg_wind_mph?: number | null
          created_at?: string | null
          expected_rod_average?: number | null
          flies_ranked?: Json | null
          id?: string
          latest_similar?: Json | null
          methods_ranked?: Json | null
          report_count?: number | null
          rod_average_range?: string | null
          season?: string
          spots_ranked?: Json | null
          temp_label?: string | null
          temp_range_max?: number | null
          temp_range_min?: number | null
          updated_at?: string | null
          venue?: string
          weather_category?: string
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          arrival_time: string | null
          best_fly: string | null
          best_method: string | null
          best_spot: string | null
          competition_name: string | null
          created_at: string | null
          departure_time: string | null
          fishing_type: string | null
          flies_used: Json | null
          humidity_mean_week: number | null
          id: string
          is_competition: boolean | null
          lines_used: Json | null
          methods_used: Json | null
          notes: string | null
          photo_urls: Json | null
          precip_total_mm_week: number | null
          pressure_mean_week: number | null
          spots_fished: Json | null
          t_mean_week: number | null
          total_fish: number | null
          total_kept: number | null
          total_released: number | null
          trip_date: string
          updated_at: string | null
          user_id: string
          venue: string
          weather_auto: Json | null
          weather_override: Json | null
          wind_speed_mean_week: number | null
        }
        Insert: {
          arrival_time?: string | null
          best_fly?: string | null
          best_method?: string | null
          best_spot?: string | null
          competition_name?: string | null
          created_at?: string | null
          departure_time?: string | null
          fishing_type?: string | null
          flies_used?: Json | null
          humidity_mean_week?: number | null
          id?: string
          is_competition?: boolean | null
          lines_used?: Json | null
          methods_used?: Json | null
          notes?: string | null
          photo_urls?: Json | null
          precip_total_mm_week?: number | null
          pressure_mean_week?: number | null
          spots_fished?: Json | null
          t_mean_week?: number | null
          total_fish?: number | null
          total_kept?: number | null
          total_released?: number | null
          trip_date: string
          updated_at?: string | null
          user_id: string
          venue: string
          weather_auto?: Json | null
          weather_override?: Json | null
          wind_speed_mean_week?: number | null
        }
        Update: {
          arrival_time?: string | null
          best_fly?: string | null
          best_method?: string | null
          best_spot?: string | null
          competition_name?: string | null
          created_at?: string | null
          departure_time?: string | null
          fishing_type?: string | null
          flies_used?: Json | null
          humidity_mean_week?: number | null
          id?: string
          is_competition?: boolean | null
          lines_used?: Json | null
          methods_used?: Json | null
          notes?: string | null
          photo_urls?: Json | null
          precip_total_mm_week?: number | null
          pressure_mean_week?: number | null
          spots_fished?: Json | null
          t_mean_week?: number | null
          total_fish?: number | null
          total_kept?: number | null
          total_released?: number | null
          trip_date?: string
          updated_at?: string | null
          user_id?: string
          venue?: string
          weather_auto?: Json | null
          weather_override?: Json | null
          wind_speed_mean_week?: number | null
        }
        Relationships: []
      }
      diary_fish: {
        Row: {
          created_at: string | null
          depth: string | null
          diary_entry_id: string
          fish_number: number
          fly: string | null
          fly_colour: string | null
          fly_size: number | null
          id: string
          kept_or_released: string | null
          length_inches: number | null
          line: string | null
          method: string | null
          notes: string | null
          retrieve: string | null
          species: string | null
          spot: string | null
          time_caught: string | null
          user_id: string
          weight_lb: number | null
          weight_oz: number | null
        }
        Insert: {
          created_at?: string | null
          depth?: string | null
          diary_entry_id: string
          fish_number: number
          fly?: string | null
          fly_colour?: string | null
          fly_size?: number | null
          id?: string
          kept_or_released?: string | null
          length_inches?: number | null
          line?: string | null
          method?: string | null
          notes?: string | null
          retrieve?: string | null
          species?: string | null
          spot?: string | null
          time_caught?: string | null
          user_id: string
          weight_lb?: number | null
          weight_oz?: number | null
        }
        Update: {
          created_at?: string | null
          depth?: string | null
          diary_entry_id?: string
          fish_number?: number
          fly?: string | null
          fly_colour?: string | null
          fly_size?: number | null
          id?: string
          kept_or_released?: string | null
          length_inches?: number | null
          line?: string | null
          method?: string | null
          notes?: string | null
          retrieve?: string | null
          species?: string | null
          spot?: string | null
          time_caught?: string | null
          user_id?: string
          weight_lb?: number | null
          weight_oz?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_fish_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      fishing_reports: {
        Row: {
          best_spots: string[] | null
          created_at: string | null
          fish_killed: string | null
          fish_released: string | null
          flies: string[] | null
          headers: string | null
          humidity_mean_week: number | null
          id: string
          methods: string[] | null
          precip_total_mm_week: number | null
          pressure_mean_week: number | null
          report_date: string
          report_text: string | null
          report_url: string | null
          returns: number | null
          rod_average: number | null
          summary: string | null
          t_mean_week: number | null
          venue: string
          water_level: string | null
          water_temp_week: number | null
          weather: string[] | null
          wind_dir_deg_week: number | null
          wind_speed_mean_week: number | null
          year: number | null
        }
        Insert: {
          best_spots?: string[] | null
          created_at?: string | null
          fish_killed?: string | null
          fish_released?: string | null
          flies?: string[] | null
          headers?: string | null
          humidity_mean_week?: number | null
          id?: string
          methods?: string[] | null
          precip_total_mm_week?: number | null
          pressure_mean_week?: number | null
          report_date: string
          report_text?: string | null
          report_url?: string | null
          returns?: number | null
          rod_average?: number | null
          summary?: string | null
          t_mean_week?: number | null
          venue: string
          water_level?: string | null
          water_temp_week?: number | null
          weather?: string[] | null
          wind_dir_deg_week?: number | null
          wind_speed_mean_week?: number | null
          year?: number | null
        }
        Update: {
          best_spots?: string[] | null
          created_at?: string | null
          fish_killed?: string | null
          fish_released?: string | null
          flies?: string[] | null
          headers?: string | null
          humidity_mean_week?: number | null
          id?: string
          methods?: string[] | null
          precip_total_mm_week?: number | null
          pressure_mean_week?: number | null
          report_date?: string
          report_text?: string | null
          report_url?: string | null
          returns?: number | null
          rod_average?: number | null
          summary?: string | null
          t_mean_week?: number | null
          venue?: string
          water_level?: string | null
          water_temp_week?: number | null
          weather?: string[] | null
          wind_dir_deg_week?: number | null
          wind_speed_mean_week?: number | null
          year?: number | null
        }
        Relationships: []
      }
      queries: {
        Row: {
          advice_text: string | null
          created_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          map_image_url: string | null
          query_date: string
          recommended_locations: Json | null
          user_id: string
          venue: string
          weather_data: Json | null
        }
        Insert: {
          advice_text?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          map_image_url?: string | null
          query_date: string
          recommended_locations?: Json | null
          user_id: string
          venue: string
          weather_data?: Json | null
        }
        Update: {
          advice_text?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          map_image_url?: string | null
          query_date?: string
          recommended_locations?: Json | null
          user_id?: string
          venue?: string
          weather_data?: Json | null
        }
        Relationships: []
      }
      share_views: {
        Row: {
          id: string
          shared_report_id: string
          viewed_at: string | null
          viewer_email: string | null
          viewer_ip: string | null
        }
        Insert: {
          id?: string
          shared_report_id: string
          viewed_at?: string | null
          viewer_email?: string | null
          viewer_ip?: string | null
        }
        Update: {
          id?: string
          shared_report_id?: string
          viewed_at?: string | null
          viewer_email?: string | null
          viewer_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_views_shared_report_id_fkey"
            columns: ["shared_report_id"]
            isOneToOne: false
            referencedRelation: "shared_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_reports: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          query_id: string
          share_token: string
          short_url: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          query_id: string
          share_token: string
          short_url?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          query_id?: string
          share_token?: string
          short_url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_reports_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "queries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          id: string
          mobile_number: string | null
          mobile_verified: boolean | null
          two_factor_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          id: string
          mobile_number?: string | null
          mobile_verified?: boolean | null
          two_factor_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mobile_number?: string | null
          mobile_verified?: boolean | null
          two_factor_enabled?: boolean | null
        }
        Relationships: []
      }
      venue_metadata: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          mobile_number: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          mobile_number: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          mobile_number?: string
          user_id?: string
          verified?: boolean | null
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
