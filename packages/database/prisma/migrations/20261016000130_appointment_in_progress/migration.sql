-- Статус записи салона «В процессе» (DATA_MODEL §58, v2.42, Q-BS-2)
ALTER TYPE "AppointmentStatus" ADD VALUE 'IN_PROGRESS' AFTER 'CONFIRMED';
