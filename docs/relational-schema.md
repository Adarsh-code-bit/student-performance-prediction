# Smart Inventory Management System — Relational Schema

## Overview

This document provides the complete relational schema for the Smart Inventory Management System database (`smart_inventory`). The schema consists of **14 tables** using **MySQL 8+** with **InnoDB** engine.

---

## Table Definitions

### 1. category

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **category_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique category identifier |
| category_name | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Category display name |
| description | `TEXT` | | Category description |
| is_active | `BOOLEAN` | `DEFAULT TRUE` | Soft-delete flag |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `category_id`
**Foreign Keys:** None
**Relationships:** Parent of `product`

---

### 2. supplier

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **supplier_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique supplier identifier |
| supplier_name | `VARCHAR(150)` | `NOT NULL` | Company/supplier name |
| contact_person | `VARCHAR(100)` | | Primary contact name |
| email | `VARCHAR(100)` | `UNIQUE` | Contact email |
| phone | `VARCHAR(20)` | | Phone number |
| address | `TEXT` | | Full address |
| city | `VARCHAR(50)` | | City |
| is_active | `BOOLEAN` | `DEFAULT TRUE` | Soft-delete flag |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `supplier_id`
**Foreign Keys:** None
**Relationships:** Parent of `purchase`

---

### 3. location

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **location_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique location identifier |
| location_name | `VARCHAR(100)` | `NOT NULL` | Location display name |
| location_type | `ENUM('warehouse','dark_store','hub','retail_store')` | `NOT NULL` | Facility type |
| address | `TEXT` | | Full address |
| city | `VARCHAR(50)` | | City |
| capacity | `INT` | | Max storage capacity |
| is_active | `BOOLEAN` | `DEFAULT TRUE` | Soft-delete flag |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `location_id`
**Foreign Keys:** None
**Relationships:** Parent of `inventory`, parent of `stock_movement` (twice: `from_location_id`, `to_location_id`)

> [!IMPORTANT]
> Single table serving both source and destination for stock movements. No separate FROM_LOCATION or TO_LOCATION entities.

---

### 4. user

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **user_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique user identifier |
| user_name | `VARCHAR(100)` | `NOT NULL` | Display name |
| email | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Login email |
| password_hash | `VARCHAR(255)` | `NOT NULL` | bcrypt hashed password |
| role | `ENUM('admin','manager','staff')` | `NOT NULL` | User role |
| is_active | `BOOLEAN` | `DEFAULT TRUE` | Account active flag |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `user_id`
**Foreign Keys:** None
**Relationships:** Parent of `stock_movement` (via `changed_by`), parent of `audit_log`

---

### 5. customer

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **customer_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique customer identifier |
| customer_name | `VARCHAR(100)` | `NOT NULL` | Customer full name |
| email | `VARCHAR(100)` | `UNIQUE` | Email address |
| phone | `VARCHAR(20)` | `NOT NULL` | Phone number |
| address | `TEXT` | | Delivery address |
| city | `VARCHAR(50)` | | City |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `customer_id`
**Foreign Keys:** None
**Relationships:** Parent of `orders`

---

### 6. product ⭐ (Central Entity)

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **product_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique product identifier |
| category_id | `INT` | `NOT NULL`, `FK` | References `category` |
| product_name | `VARCHAR(150)` | `NOT NULL` | Product display name |
| description | `TEXT` | | Product description |
| sku | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | Stock Keeping Unit code |
| unit | `VARCHAR(20)` | `NOT NULL` | Unit of measurement |
| unit_price | `DECIMAL(10,2)` | `NOT NULL` | Selling price (INR) |
| reorder_level | `INT` | `NOT NULL`, `DEFAULT 10` | Minimum stock threshold |
| is_active | `BOOLEAN` | `DEFAULT TRUE` | Active product flag |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `product_id`
**Foreign Keys:** `category_id` → `category(category_id)`
**Indexes:** `idx_product_category`, `idx_product_sku`, `idx_product_active`
**Relationships:** Child of `category`; parent of `batch`, `inventory`, `purchase_details`, `order_details`, `stock_movement`

---

