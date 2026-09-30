SELECT count(*) AS invalid_profiles FROM seller_profiles p LEFT JOIN seller_agents a ON a.id = p.agent_id
WHERE p.agent_id IS NULL OR a.id IS NULL OR a.organization_id <> p.organization_id;
SELECT pg_get_constraintdef(oid) AS profile_primary_key FROM pg_constraint
WHERE conrelid = 'seller_profiles'::regclass AND contype = 'p';
