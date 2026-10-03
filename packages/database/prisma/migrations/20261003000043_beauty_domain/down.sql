-- Откат 20261003000043_beauty_domain: убрать Beauty-домен целиком.
-- Hospitality миграция не трогала, поэтому откат на него не влияет. Записи, клиенты, мастера и услуги
-- салонов теряются: перед откатом снять копию (`docs/deploy.md`).
DROP TRIGGER IF EXISTS "appointments_guard" ON "appointments";
DROP TRIGGER IF EXISTS "working_hours_guard" ON "working_hours";
DROP TRIGGER IF EXISTS "employee_services_guard" ON "employee_services";
DROP TRIGGER IF EXISTS "location_services_guard" ON "location_services";
DROP TRIGGER IF EXISTS "employee_locations_guard" ON "employee_locations";
DROP TRIGGER IF EXISTS "customer_businesses_guard" ON "customer_businesses";

DROP FUNCTION IF EXISTS beauty_appointment_guard();
DROP FUNCTION IF EXISTS beauty_working_hours_guard();
DROP FUNCTION IF EXISTS beauty_employee_service_guard();
DROP FUNCTION IF EXISTS beauty_location_service_guard();
DROP FUNCTION IF EXISTS beauty_employee_location_guard();
DROP FUNCTION IF EXISTS beauty_customer_business_guard();

DROP TABLE IF EXISTS "appointments";
DROP TABLE IF EXISTS "time_offs";
DROP TABLE IF EXISTS "working_hours";
DROP TABLE IF EXISTS "employee_services";
DROP TABLE IF EXISTS "location_services";
DROP TABLE IF EXISTS "beauty_services";
DROP TABLE IF EXISTS "employee_locations";
DROP TABLE IF EXISTS "employees";
DROP TABLE IF EXISTS "customer_businesses";
DROP TABLE IF EXISTS "customers";

DROP TYPE IF EXISTS "AppointmentStatus";
DROP TYPE IF EXISTS "EmployeeStatus";
DROP TYPE IF EXISTS "CustomerStatus";
