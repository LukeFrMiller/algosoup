export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      codebooks: {
        Row: {
          created_at: string
          definition: Json
          system_prompt: string
          version: number
        }
        Insert: {
          created_at?: string
          definition: Json
          system_prompt: string
          version: number
        }
        Update: {
          created_at?: string
          definition?: Json
          system_prompt?: string
          version?: number
        }
        Relationships: []
      }
      hypotheses: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          kind: string
          labels: Json
          metric: string
          owner_id: string
          prior_hit_rate: number | null
          rationale: string | null
          status: string
          target_n: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          labels: Json
          metric: string
          owner_id: string
          prior_hit_rate?: number | null
          rationale?: string | null
          status?: string
          target_n?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          labels?: Json
          metric?: string
          owner_id?: string
          prior_hit_rate?: number | null
          rationale?: string | null
          status?: string
          target_n?: number
        }
        Relationships: []
      }
      hypothesis_videos: {
        Row: {
          hypothesis_id: string
          owner_id: string
          video_id: string
        }
        Insert: {
          hypothesis_id: string
          owner_id: string
          video_id: string
        }
        Update: {
          hypothesis_id?: string
          owner_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hypothesis_videos_hypothesis_id_fkey"
            columns: ["hypothesis_id"]
            isOneToOne: false
            referencedRelation: "hypotheses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypothesis_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_top_videos"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "hypothesis_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_hits"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "hypothesis_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypothesis_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_scores"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "hypothesis_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          connected_at: string
          followers_count: number | null
          id: string
          ig_user_id: string
          owner_id: string
          token_ciphertext: string
          token_expires_at: string
          token_iv: string
          token_refreshed_at: string | null
          username: string
        }
        Insert: {
          connected_at?: string
          followers_count?: number | null
          id?: string
          ig_user_id: string
          owner_id: string
          token_ciphertext: string
          token_expires_at: string
          token_iv: string
          token_refreshed_at?: string | null
          username: string
        }
        Update: {
          connected_at?: string
          followers_count?: number | null
          id?: string
          ig_user_id?: string
          owner_id?: string
          token_ciphertext?: string
          token_expires_at?: string
          token_iv?: string
          token_refreshed_at?: string | null
          username?: string
        }
        Relationships: []
      }
      pipeline_runs: {
        Row: {
          done: number
          failed: number
          finished_at: string | null
          id: string
          kind: string
          owner_id: string
          started_at: string
          status: string
          total: number
        }
        Insert: {
          done?: number
          failed?: number
          finished_at?: string | null
          id?: string
          kind: string
          owner_id: string
          started_at?: string
          status?: string
          total?: number
        }
        Update: {
          done?: number
          failed?: number
          finished_at?: string | null
          id?: string
          kind?: string
          owner_id?: string
          started_at?: string
          status?: string
          total?: number
        }
        Relationships: []
      }
      pipeline_steps: {
        Row: {
          error: string | null
          finished_at: string
          id: number
          owner_id: string
          run_id: string
          status: string
          step: string
          video_id: string
        }
        Insert: {
          error?: string | null
          finished_at?: string
          id?: never
          owner_id: string
          run_id: string
          status: string
          step: string
          video_id: string
        }
        Update: {
          error?: string | null
          finished_at?: string
          id?: never
          owner_id?: string
          run_id?: string
          status?: string
          step?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pipeline_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_steps_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_top_videos"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "pipeline_steps_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_hits"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "pipeline_steps_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_steps_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_scores"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "pipeline_steps_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      script_labels: {
        Row: {
          beats: string[]
          broad_topic: string
          codebook_version: number
          created_at: string
          hook_device: string
          hook_template: string
          hook_text: string
          id: string
          model: string | null
          notes: string | null
          owner_id: string
          raw: Json | null
          specific_topic: string | null
          video_id: string
        }
        Insert: {
          beats: string[]
          broad_topic: string
          codebook_version: number
          created_at?: string
          hook_device: string
          hook_template: string
          hook_text: string
          id?: string
          model?: string | null
          notes?: string | null
          owner_id: string
          raw?: Json | null
          specific_topic?: string | null
          video_id: string
        }
        Update: {
          beats?: string[]
          broad_topic?: string
          codebook_version?: number
          created_at?: string
          hook_device?: string
          hook_template?: string
          hook_text?: string
          id?: string
          model?: string | null
          notes?: string | null
          owner_id?: string
          raw?: Json | null
          specific_topic?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_labels_codebook_version_fkey"
            columns: ["codebook_version"]
            isOneToOne: false
            referencedRelation: "codebooks"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_top_videos"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_hits"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_scores"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          baseline_window: number
          hit_quantile: number
          id: number
          maturity_days: number
          min_sample: number
          owner_id: string
        }
        Insert: {
          baseline_window?: number
          hit_quantile?: number
          id?: number
          maturity_days?: number
          min_sample?: number
          owner_id: string
        }
        Update: {
          baseline_window?: number
          hit_quantile?: number
          id?: number
          maturity_days?: number
          min_sample?: number
          owner_id?: string
        }
        Relationships: []
      }
      transcripts: {
        Row: {
          created_at: string
          duration_s: number | null
          language: string | null
          model: string | null
          owner_id: string
          status: string
          text: string | null
          video_id: string
        }
        Insert: {
          created_at?: string
          duration_s?: number | null
          language?: string | null
          model?: string | null
          owner_id: string
          status: string
          text?: string | null
          video_id: string
        }
        Update: {
          created_at?: string
          duration_s?: number | null
          language?: string | null
          model?: string | null
          owner_id?: string
          status?: string
          text?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "v_top_videos"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "transcripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "v_video_hits"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "transcripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "v_video_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "v_video_scores"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "transcripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_metric_snapshots: {
        Row: {
          comments: number | null
          engagement: number | null
          fetched_at: string
          id: number
          likes: number | null
          owner_id: string
          reach: number | null
          saves: number | null
          shares: number | null
          video_id: string
          views: number | null
        }
        Insert: {
          comments?: number | null
          engagement?: number | null
          fetched_at?: string
          id?: never
          likes?: number | null
          owner_id: string
          reach?: number | null
          saves?: number | null
          shares?: number | null
          video_id: string
          views?: number | null
        }
        Update: {
          comments?: number | null
          engagement?: number | null
          fetched_at?: string
          id?: never
          likes?: number | null
          owner_id?: string
          reach?: number | null
          saves?: number | null
          shares?: number | null
          video_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_metric_snapshots_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_top_videos"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "video_metric_snapshots_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_hits"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "video_metric_snapshots_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_metric_snapshots_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_scores"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "video_metric_snapshots_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_metrics: {
        Row: {
          comments: number | null
          engagement: number | null
          fetched_at: string
          likes: number | null
          owner_id: string
          reach: number | null
          saves: number | null
          shares: number | null
          video_id: string
          views: number | null
        }
        Insert: {
          comments?: number | null
          engagement?: number | null
          fetched_at?: string
          likes?: number | null
          owner_id: string
          reach?: number | null
          saves?: number | null
          shares?: number | null
          video_id: string
          views?: number | null
        }
        Update: {
          comments?: number | null
          engagement?: number | null
          fetched_at?: string
          likes?: number | null
          owner_id?: string
          reach?: number | null
          saves?: number | null
          shares?: number | null
          video_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_metrics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "v_top_videos"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "video_metrics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "v_video_hits"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "video_metrics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "v_video_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_metrics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "v_video_scores"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "video_metrics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          caption: string | null
          created_at: string
          duration_s: number | null
          id: string
          ig_media_id: string
          owner_id: string
          permalink: string
          posted_at: string
          thumbnail_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          duration_s?: number | null
          id?: string
          ig_media_id: string
          owner_id: string
          permalink: string
          posted_at: string
          thumbnail_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          duration_s?: number | null
          id?: string
          ig_media_id?: string
          owner_id?: string
          permalink?: string
          posted_at?: string
          thumbnail_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_base_rate: {
        Row: {
          hits: number | null
          metric: string | null
          n: number | null
        }
        Relationships: []
      }
      v_dimension_counts: {
        Row: {
          dimension: string | null
          hits: number | null
          metric: string | null
          n: number | null
          value: string | null
        }
        Relationships: []
      }
      v_label_long: {
        Row: {
          dimension: string | null
          owner_id: string | null
          value: string | null
          video_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_top_videos"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_hits"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "v_video_scores"
            referencedColumns: ["video_id"]
          },
          {
            foreignKeyName: "script_labels_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pair_counts: {
        Row: {
          dim_a: string | null
          dim_b: string | null
          hits: number | null
          hits_a: number | null
          hits_b: number | null
          metric: string | null
          n: number | null
          n_a: number | null
          n_b: number | null
          val_a: string | null
          val_b: string | null
        }
        Relationships: []
      }
      v_top_videos: {
        Row: {
          engagement: number | null
          engagement_baseline: number | null
          engagement_hit: boolean | null
          engagement_log_ratio: number | null
          hook_device: string | null
          hook_text: string | null
          owner_id: string | null
          permalink: string | null
          posted_at: string | null
          saves: number | null
          saves_baseline: number | null
          saves_hit: boolean | null
          saves_log_ratio: number | null
          shares: number | null
          shares_baseline: number | null
          shares_hit: boolean | null
          shares_log_ratio: number | null
          thumbnail_url: string | null
          video_id: string | null
          views: number | null
          views_baseline: number | null
          views_hit: boolean | null
          views_log_ratio: number | null
        }
        Relationships: []
      }
      v_video_hits: {
        Row: {
          hit: boolean | null
          metric: string | null
          owner_id: string | null
          video_id: string | null
        }
        Relationships: []
      }
      v_video_list: {
        Row: {
          caption: string | null
          codebook_version: number | null
          engagement: number | null
          hook_device: string | null
          hook_text: string | null
          id: string | null
          owner_id: string | null
          permalink: string | null
          posted_at: string | null
          saves: number | null
          saves_log_ratio: number | null
          search_text: string | null
          shares: number | null
          thumbnail_url: string | null
          transcript_status: string | null
          views: number | null
          views_log_ratio: number | null
        }
        Relationships: [
          {
            foreignKeyName: "script_labels_codebook_version_fkey"
            columns: ["codebook_version"]
            isOneToOne: false
            referencedRelation: "codebooks"
            referencedColumns: ["version"]
          },
        ]
      }
      v_video_scores: {
        Row: {
          engagement: number | null
          engagement_baseline: number | null
          engagement_hit: boolean | null
          engagement_log_ratio: number | null
          owner_id: string | null
          posted_at: string | null
          saves: number | null
          saves_baseline: number | null
          saves_hit: boolean | null
          saves_log_ratio: number | null
          shares: number | null
          shares_baseline: number | null
          shares_hit: boolean | null
          shares_log_ratio: number | null
          video_id: string | null
          views: number | null
          views_baseline: number | null
          views_hit: boolean | null
          views_log_ratio: number | null
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

