BEGIN READ ONLY;
SELECT migration_name, finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied FROM public._prisma_migrations WHERE migration_name >= '20260930000035' ORDER BY migration_name;
SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='reservations' AND column_name='promo_code_id') OR (table_name='seller_agents' AND column_name='location_id') OR (table_name='seller_profiles' AND column_name='agent_id'));
SELECT public.seller_scope_assert();
ROLLBACK;
