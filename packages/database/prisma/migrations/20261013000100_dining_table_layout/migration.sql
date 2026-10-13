-- Схема зала (DATA_MODEL §42, v2.25, ADR-174): место, форма, размер и поворот стола

-- CreateEnum
CREATE TYPE "DiningTableShape" AS ENUM ('ROUND', 'SQUARE', 'RECT');

-- AlterTable
ALTER TABLE "dining_tables" ADD COLUMN "pos_x" SMALLINT,
ADD COLUMN "pos_y" SMALLINT,
ADD COLUMN "shape" "DiningTableShape",
ADD COLUMN "scale" SMALLINT NOT NULL DEFAULT 100,
ADD COLUMN "rotation" SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_layout" CHECK (
  (pos_x IS NULL) = (pos_y IS NULL)
  AND (pos_x IS NULL OR (pos_x BETWEEN 0 AND 1000 AND pos_y BETWEEN 0 AND 1000))
  AND scale BETWEEN 50 AND 200
  AND rotation IN (0, 90)
);
