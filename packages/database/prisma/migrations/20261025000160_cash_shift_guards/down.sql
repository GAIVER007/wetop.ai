DROP TRIGGER cash_shift_operation_guard ON restaurant_cash_operations;
DROP TRIGGER cash_handover_integrity_guard ON cash_handovers;
DROP FUNCTION cash_handover_integrity_guard();
DROP TRIGGER cash_shift_operation_guard ON cash_operations;
DROP FUNCTION cash_shift_operation_guard();
DROP TRIGGER cash_shift_integrity_guard ON cash_shifts;
DROP FUNCTION cash_shift_integrity_guard();
DROP TRIGGER cash_register_scope_guard ON cash_registers;
DROP FUNCTION cash_register_scope_guard();

GRANT UPDATE ON cash_commands TO wetop_app,wetop_service;
