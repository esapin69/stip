-- Pin resolution for all functions reported by the Supabase security advisor.
-- Keep public because these routines intentionally reference public STIP tables.

alter function public.stip_hfme_recalc_sort(text)
  set search_path = public, pg_temp;
alter function public.stip_hfme_relation_sort_trigger()
  set search_path = public, pg_temp;
alter function public.stip_is_hfme_descendant(text)
  set search_path = public, pg_temp;
alter function public.stip_refresh_hfme_spatial_order(text)
  set search_path = public, pg_temp;
alter function public.stip_refresh_hfme_spatial_order_from_relation()
  set search_path = public, pg_temp;
alter function public.stip_staffing_file_priority(text, date)
  set search_path = public, pg_temp;
alter function public.stip_staffing_shift_group(text)
  set search_path = public, pg_temp;
alter function public.stip_sync_permission_levels()
  set search_path = public, pg_temp;
