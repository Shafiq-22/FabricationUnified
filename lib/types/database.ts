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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consumables: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivery_date: string | null
          id: string
          invoice_dn_no: string | null
          item_name: string | null
          lpo_no: string | null
          month_year: string | null
          order_date: string | null
          pr_no: string | null
          qty: number | null
          supplier: string | null
          supplier_id: string | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          id?: string
          invoice_dn_no?: string | null
          item_name?: string | null
          lpo_no?: string | null
          month_year?: string | null
          order_date?: string | null
          pr_no?: string | null
          qty?: number | null
          supplier?: string | null
          supplier_id?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          id?: string
          invoice_dn_no?: string | null
          item_name?: string | null
          lpo_no?: string | null
          month_year?: string | null
          order_date?: string | null
          pr_no?: string | null
          qty?: number | null
          supplier?: string | null
          supplier_id?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consumables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_assignments: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          job_id: string | null
          note: string | null
          project_id: string | null
          role: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          note?: string | null
          project_id?: string | null
          role?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          note?: string | null
          project_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_view"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organisation: string | null
          personnel_id: string | null
          phone: string | null
          role: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organisation?: string | null
          personnel_id?: string | null
          phone?: string | null
          role?: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organisation?: string | null
          personnel_id?: string | null
          phone?: string | null
          role?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "job_workforce_contacts"
            referencedColumns: ["personnel_id"]
          },
          {
            foreignKeyName: "contacts_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cut_list_plates: {
        Row: {
          grade: string | null
          id: string
          job_id: string
          length_mm: number | null
          plate_size: string | null
          qty: number | null
          seq_no: number | null
          thickness_mm: number | null
          total_area_m2: number | null
          width_mm: number | null
        }
        Insert: {
          grade?: string | null
          id?: string
          job_id: string
          length_mm?: number | null
          plate_size?: string | null
          qty?: number | null
          seq_no?: number | null
          thickness_mm?: number | null
          total_area_m2?: number | null
          width_mm?: number | null
        }
        Update: {
          grade?: string | null
          id?: string
          job_id?: string
          length_mm?: number | null
          plate_size?: string | null
          qty?: number | null
          seq_no?: number | null
          thickness_mm?: number | null
          total_area_m2?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cut_list_plates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cut_list_plates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          deleted_at: string | null
          doc_type: string
          file_path: string
          id: string
          job_id: string | null
          mime_type: string | null
          notes: string | null
          original_filename: string | null
          project_id: string | null
          revision: string | null
          size_bytes: number | null
          title: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          deleted_at?: string | null
          doc_type?: string
          file_path: string
          id?: string
          job_id?: string | null
          mime_type?: string | null
          notes?: string | null
          original_filename?: string | null
          project_id?: string | null
          revision?: string | null
          size_bytes?: number | null
          title?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          deleted_at?: string | null
          doc_type?: string
          file_path?: string
          id?: string
          job_id?: string | null
          mime_type?: string | null
          notes?: string | null
          original_filename?: string | null
          project_id?: string | null
          revision?: string | null
          size_bytes?: number | null
          title?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      drawings: {
        Row: {
          created_at: string
          handover_id: string | null
          id: string
          notes: string | null
          status: string | null
          submitted_to: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          handover_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          submitted_to?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          handover_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          submitted_to?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawings_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "handover_items"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          active: boolean
          bare_rate: number | null
          created_at: string
          created_by: string | null
          device_group: string | null
          driver_rate: number | null
          id: string
          last_service_date: string | null
          machine: string
          make: string | null
          sixco_no: string | null
          status: string
          type: string | null
        }
        Insert: {
          active?: boolean
          bare_rate?: number | null
          created_at?: string
          created_by?: string | null
          device_group?: string | null
          driver_rate?: number | null
          id?: string
          last_service_date?: string | null
          machine: string
          make?: string | null
          sixco_no?: string | null
          status?: string
          type?: string | null
        }
        Update: {
          active?: boolean
          bare_rate?: number | null
          created_at?: string
          created_by?: string | null
          device_group?: string | null
          driver_rate?: number | null
          id?: string
          last_service_date?: string | null
          machine?: string
          make?: string | null
          sixco_no?: string | null
          status?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_usage: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_id: string
          id: string
          status_code: string
          usage_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          id?: string
          status_code: string
          usage_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          id?: string
          status_code?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_usage_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_usage_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_items: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expected_completion: string | null
          id: string
          job_description: string | null
          po_ref: string | null
          qty: number | null
          remark: string | null
          site_id: string | null
          supplier: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expected_completion?: string | null
          id?: string
          job_description?: string | null
          po_ref?: string | null
          qty?: number | null
          remark?: string | null
          site_id?: string | null
          supplier?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expected_completion?: string | null
          id?: string
          job_description?: string | null
          po_ref?: string | null
          qty?: number | null
          remark?: string | null
          site_id?: string | null
          supplier?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handover_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_items_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_reports: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          inspected_at: string
          inspector_id: string | null
          item_ref: string | null
          job_id: string | null
          notes: string | null
          result: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          inspected_at?: string
          inspector_id?: string | null
          item_ref?: string | null
          job_id?: string | null
          notes?: string | null
          result?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          inspected_at?: string
          inspector_id?: string | null
          item_ref?: string | null
          job_id?: string | null
          notes?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_reports_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "job_workforce_contacts"
            referencedColumns: ["personnel_id"]
          },
          {
            foreignKeyName: "inspection_reports_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string
          dimensions: string | null
          id: string
          item_code: string | null
          item_type: string
          material_grade: string | null
          parent_item_id: string | null
          quantity_on_hand: number
          reorder_threshold: number | null
          source_job_id: string | null
          unit: string | null
          unit_cost: number | null
          updated_at: string
          warehouse_location: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description: string
          dimensions?: string | null
          id?: string
          item_code?: string | null
          item_type?: string
          material_grade?: string | null
          parent_item_id?: string | null
          quantity_on_hand?: number
          reorder_threshold?: number | null
          source_job_id?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
          warehouse_location?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          dimensions?: string | null
          id?: string
          item_code?: string | null
          item_type?: string
          material_grade?: string | null
          parent_item_id?: string | null
          quantity_on_hand?: number
          reorder_threshold?: number | null
          source_job_id?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string
          job_id: string | null
          job_material_id: string | null
          moved_on: string
          movement_type: string
          note: string | null
          qty: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id: string
          job_id?: string | null
          job_material_id?: string | null
          moved_on?: string
          movement_type: string
          note?: string | null
          qty: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          job_id?: string | null
          job_material_id?: string | null
          moved_on?: string
          movement_type?: string
          note?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_job_material_id_fkey"
            columns: ["job_material_id"]
            isOneToOne: false
            referencedRelation: "job_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      job_actual_consumables: {
        Row: {
          id: string
          item_name: string | null
          job_id: string
          qty: number | null
          seq_no: number | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          id?: string
          item_name?: string | null
          job_id: string
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string | null
          job_id?: string
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_actual_consumables_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_actual_consumables_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_actual_materials: {
        Row: {
          dimension: string | null
          id: string
          job_id: string
          material_name: string | null
          qty: number | null
          seq_no: number | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          dimension?: string | null
          id?: string
          job_id: string
          material_name?: string | null
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          dimension?: string | null
          id?: string
          job_id?: string
          material_name?: string | null
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_actual_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_actual_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_actual_summary: {
        Row: {
          id: string
          item_name: string | null
          job_id: string
          qty: number | null
          seq_no: number | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          id?: string
          item_name?: string | null
          job_id: string
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string | null
          job_id?: string
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_actual_summary_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_actual_summary_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_actual_workforce: {
        Row: {
          date: string | null
          designation: string | null
          hrs_per_person: number | null
          id: string
          job_id: string
          qty: number | null
          rate_aed_per_hr: number | null
          seq_no: number | null
          total_hours: number | null
        }
        Insert: {
          date?: string | null
          designation?: string | null
          hrs_per_person?: number | null
          id?: string
          job_id: string
          qty?: number | null
          rate_aed_per_hr?: number | null
          seq_no?: number | null
          total_hours?: number | null
        }
        Update: {
          date?: string | null
          designation?: string | null
          hrs_per_person?: number | null
          id?: string
          job_id?: string
          qty?: number | null
          rate_aed_per_hr?: number | null
          seq_no?: number | null
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_actual_workforce_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_actual_workforce_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_code_sequences: {
        Row: {
          last_seq: number
          year_month: string
        }
        Insert: {
          last_seq?: number
          year_month: string
        }
        Update: {
          last_seq?: number
          year_month?: string
        }
        Relationships: []
      }
      job_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          job_id: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_id: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_materials: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivery_date: string | null
          id: string
          invoice_dn_no: string | null
          item_name: string | null
          job_id: string | null
          lpo_no: string | null
          order_date: string | null
          pr_no: string | null
          qty: number | null
          request_date: string | null
          supplier: string | null
          supplier_id: string | null
          time_to_deliver_days: number | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          id?: string
          invoice_dn_no?: string | null
          item_name?: string | null
          job_id?: string | null
          lpo_no?: string | null
          order_date?: string | null
          pr_no?: string | null
          qty?: number | null
          request_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          time_to_deliver_days?: number | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          id?: string
          invoice_dn_no?: string | null
          item_name?: string | null
          job_id?: string | null
          lpo_no?: string | null
          order_date?: string | null
          pr_no?: string | null
          qty?: number | null
          request_date?: string | null
          supplier?: string | null
          supplier_id?: string | null
          time_to_deliver_days?: number | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_quotation_summary: {
        Row: {
          id: string
          item_name: string | null
          job_id: string
          qty: number | null
          seq_no: number | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          id?: string
          item_name?: string | null
          job_id: string
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string | null
          job_id?: string
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_quotation_summary_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_quotation_summary_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_quote_consumables: {
        Row: {
          id: string
          item_name: string | null
          job_id: string
          qty: number | null
          seq_no: number | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          id?: string
          item_name?: string | null
          job_id: string
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string | null
          job_id?: string
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_quote_consumables_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_quote_consumables_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_quote_materials: {
        Row: {
          dimension: string | null
          id: string
          job_id: string
          material_name: string | null
          qty: number | null
          seq_no: number | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          dimension?: string | null
          id?: string
          job_id: string
          material_name?: string | null
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          dimension?: string | null
          id?: string
          job_id?: string
          material_name?: string | null
          qty?: number | null
          seq_no?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_quote_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_quote_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_quote_workforce: {
        Row: {
          date: string | null
          designation: string | null
          hrs_per_person: number | null
          id: string
          job_id: string
          qty: number | null
          rate_aed_per_hr: number | null
          seq_no: number | null
          total_hours: number | null
        }
        Insert: {
          date?: string | null
          designation?: string | null
          hrs_per_person?: number | null
          id?: string
          job_id: string
          qty?: number | null
          rate_aed_per_hr?: number | null
          seq_no?: number | null
          total_hours?: number | null
        }
        Update: {
          date?: string | null
          designation?: string | null
          hrs_per_person?: number | null
          id?: string
          job_id?: string
          qty?: number | null
          rate_aed_per_hr?: number | null
          seq_no?: number | null
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_quote_workforce_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_quote_workforce_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_events: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          job_code: string | null
          job_id: string
          status: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          job_code?: string | null
          job_id: string
          status?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          job_code?: string | null
          job_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_cost: number | null
          charge_to_site: number | null
          code_tail: string | null
          comments: string | null
          company_job_code: string | null
          completion_date: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          exit_outpass: string | null
          final_quote: number | null
          id: string
          inbound_outpass: string | null
          job_code: string | null
          lpo_ref: string | null
          margin: number
          pl_percentage: number | null
          profit_loss: number | null
          project_id: string | null
          qty: number | null
          quotation_ref: string | null
          quote_before_margin: number
          requisition_no: string | null
          site_id: string | null
          start_date: string | null
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          charge_to_site?: number | null
          code_tail?: string | null
          comments?: string | null
          company_job_code?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          exit_outpass?: string | null
          final_quote?: number | null
          id?: string
          inbound_outpass?: string | null
          job_code?: string | null
          lpo_ref?: string | null
          margin?: number
          pl_percentage?: number | null
          profit_loss?: number | null
          project_id?: string | null
          qty?: number | null
          quotation_ref?: string | null
          quote_before_margin?: number
          requisition_no?: string | null
          site_id?: string | null
          start_date?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          charge_to_site?: number | null
          code_tail?: string | null
          comments?: string | null
          company_job_code?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          exit_outpass?: string | null
          final_quote?: number | null
          id?: string
          inbound_outpass?: string | null
          job_code?: string | null
          lpo_ref?: string | null
          margin?: number
          pl_percentage?: number | null
          profit_loss?: number | null
          project_id?: string | null
          qty?: number | null
          quotation_ref?: string | null
          quote_before_margin?: number
          requisition_no?: string | null
          site_id?: string | null
          start_date?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_rates: {
        Row: {
          active: boolean
          created_at: string
          designation: string
          effective_from: string
          id: string
          rate_aed_per_hr: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          designation: string
          effective_from?: string
          id?: string
          rate_aed_per_hr: number
        }
        Update: {
          active?: boolean
          created_at?: string
          designation?: string
          effective_from?: string
          id?: string
          rate_aed_per_hr?: number
        }
        Relationships: []
      }
      maintenance_records: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          downtime_hours: number | null
          equipment_id: string
          id: string
          maintenance_type: string
          performed_by: string | null
          performed_on: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          downtime_hours?: number | null
          equipment_id: string
          id?: string
          maintenance_type?: string
          performed_by?: string | null
          performed_on?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          downtime_hours?: number | null
          equipment_id?: string
          id?: string
          maintenance_type?: string
          performed_by?: string | null
          performed_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "job_workforce_contacts"
            referencedColumns: ["personnel_id"]
          },
          {
            foreignKeyName: "maintenance_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      ncrs: {
        Row: {
          closed_at: string | null
          corrective_action: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          item_ref: string | null
          job_id: string | null
          project_id: string | null
          raised_at: string
          raised_by: string | null
          root_cause: string | null
          severity: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          item_ref?: string | null
          job_id?: string | null
          project_id?: string | null
          raised_at?: string
          raised_by?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          item_ref?: string | null
          job_id?: string | null
          project_id?: string | null
          raised_at?: string
          raised_by?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ncrs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncrs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncrs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncrs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncrs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncrs_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          ho_no: string | null
          id: string
          name: string
          qualification_expiry: string | null
          trade: string | null
          welder_qualification: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ho_no?: string | null
          id?: string
          name: string
          qualification_expiry?: string | null
          trade?: string | null
          welder_qualification?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ho_no?: string | null
          id?: string
          name?: string
          qualification_expiry?: string | null
          trade?: string | null
          welder_qualification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_code_sequences: {
        Row: {
          last_seq: number
          year_key: string
        }
        Insert: {
          last_seq?: number
          year_key: string
        }
        Update: {
          last_seq?: number
          year_key?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          actual_completion: string | null
          client_id: string | null
          contract_value: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          project_code: string | null
          site_id: string | null
          start_date: string | null
          status: string
          target_completion: string | null
          updated_at: string
        }
        Insert: {
          actual_completion?: string | null
          client_id?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          project_code?: string | null
          site_id?: string | null
          start_date?: string | null
          status?: string
          target_completion?: string | null
          updated_at?: string
        }
        Update: {
          actual_completion?: string | null
          client_id?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_code?: string | null
          site_id?: string | null
          start_date?: string | null
          status?: string
          target_completion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          job_id: string | null
          notes: string | null
          project_id: string | null
          received_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          project_id?: string | null
          received_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          project_id?: string | null
          received_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_view"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_config: {
        Row: {
          created_at: string
          display_name: string
          id: string
          tier: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          tier: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          tier?: number
          updated_at?: string
        }
        Relationships: []
      }
      rough_sheet_items: {
        Row: {
          dimension: string | null
          grade: string | null
          id: string
          job_id: string
          length_m: number | null
          order_qty: number | null
          profile_type: string | null
          qty: number | null
          seq_no: number | null
          total_length: number | null
        }
        Insert: {
          dimension?: string | null
          grade?: string | null
          id?: string
          job_id: string
          length_m?: number | null
          order_qty?: number | null
          profile_type?: string | null
          qty?: number | null
          seq_no?: number | null
          total_length?: number | null
        }
        Update: {
          dimension?: string | null
          grade?: string | null
          id?: string
          job_id?: string
          length_m?: number | null
          order_qty?: number | null
          profile_type?: string | null
          qty?: number | null
          seq_no?: number | null
          total_length?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rough_sheet_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rough_sheet_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          location: string | null
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          category: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          begin_time: string | null
          created_at: string
          created_by: string | null
          end_time: string | null
          entry_date: string
          id: string
          job_description: string | null
          job_id: string | null
          job_ref: string | null
          normal_hours: number | null
          ot_hours: number | null
          personnel_id: string
          site: string | null
        }
        Insert: {
          begin_time?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          entry_date: string
          id?: string
          job_description?: string | null
          job_id?: string | null
          job_ref?: string | null
          normal_hours?: number | null
          ot_hours?: number | null
          personnel_id: string
          site?: string | null
        }
        Update: {
          begin_time?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          entry_date?: string
          id?: string
          job_description?: string | null
          job_id?: string | null
          job_ref?: string | null
          normal_hours?: number | null
          ot_hours?: number | null
          personnel_id?: string
          site?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "job_workforce_contacts"
            referencedColumns: ["personnel_id"]
          },
          {
            foreignKeyName: "timesheet_entries_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          role_tier: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          role_tier?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role_tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_role_tier_fkey"
            columns: ["role_tier"]
            isOneToOne: false
            referencedRelation: "roles_config"
            referencedColumns: ["tier"]
          },
        ]
      }
    }
    Views: {
      cut_list_plates_aggregated: {
        Row: {
          area_used: number | null
          grade: string | null
          job_id: string | null
          plate_size: string | null
          sheet_area: number | null
          sheets_required: number | null
          thickness_mm: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cut_list_plates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cut_list_plates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      historic_prices: {
        Row: {
          avg_price: number | null
          item_key: string | null
          item_name: string | null
          last_date: string | null
          last_price: number | null
          order_count: number | null
          supplier: string | null
          supplier_id: string | null
        }
        Relationships: []
      }
      inventory_items_view: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          dimensions: string | null
          id: string | null
          item_code: string | null
          item_type: string | null
          low_stock: boolean | null
          material_grade: string | null
          parent_item_id: string | null
          quantity_on_hand: number | null
          reorder_threshold: number | null
          source_job_code: string | null
          source_job_id: string | null
          stock_value: number | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
          warehouse_location: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_low_stock: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          dimensions: string | null
          id: string | null
          item_code: string | null
          item_type: string | null
          low_stock: boolean | null
          material_grade: string | null
          parent_item_id: string | null
          quantity_on_hand: number | null
          reorder_threshold: number | null
          source_job_code: string | null
          source_job_id: string | null
          stock_value: number | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
          warehouse_location: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      job_workforce_contacts: {
        Row: {
          days_worked: number | null
          first_worked: string | null
          ho_no: string | null
          job_id: string | null
          last_worked: string | null
          name: string | null
          normal_hours: number | null
          ot_hours: number | null
          personnel_id: string | null
          qualification_expiry: string | null
          trade: string | null
          welder_qualification: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_view: {
        Row: {
          actual_cost: number | null
          charge_to_site: number | null
          code_tail: string | null
          comments: string | null
          company_job_code: string | null
          completion_date: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          description: string | null
          exit_outpass: string | null
          final_quote: number | null
          id: string | null
          inbound_outpass: string | null
          job_code: string | null
          lpo_ref: string | null
          margin: number | null
          pl_percentage: number | null
          profit_loss: number | null
          project_id: string | null
          qty: number | null
          quotation_ref: string | null
          quote_before_margin: number | null
          requisition_no: string | null
          site_code: string | null
          site_id: string | null
          site_name: string | null
          start_date: string | null
          status: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      projects_view: {
        Row: {
          actual_completion: string | null
          actual_value: number | null
          client_id: string | null
          client_name: string | null
          completed_job_count: number | null
          contract_value: number | null
          created_at: string | null
          created_by: string | null
          id: string | null
          job_count: number | null
          name: string | null
          notes: string | null
          project_code: string | null
          quoted_value: number | null
          site_code: string | null
          site_id: string | null
          site_name: string | null
          start_date: string | null
          status: string | null
          target_completion: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      rough_sheet_aggregated: {
        Row: {
          dimension: string | null
          grade: string | null
          job_id: string | null
          line_count: number | null
          order_qty: number | null
          profile_type: string | null
          theoretical_qty: number | null
          total_length: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rough_sheet_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rough_sheet_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_create_user: {
        Args: {
          p_email: string
          p_full_name: string
          p_password: string
          p_tier: number
        }
        Returns: string
      }
      admin_reset_password: {
        Args: { p_password: string; p_user_id: string }
        Returns: undefined
      }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_user_tier: { Args: never; Returns: number }
      dashboard_financial_kpis: { Args: { p_month: string }; Returns: Json }
      global_search: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          href: string
          id: string
          kind: string
          meta: string
          subtitle: string
          title: string
        }[]
      }
      next_job_seq: { Args: { p_year_month: string }; Returns: number }
      next_project_seq: { Args: { p_year: string }; Returns: number }
      plate_sheet_area: { Args: { p_size: string }; Returns: number }
      recompute_all_jobs: { Args: never; Returns: undefined }
      recompute_inventory_on_hand: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      recompute_job_financials: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      status_to_prefix: { Args: { p_status: string }; Returns: string }
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
