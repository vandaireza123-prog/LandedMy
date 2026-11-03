-- API keys for /api/calc. The raw key is shown once to the user; only its SHA-256 hash is stored.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'default',
  key_prefix text not null,            -- first 8 chars, for display
  key_hash text not null unique,       -- sha256 hex of the full key
  calls_total bigint not null default 0,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_user_idx on api_keys (user_id, created_at desc);
alter table api_keys enable row level security;
drop policy if exists "own api keys" on api_keys;
create policy "own api keys" on api_keys for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Called by the calc function with the service role: validates a key and counts the call.
create or replace function public.touch_api_key(p_hash text)
returns table (user_id uuid, key_id uuid) language plpgsql security definer as $$
begin
  return query
  update api_keys set calls_total = calls_total + 1, last_used_at = now()
  where key_hash = p_hash and revoked_at is null
  returning api_keys.user_id, api_keys.id;
end $$;
