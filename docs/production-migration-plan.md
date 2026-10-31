# QUICKSTOCK Production Migration Execution Plan & Safety Review

**System**: QUICKSTOCK Smart Inventory Management System  
**Target Database**: Aiven Cloud MySQL 8.4.11 (`mysql-37e1f16a-work-ae9c.d.aivencloud.com:24803` / `defaultdb`)  
**Verified Baseline Backup**: `backups/backup_defaultdb_pre_v3_20261030_192912.sql` (43,177 bytes)  
**SHA-256 Checksum**: `4B7092DBB84C39B35937D0A5FAE75BC1F0C65C27C68A526A3967559043553D52`  
**Restoration Parity**: 16/16 tables, 115/115 rows, 30/30 foreign keys, 95 inventory units, ₹64.00 order value verified.  
**Execution Status**: **ON HOLD - PENDING APPROVAL** (No production writes executed)

---

## 1. Corrections to Critical Migration Issues

### Issue 1: V3 Historical Allocation Backfill
- **Unverified Historical Picking Guarantee**: Historical completed/cancelled orders (Orders 1–8) never claim current inventory locations prove historical picking racks.
- **Unverified Flagging**: Completed legacy orders allocate with `batch_id = NULL`, `location_id = NULL`, and `inventory_id = NULL`, with audit notes explicitly set to `'Legacy pre-v3 historical order: fulfillment batch/rack unrecorded (UNVERIFIED_HISTORICAL)'`.
- **Zero Inventory Impact**: Total inventory quantity remains exactly 95 units across all products. No deductions, updates, or deletions are made to `inventory`.
- **Item-Level Idempotency**: `database/backfill-pre-v3-allocations.js` queries `order_details` via `LEFT JOIN order_item_allocations oia ON od.order_detail_id = oia.order_detail_id WHERE oia.allocation_id IS NULL`. Subsequent runs find 0 unallocated items and exit cleanly without creating duplicates.

### Issue 2: V4 Mobile Verification & Legacy User Safety
- **Existing User Audit**: Production possesses exactly 7 users (Admin, Manager, Staff, Auditor, Picker, Packer, Clerk). None currently have mobile numbers or SMS verification history.
- **No False Verification**: `database/migration-v4-employee-signup.sql` and `apply-migration-v4.js` set `phone = NULL`, `is_mobile_verified = FALSE`, and `mobile_verified_at = NULL`. No false OTP verification is asserted.
- **Preserve Access & Roles**: All 7 accounts retain `approval_status = 'APPROVED'`, `is_active = 1`, existing bcrypt password hashes, and assigned roles. The backend login handler does not block accounts with `is_mobile_verified = FALSE`, ensuring uninterrupted staff access.

