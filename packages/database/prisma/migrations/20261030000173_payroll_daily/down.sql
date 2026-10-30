-- Откат 173. Выплаты остаются операциями кассы; теряются только день выплаты и тип расхода.
ALTER TABLE cash_operations DROP CONSTRAINT IF EXISTS cash_operations_expense_type;
ALTER TABLE cash_operations DROP COLUMN IF EXISTS expense_type;
ALTER TABLE restaurant_cash_operations DROP CONSTRAINT IF EXISTS restaurant_cash_operations_expense_type;
ALTER TABLE restaurant_cash_operations DROP CONSTRAINT IF EXISTS restaurant_cash_operations_pay_date;
ALTER TABLE restaurant_cash_operations DROP COLUMN IF EXISTS expense_type;
ALTER TABLE restaurant_cash_operations DROP COLUMN IF EXISTS pay_date;
ALTER TABLE employee_pay_settings DROP CONSTRAINT IF EXISTS employee_pay_settings_pay_weekday;
ALTER TABLE employee_pay_settings DROP COLUMN IF EXISTS pay_method;
ALTER TABLE employee_pay_settings DROP COLUMN IF EXISTS pay_weekday;
ALTER TABLE employee_pay_settings DROP COLUMN IF EXISTS pay_frequency;
DROP TYPE IF EXISTS "ExpenseType";
DROP TYPE IF EXISTS "PayFrequency";
