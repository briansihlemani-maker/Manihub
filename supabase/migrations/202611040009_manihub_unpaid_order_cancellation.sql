-- ManiHub unpaid-order cancellation and stock restoration
-- Apply after 202611040008_manihub_marketplace_actions.sql.
-- This gives buyers a safe way to release stock reserved by an unpaid order.
-- Automatic expiry is deliberately not enabled until a trusted scheduler is configured.

create or replace function public.manihub_cancel_unpaid_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_order public.manihub_orders%rowtype;
  v_item record;
begin
  if v_user is null then
    raise exception 'Sign in to cancel this order';
  end if;

  select * into v_order
  from public.manihub_orders
  where id = p_order_id
    and buyer_id = v_user
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'pending_payment'
     or v_order.payment_status <> 'unpaid' then
    raise exception 'Only unpaid orders awaiting payment can be cancelled';
  end if;

  -- Restore each still-linked product exactly once from the order snapshots.
  for v_item in
    select product_id, sum(quantity)::integer as quantity
    from public.manihub_order_items
    where order_id = p_order_id
      and product_id is not null
    group by product_id
    order by product_id
  loop
    update public.manihub_store_products
    set stock_quantity = stock_quantity + v_item.quantity,
        status = case
          when status = 'out_of_stock' then 'active'
          else status
        end,
        updated_at = now()
    where id = v_item.product_id;
  end loop;

  update public.manihub_orders
  set status = 'cancelled',
      updated_at = now()
  where id = p_order_id;

  insert into public.manihub_order_events(order_id, actor_id, event_type, note)
  values (
    p_order_id,
    v_user,
    'order_cancelled',
    'Buyer cancelled the unpaid order; reserved stock was released.'
  );

  return true;
end;
$$;

revoke all on function public.manihub_cancel_unpaid_order(uuid) from public;
grant execute on function public.manihub_cancel_unpaid_order(uuid) to authenticated;

comment on function public.manihub_cancel_unpaid_order(uuid) is
  'Cancels a buyer-owned unpaid pending order and restores its reserved product stock. Does not process refunds or payments.';
