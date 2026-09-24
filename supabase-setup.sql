-- =====================================================================
--  ASCENT · one-time Supabase setup
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  Safe to run more than once. It does not delete any of your data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LOCK YOUR EXISTING TABLES
--    Your key is public (that's normal), so without this anyone with the
--    link could read your debts. After this, only a logged-in user can.
-- ---------------------------------------------------------------------
alter table public.liabilities       enable row level security;
alter table public.cashflow_schedule enable row level security;
alter table public.milestones        enable row level security;
alter table public.wealth_portfolio  enable row level security;

drop policy if exists "ascent signed-in only" on public.liabilities;
drop policy if exists "ascent signed-in only" on public.cashflow_schedule;
drop policy if exists "ascent signed-in only" on public.milestones;
drop policy if exists "ascent signed-in only" on public.wealth_portfolio;

create policy "ascent signed-in only" on public.liabilities       for all to authenticated using (true) with check (true);
create policy "ascent signed-in only" on public.cashflow_schedule for all to authenticated using (true) with check (true);
create policy "ascent signed-in only" on public.milestones        for all to authenticated using (true) with check (true);
create policy "ascent signed-in only" on public.wealth_portfolio  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 2. SAVINGS POTS: add a goal to each pot, and the pots from the plan
-- ---------------------------------------------------------------------
alter table public.wealth_portfolio add column if not exists goal numeric;
alter table public.wealth_portfolio add column if not exists note text;
alter table public.wealth_portfolio add column if not exists sort int;

update public.wealth_portfolio set goal = 4000, note = 'By ORD, Sep 2028',      sort = 20 where name = 'Emergency Reserves';
update public.wealth_portfolio set goal = 600,  note = 'Starts Mar 2028',       sort = 60 where name = 'Goal: Travel';
update public.wealth_portfolio set goal = 650,  note = '$50/month from Sep 2027', sort = 50 where name = 'Interactive Brokers (IBKR)';
update public.wealth_portfolio set note = 'Not in the plan yet', sort = 70 where name = 'Syfe';

insert into public.wealth_portfolio (name, balance, category, goal, note, sort)
select 'Buffer', 0, 'Cash', 300, 'Target Dec 2026', 10
where not exists (select 1 from public.wealth_portfolio where name = 'Buffer');

insert into public.wealth_portfolio (name, balance, category, goal, note, sort)
select 'Network+ exam', 0, 'Goal', 480, 'Exam Sep 2027', 30
where not exists (select 1 from public.wealth_portfolio where name = 'Network+ exam');

insert into public.wealth_portfolio (name, balance, category, goal, note, sort)
select 'Mum & Dad', 0, 'Goal', 650, '$50/month from Sep 2027', 40
where not exists (select 1 from public.wealth_portfolio where name = 'Mum & Dad');

-- ---------------------------------------------------------------------
-- 3. NEW TABLES FOR THE APP
-- ---------------------------------------------------------------------
create table if not exists public.ascent_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ascent_spend (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null check (amount > 0),
  category text not null,
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.ascent_study (
  id uuid primary key default gen_random_uuid(),
  minutes int not null check (minutes > 0),
  studied_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.ascent_state (
  id int primary key default 1 check (id = 1),
  trading_free_since date not null default current_date,
  updated_at timestamptz not null default now()
);

create table if not exists public.ascent_milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_label text,
  target_date date,
  sort int not null default 0,
  done boolean not null default false,
  done_at timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['ascent_tasks','ascent_spend','ascent_study','ascent_state','ascent_milestones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "ascent signed-in only" on public.%I', t);
    execute format('create policy "ascent signed-in only" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. STARTING DATA
-- ---------------------------------------------------------------------
insert into public.ascent_state (id, trading_free_since) values (1, current_date)
on conflict (id) do nothing;

insert into public.ascent_tasks (title, due_date)
select * from (values
  ('Confirm backup cover with your friend', date '2026-10-01'),
  ('Withdraw and close live broker accounts', date '2026-10-07'),
  ('Remove saved cards and PayNow links from brokers', date '2026-10-07'),
  ('Check GXS and CIMB interest rates', date '2026-10-31'),
  ('Ask Izzat if repaying all $500 in Jan 2028 is OK', date '2027-11-30')
) v(title, due_date)
where not exists (select 1 from public.ascent_tasks);

insert into public.ascent_milestones (title, target_label, target_date, sort, done, done_at)
select * from (values
  ('IPPT passed',                               'Sep 2026', date '2026-09-18', 10,  true,  now()),
  ('Kept the $172 instead of trading it',       'Sep 2026', date '2026-09-24', 20,  true,  now()),
  ('Broker accounts closed',                    'Oct 2026', date '2026-10-07', 30,  false, null::timestamptz),
  ('$300 buffer',                               'Dec 2026', date '2026-12-31', 40,  false, null),
  ('CIMB cleared',                              'Dec 2026', date '2026-12-31', 50,  false, null),
  ('BMT passed out, first study session',       'Jan 2027', date '2027-01-31', 60,  false, null),
  ('$600 saved',                                'Apr 2027', date '2027-04-30', 70,  false, null),
  ('Grab PayLater cleared',                     'Jun 2027', date '2027-06-30', 80,  false, null),
  ('GXS cleared',                               'Jul 2027', date '2027-07-31', 90,  false, null),
  ('Shopee BNPL cleared: all credit gone',      'Aug 2027', date '2027-08-31', 100, false, null),
  ('Network+ passed',                           'Sep 2027', date '2027-09-30', 110, false, null),
  ('First investment and first money to Mum & Dad', 'Sep 2027', date '2027-09-30', 120, false, null),
  ('Izzat repaid: no loans left',               'Jan 2028', date '2028-01-31', 130, false, null),
  ('ORD: fully debt-free, ~$4,000 saved',       'Sep 2028', date '2028-09-30', 140, false, null)
) v(title, target_label, target_date, sort, done, done_at)
where not exists (select 1 from public.ascent_milestones);

-- ---------------------------------------------------------------------
-- 5. DATA FIXES FROM THE ROADMAP REVIEW
-- ---------------------------------------------------------------------
-- October income was marked as received before it arrived:
update public.cashflow_schedule set is_cleared = false where category = 'Income' and month_date = '2026-10-01';
-- NS allowance lands around the 10th, not the 1st:
update public.cashflow_schedule set due_day = 10 where category = 'Income';
