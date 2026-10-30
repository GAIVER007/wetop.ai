-- PAYROLL-DAILY-20261030 (DATA_MODEL): выплаты зарплаты по дням, тип расхода. Аддитивно, у всех сотрудников месяц.
CREATE TYPE "PayFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "ExpenseType" AS ENUM ('DAILY', 'ONE_OFF');

ALTER TABLE employee_pay_settings
  ADD COLUMN pay_frequency "PayFrequency" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN pay_weekday smallint,
  ADD COLUMN pay_method "PaymentMethod";
ALTER TABLE employee_pay_settings
  ADD CONSTRAINT employee_pay_settings_pay_weekday CHECK (
    (pay_frequency = 'WEEKLY' AND pay_weekday BETWEEN 1 AND 7) OR (pay_frequency <> 'WEEKLY' AND pay_weekday IS NULL)
  );

ALTER TABLE restaurant_cash_operations
  ADD COLUMN pay_date date,
  ADD COLUMN expense_type "ExpenseType";
ALTER TABLE restaurant_cash_operations
  ADD CONSTRAINT restaurant_cash_operations_pay_date CHECK (pay_date IS NULL OR employee_id IS NOT NULL),
  ADD CONSTRAINT restaurant_cash_operations_expense_type CHECK (expense_type IS NULL OR kind = 'EXPENSE');

ALTER TABLE cash_operations
  ADD COLUMN expense_type "ExpenseType";
ALTER TABLE cash_operations
  ADD CONSTRAINT cash_operations_expense_type CHECK (expense_type IS NULL OR kind = 'EXPENSE');
