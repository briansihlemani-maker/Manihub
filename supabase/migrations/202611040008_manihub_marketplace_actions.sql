-- ManiHub secure marketplace actions
-- Additive migration. Apply after 202611040007_manihub_catalogue_orders_reviews.sql.
-- Supports both individual sellers and registered businesses.
alter table public.manihub_stores add column if not exists seller_type text not null default 'business';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'manihub_stores_seller_type_check') then
    alter table public.manihub_stores add constraint manihub_stores_seller_type_check check (seller_type in ('individual','business'));
  end if;
end $$;

-- No service-role key is exposed to the browser. Payment collection remains disabled
-- until a payment provider and signed webhook are configured.

create or replace function public.manihub_start_seller_conversation(p_store_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_conversation uuid;
begin
  if v_user is null then
    raise exception 'Sign in to message a seller';
  end if;

  select owner_id into v_owner
  from public.manihub_stores
  where id = p_store_id and status = 'active';

  if v_owner is null then
    raise exception 'Store not found or unavailable';
  end if;

  if v_owner = v_user then
    raise exception 'You cannot start a customer conversation with your own store';
  end if;

  select c.id into v_conversation
  from public.manihub_conversations c
  join public.manihub_conversation_participants p1
    on p1.conversation_id = c.id and p1.user_id = v_user
  join public.manihub_conversation_participants p2
    on p2.conversation_id = c.id and p2.user_id = v_owner
  where c.conversation_type = 'seller_customer'
    and c.status = 'open'
    and c.subject = 'Store:' || p_store_id::text
  limit 1;

  if v_conversation is not null then
    return v_conversation;
  end if;

  insert into public.manihub_conversations
    (conversation_type, subject, created_by)
  values
    ('seller_customer', 'Store:' || p_store_id::text, v_user)
  returning id into v_conversation;

  insert into public.manihub_conversation_participants
    (conversation_id, user_id, participant_role)
  values
    (v_conversation, v_user, 'member'),
    (v_conversation, v_owner, 'member')
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation;
end;
$$;

revoke all on function public.manihub_start_seller_conversation(uuid) from public;
grant execute on function public.manihub_start_seller_conversation(uuid) to authenticated;

create or replace function public.manihub_create_order(
  p_items jsonb,
  p_fulfilment_method text default 'collection',
  p_delivery_address jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer uuid := auth.uid();
  v_order_id uuid;
  v_line record;
  v_product public.manihub_store_products%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_total_items integer := 0;
begin
  if v_buyer is null then
    raise exception 'Sign in before placing an order';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Your basket is empty or too large';
  end if;

  if p_fulfilment_method not in ('collection','delivery') then
    raise exception 'Choose collection or delivery';
  end if;

  if p_fulfilment_method = 'delivery'
     and (p_delivery_address is null or jsonb_typeof(p_delivery_address) <> 'object') then
    raise exception 'A delivery address is required';
  end if;

  -- Lock each product while validating the current price and stock.
  for v_line in
    select x.product_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id
  loop
    if v_line.product_id is null or v_line.quantity is null or v_line.quantity < 1 or v_line.quantity > 100 then
      raise exception 'Invalid product or quantity in basket';
    end if;

    select * into v_product
    from public.manihub_store_products
    where id = v_line.product_id
    for update;

    if not found or v_product.status <> 'active' then
      raise exception 'A product in your basket is no longer available';
    end if;

    if v_product.stock_quantity < v_line.quantity then
      raise exception 'Not enough stock for %', v_product.product_name;
    end if;

    if not exists (
      select 1 from public.manihub_stores s
      where s.id = v_product.store_id and s.status = 'active'
    ) then
      raise exception 'A store in your basket is unavailable';
    end if;

    v_subtotal := v_subtotal + (v_product.price_zar * v_line.quantity);
    v_total_items := v_total_items + v_line.quantity;
  end loop;

  if v_total_items < 1 then
    raise exception 'Your basket is empty';
  end if;

  -- Delivery and payment fees are intentionally zero until their trusted
  -- server-side quote/provider integrations are configured.
  insert into public.manihub_orders (
    buyer_id, status, payment_status, fulfilment_method, delivery_address,
    item_subtotal_zar, delivery_fee_zar, payment_service_fee_zar, total_zar
  ) values (
    v_buyer, 'pending_payment', 'unpaid', p_fulfilment_method, p_delivery_address,
    v_subtotal, 0, 0, v_subtotal
  ) returning id into v_order_id;

  for v_line in
    select x.product_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id
  loop
    select * into v_product
    from public.manihub_store_products
    where id = v_line.product_id;

    update public.manihub_store_products
    set stock_quantity = stock_quantity - v_line.quantity,
        status = case when stock_quantity - v_line.quantity = 0 then 'out_of_stock' else status end,
        updated_at = now()
    where id = v_line.product_id;

    insert into public.manihub_order_items (
      order_id, store_id, seller_id, product_id,
      product_name_snapshot, unit_price_zar, quantity, line_total_zar
    ) values (
      v_order_id, v_product.store_id, v_product.owner_id, v_product.id,
      v_product.product_name, v_product.price_zar, v_line.quantity,
      v_product.price_zar * v_line.quantity
    );
  end loop;

  insert into public.manihub_order_events(order_id, actor_id, event_type, note)
  values (v_order_id, v_buyer, 'order_created', 'Order created; awaiting payment setup.');

  return v_order_id;
end;
$$;

revoke all on function public.manihub_create_order(jsonb,text,jsonb) from public;
grant execute on function public.manihub_create_order(jsonb,text,jsonb) to authenticated;

comment on function public.manihub_create_order(jsonb,text,jsonb) is
  'Creates a pending unpaid order using database prices and locked stock. Does not collect payment or calculate delivery fees.';


create or replace function public.manihub_seller_update_order_status(
  p_order_id uuid,
  p_new_status text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_order public.manihub_orders%rowtype;
  v_allowed boolean := false;
begin
  if v_user is null then
    raise exception 'Sign in to manage seller orders';
  end if;

  if p_new_status not in ('accepted','preparing','ready_for_collection','out_for_delivery','completed') then
    raise exception 'Unsupported seller order status';
  end if;

  select * into v_order
  from public.manihub_orders
  where id = p_order_id
    and exists (
      select 1 from public.manihub_order_items oi
      where oi.order_id = p_order_id and oi.seller_id = v_user
    )
  for update;

  if not found then
    raise exception 'Order not found for this seller';
  end if;

  if v_order.payment_status not in ('paid','partially_refunded') then
    raise exception 'This order cannot be processed until payment is confirmed';
  end if;

  v_allowed := case
    when v_order.status = 'paid' and p_new_status = 'accepted' then true
    when v_order.status = 'accepted' and p_new_status = 'preparing' then true
    when v_order.status = 'preparing' and p_new_status in ('ready_for_collection','out_for_delivery') then true
    when v_order.status in ('ready_for_collection','out_for_delivery') and p_new_status = 'completed' then true
    else false
  end;

  if not v_allowed then
    raise exception 'That order status change is not allowed';
  end if;

  update public.manihub_orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id;

  insert into public.manihub_order_events(order_id, actor_id, event_type, note)
  values (p_order_id, v_user, 'seller_status_updated', p_new_status);

  return true;
end;
$$;

revoke all on function public.manihub_seller_update_order_status(uuid,text) from public;
grant execute on function public.manihub_seller_update_order_status(uuid,text) to authenticated;
