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
      angler_venue_stats: {
        Row: {
          catch_rate: number | null
          fish_per_hour: number | null
          general_ability: number | null
          id: string
          last_session_date: string | null
          technique_stats: Json
          total_fish: number
          total_hours: number
          total_sessions: number
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          catch_rate?: number | null
          fish_per_hour?: number | null
          general_ability?: number | null
          id?: string
          last_session_date?: string | null
          technique_stats?: Json
          total_fish?: number
          total_hours?: number
          total_sessions?: number
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          catch_rate?: number | null
          fish_per_hour?: number | null
          general_ability?: number | null
          id?: string
          last_session_date?: string | null
          technique_stats?: Json
          total_fish?: number
          total_hours?: number
          total_sessions?: number
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "angler_venue_stats_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
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
          venue_type: string | null
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
          venue_type?: string | null
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
          venue_type?: string | null
          water_level?: string | null
          water_temp_week?: number | null
          weather?: string[] | null
          wind_dir_deg_week?: number | null
          wind_speed_mean_week?: number | null
          year?: number | null
        }
        Relationships: []
      }
      fishing_sessions: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          end_time: string | null
          fishing_type: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          plan: string | null
          rods: number | null
          satisfaction_score: number | null
          session_date: string
          start_time: string | null
          updated_at: string | null
          user_id: string
          venue_name: string
          venue_type: string | null
          weather_conditions: string | null
          weather_log: Json | null
          weather_pressure: number | null
          weather_temp: number | null
          weather_wind_dir: string | null
          weather_wind_speed: number | null
          would_return: boolean | null
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          fishing_type?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          plan?: string | null
          rods?: number | null
          satisfaction_score?: number | null
          session_date: string
          start_time?: string | null
          updated_at?: string | null
          user_id: string
          venue_name: string
          venue_type?: string | null
          weather_conditions?: string | null
          weather_log?: Json | null
          weather_pressure?: number | null
          weather_temp?: number | null
          weather_wind_dir?: string | null
          weather_wind_speed?: number | null
          would_return?: boolean | null
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          fishing_type?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          plan?: string | null
          rods?: number | null
          satisfaction_score?: number | null
          session_date?: string
          start_time?: string | null
          updated_at?: string | null
          user_id?: string
          venue_name?: string
          venue_type?: string | null
          weather_conditions?: string | null
          weather_log?: Json | null
          weather_pressure?: number | null
          weather_temp?: number | null
          weather_wind_dir?: string | null
          weather_wind_speed?: number | null
          would_return?: boolean | null
        }
        Relationships: []
      }
      fly_monthly_availability: {
        Row: {
          id: number
          month: number
          notes: string | null
          pattern_name: string
          relevance: string | null
          source: string | null
          water_type_id: number | null
        }
        Insert: {
          id: number
          month: number
          notes?: string | null
          pattern_name: string
          relevance?: string | null
          source?: string | null
          water_type_id?: number | null
        }
        Update: {
          id?: number
          month?: number
          notes?: string | null
          pattern_name?: string
          relevance?: string | null
          source?: string | null
          water_type_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fly_monthly_availability_water_type_id_fkey"
            columns: ["water_type_id"]
            isOneToOne: false
            referencedRelation: "water_types"
            referencedColumns: ["water_type_id"]
          },
        ]
      }
      fly_species: {
        Row: {
          common_name: string
          description: string | null
          family_group: string | null
          fly_type_id: number | null
          latin_name: string | null
          order_name: string | null
          species_id: number
        }
        Insert: {
          common_name: string
          description?: string | null
          family_group?: string | null
          fly_type_id?: number | null
          latin_name?: string | null
          order_name?: string | null
          species_id: number
        }
        Update: {
          common_name?: string
          description?: string | null
          family_group?: string | null
          fly_type_id?: number | null
          latin_name?: string | null
          order_name?: string | null
          species_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fly_species_fly_type_id_fkey"
            columns: ["fly_type_id"]
            isOneToOne: false
            referencedRelation: "fly_types"
            referencedColumns: ["fly_type_id"]
          },
        ]
      }
      fly_species_link: {
        Row: {
          id: number
          is_primary: number | null
          life_stage: string | null
          notes: string | null
          pattern_name: string
          species_id: number | null
        }
        Insert: {
          id: number
          is_primary?: number | null
          life_stage?: string | null
          notes?: string | null
          pattern_name: string
          species_id?: number | null
        }
        Update: {
          id?: number
          is_primary?: number | null
          life_stage?: string | null
          notes?: string | null
          pattern_name?: string
          species_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fly_species_link_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "fly_species"
            referencedColumns: ["species_id"]
          },
        ]
      }
      fly_types: {
        Row: {
          description: string | null
          fly_type: string
          fly_type_id: number
        }
        Insert: {
          description?: string | null
          fly_type: string
          fly_type_id: number
        }
        Update: {
          description?: string | null
          fly_type?: string
          fly_type_id?: number
        }
        Relationships: []
      }
      fly_water_types: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          pattern_name: string
          suitability: string
          water_type_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          pattern_name: string
          suitability: string
          water_type_id: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          pattern_name?: string
          suitability?: string
          water_type_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fly_water_types_water_type_id_fkey"
            columns: ["water_type_id"]
            isOneToOne: false
            referencedRelation: "water_types"
            referencedColumns: ["water_type_id"]
          },
        ]
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
      ref_leaders: {
        Row: {
          brand: string | null
          breaking_strain_lb: number | null
          butt_diameter_mm: number | null
          created_at: string | null
          id: number
          length_ft: number | null
          material: string | null
          tippet_diameter_mm: number | null
          type: string | null
          typical_use: string | null
        }
        Insert: {
          brand?: string | null
          breaking_strain_lb?: number | null
          butt_diameter_mm?: number | null
          created_at?: string | null
          id?: never
          length_ft?: number | null
          material?: string | null
          tippet_diameter_mm?: number | null
          type?: string | null
          typical_use?: string | null
        }
        Update: {
          brand?: string | null
          breaking_strain_lb?: number | null
          butt_diameter_mm?: number | null
          created_at?: string | null
          id?: never
          length_ft?: number | null
          material?: string | null
          tippet_diameter_mm?: number | null
          type?: string | null
          typical_use?: string | null
        }
        Relationships: []
      }
      ref_lines: {
        Row: {
          buoyancy: string | null
          created_at: string | null
          description: string | null
          friendly_name: string | null
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
          friendly_name?: string | null
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
          friendly_name?: string | null
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
      ref_rods: {
        Row: {
          action: string | null
          created_at: string | null
          id: number
          length_ft: number | null
          line_weight: number | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          owner: string | null
          pieces: number | null
          primary_use: string | null
          water_type: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: never
          length_ft?: number | null
          line_weight?: number | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          owner?: string | null
          pieces?: number | null
          primary_use?: string | null
          water_type?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: never
          length_ft?: number | null
          line_weight?: number | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          owner?: string | null
          pieces?: number | null
          primary_use?: string | null
          water_type?: string | null
        }
        Relationships: []
      }
      ref_tippets: {
        Row: {
          brand: string | null
          breaking_strain_lb: number | null
          created_at: string | null
          diameter_mm: number | null
          id: number
          material: string | null
          spool_length_m: number | null
          typical_use: string | null
          x_rating: string | null
        }
        Insert: {
          brand?: string | null
          breaking_strain_lb?: number | null
          created_at?: string | null
          diameter_mm?: number | null
          id?: never
          material?: string | null
          spool_length_m?: number | null
          typical_use?: string | null
          x_rating?: string | null
        }
        Update: {
          brand?: string | null
          breaking_strain_lb?: number | null
          created_at?: string | null
          diameter_mm?: number | null
          id?: never
          material?: string | null
          spool_length_m?: number | null
          typical_use?: string | null
          x_rating?: string | null
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
      regions: {
        Row: {
          description: string | null
          essential_fly_mapping: string | null
          region_id: number
          region_name: string
        }
        Insert: {
          description?: string | null
          essential_fly_mapping?: string | null
          region_id: number
          region_name: string
        }
        Update: {
          description?: string | null
          essential_fly_mapping?: string | null
          region_id?: number
          region_name?: string
        }
        Relationships: []
      }
      session_events: {
        Row: {
          blank_confidence: string | null
          blank_reason: string | null
          change_from: Json | null
          change_reason: string | null
          change_to: Json | null
          depth_zone: string | null
          event_conditions: string | null
          event_pressure: number | null
          event_temp: number | null
          event_time: string
          event_type: string
          event_wind_dir: string | null
          event_wind_speed: number | null
          flies_on_cast: Json | null
          fly_known: boolean | null
          fly_pattern: string | null
          fly_size: number | null
          got_away_stage: string | null
          id: string
          is_best_fish: boolean | null
          latitude: number | null
          length_inches: number | null
          line_type: string | null
          longitude: number | null
          measurement_mode: string | null
          notes: string | null
          photo_url: string | null
          retrieve: string | null
          rig: string | null
          rig_position: string | null
          session_id: string
          size_estimate: string | null
          sort_order: number
          species: string | null
          spot: string | null
          style: string | null
          weight_display: string | null
          weight_lb: number | null
          weight_oz: number | null
        }
        Insert: {
          blank_confidence?: string | null
          blank_reason?: string | null
          change_from?: Json | null
          change_reason?: string | null
          change_to?: Json | null
          depth_zone?: string | null
          event_conditions?: string | null
          event_pressure?: number | null
          event_temp?: number | null
          event_time?: string
          event_type: string
          event_wind_dir?: string | null
          event_wind_speed?: number | null
          flies_on_cast?: Json | null
          fly_known?: boolean | null
          fly_pattern?: string | null
          fly_size?: number | null
          got_away_stage?: string | null
          id?: string
          is_best_fish?: boolean | null
          latitude?: number | null
          length_inches?: number | null
          line_type?: string | null
          longitude?: number | null
          measurement_mode?: string | null
          notes?: string | null
          photo_url?: string | null
          retrieve?: string | null
          rig?: string | null
          rig_position?: string | null
          session_id: string
          size_estimate?: string | null
          sort_order: number
          species?: string | null
          spot?: string | null
          style?: string | null
          weight_display?: string | null
          weight_lb?: number | null
          weight_oz?: number | null
        }
        Update: {
          blank_confidence?: string | null
          blank_reason?: string | null
          change_from?: Json | null
          change_reason?: string | null
          change_to?: Json | null
          depth_zone?: string | null
          event_conditions?: string | null
          event_pressure?: number | null
          event_temp?: number | null
          event_time?: string
          event_type?: string
          event_wind_dir?: string | null
          event_wind_speed?: number | null
          flies_on_cast?: Json | null
          fly_known?: boolean | null
          fly_pattern?: string | null
          fly_size?: number | null
          got_away_stage?: string | null
          id?: string
          is_best_fish?: boolean | null
          latitude?: number | null
          length_inches?: number | null
          line_type?: string | null
          longitude?: number | null
          measurement_mode?: string | null
          notes?: string | null
          photo_url?: string | null
          retrieve?: string | null
          rig?: string | null
          rig_position?: string | null
          session_id?: string
          size_estimate?: string | null
          sort_order?: number
          species?: string | null
          spot?: string | null
          style?: string | null
          weight_display?: string | null
          weight_lb?: number | null
          weight_oz?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fishing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_summaries: {
        Row: {
          blank_confidence: string | null
          blanked: boolean
          created_at: string
          fish_per_hour: number | null
          id: string
          is_private: boolean
          satisfaction_score: number | null
          session_date: string
          session_hours: number | null
          session_id: string
          setup_change_log: Json
          setup_changes_count: number
          total_fish: number
          user_id: string
          venue_id: string
          weather_periods: Json
        }
        Insert: {
          blank_confidence?: string | null
          blanked?: boolean
          created_at?: string
          fish_per_hour?: number | null
          id?: string
          is_private?: boolean
          satisfaction_score?: number | null
          session_date: string
          session_hours?: number | null
          session_id: string
          setup_change_log?: Json
          setup_changes_count?: number
          total_fish?: number
          user_id: string
          venue_id: string
          weather_periods?: Json
        }
        Update: {
          blank_confidence?: string | null
          blanked?: boolean
          created_at?: string
          fish_per_hour?: number | null
          id?: string
          is_private?: boolean
          satisfaction_score?: number | null
          session_date?: string
          session_hours?: number | null
          session_id?: string
          setup_change_log?: Json
          setup_changes_count?: number
          total_fish?: number
          user_id?: string
          venue_id?: string
          weather_periods?: Json
        }
        Relationships: [
          {
            foreignKeyName: "session_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fishing_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_summaries_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_metadata"
            referencedColumns: ["id"]
          },
        ]
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
      species_hatch_calendar: {
        Row: {
          hatch_intensity: string | null
          hatch_time_of_day: string | null
          id: number
          month: number
          notes: string | null
          region_id: number | null
          source: string | null
          species_id: number | null
          water_type_id: number | null
        }
        Insert: {
          hatch_intensity?: string | null
          hatch_time_of_day?: string | null
          id: number
          month: number
          notes?: string | null
          region_id?: number | null
          source?: string | null
          species_id?: number | null
          water_type_id?: number | null
        }
        Update: {
          hatch_intensity?: string | null
          hatch_time_of_day?: string | null
          id?: number
          month?: number
          notes?: string | null
          region_id?: number | null
          source?: string | null
          species_id?: number | null
          water_type_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "species_hatch_calendar_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "species_hatch_calendar_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "fly_species"
            referencedColumns: ["species_id"]
          },
          {
            foreignKeyName: "species_hatch_calendar_water_type_id_fkey"
            columns: ["water_type_id"]
            isOneToOne: false
            referencedRelation: "water_types"
            referencedColumns: ["water_type_id"]
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
      user_rod_setups: {
        Row: {
          created_at: string | null
          default_flies: Json | null
          depth_zone: string | null
          id: string
          last_used_at: string | null
          line_type: string | null
          name: string
          retrieve: string | null
          rig: string | null
          rod_name: string | null
          style: string | null
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_flies?: Json | null
          depth_zone?: string | null
          id?: string
          last_used_at?: string | null
          line_type?: string | null
          name: string
          retrieve?: string | null
          rig?: string | null
          rod_name?: string | null
          style?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_flies?: Json | null
          depth_zone?: string | null
          id?: string
          last_used_at?: string | null
          line_type?: string | null
          name?: string
          retrieve?: string | null
          rig?: string | null
          rod_name?: string | null
          style?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
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
          season_close_date: string | null
          season_open_date: string | null
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
          season_close_date?: string | null
          season_open_date?: string | null
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
          season_close_date?: string | null
          season_open_date?: string | null
          seasonal_pattern_json?: string | null
          spots_recall_at4?: number | null
          temp_correlation?: number | null
          venue?: string
        }
        Relationships: []
      }
      venue_spots: {
        Row: {
          access_type: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          spot_id: number
          spot_name: string
          venue_name: string
        }
        Insert: {
          access_type?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          spot_id: number
          spot_name: string
          venue_name: string
        }
        Update: {
          access_type?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          spot_id?: number
          spot_name?: string
          venue_name?: string
        }
        Relationships: []
      }
      venue_stats: {
        Row: {
          diary_date_range: string | null
          mean_catch_rate: number | null
          mean_fish_per_hour: number | null
          report_date_range: string | null
          total_anglers: number
          total_diary_sessions: number
          total_reports: number
          total_sessions: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          diary_date_range?: string | null
          mean_catch_rate?: number | null
          mean_fish_per_hour?: number | null
          report_date_range?: string | null
          total_anglers?: number
          total_diary_sessions?: number
          total_reports?: number
          total_sessions?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          diary_date_range?: string | null
          mean_catch_rate?: number | null
          mean_fish_per_hour?: number | null
          report_date_range?: string | null
          total_anglers?: number
          total_diary_sessions?: number
          total_reports?: number
          total_sessions?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_stats_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venue_metadata"
            referencedColumns: ["id"]
          },
        ]
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
      water_types: {
        Row: {
          description: string | null
          water_type: string
          water_type_id: number
        }
        Insert: {
          description?: string | null
          water_type: string
          water_type_id: number
        }
        Update: {
          description?: string | null
          water_type?: string
          water_type_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      diary_as_reports: {
        Row: {
          best_spots: string[] | null
          content: string | null
          date: string | null
          flies: string[] | null
          humidity_mean_week: number | null
          methods: string[] | null
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