### Issue 3: Precision V6 Rollback & Location Preservation
- **No Generic Deletions**: Rollback script [`database/rollback-v6-purchase-location.sql`](file:///c:/Users/mgoty/.gemini/antigravity/scratch/smart-inventory/database/rollback-v6-purchase-location.sql) never deletes locations using generic rack lists (`WHERE rack_number IN (...)`).
- **Exact V6 Signature Matching**: Only deletes locations matching the exact composite signature created by V6:
  - `Rack A01 Position 02-0B` (A01-02-0B)
  - `Rack A02 Position 01-0A` (A02-01-0A)
  - `Rack A03 Position 04-0C` (A03-04-0C)
  - `Rack A04 Position 01-0A (Limited)` (A04-01-0A)
  - `Rack A99 Position 99-9Z (Decommissioned)` (A99-99-9Z)
- **Referential Integrity Guards**: Subqueries explicitly guard against deleting any location referenced in:
  - `inventory` (`location_id`)
  - `order_item_allocations` (`location_id`)
  - `purchase_details` (`location_id`)
  - `stock_movement` (`from_location_id`, `to_location_id`)
  - `stock_audit` (`location_id`)
- **Preserve Pre-existing Racks**: Production pre-existing locations `RACK-A1` (id=1) and `CHILL-C1` (id=2) are explicitly excluded and 100% preserved.

### Issue 4: Windows PowerShell Compatibility & Credential Security
- **No Input Redirection `<`**: Replaced all instances of `mysql < script.sql` with PowerShell native stream pipeline:
  `Get-Content -Path "<script.sql>" -Raw -Encoding utf8 | & $mysqlPath ...`
- **Immediate Error Stopping**: Scripts configure `$ErrorActionPreference = 'Stop'` and explicitly test `$LASTEXITCODE -ne 0` after every external command.
- **Fail-Safe Credential Scrubbing**: Wrapped all commands in `try { ... } finally { Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue }`. In the event of an error, timeout, or cancellation, the password is guaranteed cleared from process memory.

### Issue 5: Recovery & Protection of Post-Backup Production Writes
- **No Blind Overwrite**: Baseline backup `backup_defaultdb_pre_v3_20261030_192912.sql` must NEVER be directly restored over live production. Doing so would destroy any transactions, orders, audits, or stock movements created after 19:29:12.
- **Tier 1 (Targeted DDL Rollback)**: If a migration fails or must be rolled back, execute the dedicated idempotent rollback script (`rollback-v4-employee-signup.sql`, `rollback-v6-purchase-location.sql`). This removes new columns and tables without touching existing data.
- **Tier 2 (Post-Backup Write Delta Protection & Side-by-Side Restore)**:
  1. In the event of catastrophic data corruption requiring full restore, first extract all post-backup delta records:
     ```sql
     SELECT * FROM audit_log WHERE created_at >= '2026-10-30 19:29:12';
     SELECT * FROM orders WHERE order_date >= '2026-10-30 19:29:12';
     SELECT * FROM stock_movement WHERE movement_date >= '2026-10-30 19:29:12';
     ```
  2. Restore baseline backup into an isolated side-by-side database schema (e.g. `defaultdb_recovery_20261030`).
  3. Replay validated post-backup write deltas into the recovery schema.
  4. Verify data integrity and checksums against pre-incident logs.
  5. Update application environment variables (`DATABASE_URL`) on Render to switch traffic to the restored, reconciled database.

---

## 2. Tested Windows PowerShell Execution Commands

### Prerequisites Setup (PowerShell)
```powershell
$ErrorActionPreference = 'Stop'
$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$caCertPath = "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\backups\aiven-ca.pem"

# Target Production Database Parameters
$aivenHost = "mysql-37e1f16a-work-ae9c.d.aivencloud.com"
$aivenPort = 24803
$aivenUser = "avnadmin"
$aivenDb   = "defaultdb"

# Retrieve Aiven Password securely from environment
$envFile = "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\backend\.env"
$aivenPass = ""
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*AIVEN_PASSWORD\s*=\s*(.*)$") { $aivenPass = $matches[1].Trim() }
}
if (-not $aivenPass) { throw "AIVEN_PASSWORD not found in environment." }
```

### Command 1: Execute Migration V3 (Picker Guidance & Table Extension)
```powershell
$env:MYSQL_PWD = $aivenPass
try {
    Write-Host "[1/5] Applying Migration V3..." -ForegroundColor Yellow
    Get-Content -Path "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\database\migration-v3-picker-tracking.sql" -Raw -Encoding utf8 | `
        & $mysqlPath -h $aivenHost -P $aivenPort -u $aivenUser --ssl-ca=$caCertPath --ssl-mode=VERIFY_IDENTITY $aivenDb
    if ($LASTEXITCODE -ne 0) { throw "Migration V3 failed with exit code $LASTEXITCODE" }
    Write-Host "[OK] Migration V3 applied successfully." -ForegroundColor Green
}
catch {
    Write-Error "ERROR in Migration V3: $_"
    throw $_
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

### Command 2: Execute V3 Historical Allocation Backfill
```powershell
try {
    Write-Host "[2/5] Running V3 Historical Allocation Backfill..." -ForegroundColor Yellow
    $backupFile = "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\backups\backup_defaultdb_pre_v3_20261030_192912.sql"
    
    # Configure production target environment variables for runner
    $env:DB_HOST = $aivenHost
    $env:DB_PORT = $aivenPort
    $env:DB_USER = $aivenUser
    $env:DB_PASSWORD = $aivenPass
    $env:DB_NAME = $aivenDb
    $env:DB_SSL = "true"
    $env:DB_SSL_CA_PATH = $caCertPath
    
    node c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\database\backfill-pre-v3-allocations.js `
        --execute `
        --confirm `
        --allow-production `
        --verified-backup-confirmed=$backupFile
    if ($LASTEXITCODE -ne 0) { throw "V3 Backfill failed with exit code $LASTEXITCODE" }
    Write-Host "[OK] V3 Historical Allocation Backfill completed successfully." -ForegroundColor Green
}
catch {
    Write-Error "ERROR in V3 Historical Backfill: $_"
    throw $_
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

### Command 3: Execute Migration V4 (Employee Signup & Approval Workflow)
```powershell
$env:MYSQL_PWD = $aivenPass
try {
    Write-Host "[3/5] Applying Migration V4..." -ForegroundColor Yellow
    Get-Content -Path "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\database\migration-v4-employee-signup.sql" -Raw -Encoding utf8 | `
        & $mysqlPath -h $aivenHost -P $aivenPort -u $aivenUser --ssl-ca=$caCertPath --ssl-mode=VERIFY_IDENTITY $aivenDb
    if ($LASTEXITCODE -ne 0) { throw "Migration V4 failed with exit code $LASTEXITCODE" }
    Write-Host "[OK] Migration V4 applied successfully." -ForegroundColor Green
}
catch {
    Write-Error "ERROR in Migration V4: $_"
    throw $_
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

### Command 4: Execute Migration V4.1 (OTP Consumption Tracking)
```powershell
$env:MYSQL_PWD = $aivenPass
try {
    Write-Host "[4/5] Applying Migration V4.1 (OTP Consumption Tracking)..." -ForegroundColor Yellow
    Get-Content -Path "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\database\migration-v4.1-otp-consumption.sql" -Raw -Encoding utf8 | `
        & $mysqlPath -h $aivenHost -P $aivenPort -u $aivenUser --ssl-ca=$caCertPath --ssl-mode=VERIFY_IDENTITY $aivenDb
    if ($LASTEXITCODE -ne 0) { throw "Migration V4.1 failed with exit code $LASTEXITCODE" }
    Write-Host "[OK] Migration V4.1 applied successfully." -ForegroundColor Green
}
catch {
    Write-Error "ERROR in Migration V4.1: $_"
    throw $_
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

### Command 5: Execute Migration V6 (Purchase Location & Storage Capacity)
```powershell
$env:MYSQL_PWD = $aivenPass
try {
    Write-Host "[5/5] Applying Migration V6..." -ForegroundColor Yellow
    Get-Content -Path "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\database\migration-v6-purchase-location.sql" -Raw -Encoding utf8 | `
        & $mysqlPath -h $aivenHost -P $aivenPort -u $aivenUser --ssl-ca=$caCertPath --ssl-mode=VERIFY_IDENTITY $aivenDb
    if ($LASTEXITCODE -ne 0) { throw "Migration V6 failed with exit code $LASTEXITCODE" }
    Write-Host "[OK] Migration V6 applied successfully." -ForegroundColor Green
}
catch {
    Write-Error "ERROR in Migration V6: $_"
    throw $_
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

---

## 3. Rollback Procedures (Tested & Precision-Scoped)

### Rollback V6 (Purchase Location & Racks)
```powershell
$env:MYSQL_PWD = $aivenPass
try {
    Write-Host "Rolling back Migration V6..." -ForegroundColor Yellow
    Get-Content -Path "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\database\rollback-v6-purchase-location.sql" -Raw -Encoding utf8 | `
        & $mysqlPath -h $aivenHost -P $aivenPort -u $aivenUser --ssl-ca=$caCertPath --ssl-mode=VERIFY_IDENTITY $aivenDb
    if ($LASTEXITCODE -ne 0) { throw "V6 Rollback failed with exit code $LASTEXITCODE" }
    Write-Host "[OK] V6 Rollback completed. Pre-existing locations and active stock preserved." -ForegroundColor Green
}
catch {
    Write-Error "ERROR in V6 Rollback: $_"
    throw $_
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

### Rollback V4 (Employee Signup & Approval Workflow)
```powershell
$env:MYSQL_PWD = $aivenPass
try {
    Write-Host "Rolling back Migration V4..." -ForegroundColor Yellow
    Get-Content -Path "c:\Users\mgoty\.gemini\antigravity\scratch\smart-inventory\database\rollback-v4-employee-signup.sql" -Raw -Encoding utf8 | `
        & $mysqlPath -h $aivenHost -P $aivenPort -u $aivenUser --ssl-ca=$caCertPath --ssl-mode=VERIFY_IDENTITY $aivenDb
    if ($LASTEXITCODE -ne 0) { throw "V4 Rollback failed with exit code $LASTEXITCODE" }
    Write-Host "[OK] V4 Rollback completed." -ForegroundColor Green
}
catch {
    Write-Error "ERROR in V4 Rollback: $_"
    throw $_
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

---

## 4. Verification & Validation Metrics

After running migrations or rollback, verify production health using these read-only metrics:
1. **Inventory Conservation**: Total inventory quantity must remain exactly `95` units (`SELECT SUM(quantity) FROM inventory`).
2. **Order Totals**: Total order value must remain exactly `₹64.00` (`SELECT SUM(total_amount) FROM orders`).
3. **Legacy Users (7 Accounts)**: All 7 users must retain `is_active = 1`, `approval_status = 'APPROVED'`, and valid `password_hash`.
4. **Order Allocations (8 Orders)**: Exactly 8 allocations created, each marked `status = 'PICKED'`, `batch_id = NULL`, `location_id = NULL`, `notes LIKE '%UNVERIFIED_HISTORICAL%'`.
5. **Location Integrity**: Pre-existing locations `RACK-A1` (id=1) and `CHILL-C1` (id=2) must exist and remain linked to inventory.

