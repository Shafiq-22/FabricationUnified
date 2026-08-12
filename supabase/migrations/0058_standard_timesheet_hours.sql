-- =====================================================================
-- 0058: Standard working hours for the timesheet (Changes III item 11).
--
-- The timesheet asked for a Begin and an End time against every person,
-- every day. The shop works a standard day, so that was ~20 identical pairs
-- typed each morning. The times now come from Settings and are applied to
-- every line; the per-row columns go away.
--
-- The begin_time / end_time columns on timesheet_entries are deliberately
-- KEPT and still written, with the standard values. They are what the
-- timesheet PDF prints, and keeping them means historic entries -- which
-- have real typed times -- stay readable and are not retro-fitted with
-- today's standard.
-- =====================================================================

insert into public.app_config (key, value) values
  ('standard_start_time', '07:00'),
  ('standard_end_time',   '17:00')
on conflict (key) do nothing;
