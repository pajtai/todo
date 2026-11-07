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
    PostgrestVersion: "14.18"
  }
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
      areas: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          description: string | null
          habit_title: string | null
          id: string
          name: string
          parent_id: string | null
          recurrence: string | null
          recurrence_days: number[] | null
          starts_on: string | null
          type: Database["public"]["Enums"]["area_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          habit_title?: string | null
          id?: string
          name: string
          parent_id?: string | null
          recurrence?: string | null
          recurrence_days?: number[] | null
          starts_on?: string | null
          type?: Database["public"]["Enums"]["area_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          habit_title?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          recurrence?: string | null
          recurrence_days?: number[] | null
          starts_on?: string | null
          type?: Database["public"]["Enums"]["area_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          timezone: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          timezone?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string
        }
        Relationships: []
      }
      todo_areas: {
        Row: {
          area_id: string
          todo_id: string
          user_id: string
        }
        Insert: {
          area_id: string
          todo_id: string
          user_id?: string
        }
        Update: {
          area_id?: string
          todo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_areas_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_series: {
        Row: {
          created_at: string
          ended_on: string | null
          id: string
          recurrence: string
          recurrence_days: number[] | null
          starts_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_on?: string | null
          id?: string
          recurrence: string
          recurrence_days?: number[] | null
          starts_on: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ended_on?: string | null
          id?: string
          recurrence?: string
          recurrence_days?: number[] | null
          starts_on?: string
          user_id?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          completed_at: string | null
          created_at: string
          due_on: string | null
          habit_area_id: string | null
          id: string
          notes: string | null
          occurrence_date: string | null
          series_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_on?: string | null
          habit_area_id?: string | null
          id?: string
          notes?: string | null
          occurrence_date?: string | null
          series_id?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_on?: string | null
          habit_area_id?: string | null
          id?: string
          notes?: string | null
          occurrence_date?: string | null
          series_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_habit_area_id_fkey"
            columns: ["habit_area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "todo_series"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      area_paths: {
        Row: {
          ancestor_id: string | null
          area_id: string | null
          depth: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      ensure_habit_todos: { Args: { p_on?: string }; Returns: number }
      habit_occurrences: {
        Args: { p_from: string; p_to: string }
        Returns: {
          area_id: string
          day: string
          done: boolean
        }[]
      }
      habit_occurs_on: {
        Args: {
          p_date: string
          p_days: number[]
          p_recurrence: string
          p_starts_on: string
        }
        Returns: boolean
      }
      habit_rule_matches: {
        Args: {
          p_date: string
          p_days: number[]
          p_recurrence: string
          p_starts_on: string
        }
        Returns: boolean
      }
      habit_streaks: {
        Args: never
        Returns: {
          area_id: string
          completed_30: number
          current_streak: number
          expected_30: number
        }[]
      }
      review_completed: {
        Args: { p_from: string; p_to: string }
        Returns: {
          areas: Json
          completed_at: string
          completed_local_date: string
          title: string
          todo_id: string
        }[]
      }
      series_next_occurrence: {
        Args: {
          p_days: number[]
          p_from: string
          p_recurrence: string
          p_starts_on: string
        }
        Returns: string
      }
      series_occurrences: {
        Args: { p_from: string; p_to: string }
        Returns: {
          area_id: string
          day: string
          done: boolean
          series_id: string
        }[]
      }
      set_todo_recurrence: {
        Args: {
          p_days: number[]
          p_recurrence: string
          p_starts_on: string
          p_todo_id: string
        }
        Returns: undefined
      }
      user_today: { Args: never; Returns: string }
    }
    Enums: {
      area_type: "project" | "goal" | "habit" | "area" | "other"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {
      area_type: ["project", "goal", "habit", "area", "other"],
    },
  },
} as const
