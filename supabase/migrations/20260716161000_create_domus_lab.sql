begin;

do $$
declare
  laboratory_id uuid;
  laboratory_building_id uuid;
begin
  insert into public.condominiums (
    name,
    slug,
    registration_code,
    legal_name,
    city,
    state,
    status,
    staff_limit,
    settings
  ) values (
    'Domus Lab',
    'domus-lab',
    'DOMUSLAB',
    'Ambiente de validação Domus One',
    'Campinas',
    'SP',
    'active',
    10,
    jsonb_build_object(
      'environment', 'test',
      'purpose', 'end_to_end_validation'
    )
  )
  on conflict (slug) do update
  set name = excluded.name,
      registration_code = excluded.registration_code,
      legal_name = excluded.legal_name,
      city = excluded.city,
      state = excluded.state,
      status = excluded.status,
      staff_limit = excluded.staff_limit,
      settings = excluded.settings
  returning id into laboratory_id;

  insert into public.buildings (
    condominium_id, name, code, floors, sort_order
  ) values (
    laboratory_id, 'Bloco Teste', 'TESTE', 3, 0
  )
  on conflict (condominium_id, code) do update
  set name = excluded.name,
      floors = excluded.floors,
      sort_order = excluded.sort_order
  returning id into laboratory_building_id;

  insert into public.units (
    condominium_id, building_id, unit_number, floor_label, status
  )
  select
    laboratory_id,
    laboratory_building_id,
    floor_number::text || lpad(position_number::text, 2, '0'),
    floor_number::text || 'º',
    'active'::public.unit_status
  from generate_series(1, 3) as floor_number
  cross join generate_series(1, 4) as position_number
  on conflict (building_id, unit_number) do update
  set floor_label = excluded.floor_label,
      status = excluded.status;
end;
$$;

commit;
