-- ManiHub messaging RLS hardening
-- Apply AFTER 202611040004_manihub_messaging_foundation.sql.
-- SECURITY DEFINER helper avoids recursive RLS when policies check membership.

create or replace function public.manihub_is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.manihub_conversation_participants as p
    where p.conversation_id = p_conversation_id
      and p.user_id = (select auth.uid())
  );
$$;

revoke all on function public.manihub_is_conversation_participant(uuid) from public;
grant execute on function public.manihub_is_conversation_participant(uuid) to authenticated;

drop policy if exists "Participants can view their conversations" on public.manihub_conversations;
create policy "Participants can view their conversations"
on public.manihub_conversations
for select to authenticated
using (public.manihub_is_conversation_participant(id));

drop policy if exists "Participants can view participant lists" on public.manihub_conversation_participants;
create policy "Participants can view participant lists"
on public.manihub_conversation_participants
for select to authenticated
using (public.manihub_is_conversation_participant(conversation_id));

drop policy if exists "Conversation creator can add participants" on public.manihub_conversation_participants;
create policy "Conversation creator can add own member record"
on public.manihub_conversation_participants
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and participant_role = 'member'
  and exists (
    select 1
    from public.manihub_conversations as c
    where c.id = conversation_id
      and c.created_by = (select auth.uid())
  )
);

drop policy if exists "Participants can read messages" on public.manihub_messages;
create policy "Participants can read messages"
on public.manihub_messages
for select to authenticated
using (public.manihub_is_conversation_participant(conversation_id));

drop policy if exists "Participants can send messages as themselves" on public.manihub_messages;
create policy "Participants can send messages as themselves"
on public.manihub_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.manihub_is_conversation_participant(conversation_id)
);
