-- MV1: only extends the canonical Business enum. No backfill or new domain tables.
ALTER TYPE "BusinessVertical" ADD VALUE IF NOT EXISTS 'FOOD_SERVICE';
