update public.role_tracks
set modules = modules || '["system-design"]'::jsonb
where id = 'software-engineer' and not (modules ? 'system-design');