### 7. batch

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **batch_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique batch identifier |
| product_id | `INT` | `NOT NULL`, `FK` | References `product` |
| batch_code | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | Batch tracking code |
| manufacturing_date | `DATE` | `NOT NULL` | Date of manufacture |
| expiry_date | `DATE` | `NOT NULL` | Expiry date |
| quantity | `INT` | `NOT NULL`, `CHECK >= 0` | Total batch quantity |
| cost_price | `DECIMAL(10,2)` | `NOT NULL` | Cost per unit |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `batch_id`
**Foreign Keys:** `product_id` → `product(product_id)`
**Check Constraints:** `quantity >= 0`, `expiry_date > manufacturing_date`
**Relationships:** Child of `product`; parent of `inventory`

---

### 8. purchase

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **purchase_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique purchase identifier |
| supplier_id | `INT` | `NOT NULL`, `FK` | References `supplier` |
| purchase_date | `DATE` | `NOT NULL` | Date of purchase |
| total_amount | `DECIMAL(12,2)` | `NOT NULL` | Total purchase value |
| status | `ENUM('pending','received','cancelled')` | `DEFAULT 'pending'` | Order status |
| notes | `TEXT` | | Additional notes |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `purchase_id`
**Foreign Keys:** `supplier_id` → `supplier(supplier_id)`
**Relationships:** Child of `supplier`; parent of `purchase_details`

---

### 9. purchase_details

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **purchase_detail_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique line item ID |
| purchase_id | `INT` | `NOT NULL`, `FK` | References `purchase` |
| product_id | `INT` | `NOT NULL`, `FK` | References `product` |
| quantity | `INT` | `NOT NULL`, `CHECK > 0` | Quantity purchased |
| unit_price | `DECIMAL(10,2)` | `NOT NULL` | Price per unit |
| total_price | `DECIMAL(12,2)` | `NOT NULL` | Line total |

**Primary Key:** `purchase_detail_id`
**Foreign Keys:** `purchase_id` → `purchase(purchase_id)`, `product_id` → `product(product_id)`
**Relationships:** Child of `purchase` and `product`

---

### 10. inventory

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **inventory_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique inventory record ID |
| product_id | `INT` | `NOT NULL`, `FK` | References `product` |
| batch_id | `INT` | `NOT NULL`, `FK` | References `batch` |
| location_id | `INT` | `NOT NULL`, `FK` | References `location` |
| quantity | `INT` | `NOT NULL`, `DEFAULT 0`, `CHECK >= 0` | Current stock |
| updated_at | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last modification time |

**Primary Key:** `inventory_id`
**Foreign Keys:** `product_id` → `product`, `batch_id` → `batch`, `location_id` → `location`
**Unique Constraint:** `(product_id, batch_id, location_id)` — prevents duplicate entries
**Relationships:** Child of `product`, `batch`, `location`

> [!IMPORTANT]
> `CHECK (quantity >= 0)` prevents negative inventory at the database level.

---

### 11. stock_movement

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **movement_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique movement ID |
| product_id | `INT` | `NOT NULL`, `FK` | References `product` |
| from_location_id | `INT` | `NOT NULL`, `FK` | Source location |
| to_location_id | `INT` | `NOT NULL`, `FK` | Destination location |
| quantity | `INT` | `NOT NULL`, `CHECK > 0` | Units moved |
| movement_type | `ENUM('transfer','restock','return','disposal')` | `NOT NULL` | Type of movement |
| reason | `VARCHAR(255)` | | Reason/notes |
| changed_by | `INT` | `NOT NULL`, `FK` | User who performed |
| movement_date | `DATETIME` | `NOT NULL` | When the move happened |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `movement_id`
**Foreign Keys:**
- `product_id` → `product(product_id)`
- `from_location_id` → `location(location_id)`
- `to_location_id` → `location(location_id)`
- `changed_by` → `user(user_id)`

**Check Constraints:** `quantity > 0`, `from_location_id <> to_location_id`
**Relationships:** Child of `product`, `location` (×2), `user`

---

