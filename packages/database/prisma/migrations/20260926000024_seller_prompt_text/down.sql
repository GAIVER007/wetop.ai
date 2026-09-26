-- Откат 20260926000024_seller_prompt_text (выполняет владелец). Текст инструкции теряется: до отката его можно
-- выгрузить запросом `select organization_id, prompt_text from seller_profiles where prompt_text is not null`.
ALTER TABLE "seller_profiles" DROP COLUMN "prompt_text";
