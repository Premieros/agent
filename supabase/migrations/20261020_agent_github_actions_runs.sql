-- GitHub Actions execution metadata for authenticated AGENT Work Runs.
-- No new write access to GitHub is created by this migration.
alter table public.assistant_work_runs
  add column if not exists github_request_id uuid,
  add column if not exists github_run_id bigint;
create unique index if not exists agent_work_github_request_unique
  on public.assistant_work_runs(github_request_id)
  where github_request_id is not null;
