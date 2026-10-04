-- Откат 20261003000050_membership_contacts: введённые телефоны и должности сотрудников теряются.
ALTER TABLE "memberships"
  DROP CONSTRAINT IF EXISTS "memberships_position_not_blank",
  DROP CONSTRAINT IF EXISTS "memberships_phone_e164",
  DROP COLUMN IF EXISTS "position",
  DROP COLUMN IF EXISTS "phone";
