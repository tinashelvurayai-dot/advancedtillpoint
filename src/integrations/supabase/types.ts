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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          show_cashier_manual: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          show_cashier_manual?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          show_cashier_manual?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_cash: {
        Row: {
          amount: number
          collection_date: string
          created_at: string
          id: string
          notes: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          collection_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          collection_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          active: boolean
          created_at: string
          flavour: string | null
          id: string
          image_url: string | null
          price: number
          product_id: string
          size: Database["public"]["Enums"]["variant_size"] | null
          sku: string | null
          updated_at: string
          variant_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          flavour?: string | null
          id?: string
          image_url?: string | null
          price: number
          product_id: string
          size?: Database["public"]["Enums"]["variant_size"] | null
          sku?: string | null
          updated_at?: string
          variant_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          flavour?: string | null
          id?: string
          image_url?: string | null
          price?: number
          product_id?: string
          size?: Database["public"]["Enums"]["variant_size"] | null
          sku?: string | null
          updated_at?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          base_price: number | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          cashier_id: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cashier_id?: string | null
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cashier_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          auto_reorder: boolean
          created_at: string
          created_by: string | null
          id: string
          items: Json
          notes: string | null
          order_date: string
          status: string
          supplier_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          auto_reorder?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_date?: string
          status?: string
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          auto_reorder?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_date?: string
          status?: string
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          reason: string | null
          restocked: boolean
          sale_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          reason?: string | null
          restocked?: boolean
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          reason?: string | null
          restocked?: boolean
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_orders: {
        Row: {
          created_at: string
          entry: string
          fulfilled_at: string | null
          id: string
          notes: string | null
          product_name: string | null
          quantity: number | null
          requested_at: string
          requested_by: string | null
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry: string
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          quantity?: number | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry?: string
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          quantity?: number | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string
          cashier_name: string | null
          client_id: string | null
          created_at: string
          id: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          status: string
          total_amount: number
        }
        Insert: {
          cashier_id: string
          cashier_name?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          status?: string
          total_amount: number
        }
        Update: {
          cashier_id?: string
          cashier_name?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          status?: string
          total_amount?: number
        }
        Relationships: []
      }
      stock: {
        Row: {
          available: boolean
          id: string
          low_stock_alert_level: number
          peak_quantity: number
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          available?: boolean
          id?: string
          low_stock_alert_level?: number
          peak_quantity?: number
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          available?: boolean
          id?: string
          low_stock_alert_level?: number
          peak_quantity?: number
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_in_records: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quantity: number
          received_at: string
          recorded_by: string | null
          stock_id: string
          supplier_id: string | null
          total_cost: number
          unit_buying_price: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity: number
          received_at?: string
          recorded_by?: string | null
          stock_id: string
          supplier_id?: string | null
          total_cost?: number
          unit_buying_price?: number
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          received_at?: string
          recorded_by?: string | null
          stock_id?: string
          supplier_id?: string | null
          total_cost?: number
          unit_buying_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_in_records_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_in_records_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_in_records_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      flag_out_of_stock: { Args: { _variant_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_all_available: { Args: never; Returns: number }
      mark_variant_available: {
        Args: { _variant_id: string }
        Returns: undefined
      }
      record_stock_in: {
        Args: {
          p_notes?: string
          p_quantity: number
          p_received_at?: string
          p_stock_id: string
          p_supplier_id?: string
          p_unit_buying_price: number
          p_variant_id: string
        }
        Returns: string
      }
      refund_sale: {
        Args: {
          p_kind?: string
          p_reason?: string
          p_restock?: boolean
          p_sale_id: string
        }
        Returns: string
      }
      reset_transactions: { Args: { p_peak?: number }; Returns: undefined }
      update_stock_in_record: {
        Args: {
          p_id: string
          p_notes?: string
          p_quantity: number
          p_received_at?: string
          p_supplier_id?: string
          p_unit_buying_price: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "manager" | "cashier"
      payment_type: "cash" | "mobile" | "card" | "other"
      variant_size: "Small" | "Medium" | "Large" | "XL" | "One Size"
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
    Enums: {
      app_role: ["manager", "cashier"],
      payment_type: ["cash", "mobile", "card", "other"],
      variant_size: ["Small", "Medium", "Large", "XL", "One Size"],
    },
  },
} as const
