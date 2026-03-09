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
      angler_profiles: {
        Row: {
          angler_location: string | null
          angler_name: string
          avg_catch: number | null
          catch_rate: number | null
          created_at: string | null
          first_session: string | null
          id: string
          last_session: string | null
          source: string | null
          total_fish: number | null
          total_trips: number | null
          updated_at: string | null
          user_id: string | null
          venues_fished: number | null
          weight_calculated_at: string | null
        }
        Insert: {
          angler_location?: string | null
          angler_name: string
          avg_catch?: number | null
          catch_rate?: number | null
          created_at?: string | null
          first_session?: string | null
          id: string
          last_session?: string | null
          source?: string | null
          total_fish?: number | null
          total_trips?: number | null
          updated_at?: string | null
          user_id?: string | null
          venues_fished?: number | null
          weight_calculated_at?: string | null
        }
        Update: {
          angler_location?: string | null
          angler_name?: string
          avg_catch?: number | null
          catch_rate?: number | null
          created_at?: string | null
          first_session?: string | null
          id?: string
          last_session?: string | null
          source?: string | null
          total_fish?: number | null
          total_trips?: number | null
          updated_at?: string | null
          user_id?: string | null
          venues_fished?: number | null
          weight_calculated_at?: string | null
        }
        Relationships: []
      }
      angler_type_weights: {
        Row: {
          angler_id: string
          avg_catch: number | null
          catch_rate: number | null
          fishing_type: string
          id: string
          skill_weight: number | null
          trips: number | null
        }
        Insert: {
          angler_id: string
          avg_catch?: number | null
          catch_rate?: number | null
          fishing_type: string
          id: string
          skill_weight?: number | null
          trips?: number | null
        }
        Update: {
          angler_id?: string
          avg_catch?: number | null
          catch_rate?: number | null
          fishing_type?: string
          id?: string
          skill_weight?: number | null
          trips?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "angler_type_weights_angler_id_fkey"
            columns: ["angler_id"]
            isOneToOne: false
            referencedRelation: "angler_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      card_reactions: {
        Row: {
          card_id: string | null
          created_at: string
          emoji: string
          profile_id: string
          reaction_id: string
          reply_id: string | null
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          emoji: string
          profile_id: string
          reaction_id?: string
          reply_id?: string | null
        }
        Update: {
          card_id?: string | null
          created_at?: string
          emoji?: string
          profile_id?: string
          reaction_id?: string
          reply_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_reactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "social_cards"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "card_reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "card_reactions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "card_replies"
            referencedColumns: ["reply_id"]
          },
        ]
      }
      card_replies: {
        Row: {
          body: string
          card_id: string
          created_at: string
          is_deleted: boolean
          parent_reply_id: string | null
          profile_id: string
          reply_id: string
          updated_at: string
        }
        Insert: {
          body: string
          card_id: string
          created_at?: string
          is_deleted?: boolean
          parent_reply_id?: string | null
          profile_id: string
          reply_id?: string
          updated_at?: string
        }
        Update: {
          body?: string
          card_id?: string
          created_at?: string
          is_deleted?: boolean
          parent_reply_id?: string | null
          profile_id?: string
          reply_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_replies_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "social_cards"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "card_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "card_replies"
            referencedColumns: ["reply_id"]
          },
          {
            foreignKeyName: "card_replies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      colours: {
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
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          notes: string | null
          reason: string
          report_id: string
          reporter_profile_id: string
          reviewed_at: string | null
          status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          notes?: string | null
          reason: string
          report_id?: string
          reporter_profile_id: string
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          notes?: string | null
          reason?: string
          report_id?: string
          reporter_profile_id?: string
          reviewed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      counties: {
        Row: {
          country: string
          county_id: number
          county_name: string
          region_id: number
        }
        Insert: {
          country: string
          county_id: number
          county_name: string
          region_id: number
        }
        Update: {
          country?: string
          county_id?: number
          county_name?: string
          region_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "counties_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["region_id"]
          },
        ]
      }
      crawl_audit: {
        Row: {
          action: string | null
          audit_id: number
          details: string | null
          fishery_id: number | null
          result: string | null
          timestamp: string | null
          url: string | null
        }
        Insert: {
          action?: string | null
          audit_id?: number
          details?: string | null
          fishery_id?: number | null
          result?: string | null
          timestamp?: string | null
          url?: string | null
        }
        Update: {
          action?: string | null
          audit_id?: number
          details?: string | null
          fishery_id?: number | null
          result?: string | null
          timestamp?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_audit_fishery_id_fkey"
            columns: ["fishery_id"]
            isOneToOne: false
            referencedRelation: "fisheries"
            referencedColumns: ["fishery_id"]
          },
        ]
      }
      crawl_intelligence: {
        Row: {
          confidence: number | null
          created_at: string | null
          finding_data: string | null
          finding_type: string | null
          fishery_id: number | null
          intel_id: number
          pattern_id: number | null
          verified: boolean | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          finding_data?: string | null
          finding_type?: string | null
          fishery_id?: number | null
          intel_id?: number
          pattern_id?: number | null
          verified?: boolean | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          finding_data?: string | null
          finding_type?: string | null
          fishery_id?: number | null
          intel_id?: number
          pattern_id?: number | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_intelligence_fishery_id_fkey"
            columns: ["fishery_id"]
            isOneToOne: false
            referencedRelation: "fisheries"
            referencedColumns: ["fishery_id"]
          },
          {
            foreignKeyName: "crawl_intelligence_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "url_patterns"
            referencedColumns: ["pattern_id"]
          },
        ]
      }
      depths: {
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
      discovered_urls: {
        Row: {
          discovered_at: string | null
          discovered_from: string | null
          discovery_method: string | null
          download_success: boolean | null
          download_timestamp: string | null
          downloaded: boolean | null
          fishery_id: number | null
          http_status: number | null
          sha256_hash: string | null
          url: string
          url_id: number
        }
        Insert: {
          discovered_at?: string | null
          discovered_from?: string | null
          discovery_method?: string | null
          download_success?: boolean | null
          download_timestamp?: string | null
          downloaded?: boolean | null
          fishery_id?: number | null
          http_status?: number | null
          sha256_hash?: string | null
          url: string
          url_id?: number
        }
        Update: {
          discovered_at?: string | null
          discovered_from?: string | null
          discovery_method?: string | null
          download_success?: boolean | null
          download_timestamp?: string | null
          downloaded?: boolean | null
          fishery_id?: number | null
          http_status?: number | null
          sha256_hash?: string | null
          url?: string
          url_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "discovered_urls_fishery_id_fkey"
            columns: ["fishery_id"]
            isOneToOne: false
            referencedRelation: "fisheries"
            referencedColumns: ["fishery_id"]
          },
        ]
      }
      discovery_hubs: {
        Row: {
          fishery_id: number | null
          hub_id: number
          hub_type: string | null
          hub_url: string
          last_crawled: string | null
          pattern_id: number | null
          reports_found: number | null
          still_active: boolean | null
        }
        Insert: {
          fishery_id?: number | null
          hub_id?: number
          hub_type?: string | null
          hub_url: string
          last_crawled?: string | null
          pattern_id?: number | null
          reports_found?: number | null
          still_active?: boolean | null
        }
        Update: {
          fishery_id?: number | null
          hub_id?: number
          hub_type?: string | null
          hub_url?: string
          last_crawled?: string | null
          pattern_id?: number | null
          reports_found?: number | null
          still_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_hubs_fishery_id_fkey"
            columns: ["fishery_id"]
            isOneToOne: false
            referencedRelation: "fisheries"
            referencedColumns: ["fishery_id"]
          },
          {
            foreignKeyName: "discovery_hubs_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "url_patterns"
            referencedColumns: ["pattern_id"]
          },
        ]
      }
      fish_species_game: {
        Row: {
          fish_type_id: number
          species_id: number
          species_name: string
        }
        Insert: {
          fish_type_id: number
          species_id: number
          species_name: string
        }
        Update: {
          fish_type_id?: number
          species_id?: number
          species_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fish_species_game_fish_type_id_fkey"
            columns: ["fish_type_id"]
            isOneToOne: false
            referencedRelation: "fish_types"
            referencedColumns: ["fish_type_id"]
          },
        ]
      }
      fish_types: {
        Row: {
          fish_type: string
          fish_type_id: number
        }
        Insert: {
          fish_type: string
          fish_type_id: number
        }
        Update: {
          fish_type?: string
          fish_type_id?: number
        }
        Relationships: []
      }
      fish_witnesses: {
        Row: {
          fish_id: string
          profile_id: string
          witness_id: string
          witnessed_at: string
        }
        Insert: {
          fish_id: string
          profile_id: string
          witness_id?: string
          witnessed_at?: string
        }
        Update: {
          fish_id?: string
          profile_id?: string
          witness_id?: string
          witnessed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fish_witnesses_fish_id_fkey"
            columns: ["fish_id"]
            isOneToOne: false
            referencedRelation: "notable_fish"
            referencedColumns: ["fish_id"]
          },
          {
            foreignKeyName: "fish_witnesses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      fisheries: {
        Row: {
          active: boolean | null
          country: string | null
          created_at: string | null
          discovery_method: string | null
          fishery_id: number
          fishery_name: string
          fishery_type: string | null
          last_crawled: string | null
          last_successful_crawl: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          platform_type: string | null
          region: string | null
          root_url: string | null
          total_reports_found: number | null
        }
        Insert: {
          active?: boolean | null
          country?: string | null
          created_at?: string | null
          discovery_method?: string | null
          fishery_id?: number
          fishery_name: string
          fishery_type?: string | null
          last_crawled?: string | null
          last_successful_crawl?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          platform_type?: string | null
          region?: string | null
          root_url?: string | null
          total_reports_found?: number | null
        }
        Update: {
          active?: boolean | null
          country?: string | null
          created_at?: string | null
          discovery_method?: string | null
          fishery_id?: number
          fishery_name?: string
          fishery_type?: string | null
          last_crawled?: string | null
          last_successful_crawl?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          platform_type?: string | null
          region?: string | null
          root_url?: string | null
          total_reports_found?: number | null
        }
        Relationships: []
      }
      fishing_sessions: {
        Row: {
          angler_location: string | null
          angler_name: string | null
          area: string | null
          beat: string | null
          created_at: string | null
          duration_minutes: number | null
          end_time: string | null
          fishing_type: string | null
          fishing_type_raw: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          plan: string | null
          rods: number | null
          satisfaction_score: number | null
          session_date: string
          source: string | null
          source_id: string | null
          start_time: string | null
          updated_at: string | null
          user_id: string | null
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
          angler_location?: string | null
          angler_name?: string | null
          area?: string | null
          beat?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          fishing_type?: string | null
          fishing_type_raw?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          plan?: string | null
          rods?: number | null
          satisfaction_score?: number | null
          session_date: string
          source?: string | null
          source_id?: string | null
          start_time?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          angler_location?: string | null
          angler_name?: string | null
          area?: string | null
          beat?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          fishing_type?: string | null
          fishing_type_raw?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          plan?: string | null
          rods?: number | null
          satisfaction_score?: number | null
          session_date?: string
          source?: string | null
          source_id?: string | null
          start_time?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      flies: {
        Row: {
          box_location: string | null
          confidence_rating: string | null
          created_at: string | null
          fly_type_id: number | null
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
          fly_type_id?: number | null
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
          fly_type_id?: number | null
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
        Relationships: [
          {
            foreignKeyName: "flies_fly_type_id_fkey"
            columns: ["fly_type_id"]
            isOneToOne: false
            referencedRelation: "fly_types"
            referencedColumns: ["fly_type_id"]
          },
        ]
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
      group_memberships: {
        Row: {
          group_id: string
          invited_at: string | null
          invited_by_profile_id: string | null
          joined_at: string | null
          membership_id: string
          profile_id: string
          removed_at: string | null
          role: string
          status: string
        }
        Insert: {
          group_id: string
          invited_at?: string | null
          invited_by_profile_id?: string | null
          joined_at?: string | null
          membership_id?: string
          profile_id: string
          removed_at?: string | null
          role?: string
          status?: string
        }
        Update: {
          group_id?: string
          invited_at?: string | null
          invited_by_profile_id?: string | null
          joined_at?: string | null
          membership_id?: string
          profile_id?: string
          removed_at?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_memberships_invited_by_profile_id_fkey"
            columns: ["invited_by_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "group_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      harvested_events: {
        Row: {
          areas_json: Json | null
          catch_form_json: Json | null
          conditions_json: Json | null
          created_at: string
          flies_json: Json | null
          flies_raw_json: Json | null
          id: number
          raw_text_segment: string
          report_date: string
          source_name: string
          source_type: string
          source_url: string
          tactics_json: Json | null
          venue_name: string
          venue_name_raw: string | null
        }
        Insert: {
          areas_json?: Json | null
          catch_form_json?: Json | null
          conditions_json?: Json | null
          created_at: string
          flies_json?: Json | null
          flies_raw_json?: Json | null
          id?: number
          raw_text_segment: string
          report_date: string
          source_name: string
          source_type: string
          source_url: string
          tactics_json?: Json | null
          venue_name: string
          venue_name_raw?: string | null
        }
        Update: {
          areas_json?: Json | null
          catch_form_json?: Json | null
          conditions_json?: Json | null
          created_at?: string
          flies_json?: Json | null
          flies_raw_json?: Json | null
          id?: number
          raw_text_segment?: string
          report_date?: string
          source_name?: string
          source_type?: string
          source_url?: string
          tactics_json?: Json | null
          venue_name?: string
          venue_name_raw?: string | null
        }
        Relationships: []
      }
      hook_sizes: {
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
      leaderboard_entries: {
        Row: {
          created_at: string
          entry_id: string
          fish_id: string
          group_id: string | null
          length_cm: number | null
          length_in: number | null
          profile_id: string
          rank: number | null
          scope: string
          season: string | null
          species: string
          venue_id: string | null
          venue_percentile: number | null
          verification_tier: number
          weight_kg: number | null
          weight_lb: number | null
        }
        Insert: {
          created_at?: string
          entry_id?: string
          fish_id: string
          group_id?: string | null
          length_cm?: number | null
          length_in?: number | null
          profile_id: string
          rank?: number | null
          scope: string
          season?: string | null
          species: string
          venue_id?: string | null
          venue_percentile?: number | null
          verification_tier: number
          weight_kg?: number | null
          weight_lb?: number | null
        }
        Update: {
          created_at?: string
          entry_id?: string
          fish_id?: string
          group_id?: string | null
          length_cm?: number | null
          length_in?: number | null
          profile_id?: string
          rank?: number | null
          scope?: string
          season?: string | null
          species?: string
          venue_id?: string | null
          venue_percentile?: number | null
          verification_tier?: number
          weight_kg?: number | null
          weight_lb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_fish_id_fkey"
            columns: ["fish_id"]
            isOneToOne: true
            referencedRelation: "notable_fish"
            referencedColumns: ["fish_id"]
          },
          {
            foreignKeyName: "leaderboard_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "leaderboard_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "leaderboard_entries_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
          },
        ]
      }
      leaders: {
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
      lines: {
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
      lines_from_reports: {
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
      notable_fish: {
        Row: {
          check_edit_clean: boolean | null
          check_location_pass: boolean | null
          check_measure_in_frame: boolean | null
          check_plausibility_pass: boolean | null
          check_time_pass: boolean | null
          confidence_score: number
          exif_device: string | null
          exif_edited: boolean | null
          exif_latitude: number | null
          exif_longitude: number | null
          exif_subject_distance_m: number | null
          exif_taken_at: string | null
          fish_id: string
          is_active: boolean
          is_personal_best: boolean
          is_platform_record: boolean
          is_venue_alltime_record: boolean
          is_venue_season_record: boolean
          length_cm: number | null
          length_in: number | null
          measurement_entered_at: string
          measurement_unit: string
          n_witnesses: number
          photo_uploaded_at: string | null
          photo_url: string | null
          platform_percentile: number | null
          profile_id: string
          session_id: string | null
          species: string
          submitted_at: string
          updated_at: string
          venue_id: string | null
          venue_name: string
          venue_percentile: number | null
          verification_tier: number
          weight_kg: number | null
          weight_lb: number | null
        }
        Insert: {
          check_edit_clean?: boolean | null
          check_location_pass?: boolean | null
          check_measure_in_frame?: boolean | null
          check_plausibility_pass?: boolean | null
          check_time_pass?: boolean | null
          confidence_score?: number
          exif_device?: string | null
          exif_edited?: boolean | null
          exif_latitude?: number | null
          exif_longitude?: number | null
          exif_subject_distance_m?: number | null
          exif_taken_at?: string | null
          fish_id?: string
          is_active?: boolean
          is_personal_best?: boolean
          is_platform_record?: boolean
          is_venue_alltime_record?: boolean
          is_venue_season_record?: boolean
          length_cm?: number | null
          length_in?: number | null
          measurement_entered_at: string
          measurement_unit?: string
          n_witnesses?: number
          photo_uploaded_at?: string | null
          photo_url?: string | null
          platform_percentile?: number | null
          profile_id: string
          session_id?: string | null
          species: string
          submitted_at?: string
          updated_at?: string
          venue_id?: string | null
          venue_name: string
          venue_percentile?: number | null
          verification_tier?: number
          weight_kg?: number | null
          weight_lb?: number | null
        }
        Update: {
          check_edit_clean?: boolean | null
          check_location_pass?: boolean | null
          check_measure_in_frame?: boolean | null
          check_plausibility_pass?: boolean | null
          check_time_pass?: boolean | null
          confidence_score?: number
          exif_device?: string | null
          exif_edited?: boolean | null
          exif_latitude?: number | null
          exif_longitude?: number | null
          exif_subject_distance_m?: number | null
          exif_taken_at?: string | null
          fish_id?: string
          is_active?: boolean
          is_personal_best?: boolean
          is_platform_record?: boolean
          is_venue_alltime_record?: boolean
          is_venue_season_record?: boolean
          length_cm?: number | null
          length_in?: number | null
          measurement_entered_at?: string
          measurement_unit?: string
          n_witnesses?: number
          photo_uploaded_at?: string | null
          photo_url?: string | null
          platform_percentile?: number | null
          profile_id?: string
          session_id?: string | null
          species?: string
          submitted_at?: string
          updated_at?: string
          venue_id?: string | null
          venue_name?: string
          venue_percentile?: number | null
          verification_tier?: number
          weight_kg?: number | null
          weight_lb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notable_fish_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notable_fish_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fishing_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notable_fish_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string
          log_id: string
          notification_type: string
          profile_id: string
          push_sent: boolean
          push_sent_at: string | null
          push_success: boolean | null
          reference_id: string | null
        }
        Insert: {
          created_at?: string
          log_id?: string
          notification_type: string
          profile_id: string
          push_sent?: boolean
          push_sent_at?: string | null
          push_success?: boolean | null
          reference_id?: string | null
        }
        Update: {
          created_at?: string
          log_id?: string
          notification_type?: string
          profile_id?: string
          push_sent?: boolean
          push_sent_at?: string | null
          push_success?: boolean | null
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
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
          country: string | null
          essential_fly_mapping: string | null
          region_id: number
          region_name: string
          sort_order: number | null
        }
        Insert: {
          country?: string | null
          essential_fly_mapping?: string | null
          region_id: number
          region_name: string
          sort_order?: number | null
        }
        Update: {
          country?: string | null
          essential_fly_mapping?: string | null
          region_id?: number
          region_name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      report_advice_confidence: {
        Row: {
          confidence_score: number | null
          date_span_years: number | null
          n_reports: number | null
          pct_flies: number | null
          pct_weather: number | null
          venue_name: string
        }
        Insert: {
          confidence_score?: number | null
          date_span_years?: number | null
          n_reports?: number | null
          pct_flies?: number | null
          pct_weather?: number | null
          venue_name: string
        }
        Update: {
          confidence_score?: number | null
          date_span_years?: number | null
          n_reports?: number | null
          pct_flies?: number | null
          pct_weather?: number | null
          venue_name?: string
        }
        Relationships: []
      }
      report_condition_fly_rankings: {
        Row: {
          condition_type: string
          condition_value: string
          fly_name: string
          mention_count: number | null
          rank: number | null
          venue_name: string
        }
        Insert: {
          condition_type: string
          condition_value: string
          fly_name: string
          mention_count?: number | null
          rank?: number | null
          venue_name: string
        }
        Update: {
          condition_type?: string
          condition_value?: string
          fly_name?: string
          mention_count?: number | null
          rank?: number | null
          venue_name?: string
        }
        Relationships: []
      }
      report_method_rankings: {
        Row: {
          mention_count: number | null
          method: string
          month: number
          rank: number | null
          venue_name: string
        }
        Insert: {
          mention_count?: number | null
          method: string
          month: number
          rank?: number | null
          venue_name: string
        }
        Update: {
          mention_count?: number | null
          method?: string
          month?: number
          rank?: number | null
          venue_name?: string
        }
        Relationships: []
      }
      report_seasonal_fly_rankings: {
        Row: {
          fly_name: string
          mention_count: number | null
          month: number
          rank: number | null
          venue_name: string
        }
        Insert: {
          fly_name: string
          mention_count?: number | null
          month: number
          rank?: number | null
          venue_name: string
        }
        Update: {
          fly_name?: string
          mention_count?: number | null
          month?: number
          rank?: number | null
          venue_name?: string
        }
        Relationships: []
      }
      report_venue_profiles: {
        Row: {
          date_end: string | null
          date_start: string | null
          latitude: number | null
          longitude: number | null
          mean_rod_avg: number | null
          n_reports: number | null
          pct_flies: number | null
          pct_methods: number | null
          pct_weather: number | null
          venue_name: string
        }
        Insert: {
          date_end?: string | null
          date_start?: string | null
          latitude?: number | null
          longitude?: number | null
          mean_rod_avg?: number | null
          n_reports?: number | null
          pct_flies?: number | null
          pct_methods?: number | null
          pct_weather?: number | null
          venue_name: string
        }
        Update: {
          date_end?: string | null
          date_start?: string | null
          latitude?: number | null
          longitude?: number | null
          mean_rod_avg?: number | null
          n_reports?: number | null
          pct_flies?: number | null
          pct_methods?: number | null
          pct_weather?: number | null
          venue_name?: string
        }
        Relationships: []
      }
      reports_enriched: {
        Row: {
          best_spots: string[] | null
          content: string | null
          created_at: string | null
          date: string
          fish_killed: string | null
          fish_released: string | null
          flies: string[] | null
          granularity: string | null
          headers: string | null
          humidity_mean_week: number | null
          id: string
          methods: string[] | null
          precip_mm: number | null
          precip_total_mm_week: number | null
          pressure_change: number | null
          pressure_max_week: number | null
          pressure_mean_std: number | null
          pressure_mean_week: number | null
          pressure_min_week: number | null
          report_url: string | null
          returns: number | null
          rod_average: number | null
          storm_days_week: number | null
          summary: string | null
          sunshine_hours_week: number | null
          t_avg_day: number | null
          t_max_day: number | null
          t_max_week: number | null
          t_mean_change: number | null
          t_mean_std: number | null
          t_mean_week: number | null
          t_min_day: number | null
          t_min_week: number | null
          text: string | null
          url: string | null
          venue: string
          venue_type: string | null
          water_level: string | null
          water_temp_week: number | null
          weather: string[] | null
          weather_venue: string | null
          week_start: string | null
          wind_dir_compass: string | null
          wind_dir_deg: number | null
          wind_dir_deg_week: number | null
          wind_speed_change: number | null
          wind_speed_max_week: number | null
          wind_speed_mean_week: number | null
          wind_speed_ms: number | null
          wind_speed_std: number | null
          year: number | null
        }
        Insert: {
          best_spots?: string[] | null
          content?: string | null
          created_at?: string | null
          date: string
          fish_killed?: string | null
          fish_released?: string | null
          flies?: string[] | null
          granularity?: string | null
          headers?: string | null
          humidity_mean_week?: number | null
          id?: string
          methods?: string[] | null
          precip_mm?: number | null
          precip_total_mm_week?: number | null
          pressure_change?: number | null
          pressure_max_week?: number | null
          pressure_mean_std?: number | null
          pressure_mean_week?: number | null
          pressure_min_week?: number | null
          report_url?: string | null
          returns?: number | null
          rod_average?: number | null
          storm_days_week?: number | null
          summary?: string | null
          sunshine_hours_week?: number | null
          t_avg_day?: number | null
          t_max_day?: number | null
          t_max_week?: number | null
          t_mean_change?: number | null
          t_mean_std?: number | null
          t_mean_week?: number | null
          t_min_day?: number | null
          t_min_week?: number | null
          text?: string | null
          url?: string | null
          venue: string
          venue_type?: string | null
          water_level?: string | null
          water_temp_week?: number | null
          weather?: string[] | null
          weather_venue?: string | null
          week_start?: string | null
          wind_dir_compass?: string | null
          wind_dir_deg?: number | null
          wind_dir_deg_week?: number | null
          wind_speed_change?: number | null
          wind_speed_max_week?: number | null
          wind_speed_mean_week?: number | null
          wind_speed_ms?: number | null
          wind_speed_std?: number | null
          year?: number | null
        }
        Update: {
          best_spots?: string[] | null
          content?: string | null
          created_at?: string | null
          date?: string
          fish_killed?: string | null
          fish_released?: string | null
          flies?: string[] | null
          granularity?: string | null
          headers?: string | null
          humidity_mean_week?: number | null
          id?: string
          methods?: string[] | null
          precip_mm?: number | null
          precip_total_mm_week?: number | null
          pressure_change?: number | null
          pressure_max_week?: number | null
          pressure_mean_std?: number | null
          pressure_mean_week?: number | null
          pressure_min_week?: number | null
          report_url?: string | null
          returns?: number | null
          rod_average?: number | null
          storm_days_week?: number | null
          summary?: string | null
          sunshine_hours_week?: number | null
          t_avg_day?: number | null
          t_max_day?: number | null
          t_max_week?: number | null
          t_mean_change?: number | null
          t_mean_std?: number | null
          t_mean_week?: number | null
          t_min_day?: number | null
          t_min_week?: number | null
          text?: string | null
          url?: string | null
          venue?: string
          venue_type?: string | null
          water_level?: string | null
          water_temp_week?: number | null
          weather?: string[] | null
          weather_venue?: string | null
          week_start?: string | null
          wind_dir_compass?: string | null
          wind_dir_deg?: number | null
          wind_dir_deg_week?: number | null
          wind_speed_change?: number | null
          wind_speed_max_week?: number | null
          wind_speed_mean_week?: number | null
          wind_speed_ms?: number | null
          wind_speed_std?: number | null
          year?: number | null
        }
        Relationships: []
      }
      reports_raw: {
        Row: {
          content: string | null
          date: string | null
          extraction_confidence: number | null
          fishery_id: number | null
          headers: string | null
          id: number
          platform_source: string | null
          region: string | null
          report_url: string | null
          rod_averages: number | null
          sha256_hash: string | null
          venue: string | null
        }
        Insert: {
          content?: string | null
          date?: string | null
          extraction_confidence?: number | null
          fishery_id?: number | null
          headers?: string | null
          id?: never
          platform_source?: string | null
          region?: string | null
          report_url?: string | null
          rod_averages?: number | null
          sha256_hash?: string | null
          venue?: string | null
        }
        Update: {
          content?: string | null
          date?: string | null
          extraction_confidence?: number | null
          fishery_id?: number | null
          headers?: string | null
          id?: never
          platform_source?: string | null
          region?: string | null
          report_url?: string | null
          rod_averages?: number | null
          sha256_hash?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      retrieves: {
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
      rigs: {
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
      river_advice_confidence: {
        Row: {
          confidence_tier: string | null
          data_volume_score: number | null
          fly_coverage_score: number | null
          n_sessions: number | null
          overall_confidence: number | null
          section_id: string
          section_name: string | null
          species_coverage_score: number | null
          temporal_coverage_score: number | null
          weather_coverage_score: number | null
        }
        Insert: {
          confidence_tier?: string | null
          data_volume_score?: number | null
          fly_coverage_score?: number | null
          n_sessions?: number | null
          overall_confidence?: number | null
          section_id: string
          section_name?: string | null
          species_coverage_score?: number | null
          temporal_coverage_score?: number | null
          weather_coverage_score?: number | null
        }
        Update: {
          confidence_tier?: string | null
          data_volume_score?: number | null
          fly_coverage_score?: number | null
          n_sessions?: number | null
          overall_confidence?: number | null
          section_id?: string
          section_name?: string | null
          species_coverage_score?: number | null
          temporal_coverage_score?: number | null
          weather_coverage_score?: number | null
        }
        Relationships: []
      }
      river_condition_modifiers: {
        Row: {
          catch_rate_modifier: number | null
          condition: string
          confidence: number | null
          section_id: string
          source: string | null
        }
        Insert: {
          catch_rate_modifier?: number | null
          condition: string
          confidence?: number | null
          section_id: string
          source?: string | null
        }
        Update: {
          catch_rate_modifier?: number | null
          condition?: string
          confidence?: number | null
          section_id?: string
          source?: string | null
        }
        Relationships: []
      }
      river_fly_recommendations: {
        Row: {
          confidence_n: number | null
          fly_1: string | null
          fly_2: string | null
          fly_3: string | null
          heavy_rain_flies: string | null
          high_water_style: string | null
          id: number
          method_detail: string | null
          month: number | null
          scope: string | null
          scope_id: string | null
          section_id: string | null
          species: string | null
          style: string | null
          temp_band: string | null
        }
        Insert: {
          confidence_n?: number | null
          fly_1?: string | null
          fly_2?: string | null
          fly_3?: string | null
          heavy_rain_flies?: string | null
          high_water_style?: string | null
          id?: number
          method_detail?: string | null
          month?: number | null
          scope?: string | null
          scope_id?: string | null
          section_id?: string | null
          species?: string | null
          style?: string | null
          temp_band?: string | null
        }
        Update: {
          confidence_n?: number | null
          fly_1?: string | null
          fly_2?: string | null
          fly_3?: string | null
          heavy_rain_flies?: string | null
          high_water_style?: string | null
          id?: number
          method_detail?: string | null
          month?: number | null
          scope?: string | null
          scope_id?: string | null
          section_id?: string | null
          species?: string | null
          style?: string | null
          temp_band?: string | null
        }
        Relationships: []
      }
      river_recommendation_lookup: {
        Row: {
          confidence_n: number | null
          fly_1: string | null
          fly_2: string | null
          fly_3: string | null
          id: number
          month: number | null
          rainfall_modifier: string | null
          recommended_style: string | null
          scope: string | null
          scope_id: string | null
          species: string | null
          temp_band: string | null
        }
        Insert: {
          confidence_n?: number | null
          fly_1?: string | null
          fly_2?: string | null
          fly_3?: string | null
          id?: number
          month?: number | null
          rainfall_modifier?: string | null
          recommended_style?: string | null
          scope?: string | null
          scope_id?: string | null
          species?: string | null
          temp_band?: string | null
        }
        Update: {
          confidence_n?: number | null
          fly_1?: string | null
          fly_2?: string | null
          fly_3?: string | null
          id?: number
          month?: number | null
          rainfall_modifier?: string | null
          recommended_style?: string | null
          scope?: string | null
          scope_id?: string | null
          species?: string | null
          temp_band?: string | null
        }
        Relationships: []
      }
      river_regional_defaults: {
        Row: {
          baseline_catch_rate: number | null
          cold_modifier: number | null
          default_style: string | null
          fly_1: string | null
          fly_2: string | null
          fly_3: string | null
          heavy_rain_modifier: number | null
          high_water_modifier: number | null
          low_water_modifier: number | null
          method_detail: string | null
          month: number
          n_events: number | null
          region_id: string
          region_name: string | null
          species: string
          strong_wind_modifier: number | null
          style_pct_dry: number | null
          style_pct_nymph: number | null
          style_pct_spider: number | null
          style_pct_streamer: number | null
          style_pct_wet: number | null
          warm_modifier: number | null
        }
        Insert: {
          baseline_catch_rate?: number | null
          cold_modifier?: number | null
          default_style?: string | null
          fly_1?: string | null
          fly_2?: string | null
          fly_3?: string | null
          heavy_rain_modifier?: number | null
          high_water_modifier?: number | null
          low_water_modifier?: number | null
          method_detail?: string | null
          month: number
          n_events?: number | null
          region_id: string
          region_name?: string | null
          species: string
          strong_wind_modifier?: number | null
          style_pct_dry?: number | null
          style_pct_nymph?: number | null
          style_pct_spider?: number | null
          style_pct_streamer?: number | null
          style_pct_wet?: number | null
          warm_modifier?: number | null
        }
        Update: {
          baseline_catch_rate?: number | null
          cold_modifier?: number | null
          default_style?: string | null
          fly_1?: string | null
          fly_2?: string | null
          fly_3?: string | null
          heavy_rain_modifier?: number | null
          high_water_modifier?: number | null
          low_water_modifier?: number | null
          method_detail?: string | null
          month?: number
          n_events?: number | null
          region_id?: string
          region_name?: string | null
          species?: string
          strong_wind_modifier?: number | null
          style_pct_dry?: number | null
          style_pct_nymph?: number | null
          style_pct_spider?: number | null
          style_pct_streamer?: number | null
          style_pct_wet?: number | null
          warm_modifier?: number | null
        }
        Relationships: []
      }
      river_seasonal_baselines: {
        Row: {
          blank_rate: number | null
          catch_rate: number | null
          fishing_type_norm: string
          month: number
          n_catch: number | null
          n_sessions: number | null
          region_id: string | null
          section_id: string
          section_name: string | null
          total_fish: number | null
        }
        Insert: {
          blank_rate?: number | null
          catch_rate?: number | null
          fishing_type_norm: string
          month: number
          n_catch?: number | null
          n_sessions?: number | null
          region_id?: string | null
          section_id: string
          section_name?: string | null
          total_fish?: number | null
        }
        Update: {
          blank_rate?: number | null
          catch_rate?: number | null
          fishing_type_norm?: string
          month?: number
          n_catch?: number | null
          n_sessions?: number | null
          region_id?: string | null
          section_id?: string
          section_name?: string | null
          total_fish?: number | null
        }
        Relationships: []
      }
      river_seasonal_flies: {
        Row: {
          catch_count: number | null
          fly_canonical: string | null
          month: number
          pct_of_month: number | null
          rank: number
          region_id: string
        }
        Insert: {
          catch_count?: number | null
          fly_canonical?: string | null
          month: number
          pct_of_month?: number | null
          rank: number
          region_id: string
        }
        Update: {
          catch_count?: number | null
          fly_canonical?: string | null
          month?: number
          pct_of_month?: number | null
          rank?: number
          region_id?: string
        }
        Relationships: []
      }
      river_section_profiles: {
        Row: {
          blank_rate: number | null
          catchment_group: string | null
          dominant_species: string | null
          grayling_pct: number | null
          mean_fish: number | null
          n_sessions: number | null
          nearest_water_station: string | null
          nearest_weather_station: string | null
          pct_fly_coverage: number | null
          pct_water_coverage: number | null
          pct_weather_coverage: number | null
          peak_month: number | null
          region_id: string | null
          region_name: string | null
          river_name: string | null
          salmon_pct: number | null
          section_id: string
          section_name: string | null
          trend_direction: string | null
          trend_significance: string | null
          water_station_dist_km: number | null
          weather_station_dist_km: number | null
        }
        Insert: {
          blank_rate?: number | null
          catchment_group?: string | null
          dominant_species?: string | null
          grayling_pct?: number | null
          mean_fish?: number | null
          n_sessions?: number | null
          nearest_water_station?: string | null
          nearest_weather_station?: string | null
          pct_fly_coverage?: number | null
          pct_water_coverage?: number | null
          pct_weather_coverage?: number | null
          peak_month?: number | null
          region_id?: string | null
          region_name?: string | null
          river_name?: string | null
          salmon_pct?: number | null
          section_id: string
          section_name?: string | null
          trend_direction?: string | null
          trend_significance?: string | null
          water_station_dist_km?: number | null
          weather_station_dist_km?: number | null
        }
        Update: {
          blank_rate?: number | null
          catchment_group?: string | null
          dominant_species?: string | null
          grayling_pct?: number | null
          mean_fish?: number | null
          n_sessions?: number | null
          nearest_water_station?: string | null
          nearest_weather_station?: string | null
          pct_fly_coverage?: number | null
          pct_water_coverage?: number | null
          pct_weather_coverage?: number | null
          peak_month?: number | null
          region_id?: string | null
          region_name?: string | null
          river_name?: string | null
          salmon_pct?: number | null
          section_id?: string
          section_name?: string | null
          trend_direction?: string | null
          trend_significance?: string | null
          water_station_dist_km?: number | null
          weather_station_dist_km?: number | null
        }
        Relationships: []
      }
      river_species_composition: {
        Row: {
          catch_count: number | null
          pct: number | null
          region_id: string | null
          section_id: string
          section_name: string | null
          species_group: string
          total_catches: number | null
        }
        Insert: {
          catch_count?: number | null
          pct?: number | null
          region_id?: string | null
          section_id: string
          section_name?: string | null
          species_group: string
          total_catches?: number | null
        }
        Update: {
          catch_count?: number | null
          pct?: number | null
          region_id?: string | null
          section_id?: string
          section_name?: string | null
          species_group?: string
          total_catches?: number | null
        }
        Relationships: []
      }
      rods: {
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
      session_venue_map: {
        Row: {
          created_at: string
          match_method: string
          session_count: number | null
          session_venue_name: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          match_method: string
          session_count?: number | null
          session_venue_name: string
          venue_id: string
        }
        Update: {
          created_at?: string
          match_method?: string
          session_count?: number | null
          session_venue_name?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_venue_map_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
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
      social_cards: {
        Row: {
          card_id: string
          conditions_temp_c: number | null
          conditions_weather: string | null
          conditions_wind: string | null
          created_at: string
          group_id: string | null
          is_deleted: boolean
          is_pinned: boolean
          method: string | null
          n_fish: number
          personal_note: string | null
          photo_url: string | null
          profile_id: string
          session_date: string
          session_id: string | null
          species_breakdown: Json | null
          top_fly_1: string | null
          top_fly_2: string | null
          updated_at: string
          venue_id: string | null
          venue_name: string
        }
        Insert: {
          card_id?: string
          conditions_temp_c?: number | null
          conditions_weather?: string | null
          conditions_wind?: string | null
          created_at?: string
          group_id?: string | null
          is_deleted?: boolean
          is_pinned?: boolean
          method?: string | null
          n_fish?: number
          personal_note?: string | null
          photo_url?: string | null
          profile_id: string
          session_date: string
          session_id?: string | null
          species_breakdown?: Json | null
          top_fly_1?: string | null
          top_fly_2?: string | null
          updated_at?: string
          venue_id?: string | null
          venue_name: string
        }
        Update: {
          card_id?: string
          conditions_temp_c?: number | null
          conditions_weather?: string | null
          conditions_wind?: string | null
          created_at?: string
          group_id?: string | null
          is_deleted?: boolean
          is_pinned?: boolean
          method?: string | null
          n_fish?: number
          personal_note?: string | null
          photo_url?: string | null
          profile_id?: string
          session_date?: string
          session_id?: string | null
          species_breakdown?: Json | null
          top_fly_1?: string | null
          top_fly_2?: string | null
          updated_at?: string
          venue_id?: string | null
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_cards_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "social_cards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "social_cards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fishing_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_cards_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
          },
        ]
      }
      social_groups: {
        Row: {
          created_at: string
          created_by_profile_id: string
          group_id: string
          invite_code: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          group_id?: string
          invite_code?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          group_id?: string
          invite_code?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_groups_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
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
      species_size_profiles: {
        Row: {
          created_at: string
          lw_coefficient_a: number
          lw_exponent_b: number
          notes: string | null
          record_length_cultivated_cm: number | null
          record_length_cultivated_in: number | null
          record_length_natural_cm: number | null
          record_length_natural_in: number | null
          record_notes: string | null
          record_weight_cultivated_kg: number | null
          record_weight_cultivated_lb: number | null
          record_weight_natural_kg: number | null
          record_weight_natural_lb: number | null
          size_profile_id: number
          source: string | null
          species_code: string
          species_name: string
          tolerance_pct: number
          typical_length_max_cm: number | null
          typical_length_max_in: number | null
          typical_length_min_cm: number | null
          typical_length_min_in: number | null
          typical_weight_max_kg: number | null
          typical_weight_max_lb: number | null
          typical_weight_min_kg: number | null
          typical_weight_min_lb: number | null
        }
        Insert: {
          created_at?: string
          lw_coefficient_a: number
          lw_exponent_b: number
          notes?: string | null
          record_length_cultivated_cm?: number | null
          record_length_cultivated_in?: number | null
          record_length_natural_cm?: number | null
          record_length_natural_in?: number | null
          record_notes?: string | null
          record_weight_cultivated_kg?: number | null
          record_weight_cultivated_lb?: number | null
          record_weight_natural_kg?: number | null
          record_weight_natural_lb?: number | null
          size_profile_id?: number
          source?: string | null
          species_code: string
          species_name: string
          tolerance_pct?: number
          typical_length_max_cm?: number | null
          typical_length_max_in?: number | null
          typical_length_min_cm?: number | null
          typical_length_min_in?: number | null
          typical_weight_max_kg?: number | null
          typical_weight_max_lb?: number | null
          typical_weight_min_kg?: number | null
          typical_weight_min_lb?: number | null
        }
        Update: {
          created_at?: string
          lw_coefficient_a?: number
          lw_exponent_b?: number
          notes?: string | null
          record_length_cultivated_cm?: number | null
          record_length_cultivated_in?: number | null
          record_length_natural_cm?: number | null
          record_length_natural_in?: number | null
          record_notes?: string | null
          record_weight_cultivated_kg?: number | null
          record_weight_cultivated_lb?: number | null
          record_weight_natural_kg?: number | null
          record_weight_natural_lb?: number | null
          size_profile_id?: number
          source?: string | null
          species_code?: string
          species_name?: string
          tolerance_pct?: number
          typical_length_max_cm?: number | null
          typical_length_max_in?: number | null
          typical_length_min_cm?: number | null
          typical_length_min_in?: number | null
          typical_weight_max_kg?: number | null
          typical_weight_max_lb?: number | null
          typical_weight_min_kg?: number | null
          typical_weight_min_lb?: number | null
        }
        Relationships: []
      }
      station_registry: {
        Row: {
          data_end_date: string | null
          data_start_date: string | null
          flood_mon_id: string | null
          has_flow: boolean | null
          has_level: boolean | null
          has_wq: boolean | null
          hydrology_id: string | null
          last_fetched: string | null
          latitude: number | null
          longitude: number | null
          nrw_parameter_ids: Json | null
          nrw_station_id: string | null
          raw_id: string
          river_name: string | null
          source: string
          station_id: string
          station_name: string | null
          status: string | null
        }
        Insert: {
          data_end_date?: string | null
          data_start_date?: string | null
          flood_mon_id?: string | null
          has_flow?: boolean | null
          has_level?: boolean | null
          has_wq?: boolean | null
          hydrology_id?: string | null
          last_fetched?: string | null
          latitude?: number | null
          longitude?: number | null
          nrw_parameter_ids?: Json | null
          nrw_station_id?: string | null
          raw_id: string
          river_name?: string | null
          source: string
          station_id: string
          station_name?: string | null
          status?: string | null
        }
        Update: {
          data_end_date?: string | null
          data_start_date?: string | null
          flood_mon_id?: string | null
          has_flow?: boolean | null
          has_level?: boolean | null
          has_wq?: boolean | null
          hydrology_id?: string | null
          last_fetched?: string | null
          latitude?: number | null
          longitude?: number | null
          nrw_parameter_ids?: Json | null
          nrw_station_id?: string | null
          raw_id?: string
          river_name?: string | null
          source?: string
          station_id?: string
          station_name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      stillwater_advice_confidence: {
        Row: {
          confidence_tier: string | null
          data_volume_score: number | null
          fly_coverage_score: number | null
          n_sessions: number | null
          overall_confidence: number | null
          seasonal_spread_score: number | null
          temporal_coverage_score: number | null
          venue_id: string
          venue_name: string
          weather_coverage_score: number | null
        }
        Insert: {
          confidence_tier?: string | null
          data_volume_score?: number | null
          fly_coverage_score?: number | null
          n_sessions?: number | null
          overall_confidence?: number | null
          seasonal_spread_score?: number | null
          temporal_coverage_score?: number | null
          venue_id: string
          venue_name: string
          weather_coverage_score?: number | null
        }
        Update: {
          confidence_tier?: string | null
          data_volume_score?: number | null
          fly_coverage_score?: number | null
          n_sessions?: number | null
          overall_confidence?: number | null
          seasonal_spread_score?: number | null
          temporal_coverage_score?: number | null
          venue_id?: string
          venue_name?: string
          weather_coverage_score?: number | null
        }
        Relationships: []
      }
      stillwater_condition_modifiers: {
        Row: {
          baseline: number | null
          catch_rate: number | null
          condition: string
          modifier: number | null
          n_sessions: number | null
          source: string | null
          venue_id: string
          venue_name: string
          venue_type: string | null
        }
        Insert: {
          baseline?: number | null
          catch_rate?: number | null
          condition: string
          modifier?: number | null
          n_sessions?: number | null
          source?: string | null
          venue_id: string
          venue_name: string
          venue_type?: string | null
        }
        Update: {
          baseline?: number | null
          catch_rate?: number | null
          condition?: string
          modifier?: number | null
          n_sessions?: number | null
          source?: string | null
          venue_id?: string
          venue_name?: string
          venue_type?: string | null
        }
        Relationships: []
      }
      stillwater_fly_rankings: {
        Row: {
          catch_per_event: number | null
          fly_canonical: string
          id: number
          n_events: number | null
          rank: number | null
          source: string | null
          total_fish: number | null
          venue_id: string
          venue_name: string | null
        }
        Insert: {
          catch_per_event?: number | null
          fly_canonical: string
          id?: number
          n_events?: number | null
          rank?: number | null
          source?: string | null
          total_fish?: number | null
          venue_id: string
          venue_name?: string | null
        }
        Update: {
          catch_per_event?: number | null
          fly_canonical?: string
          id?: number
          n_events?: number | null
          rank?: number | null
          source?: string | null
          total_fish?: number | null
          venue_id?: string
          venue_name?: string | null
        }
        Relationships: []
      }
      stillwater_fly_recommendations: {
        Row: {
          confidence_n: number | null
          fly_1: string | null
          fly_2: string | null
          fly_3: string | null
          month: number
          recommended_style: string | null
          source: string | null
          venue_id: string
          venue_name: string
        }
        Insert: {
          confidence_n?: number | null
          fly_1?: string | null
          fly_2?: string | null
          fly_3?: string | null
          month: number
          recommended_style?: string | null
          source?: string | null
          venue_id: string
          venue_name: string
        }
        Update: {
          confidence_n?: number | null
          fly_1?: string | null
          fly_2?: string | null
          fly_3?: string | null
          month?: number
          recommended_style?: string | null
          source?: string | null
          venue_id?: string
          venue_name?: string
        }
        Relationships: []
      }
      stillwater_seasonal_baselines: {
        Row: {
          blank_rate: number | null
          mean_fish: number | null
          month: number
          n_sessions: number | null
          venue_id: string
          venue_name: string
        }
        Insert: {
          blank_rate?: number | null
          mean_fish?: number | null
          month: number
          n_sessions?: number | null
          venue_id: string
          venue_name: string
        }
        Update: {
          blank_rate?: number | null
          mean_fish?: number | null
          month?: number
          n_sessions?: number | null
          venue_id?: string
          venue_name?: string
        }
        Relationships: []
      }
      stillwater_venue_profiles: {
        Row: {
          area: string | null
          blank_rate: number | null
          date_max: string | null
          date_min: string | null
          lat: number | null
          lng: number | null
          mean_fish: number | null
          n_anglers: number | null
          n_sessions: number | null
          peak_month: number | null
          venue_id: string
          venue_name: string
          venue_type: string | null
          weather_coverage_pct: number | null
        }
        Insert: {
          area?: string | null
          blank_rate?: number | null
          date_max?: string | null
          date_min?: string | null
          lat?: number | null
          lng?: number | null
          mean_fish?: number | null
          n_anglers?: number | null
          n_sessions?: number | null
          peak_month?: number | null
          venue_id: string
          venue_name: string
          venue_type?: string | null
          weather_coverage_pct?: number | null
        }
        Update: {
          area?: string | null
          blank_rate?: number | null
          date_max?: string | null
          date_min?: string | null
          lat?: number | null
          lng?: number | null
          mean_fish?: number | null
          n_anglers?: number | null
          n_sessions?: number | null
          peak_month?: number | null
          venue_id?: string
          venue_name?: string
          venue_type?: string | null
          weather_coverage_pct?: number | null
        }
        Relationships: []
      }
      tippets: {
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
      url_patterns: {
        Row: {
          confidence_score: number | null
          created_by: string | null
          discovered_at: string | null
          example_urls: string | null
          failure_count: number | null
          last_used: string | null
          pattern_id: number
          pattern_template: string
          pattern_type: string | null
          success_count: number | null
          works_for_platforms: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_by?: string | null
          discovered_at?: string | null
          example_urls?: string | null
          failure_count?: number | null
          last_used?: string | null
          pattern_id?: number
          pattern_template: string
          pattern_type?: string | null
          success_count?: number | null
          works_for_platforms?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_by?: string | null
          discovered_at?: string | null
          example_urls?: string | null
          failure_count?: number | null
          last_used?: string | null
          pattern_id?: number
          pattern_template?: string
          pattern_type?: string | null
          success_count?: number | null
          works_for_platforms?: string | null
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          block_id: string
          blocked_profile_id: string
          blocker_profile_id: string
          created_at: string
        }
        Insert: {
          block_id?: string
          blocked_profile_id: string
          blocker_profile_id: string
          created_at?: string
        }
        Update: {
          block_id?: string
          blocked_profile_id?: string
          blocker_profile_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_profile_id_fkey"
            columns: ["blocked_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_profile_id_fkey"
            columns: ["blocker_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          angler_id: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          location: string | null
          mobile_number: string | null
          mobile_verified: boolean | null
          notification_push_token: string | null
          notify_group_post: boolean
          notify_notable_fish: boolean
          notify_platform_record: boolean
          notify_venue_card: boolean
          profile_id: string
          two_factor_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          angler_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id: string
          location?: string | null
          mobile_number?: string | null
          mobile_verified?: boolean | null
          notification_push_token?: string | null
          notify_group_post?: boolean
          notify_notable_fish?: boolean
          notify_platform_record?: boolean
          notify_venue_card?: boolean
          profile_id?: string
          two_factor_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          angler_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          location?: string | null
          mobile_number?: string | null
          mobile_verified?: boolean | null
          notification_push_token?: string | null
          notify_group_post?: boolean
          notify_notable_fish?: boolean
          notify_platform_record?: boolean
          notify_venue_card?: boolean
          profile_id?: string
          two_factor_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_angler_id_fkey"
            columns: ["angler_id"]
            isOneToOne: false
            referencedRelation: "angler_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_venue_favourites: {
        Row: {
          created_at: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_venue_favourites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
          },
        ]
      }
      user_venue_history: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_venue_history_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
          },
        ]
      }
      user_venue_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          status: string
          submitted_county: string | null
          submitted_latitude: number | null
          submitted_longitude: number | null
          submitted_name: string
          submitted_postcode: string | null
          submitted_water_type: string
          user_id: string
          venue_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          submitted_county?: string | null
          submitted_latitude?: number | null
          submitted_longitude?: number | null
          submitted_name: string
          submitted_postcode?: string | null
          submitted_water_type: string
          user_id: string
          venue_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          submitted_county?: string | null
          submitted_latitude?: number | null
          submitted_longitude?: number | null
          submitted_name?: string
          submitted_postcode?: string | null
          submitted_water_type?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_venue_submissions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
          },
        ]
      }
      venue_affiliations: {
        Row: {
          affiliation_id: string
          is_welcome_back_pending: boolean
          joined_at: string
          lapsed_at: string | null
          last_session_at: string | null
          opted_out_at: string | null
          profile_id: string
          status: string
          venue_id: string
        }
        Insert: {
          affiliation_id?: string
          is_welcome_back_pending?: boolean
          joined_at?: string
          lapsed_at?: string | null
          last_session_at?: string | null
          opted_out_at?: string | null
          profile_id: string
          status?: string
          venue_id: string
        }
        Update: {
          affiliation_id?: string
          is_welcome_back_pending?: boolean
          joined_at?: string
          lapsed_at?: string | null
          last_session_at?: string | null
          opted_out_at?: string | null
          profile_id?: string
          status?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_affiliations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "venue_affiliations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
          },
        ]
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
      venue_daily_cards: {
        Row: {
          best_fish_length_cm: number | null
          best_fish_length_in: number | null
          best_fish_species: string | null
          best_fish_weight_kg: number | null
          best_fish_weight_lb: number | null
          card_date: string
          conditions_temp_c: number | null
          conditions_weather: string | null
          conditions_wind: string | null
          daily_card_id: string
          dominant_method: string | null
          generated_at: string
          has_leaderboard_event: boolean
          leaderboard_summary: string | null
          n_sessions: number
          narrative: string
          rod_average: number | null
          top_fly_1: string | null
          top_fly_2: string | null
          top_fly_3: string | null
          venue_id: string
        }
        Insert: {
          best_fish_length_cm?: number | null
          best_fish_length_in?: number | null
          best_fish_species?: string | null
          best_fish_weight_kg?: number | null
          best_fish_weight_lb?: number | null
          card_date: string
          conditions_temp_c?: number | null
          conditions_weather?: string | null
          conditions_wind?: string | null
          daily_card_id?: string
          dominant_method?: string | null
          generated_at?: string
          has_leaderboard_event?: boolean
          leaderboard_summary?: string | null
          n_sessions?: number
          narrative: string
          rod_average?: number | null
          top_fly_1?: string | null
          top_fly_2?: string | null
          top_fly_3?: string | null
          venue_id: string
        }
        Update: {
          best_fish_length_cm?: number | null
          best_fish_length_in?: number | null
          best_fish_species?: string | null
          best_fish_weight_kg?: number | null
          best_fish_weight_lb?: number | null
          card_date?: string
          conditions_temp_c?: number | null
          conditions_weather?: string | null
          conditions_wind?: string | null
          daily_card_id?: string
          dominant_method?: string | null
          generated_at?: string
          has_leaderboard_event?: boolean
          leaderboard_summary?: string | null
          n_sessions?: number
          narrative?: string
          rod_average?: number | null
          top_fly_1?: string | null
          top_fly_2?: string | null
          top_fly_3?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_daily_cards_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues_new"
            referencedColumns: ["venue_id"]
          },
        ]
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
      venue_station_map: {
        Row: {
          data_type: string
          distance_km: number | null
          match_type: string | null
          station_id: string
          venue_name: string
        }
        Insert: {
          data_type: string
          distance_km?: number | null
          match_type?: string | null
          station_id: string
          venue_name: string
        }
        Update: {
          data_type?: string
          distance_km?: number | null
          match_type?: string | null
          station_id?: string
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
      venues: {
        Row: {
          id: number
          latitude: number | null
          location: string | null
          longitude: number | null
        }
        Insert: {
          id?: never
          latitude?: number | null
          location?: string | null
          longitude?: number | null
        }
        Update: {
          id?: never
          latitude?: number | null
          location?: string | null
          longitude?: number | null
        }
        Relationships: []
      }
      venues_new: {
        Row: {
          aliases: Json | null
          country: string
          county: string | null
          created_at: string
          display_context: string | null
          full_name: string
          has_diary: boolean
          has_passport: boolean
          has_reports: boolean
          is_active: boolean
          is_searchable: boolean
          last_crawled: string | null
          last_successful_crawl: string | null
          latitude: number | null
          level: string
          longitude: number | null
          name: string
          parent_id: string | null
          platform_type: string | null
          region_id: number
          river_name: string | null
          root_url: string | null
          search_text: string
          season_end_month: number | null
          season_start_month: number | null
          section_profile_id: string | null
          session_count: number
          source: string | null
          source_id: string | null
          stillwater_profile_id: string | null
          updated_at: string
          venue_id: string
          water_type_id: number
        }
        Insert: {
          aliases?: Json | null
          country?: string
          county?: string | null
          created_at?: string
          display_context?: string | null
          full_name: string
          has_diary?: boolean
          has_passport?: boolean
          has_reports?: boolean
          is_active?: boolean
          is_searchable?: boolean
          last_crawled?: string | null
          last_successful_crawl?: string | null
          latitude?: number | null
          level: string
          longitude?: number | null
          name: string
          parent_id?: string | null
          platform_type?: string | null
          region_id: number
          river_name?: string | null
          root_url?: string | null
          search_text?: string
          season_end_month?: number | null
          season_start_month?: number | null
          section_profile_id?: string | null
          session_count?: number
          source?: string | null
          source_id?: string | null
          stillwater_profile_id?: string | null
          updated_at?: string
          venue_id: string
          water_type_id: number
        }
        Update: {
          aliases?: Json | null
          country?: string
          county?: string | null
          created_at?: string
          display_context?: string | null
          full_name?: string
          has_diary?: boolean
          has_passport?: boolean
          has_reports?: boolean
          is_active?: boolean
          is_searchable?: boolean
          last_crawled?: string | null
          last_successful_crawl?: string | null
          latitude?: number | null
          level?: string
          longitude?: number | null
          name?: string
          parent_id?: string | null
          platform_type?: string | null
          region_id?: number
          river_name?: string | null
          root_url?: string | null
          search_text?: string
          season_end_month?: number | null
          season_start_month?: number | null
          section_profile_id?: string | null
          session_count?: number
          source?: string | null
          source_id?: string | null
          stillwater_profile_id?: string | null
          updated_at?: string
          venue_id?: string
          water_type_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venues_new_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["region_id"]
          },
          {
            foreignKeyName: "venues_new_water_type_id_fkey"
            columns: ["water_type_id"]
            isOneToOne: false
            referencedRelation: "water_types"
            referencedColumns: ["water_type_id"]
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
      verification_scores: {
        Row: {
          computed_at: string
          fish_id: string
          pts_exif_clean: number
          pts_location_match: number
          pts_measure_in_frame: number
          pts_measurement_entered: number
          pts_peer_witness: number
          pts_photo_submitted: number
          pts_plausibility_pass: number
          pts_time_match: number
          score_id: string
          total_score: number
        }
        Insert: {
          computed_at?: string
          fish_id: string
          pts_exif_clean?: number
          pts_location_match?: number
          pts_measure_in_frame?: number
          pts_measurement_entered?: number
          pts_peer_witness?: number
          pts_photo_submitted?: number
          pts_plausibility_pass?: number
          pts_time_match?: number
          score_id?: string
          total_score?: number
        }
        Update: {
          computed_at?: string
          fish_id?: string
          pts_exif_clean?: number
          pts_location_match?: number
          pts_measure_in_frame?: number
          pts_measurement_entered?: number
          pts_peer_witness?: number
          pts_photo_submitted?: number
          pts_plausibility_pass?: number
          pts_time_match?: number
          score_id?: string
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "verification_scores_fish_id_fkey"
            columns: ["fish_id"]
            isOneToOne: true
            referencedRelation: "notable_fish"
            referencedColumns: ["fish_id"]
          },
        ]
      }
      water_level_daily: {
        Row: {
          date: string
          flow_max_m3s: number | null
          flow_mean_m3s: number | null
          flow_min_m3s: number | null
          level_max_m: number | null
          level_mean_m: number | null
          level_min_m: number | null
          reading_count: number | null
          source: string
          station_id: string
          station_name: string | null
        }
        Insert: {
          date: string
          flow_max_m3s?: number | null
          flow_mean_m3s?: number | null
          flow_min_m3s?: number | null
          level_max_m?: number | null
          level_mean_m?: number | null
          level_min_m?: number | null
          reading_count?: number | null
          source: string
          station_id: string
          station_name?: string | null
        }
        Update: {
          date?: string
          flow_max_m3s?: number | null
          flow_mean_m3s?: number | null
          flow_min_m3s?: number | null
          level_max_m?: number | null
          level_mean_m?: number | null
          level_min_m?: number | null
          reading_count?: number | null
          source?: string
          station_id?: string
          station_name?: string | null
        }
        Relationships: []
      }
      water_quality_daily: {
        Row: {
          date: string
          do_max_pct: number | null
          do_mean_pct: number | null
          do_min_pct: number | null
          ph_max: number | null
          ph_mean: number | null
          ph_min: number | null
          reading_count: number | null
          station_id: string
          station_name: string | null
          temp_max_c: number | null
          temp_mean_c: number | null
          temp_min_c: number | null
          turbidity_max_ntu: number | null
          turbidity_mean_ntu: number | null
          turbidity_min_ntu: number | null
        }
        Insert: {
          date: string
          do_max_pct?: number | null
          do_mean_pct?: number | null
          do_min_pct?: number | null
          ph_max?: number | null
          ph_mean?: number | null
          ph_min?: number | null
          reading_count?: number | null
          station_id: string
          station_name?: string | null
          temp_max_c?: number | null
          temp_mean_c?: number | null
          temp_min_c?: number | null
          turbidity_max_ntu?: number | null
          turbidity_mean_ntu?: number | null
          turbidity_min_ntu?: number | null
        }
        Update: {
          date?: string
          do_max_pct?: number | null
          do_mean_pct?: number | null
          do_min_pct?: number | null
          ph_max?: number | null
          ph_mean?: number | null
          ph_min?: number | null
          reading_count?: number | null
          station_id?: string
          station_name?: string | null
          temp_max_c?: number | null
          temp_mean_c?: number | null
          temp_min_c?: number | null
          turbidity_max_ntu?: number | null
          turbidity_mean_ntu?: number | null
          turbidity_min_ntu?: number | null
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
      weather_daily: {
        Row: {
          date: string
          granularity: string | null
          id: number
          location: string
          precip_mm: number | null
          t_avg_day: number | null
          t_max_day: number | null
          t_min_day: number | null
          wind_dir_compass: string | null
          wind_dir_deg: number | null
          wind_speed_ms: number | null
        }
        Insert: {
          date: string
          granularity?: string | null
          id?: never
          location: string
          precip_mm?: number | null
          t_avg_day?: number | null
          t_max_day?: number | null
          t_min_day?: number | null
          wind_dir_compass?: string | null
          wind_dir_deg?: number | null
          wind_speed_ms?: number | null
        }
        Update: {
          date?: string
          granularity?: string | null
          id?: never
          location?: string
          precip_mm?: number | null
          t_avg_day?: number | null
          t_max_day?: number | null
          t_min_day?: number | null
          wind_dir_compass?: string | null
          wind_dir_deg?: number | null
          wind_speed_ms?: number | null
        }
        Relationships: []
      }
      wt_advice_confidence: {
        Row: {
          confidence_score: number | null
          cross_validation_score: number | null
          db_data_score: number | null
          fly_diversity_score: number | null
          method_coverage_score: number | null
          months_with_data: number | null
          n_reports: number | null
          n_venues: number | null
          n_web_sources: number | null
          water_type_id: number
          web_coverage_score: number | null
        }
        Insert: {
          confidence_score?: number | null
          cross_validation_score?: number | null
          db_data_score?: number | null
          fly_diversity_score?: number | null
          method_coverage_score?: number | null
          months_with_data?: number | null
          n_reports?: number | null
          n_venues?: number | null
          n_web_sources?: number | null
          water_type_id: number
          web_coverage_score?: number | null
        }
        Update: {
          confidence_score?: number | null
          cross_validation_score?: number | null
          db_data_score?: number | null
          fly_diversity_score?: number | null
          method_coverage_score?: number | null
          months_with_data?: number | null
          n_reports?: number | null
          n_venues?: number | null
          n_web_sources?: number | null
          water_type_id?: number
          web_coverage_score?: number | null
        }
        Relationships: []
      }
      wt_advice_profiles: {
        Row: {
          confidence_score: number | null
          generated_at: string
          last_db_refresh: string | null
          n_reports: number | null
          n_sessions: number | null
          n_venues: number | null
          water_type_id: number
          water_type_name: string
          web_sources: number | null
        }
        Insert: {
          confidence_score?: number | null
          generated_at: string
          last_db_refresh?: string | null
          n_reports?: number | null
          n_sessions?: number | null
          n_venues?: number | null
          water_type_id: number
          water_type_name: string
          web_sources?: number | null
        }
        Update: {
          confidence_score?: number | null
          generated_at?: string
          last_db_refresh?: string | null
          n_reports?: number | null
          n_sessions?: number | null
          n_venues?: number | null
          water_type_id?: number
          water_type_name?: string
          web_sources?: number | null
        }
        Relationships: []
      }
      wt_condition_advice: {
        Row: {
          catch_modifier: number | null
          condition_type: string
          condition_value: string
          fly_adjustments: string | null
          method_adjustments: string | null
          n_observations: number | null
          notes: string | null
          source: string
          water_type_id: number
        }
        Insert: {
          catch_modifier?: number | null
          condition_type: string
          condition_value: string
          fly_adjustments?: string | null
          method_adjustments?: string | null
          n_observations?: number | null
          notes?: string | null
          source: string
          water_type_id: number
        }
        Update: {
          catch_modifier?: number | null
          condition_type?: string
          condition_value?: string
          fly_adjustments?: string | null
          method_adjustments?: string | null
          n_observations?: number | null
          notes?: string | null
          source?: string
          water_type_id?: number
        }
        Relationships: []
      }
      wt_monthly_fly_advice: {
        Row: {
          confidence: number | null
          fly_name: string
          fly_style: string | null
          importance: string | null
          mention_count: number | null
          month: number
          notes: string | null
          rank: number | null
          source: string
          water_type_id: number
        }
        Insert: {
          confidence?: number | null
          fly_name: string
          fly_style?: string | null
          importance?: string | null
          mention_count?: number | null
          month: number
          notes?: string | null
          rank?: number | null
          source: string
          water_type_id: number
        }
        Update: {
          confidence?: number | null
          fly_name?: string
          fly_style?: string | null
          importance?: string | null
          mention_count?: number | null
          month?: number
          notes?: string | null
          rank?: number | null
          source?: string
          water_type_id?: number
        }
        Relationships: []
      }
      wt_monthly_method_advice: {
        Row: {
          confidence: number | null
          importance: string | null
          mention_count: number | null
          method_name: string
          month: number
          notes: string | null
          rank: number | null
          source: string
          water_type_id: number
        }
        Insert: {
          confidence?: number | null
          importance?: string | null
          mention_count?: number | null
          method_name: string
          month: number
          notes?: string | null
          rank?: number | null
          source: string
          water_type_id: number
        }
        Update: {
          confidence?: number | null
          importance?: string | null
          mention_count?: number | null
          method_name?: string
          month?: number
          notes?: string | null
          rank?: number | null
          source?: string
          water_type_id?: number
        }
        Relationships: []
      }
      wt_narrative_advice: {
        Row: {
          generated_at: string
          month: number
          narrative_text: string
          source: string
          water_type_id: number
          word_count: number | null
        }
        Insert: {
          generated_at: string
          month: number
          narrative_text: string
          source: string
          water_type_id: number
          word_count?: number | null
        }
        Update: {
          generated_at?: string
          month?: number
          narrative_text?: string
          source?: string
          water_type_id?: number
          word_count?: number | null
        }
        Relationships: []
      }
      wt_seasonal_overview: {
        Row: {
          avg_rod_average: number | null
          key_flies: string | null
          key_hatches: string | null
          key_methods: string | null
          overview_text: string | null
          peak_months: string | null
          season: string
          source: string
          water_type_id: number
        }
        Insert: {
          avg_rod_average?: number | null
          key_flies?: string | null
          key_hatches?: string | null
          key_methods?: string | null
          overview_text?: string | null
          peak_months?: string | null
          season: string
          source: string
          water_type_id: number
        }
        Update: {
          avg_rod_average?: number | null
          key_flies?: string | null
          key_hatches?: string | null
          key_methods?: string | null
          overview_text?: string | null
          peak_months?: string | null
          season?: string
          source?: string
          water_type_id?: number
        }
        Relationships: []
      }
      wt_where_to_fish: {
        Row: {
          advice_text: string
          source: string
          topic: string
          water_type_id: number
        }
        Insert: {
          advice_text: string
          source: string
          topic: string
          water_type_id: number
        }
        Update: {
          advice_text?: string
          source?: string
          topic?: string
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
      model_inputs_ready: {
        Row: {
          best_spots: string[] | null
          date: string | null
          flies: string[] | null
          humidity_mean_week: number | null
          methods: string[] | null
          precip_total_mm_week: number | null
          pressure_mean_week: number | null
          rod_average: number | null
          t_mean_week: number | null
          venue: string | null
          water_temp_week: number | null
          wind_speed_mean_week: number | null
          year: number | null
        }
        Insert: {
          best_spots?: string[] | null
          date?: string | null
          flies?: string[] | null
          humidity_mean_week?: number | null
          methods?: string[] | null
          precip_total_mm_week?: number | null
          pressure_mean_week?: number | null
          rod_average?: number | null
          t_mean_week?: number | null
          venue?: string | null
          water_temp_week?: number | null
          wind_speed_mean_week?: number | null
          year?: number | null
        }
        Update: {
          best_spots?: string[] | null
          date?: string | null
          flies?: string[] | null
          humidity_mean_week?: number | null
          methods?: string[] | null
          precip_total_mm_week?: number | null
          pressure_mean_week?: number | null
          rod_average?: number | null
          t_mean_week?: number | null
          venue?: string | null
          water_temp_week?: number | null
          wind_speed_mean_week?: number | null
          year?: number | null
        }
        Relationships: []
      }
      report_weather_summary: {
        Row: {
          best_spots: string[] | null
          date: string | null
          flies: string[] | null
          humidity_mean_week: number | null
          methods: string[] | null
          precip_mm: number | null
          precip_total_mm_week: number | null
          pressure_mean_week: number | null
          rod_average: number | null
          summary: string | null
          t_avg_day: number | null
          t_mean_week: number | null
          venue: string | null
          water_temp_week: number | null
          wind_dir_deg: number | null
          wind_dir_deg_week: number | null
          wind_speed_mean_week: number | null
          wind_speed_ms: number | null
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
