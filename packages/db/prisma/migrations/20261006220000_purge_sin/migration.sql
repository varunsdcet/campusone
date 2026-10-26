-- Privacy rule: no government ID numbers are stored. Removes the last SIN remnants.
ALTER TABLE "Person" DROP COLUMN IF EXISTS "sinMasked";
ALTER TABLE "TaxDocument" DROP COLUMN IF EXISTS "sinLast4";
