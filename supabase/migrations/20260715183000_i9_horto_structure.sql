begin;

do $$
declare
  condominium_uuid uuid;
  building_a_uuid uuid;
  building_b_uuid uuid;
begin
  select id into condominium_uuid
  from public.condominiums
  where slug = 'i9-horto';

  if condominium_uuid is null then
    raise exception 'i9_horto_condominium_not_found' using errcode = 'no_data_found';
  end if;

  insert into public.buildings (condominium_id, name, code, floors, sort_order)
  values (condominium_uuid, 'Bloco A', 'A', 16, 0)
  on conflict (condominium_id, code) do update
  set name = excluded.name,
      floors = excluded.floors,
      sort_order = excluded.sort_order
  returning id into building_a_uuid;

  insert into public.buildings (condominium_id, name, code, floors, sort_order)
  values (condominium_uuid, 'Bloco B', 'B', 16, 1)
  on conflict (condominium_id, code) do update
  set name = excluded.name,
      floors = excluded.floors,
      sort_order = excluded.sort_order
  returning id into building_b_uuid;

  insert into public.units (
    condominium_id, building_id, unit_number, floor_label, status
  )
  select
    condominium_uuid,
    building_id,
    floor_number::text || lpad(apartment_position::text, 2, '0'),
    floor_number::text || 'º',
    'active'::public.unit_status
  from (values (building_a_uuid), (building_b_uuid)) as selected_buildings(building_id)
  cross join generate_series(1, 16) as floor_number
  cross join generate_series(1, 8) as apartment_position
  on conflict (building_id, unit_number) do update
  set floor_label = excluded.floor_label,
      status = 'active'::public.unit_status;
end;
$$;

commit;