### 12. orders

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **order_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique order ID |
| customer_id | `INT` | `NOT NULL`, `FK` | References `customer` |
| order_date | `DATETIME` | `NOT NULL` | When the order was placed |
| total_amount | `DECIMAL(12,2)` | `NOT NULL` | Order total (INR) |
| status | `ENUM('pending','processing','shipped','delivered','cancelled')` | `DEFAULT 'pending'` | Order status |
| shipping_address | `TEXT` | | Delivery address |
| created_at | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Record creation time |

**Primary Key:** `order_id`
**Foreign Keys:** `customer_id` → `customer(customer_id)`
**Relationships:** Child of `customer`; parent of `order_details`

> [!NOTE]
> Table named `orders` (not `order`) to avoid conflict with SQL reserved keyword.

---

### 13. order_details

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **order_detail_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique line item ID |
| order_id | `INT` | `NOT NULL`, `FK` | References `orders` |
| product_id | `INT` | `NOT NULL`, `FK` | References `product` |
| quantity | `INT` | `NOT NULL`, `CHECK > 0` | Quantity ordered |
| unit_price | `DECIMAL(10,2)` | `NOT NULL` | Price at time of order |
| total_price | `DECIMAL(12,2)` | `NOT NULL` | Line total |

**Primary Key:** `order_detail_id`
**Foreign Keys:** `order_id` → `orders(order_id)`, `product_id` → `product(product_id)`
**Relationships:** Child of `orders` and `product`

---

### 14. audit_log

| Attribute | Data Type | Constraints | Description |
|---|---|---|---|
| **audit_id** | `INT` | `PK`, `AUTO_INCREMENT` | Unique audit entry ID |
| user_id | `INT` | `NOT NULL`, `FK` | User who performed the action |
| action | `ENUM('INSERT','UPDATE','DELETE')` | `NOT NULL` | Operation type |
| table_name | `VARCHAR(50)` | `NOT NULL` | Affected table name |
| record_id | `INT` | `NOT NULL` | PK of affected record |
| old_values | `JSON` | | Previous state (for UPDATE/DELETE) |
| new_values | `JSON` | | New state (for INSERT/UPDATE) |
| action_date | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | When the action occurred |
| details | `TEXT` | | Human-readable description |

**Primary Key:** `audit_id`
**Foreign Keys:** `user_id` → `user(user_id)`
**Relationships:** Child of `user`

---

## Constraints Summary

| Type | Count | Examples |
|---|---|---|
| Primary Keys | 14 | One per table |
| Foreign Keys | 17 | Including 2 from `stock_movement` → `location` |
| UNIQUE | 7 | `category_name`, `email` fields, `sku`, `batch_code`, inventory composite |
| CHECK | 6 | `quantity >= 0`, `quantity > 0`, `expiry > manufacturing`, `from ≠ to` |
| NOT NULL | 50+ | On all critical fields |
| DEFAULT | 14 | Timestamps, booleans, status enums |

## Indexes Summary

| Table | Index | Columns |
|---|---|---|
| product | `idx_product_category` | `category_id` |
| product | `idx_product_sku` | `sku` |
| product | `idx_product_active` | `is_active` |
| batch | `idx_batch_product` | `product_id` |
| batch | `idx_batch_expiry` | `expiry_date` |
| purchase | `idx_purchase_supplier` | `supplier_id` |
| purchase | `idx_purchase_status` | `status` |
| purchase | `idx_purchase_date` | `purchase_date` |
| inventory | `idx_inv_product` | `product_id` |
| inventory | `idx_inv_batch` | `batch_id` |
| inventory | `idx_inv_location` | `location_id` |
| stock_movement | `idx_sm_product` | `product_id` |
| stock_movement | `idx_sm_from_location` | `from_location_id` |
| stock_movement | `idx_sm_to_location` | `to_location_id` |
| stock_movement | `idx_sm_changed_by` | `changed_by` |
| stock_movement | `idx_sm_date` | `movement_date` |
| orders | `idx_order_customer` | `customer_id` |
| orders | `idx_order_status` | `status` |
| orders | `idx_order_date` | `order_date` |
| audit_log | `idx_audit_user` | `user_id` |
| audit_log | `idx_audit_table` | `table_name` |
| audit_log | `idx_audit_action_date` | `action_date` |
