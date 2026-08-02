export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: { key: string; updated_at: string; value: string | null }
        Insert: { key: string; updated_at?: string; value?: string | null }
        Update: { key?: string; updated_at?: string; value?: string | null }
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
      personnel: {
        Row: { active: boolean; created_at: string; created_by: string | null; ho_no: string | null; id: string; name: string; trade: string | null }
        Insert: { active?: boolean; created_at?: string; created_by?: string | null; ho_no?: string | null; id?: string; name: string; trade?: string | null }
        Update: { active?: boolean; created_at?: string; created_by?: string | null; ho_no?: string | null; id?: string; name?: string; trade?: string | null }
        Relationships: []
      }
      equipment: {
        Row: { active: boolean; bare_rate: number | null; created_at: string; created_by: string | null; device_group: string | null; driver_rate: number | null; id: string; machine: string; make: string | null; sixco_no: string | null; type: string | null }
        Insert: { active?: boolean; bare_rate?: number | null; created_at?: string; created_by?: string | null; device_group?: string | null; driver_rate?: number | null; id?: string; machine: string; make?: string | null; sixco_no?: string | null; type?: string | null }
        Update: { active?: boolean; bare_rate?: number | null; created_at?: string; created_by?: string | null; device_group?: string | null; driver_rate?: number | null; id?: string; machine?: string; make?: string | null; sixco_no?: string | null; type?: string | null }
        Relationships: []
      }
      timesheet_entries: {
        Row: { begin_time: string | null; created_at: string; created_by: string | null; end_time: string | null; entry_date: string; id: string; job_description: string | null; job_id: string | null; job_ref: string | null; normal_hours: number | null; ot_hours: number | null; personnel_id: string; site: string | null }
        Insert: { begin_time?: string | null; created_at?: string; created_by?: string | null; end_time?: string | null; entry_date: string; id?: string; job_description?: string | null; job_id?: string | null; job_ref?: string | null; normal_hours?: number | null; ot_hours?: number | null; personnel_id: string; site?: string | null }
        Update: { begin_time?: string | null; created_at?: string; created_by?: string | null; end_time?: string | null; entry_date?: string; id?: string; job_description?: string | null; job_id?: string | null; job_ref?: string | null; normal_hours?: number | null; ot_hours?: number | null; personnel_id?: string; site?: string | null }
        Relationships: []
      }
      equipment_usage: {
        Row: { created_at: string; created_by: string | null; equipment_id: string; id: string; status_code: string; usage_date: string }
        Insert: { created_at?: string; created_by?: string | null; equipment_id: string; id?: string; status_code: string; usage_date: string }
        Update: { created_at?: string; created_by?: string | null; equipment_id?: string; id?: string; status_code?: string; usage_date?: string }
        Relationships: []
      }
      documents: {
        Row: { deleted_at: string | null; doc_type: string; file_path: string; id: string; job_id: string | null; mime_type: string | null; notes: string | null; original_filename: string | null; project_id: string | null; revision: string | null; size_bytes: number | null; title: string | null; uploaded_at: string; uploaded_by: string | null }
        Insert: { deleted_at?: string | null; doc_type?: string; file_path: string; id?: string; job_id?: string | null; mime_type?: string | null; notes?: string | null; original_filename?: string | null; project_id?: string | null; revision?: string | null; size_bytes?: number | null; title?: string | null; uploaded_at?: string; uploaded_by?: string | null }
        Update: { deleted_at?: string | null; doc_type?: string; file_path?: string; id?: string; job_id?: string | null; mime_type?: string | null; notes?: string | null; original_filename?: string | null; project_id?: string | null; revision?: string | null; size_bytes?: number | null; title?: string | null; uploaded_at?: string; uploaded_by?: string | null }
        Relationships: []
      }
      inventory_items: {
        Row: { active: boolean; created_at: string; created_by: string | null; description: string; dimensions: string | null; id: string; item_code: string | null; item_type: string; material_grade: string | null; parent_item_id: string | null; quantity_on_hand: number; reorder_threshold: number | null; source_job_id: string | null; unit: string | null; unit_cost: number | null; updated_at: string; warehouse_location: string | null }
        Insert: { active?: boolean; created_at?: string; created_by?: string | null; description: string; dimensions?: string | null; id?: string; item_code?: string | null; item_type?: string; material_grade?: string | null; parent_item_id?: string | null; reorder_threshold?: number | null; source_job_id?: string | null; unit?: string | null; unit_cost?: number | null; warehouse_location?: string | null }
        Update: { active?: boolean; created_at?: string; created_by?: string | null; description?: string; dimensions?: string | null; id?: string; item_code?: string | null; item_type?: string; material_grade?: string | null; parent_item_id?: string | null; reorder_threshold?: number | null; source_job_id?: string | null; unit?: string | null; unit_cost?: number | null; warehouse_location?: string | null }
        Relationships: []
      }
      inventory_movements: {
        Row: { created_at: string; created_by: string | null; id: string; inventory_item_id: string; job_id: string | null; job_material_id: string | null; moved_on: string; movement_type: string; note: string | null; qty: number }
        Insert: { created_at?: string; created_by?: string | null; id?: string; inventory_item_id: string; job_id?: string | null; job_material_id?: string | null; moved_on?: string; movement_type: string; note?: string | null; qty: number }
        Update: { created_at?: string; created_by?: string | null; id?: string; inventory_item_id?: string; job_id?: string | null; job_material_id?: string | null; moved_on?: string; movement_type?: string; note?: string | null; qty?: number }
        Relationships: []
      }
      suppliers: {
        Row: { active: boolean; category: string | null; contact_email: string | null; contact_name: string | null; contact_phone: string | null; created_at: string; created_by: string | null; id: string; name: string }
        Insert: { active?: boolean; category?: string | null; contact_email?: string | null; contact_name?: string | null; contact_phone?: string | null; created_at?: string; created_by?: string | null; id?: string; name: string }
        Update: { active?: boolean; category?: string | null; contact_email?: string | null; contact_name?: string | null; contact_phone?: string | null; created_at?: string; created_by?: string | null; id?: string; name?: string }
        Relationships: []
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
        Relationships: []
      }
      cut_list_plates: {
        Row: {
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      job_actual_materials: {
        Row: {
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
          id?: string
          job_id: string
          material_name?: string | null
          qty?: number | null
          seq_no?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          job_id?: string
          material_name?: string | null
          qty?: number | null
          seq_no?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: []
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
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string | null
          job_id?: string
          qty?: number | null
          seq_no?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: []
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
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string | null
          job_id?: string
          qty?: number | null
          seq_no?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: []
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
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string | null
          job_id?: string
          qty?: number | null
          seq_no?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: []
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
        }
        Relationships: []
      }
      job_code_sequences: {
        Row: { last_seq: number; year_month: string }
        Insert: { last_seq?: number; year_month: string }
        Update: { last_seq?: number; year_month?: string }
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
        Relationships: []
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
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: []
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
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string | null
          job_id?: string
          qty?: number | null
          seq_no?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: []
      }
      job_quote_materials: {
        Row: {
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
          id?: string
          job_id: string
          material_name?: string | null
          qty?: number | null
          seq_no?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          job_id?: string
          material_name?: string | null
          qty?: number | null
          seq_no?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: []
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
        }
        Relationships: []
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
        Relationships: []
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
          id?: string
          inbound_outpass?: string | null
          job_code?: string | null
          lpo_ref?: string | null
          margin?: number
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
          id?: string
          inbound_outpass?: string | null
          job_code?: string | null
          lpo_ref?: string | null
          margin?: number
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
          id?: string
          job_id: string
          length_m?: number | null
          profile_type?: string | null
          qty?: number | null
          seq_no?: number | null
        }
        Update: {
          dimension?: string | null
          id?: string
          job_id?: string
          length_m?: number | null
          profile_type?: string | null
          qty?: number | null
          seq_no?: number | null
        }
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      inventory_items_view: {
        Row: { active: boolean | null; created_at: string | null; description: string | null; dimensions: string | null; id: string | null; item_code: string | null; item_type: string | null; low_stock: boolean | null; material_grade: string | null; parent_item_id: string | null; quantity_on_hand: number | null; reorder_threshold: number | null; source_job_code: string | null; source_job_id: string | null; stock_value: number | null; unit: string | null; unit_cost: number | null; updated_at: string | null; warehouse_location: string | null }
        Relationships: []
      }
      inventory_low_stock: {
        Row: { active: boolean | null; created_at: string | null; description: string | null; dimensions: string | null; id: string | null; item_code: string | null; item_type: string | null; low_stock: boolean | null; material_grade: string | null; parent_item_id: string | null; quantity_on_hand: number | null; reorder_threshold: number | null; source_job_code: string | null; source_job_id: string | null; stock_value: number | null; unit: string | null; unit_cost: number | null; updated_at: string | null; warehouse_location: string | null }
        Relationships: []
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
      cut_list_plates_aggregated: {
        Row: {
          area_used: number | null
          job_id: string | null
          plate_size: string | null
          sheets_required: number | null
          thickness_mm: number | null
        }
        Relationships: []
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
        Relationships: []
      }
      rough_sheet_aggregated: {
        Row: {
          dimension: string | null
          job_id: string | null
          line_count: number | null
          order_qty: number | null
          profile_type: string | null
          theoretical_qty: number | null
          total_length: number | null
        }
        Relationships: []
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
      auth_is_admin: { Args: Record<string, never>; Returns: boolean }
      auth_user_tier: { Args: Record<string, never>; Returns: number }
      dashboard_financial_kpis: { Args: { p_month: string }; Returns: Json }
      next_job_seq: { Args: { p_year_month: string }; Returns: number }
      recompute_all_jobs: { Args: Record<string, never>; Returns: undefined }
      recompute_job_financials: { Args: { p_job_id: string }; Returns: undefined }
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
