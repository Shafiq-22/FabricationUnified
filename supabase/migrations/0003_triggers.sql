-- =====================================================================
-- 0003_triggers: attach triggers (ordered by name within a timing)
-- =====================================================================

-- jobs: code + financials + updated_at + soft-delete guard
create trigger t10_set_job_code        before insert on public.jobs
  for each row execute function public.set_job_code();
create trigger t20_compute_financials  before insert or update on public.jobs
  for each row execute function public.jobs_compute_financials();
create trigger t30_update_code_status  before update on public.jobs
  for each row execute function public.update_job_code_status();
create trigger t40_guard_soft_delete   before update on public.jobs
  for each row execute function public.guard_soft_delete();
create trigger t50_set_updated_at      before update on public.jobs
  for each row execute function public.set_updated_at();

-- updated_at on other mutated entities
create trigger t50_set_updated_at before update on public.roles_config
  for each row execute function public.set_updated_at();
create trigger t50_set_updated_at before update on public.handover_items
  for each row execute function public.set_updated_at();

-- soft-delete guard on the other soft-deletable record tables
create trigger t40_guard_soft_delete before update on public.consumables
  for each row execute function public.guard_soft_delete();
create trigger t40_guard_soft_delete before update on public.job_materials
  for each row execute function public.guard_soft_delete();
create trigger t40_guard_soft_delete before update on public.handover_items
  for each row execute function public.guard_soft_delete();

-- last-admin guard
create trigger t10_guard_last_admin before update or delete on public.users
  for each row execute function public.guard_last_admin();

-- ---------------------------------------------------------------------
-- Audit log on every mutable business table (runs after the row change)
-- ---------------------------------------------------------------------
create trigger z_audit after insert or update or delete on public.roles_config
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.sites
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.users
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.labour_rates
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.jobs
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_quote_materials
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_actual_materials
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_quote_workforce
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_actual_workforce
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_quotation_summary
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_actual_summary
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_comments
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.rough_sheet_items
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.cut_list_plates
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.consumables
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.job_materials
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.handover_items
  for each row execute function public.audit_trigger();
create trigger z_audit after insert or update or delete on public.drawings
  for each row execute function public.audit_trigger();
