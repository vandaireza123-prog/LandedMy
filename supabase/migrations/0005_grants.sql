-- Access rights for the API roles. Some projects do not carry Supabase's default privileges, so tables
-- created by 0003/0004 were unreadable through PostgREST ("permission denied for table duty_rates").
-- Row-level security policies still decide which rows each role may see.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.hs_codes, public.rate_sources, public.duty_rates to anon, authenticated, service_role;
grant all on public.hs_codes, public.rate_sources, public.duty_rates to service_role;
grant select, insert, update, delete on public.declarations to authenticated, service_role;
grant select, insert, update, delete on public.api_keys to authenticated, service_role;
grant execute on function public.best_duty(text, text, text, date) to anon, authenticated, service_role;
grant execute on function public.touch_api_key(text) to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
