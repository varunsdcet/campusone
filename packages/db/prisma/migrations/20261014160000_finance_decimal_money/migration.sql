-- Store ledger money as exact fixed-point values. Existing floats are rounded
-- once during the conversion so future arithmetic cannot accumulate binary
-- floating-point drift.
ALTER TABLE "FinanceLedgerEntry"
  ALTER COLUMN "amountCad" TYPE DECIMAL(14,2)
  USING ROUND("amountCad"::numeric, 2);
