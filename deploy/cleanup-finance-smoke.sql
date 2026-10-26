-- Removes the Financial Management rows written by deploy/smoke-heritage-screens.py (all tagged "Heritage smoke").
-- The smoke run reverses every write through the API; this drops the reversed ledger rows and their side records.
-- Run on the VPS:
--   docker compose -f deploy/docker-compose.prod.yml --project-directory . --env-file .env.production \
--     exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < deploy/cleanup-finance-smoke.sql
BEGIN;

CREATE TEMP TABLE smoke_records ON COMMIT DROP AS
  SELECT id, "dataJson" FROM "HeritageRecord"
  WHERE "screenId" LIKE 'FIN:%' AND "screenId" NOT IN ('FIN:SEQ', 'FIN:STUDENT') AND "dataJson" LIKE '%Heritage smoke%';

CREATE TEMP TABLE smoke_entries ON COMMIT DROP AS
  SELECT e.id FROM "FinanceLedgerEntry" e
  WHERE e.note LIKE '%Heritage smoke%'
     OR EXISTS (SELECT 1 FROM smoke_records r JOIN "HeritageRecord" h ON h.id = r.id
                WHERE h."screenId" = 'FIN:FUND' AND r."dataJson" LIKE '%' || e.id || '%');

INSERT INTO smoke_entries
  SELECT id FROM "FinanceLedgerEntry"
  WHERE "reversedFromId" IN (SELECT id FROM smoke_entries) AND id NOT IN (SELECT id FROM smoke_entries);

DELETE FROM "HeritageRecord" h
WHERE h.id IN (SELECT id FROM smoke_records)
   OR (h."screenId" IN ('FIN:META', 'FIN:RECEIPT') AND h."singletonKey" IN (SELECT id FROM smoke_entries))
   OR (h."screenId" = 'FIN:ALLOC' AND EXISTS (SELECT 1 FROM smoke_entries e WHERE h."dataJson" LIKE '%' || e.id || '%'));

DELETE FROM "FinanceLedgerEntry" WHERE id IN (SELECT id FROM smoke_entries);

COMMIT;
