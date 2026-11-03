-- Server-only request limiter for the Support AI public chat.
-- Requires existing 20261103_support_ai_multproject.sql migration.
create table if not exists public.support_request_limits(
 key_hash text not null,
 window_start timestamptz not null,
 request_count integer not null default 1 check(request_count >= 1),
 primary key(key_hash,window_start)
);
alter table public.support_request_limits enable row level security;
revoke all on public.support_request_limits from public,anon,authenticated;
grant select,insert,update,delete on public.support_request_limits to service_role;
create or replace function public.support_consume_limit(
 p_key_hash text,p_window_start timestamptz,p_max integer
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_count integer;
begin
 if p_key_hash !~ '^[a-f0-9]{64}$' or p_max not between 1 and 100
 then raise exception 'Invalid limit parameters'; end if;
 insert into public.support_request_limits(key_hash,window_start,request_count)
 values(p_key_hash,p_window_start,1)
 on conflict(key_hash,window_start) do update
 set request_count=public.support_request_limits.request_count+1
 where public.support_request_limits.request_count < p_max
 returning request_count into v_count;
 return v_count is not null;
end; $$;
revoke all on function public.support_consume_limit(text,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.support_consume_limit(text,timestamptz,integer) to service_role;
-- Maintenance: securely purge old rate-limit rows with a scheduled database job.
