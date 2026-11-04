-- ManiHub private messaging foundation
-- Apply in the Supabase SQL Editor after reviewing the policies.

create table if not exists public.manihub_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null check (conversation_type in ('support','seller_customer','ai_assistant')),
  subject text,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manihub_conversation_participants (
  conversation_id uuid not null references public.manihub_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null default 'member' check (participant_role in ('member','support_agent')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);

create table if not exists public.manihub_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.manihub_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists manihub_conversations_creator_idx on public.manihub_conversations(created_by,created_at desc);
create index if not exists manihub_participants_user_idx on public.manihub_conversation_participants(user_id,conversation_id);
create index if not exists manihub_messages_conversation_idx on public.manihub_messages(conversation_id,created_at);

alter table public.manihub_conversations enable row level security;
alter table public.manihub_conversation_participants enable row level security;
alter table public.manihub_messages enable row level security;

drop policy if exists "Participants can view their conversations" on public.manihub_conversations;
create policy "Participants can view their conversations"
on public.manihub_conversations for select to authenticated
using (exists (
  select 1 from public.manihub_conversation_participants p
  where p.conversation_id = id and p.user_id = (select auth.uid())
));

drop policy if exists "Signed-in users can create conversations" on public.manihub_conversations;
create policy "Signed-in users can create conversations"
on public.manihub_conversations for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "Participants can view participant lists" on public.manihub_conversation_participants;
create policy "Participants can view participant lists"
on public.manihub_conversation_participants for select to authenticated
using (exists (
  select 1 from public.manihub_conversation_participants mine
  where mine.conversation_id = public.manihub_conversation_participants.conversation_id and mine.user_id = (select auth.uid())
));

drop policy if exists "Conversation creator can add participants" on public.manihub_conversation_participants;
create policy "Conversation creator can add participants"
on public.manihub_conversation_participants for insert to authenticated
with check (
  exists (
    select 1 from public.manihub_conversations c
    where c.id = conversation_id and c.created_by = (select auth.uid())
  )
);

drop policy if exists "Participants can read messages" on public.manihub_messages;
create policy "Participants can read messages"
on public.manihub_messages for select to authenticated
using (exists (
  select 1 from public.manihub_conversation_participants p
  where p.conversation_id = conversation_id and p.user_id = (select auth.uid())
));

drop policy if exists "Participants can send messages as themselves" on public.manihub_messages;
create policy "Participants can send messages as themselves"
on public.manihub_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.manihub_conversation_participants p
    where p.conversation_id = conversation_id and p.user_id = (select auth.uid())
  )
);

-- Read receipts will be added through a narrowly scoped server function so
-- a client cannot rewrite message content or sender identity.
