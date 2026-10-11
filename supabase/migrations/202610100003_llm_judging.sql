-- Retire fixed question test suites without changing personal work or old attempts.
update public.problem_definitions
set data = (data - 'tests' - 'comparison') || jsonb_build_object(
  'examples', coalesce((select jsonb_agg(item - 'example' order by ordinal)
    from jsonb_array_elements(data->'tests') with ordinality as entries(item, ordinal)
    where item->>'example' = 'true'), '[]'::jsonb)
)
where data ? 'tests';

update public.problems set data = jsonb_set(data, '{runnable}', 'true'::jsonb);
