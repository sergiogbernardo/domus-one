begin;

-- Platform administrators are global operators and must never be presented as
-- condominium staff. Preserve a cleanup event, then remove memberships created
-- before the overlap protection was introduced.
insert into public.audit_events (
  condominium_id,
  actor_id,
  action,
  entity_type,
  entity_id,
  metadata
)
select
  sm.condominium_id,
  null,
  'legacy_platform_membership_removed',
  'staff_membership',
  sm.id,
  jsonb_build_object(
    'email', coalesce(sm.invited_email, u.email),
    'previous_status', sm.status,
    'reason', 'platform_administrator_cannot_join_condominium'
  )
from public.staff_memberships sm
join public.platform_admins pa
  on pa.user_id = sm.user_id
  or exists (
    select 1
    from auth.users matched_user
    where matched_user.id = pa.user_id
      and sm.invited_email is not null
      and lower(matched_user.email) = lower(sm.invited_email)
  )
left join auth.users u on u.id = pa.user_id;

delete from public.staff_memberships sm
using public.platform_admins pa
where sm.user_id = pa.user_id
   or exists (
     select 1
     from auth.users matched_user
     where matched_user.id = pa.user_id
       and sm.invited_email is not null
       and lower(matched_user.email) = lower(sm.invited_email)
   );

commit;
