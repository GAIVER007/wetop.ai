-- Откат 20261010000078_seller_prompt_versions: история инструкций теряется, сами инструкции (`seller_profiles.prompt_text`)
-- остаются. Перед откатом снять копию (`docs/deploy.md`).
DROP TABLE IF EXISTS "seller_prompt_versions";
