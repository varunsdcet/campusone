-- Add institution-aware companion foreign keys for every single-column FK
-- whose child and parent both carry institutionId. NOT VALID avoids blocking
-- rollout on historical rows, while PostgreSQL still enforces all new writes.
DO $$
DECLARE
  rel RECORD;
  index_name TEXT;
  constraint_name TEXT;
  delete_action TEXT;
  update_action TEXT;
BEGIN
  FOR rel IN
    SELECT
      c.oid AS constraint_oid,
      child.oid::regclass AS child_table,
      parent.oid::regclass AS parent_table,
      child.relname AS child_name,
      parent.relname AS parent_name,
      child_col.attname AS child_column,
      parent_col.attname AS parent_column,
      c.confdeltype,
      c.confupdtype
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace AND ns.nspname = 'public'
    JOIN pg_attribute child_col ON child_col.attrelid = child.oid AND child_col.attnum = c.conkey[1]
    JOIN pg_attribute parent_col ON parent_col.attrelid = parent.oid AND parent_col.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = child.oid AND a.attname = 'institutionId' AND NOT a.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = parent.oid AND a.attname = 'institutionId' AND NOT a.attisdropped)
  LOOP
    index_name := left(rel.parent_name, 36) || '_id_institution_tenant_key';
    constraint_name := 'tenant_' || substr(md5(rel.child_name || ':' || rel.child_column || ':' || rel.parent_name), 1, 24);
    delete_action := CASE rel.confdeltype WHEN 'c' THEN ' CASCADE' WHEN 'r' THEN ' RESTRICT' ELSE ' NO ACTION' END;
    update_action := CASE rel.confupdtype WHEN 'c' THEN ' CASCADE' WHEN 'r' THEN ' RESTRICT' ELSE ' NO ACTION' END;

    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %s (%I, "institutionId")', index_name, rel.parent_table, rel.parent_column);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint existing WHERE existing.conname = constraint_name) THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I, "institutionId") REFERENCES %s (%I, "institutionId") ON DELETE%s ON UPDATE%s NOT VALID',
        rel.child_table,
        constraint_name,
        rel.child_column,
        rel.parent_table,
        rel.parent_column,
        delete_action,
        update_action
      );
    END IF;
  END LOOP;
END $$;
