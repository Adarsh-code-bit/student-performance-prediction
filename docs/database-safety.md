# Database safety and migration procedure

## Configuration
Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `backend/.env`. Never commit that file. `setup-db.js` is only for an explicitly selected new, empty development database; it must not be used to reset or upgrade an existing database. The migration utility is a read-only preflight and refuses `--apply`.

## Backup, restore, and migration checklist
Before any migration, identify the server and database from the configured connection, inspect tables/columns/role values/foreign keys/indexes/triggers/views using `node backend/utils/run-migration.js`, and review the exact migration SQL. Stop if the live schema differs from its prerequisites.

Create a logical backup with `mysqldump --single-transaction --routines --triggers --events --databases smart_inventory > smart_inventory-backup.sql`. Verify it is non-empty and parses by restoring it into a separate test database (for example, `smart_inventory_restore_check`) using `mysql < smart_inventory-backup.sql`; inspect the restored table count and sample row counts. Do not restore over production. These commands require credentials and must be run only after the target server/database are independently confirmed.

Apply a reviewed, versioned migration to a restored test copy first. Capture before/after schema and row counts; verify foreign keys, indexes, triggers, views, role distributions, and application smoke checks. Schedule production only with a verified restorable backup and a rollback window. MySQL DDL may auto-commit, so rollback may require restoring the backup into a new database and switching the application connection after validation; do not assume a transaction can undo DDL.

## Existing script review
`database/schema-updates.sql` is not a safe migration. Its `DROP COLUMN` statements remove `location_type`, `address`, `city`, and `capacity`; the following `ADD COLUMN` statements can fail when columns already exist. These are destructive schema changes requiring data mapping, dependency review, backup, and manual approval. It contains no explicit row-level UPDATE/DELETE. Do not execute it as-is.

`database/migration-rbac-allocation.sql` includes role normalization UPDATEs and demo-account inserts; review current role values and account conflicts first. `backend/utils/run-migration.js` is now a read-only metadata preflight; it no longer alters schema or seeds/updates accounts. No migration has been run and no backup is claimed to exist.
