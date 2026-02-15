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
      prediction_params: {
        Row: {
          last_validated: string | null
          source: string
          target: string
          top_n: number
          use_cross_venue: number
          venue: string
          venue_weight: number
          w_humidity: number
          w_precipitation: number
          w_pressure: number
          w_temperature: number
          w_wind_speed: number
          week_window: number
          year_decay: number
        }
        Insert: {
          last_validated?: string | null
          source?: string
          target: string
          top_n?: number
          use_cross_venue?: number
          venue: string
          venue_weight?: number
          w_humidity?: number
          w_precipitation?: number
          w_pressure?: number
          w_temperature?: number
          w_wind_speed?: number
          week_window?: number
          year_decay?: number
        }
        Update: {
          last_validated?: string | null
          source?: string
          target?: string
          top_n?: number
          use_cross_venue?: number
          venue?: string
          venue_weight?: number
          w_humidity?: number
          w_precipitation?: number
          w_pressure?: number
          w_temperature?: number
          w_wind_speed?: number
          week_window?: number
          year_decay?: number
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
      ref_colours: {
        Row: {
          colour: string | null
          created_at: string | null
          id: number
          mentions_in_671_reports: string | null
          your_notes: string | null
        }
        Insert: {
          colour?: string | null
          created_at?: string | null
          id?: number
          mentions_in_671_reports?: string | null
          your_notes?: string | null
        }
        Update: {
          colour?: string | null
          created_at?: string | null
          id?: number
          mentions_in_671_reports?: string | null
          your_notes?: string | null
        }
        Relationships: []
      }
      ref_depths: {
        Row: {
          created_at: string | null
          depth: string | null
          id: number
          mentions_in_671_reports: string | null
          your_notes: string | null
        }
        Insert: {
          created_at?: string | null
          depth?: string | null
          id?: number
          mentions_in_671_reports?: string | null
          your_notes?: string | null
        }
        Update: {
          created_at?: string | null
          depth?: string | null
          id?: number
          mentions_in_671_reports?: string | null
          your_notes?: string | null
        }
        Relationships: []
      }
      ref_flies: {
        Row: {
          box_location: string | null
          confidence_rating: string | null
          created_at: string | null
          hook_size_max: string | null
          hook_size_min: string | null
          id: number
          imitation: string | null
          life_stage: string | null
          materials_summary: string | null
          pattern_name: string | null
          primary_colours: string | null
          season_notes: string | null
          sub_category: string | null
          tactics_notes: string | null
          top_category: string | null
          water_type: string | null
          weight_buoyancy: string | null
        }
        Insert: {
          box_location?: string | null
          confidence_rating?: string | null
          created_at?: string | null
          hook_size_max?: string | null
          hook_size_min?: string | null
          id?: number
          imitation?: string | null
          life_stage?: string | null
          materials_summary?: string | null
          pattern_name?: string | null
          primary_colours?: string | null
          season_notes?: string | null
          sub_category?: string | null
          tactics_notes?: string | null
          top_category?: string | null
          water_type?: string | null
          weight_buoyancy?: string | null
        }
        Update: {
          box_location?: string | null
          confidence_rating?: string | null
          created_at?: string | null
          hook_size_max?: string | null
          hook_size_min?: string | null
          id?: number
          imitation?: string | null
          life_stage?: string | null
          materials_summary?: string | null
          pattern_name?: string | null
          primary_colours?: string | null
          season_notes?: string | null
          sub_category?: string | null
          tactics_notes?: string | null
          top_category?: string | null
          water_type?: string | null
          weight_buoyancy?: string | null
        }
        Relationships: []
      }
      ref_hook_sizes: {
        Row: {
          created_at: string | null
          hook_size: string | null
          id: number
        }
        Insert: {
          created_at?: string | null
          hook_size?: string | null
          id?: number
        }
        Update: {
          created_at?: string | null
          hook_size?: string | null
          id?: number
        }
        Relationships: []
      }
      ref_lines: {
        Row: {
          buoyancy: string | null
          created_at: string | null
          description: string | null
          id: number
          line_family: string | null
          line_type_code: string | null
          line_weight_label: string | null
          sink_rate_ips: string | null
          typical_usage: string | null
          typical_weight_max_wt: string | null
          typical_weight_min_wt: string | null
        }
        Insert: {
          buoyancy?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          line_family?: string | null
          line_type_code?: string | null
          line_weight_label?: string | null
          sink_rate_ips?: string | null
          typical_usage?: string | null
          typical_weight_max_wt?: string | null
          typical_weight_min_wt?: string | null
        }
        Update: {
          buoyancy?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          line_family?: string | null
          line_type_code?: string | null
          line_weight_label?: string | null
          sink_rate_ips?: string | null
          typical_usage?: string | null
          typical_weight_max_wt?: string | null
          typical_weight_min_wt?: string | null
        }
        Relationships: []
      }
      ref_lines_from_reports: {
        Row: {
          created_at: string | null
          id: number
          line_type: string | null
          mentions_in_671_reports: string | null
          sink_rate: string | null
          your_notes: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          line_type?: string | null
          mentions_in_671_reports?: string | null
          sink_rate?: string | null
          your_notes?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          line_type?: string | null
          mentions_in_671_reports?: string | null
          sink_rate?: string | null
          your_notes?: string | null
        }
        Relationships: []
      }
      ref_retrieves: {
        Row: {
          created_at: string | null
          depth_zone: string | null
          description: string | null
          id: number
          pace: string | null
          retrieve_name: string | null
          rod_position: string | null
          style: string | null
          typical_line: string | null
          water_type: string | null
          when_to_use: string | null
        }
        Insert: {
          created_at?: string | null
          depth_zone?: string | null
          description?: string | null
          id?: number
          pace?: string | null
          retrieve_name?: string | null
          rod_position?: string | null
          style?: string | null
          typical_line?: string | null
          water_type?: string | null
          when_to_use?: string | null
        }
        Update: {
          created_at?: string | null
          depth_zone?: string | null
          description?: string | null
          id?: number
          pace?: string | null
          retrieve_name?: string | null
          rod_position?: string | null
          style?: string | null
          typical_line?: string | null
          water_type?: string | null
          when_to_use?: string | null
        }
        Relationships: []
      }
      ref_rigs: {
        Row: {
          created_at: string | null
          depth_zone: string | null
          description: string | null
          dropper_count: string | null
          flies_on_rig: string | null
          id: number
          leader_length_ft: string | null
          point_fly_role: string | null
          rig_name: string | null
          style: string | null
          tippet_strength_lb: string | null
          typical_dropper_flies: string | null
          typical_point_flies: string | null
          water_type: string | null
        }
        Insert: {
          created_at?: string | null
          depth_zone?: string | null
          description?: string | null
          dropper_count?: string | null
          flies_on_rig?: string | null
          id?: number
          leader_length_ft?: string | null
          point_fly_role?: string | null
          rig_name?: string | null
          style?: string | null
          tippet_strength_lb?: string | null
          typical_dropper_flies?: string | null
          typical_point_flies?: string | null
          water_type?: string | null
        }
        Update: {
          created_at?: string | null
          depth_zone?: string | null
          description?: string | null
          dropper_count?: string | null
          flies_on_rig?: string | null
          id?: number
          leader_length_ft?: string | null
          point_fly_role?: string | null
          rig_name?: string | null
          style?: string | null
          tippet_strength_lb?: string | null
          typical_dropper_flies?: string | null
          typical_point_flies?: string | null
          water_type?: string | null
        }
        Relationships: []
      }
      reference_data: {
        Row: {
          category: string
          id: string
          usage_count: number | null
          value: string
          venue: string | null
        }
        Insert: {
          category: string
          id?: string
          usage_count?: number | null
          value: string
          venue?: string | null
        }
        Update: {
          category?: string
          id?: string
          usage_count?: number | null
          value?: string
          venue?: string | null
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
      venue_correlations: {
        Row: {
          correlation: number | null
          fly_overlap_jaccard: number | null
          last_updated: string
          metric: string
          notes: string | null
          venue_a: string
          venue_b: string
        }
        Insert: {
          correlation?: number | null
          fly_overlap_jaccard?: number | null
          last_updated: string
          metric?: string
          notes?: string | null
          venue_a: string
          venue_b: string
        }
        Update: {
          correlation?: number | null
          fly_overlap_jaccard?: number | null
          last_updated?: string
          metric?: string
          notes?: string | null
          venue_a?: string
          venue_b?: string
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
      venue_profiles: {
        Row: {
          character_notes: string | null
          cross_venue_rule: string
          cross_venue_warnings: string | null
          data_quality_flag: string
          date_range_end: string | null
          date_range_start: string | null
          flies_recall_at5: number | null
          last_updated: string
          methods_recall_at4: number | null
          region: string
          report_count: number
          rod_avg_mean: number | null
          rod_avg_std: number | null
          rod_mae: number | null
          rod_mae_ci_hi: number | null
          rod_mae_ci_lo: number | null
          seasonal_pattern_json: string | null
          spots_recall_at4: number | null
          temp_correlation: number | null
          venue: string
        }
        Insert: {
          character_notes?: string | null
          cross_venue_rule?: string
          cross_venue_warnings?: string | null
          data_quality_flag?: string
          date_range_end?: string | null
          date_range_start?: string | null
          flies_recall_at5?: number | null
          last_updated: string
          methods_recall_at4?: number | null
          region: string
          report_count: number
          rod_avg_mean?: number | null
          rod_avg_std?: number | null
          rod_mae?: number | null
          rod_mae_ci_hi?: number | null
          rod_mae_ci_lo?: number | null
          seasonal_pattern_json?: string | null
          spots_recall_at4?: number | null
          temp_correlation?: number | null
          venue: string
        }
        Update: {
          character_notes?: string | null
          cross_venue_rule?: string
          cross_venue_warnings?: string | null
          data_quality_flag?: string
          date_range_end?: string | null
          date_range_start?: string | null
          flies_recall_at5?: number | null
          last_updated?: string
          methods_recall_at4?: number | null
          region?: string
          report_count?: number
          rod_avg_mean?: number | null
          rod_avg_std?: number | null
          rod_mae?: number | null
          rod_mae_ci_hi?: number | null
          rod_mae_ci_lo?: number | null
          seasonal_pattern_json?: string | null
          spots_recall_at4?: number | null
          temp_correlation?: number | null
          venue?: string
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
      diary_as_reports: {
        Row: {
          best_spots: Json | null
          content: string | null
          date: string | null
          flies: Json | null
          humidity_mean_week: number | null
          methods: Json | null
          precip_total_mm_week: number | null
          pressure_mean_week: number | null
          rod_average: number | null
          summary: string | null
          t_mean_week: number | null
          user_id: string | null
          venue: string | null
          week_num: number | null
          wind_speed_mean_week: number | null
          year: number | null
        }
        Insert: {
          best_spots?: Json | null
          content?: never
          date?: string | null
          flies?: Json | null
          humidity_mean_week?: number | null
          methods?: Json | null
          precip_total_mm_week?: number | null
          pressure_mean_week?: number | null
          rod_average?: never
          summary?: never
          t_mean_week?: number | null
          user_id?: string | null
          venue?: string | null
          week_num?: never
          wind_speed_mean_week?: number | null
          year?: never
        }
        Update: {
          best_spots?: Json | null
          content?: never
          date?: string | null
          flies?: Json | null
          humidity_mean_week?: number | null
          methods?: Json | null
          precip_total_mm_week?: number | null
          pressure_mean_week?: number | null
          rod_average?: never
          summary?: never
          t_mean_week?: number | null
          user_id?: string | null
          venue?: string | null
          week_num?: never
          wind_speed_mean_week?: number | null
          year?: never
        }
        Relationships: []
      }
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
