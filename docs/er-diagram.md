# Smart Inventory Management System — ER Diagram

## Entity-Relationship Diagram

```mermaid
erDiagram
    CATEGORY {
        int category_id PK
        varchar category_name UK
        text description
        boolean is_active
        timestamp created_at
    }

    PRODUCT {
        int product_id PK
        int category_id FK
        varchar product_name
        text description
        varchar sku UK
        varchar unit
        decimal unit_price
        int reorder_level
        boolean is_active
        timestamp created_at
    }

    SUPPLIER {
        int supplier_id PK
        varchar supplier_name
        varchar contact_person
        varchar email UK
        varchar phone
        text address
        varchar city
        boolean is_active
        timestamp created_at
    }

    LOCATION {
        int location_id PK
        varchar location_name
        enum location_type
        text address
        varchar city
        int capacity
        boolean is_active
        timestamp created_at
    }

    USER {
        int user_id PK
        varchar user_name
        varchar email UK
        varchar password_hash
        enum role
        boolean is_active
        timestamp created_at
    }

    CUSTOMER {
        int customer_id PK
        varchar customer_name
        varchar email UK
        varchar phone
        text address
        varchar city
        timestamp created_at
    }

    BATCH {
        int batch_id PK
        int product_id FK
        varchar batch_code UK
        date manufacturing_date
        date expiry_date
        int quantity
        decimal cost_price
        timestamp created_at
    }

    PURCHASE {
        int purchase_id PK
        int supplier_id FK
        date purchase_date
        decimal total_amount
        enum status
        text notes
        timestamp created_at
    }

    PURCHASE_DETAILS {
        int purchase_detail_id PK
        int purchase_id FK
        int product_id FK
        int quantity
        decimal unit_price
        decimal total_price
    }

    INVENTORY {
        int inventory_id PK
        int product_id FK
        int batch_id FK
        int location_id FK
        int quantity
        timestamp updated_at
    }

    STOCK_MOVEMENT {
        int movement_id PK
        int product_id FK
        int from_location_id FK
        int to_location_id FK
        int quantity
        enum movement_type
        varchar reason
        int changed_by FK
        datetime movement_date
        timestamp created_at
    }

    ORDERS {
        int order_id PK
        int customer_id FK
        datetime order_date
        decimal total_amount
        enum status
        text shipping_address
        timestamp created_at
    }

    ORDER_DETAILS {
        int order_detail_id PK
        int order_id FK
        int product_id FK
        int quantity
        decimal unit_price
        decimal total_price
    }

    AUDIT_LOG {
        int audit_id PK
        int user_id FK
        enum action
        varchar table_name
        int record_id
        json old_values
        json new_values
        timestamp action_date
        text details
    }

    CATEGORY ||--o{ PRODUCT : "has"
    PRODUCT ||--o{ BATCH : "has batches"
    PRODUCT ||--o{ INVENTORY : "tracked in"
    PRODUCT ||--o{ PURCHASE_DETAILS : "purchased as"
    PRODUCT ||--o{ ORDER_DETAILS : "ordered as"
    PRODUCT ||--o{ STOCK_MOVEMENT : "moved"
    BATCH ||--o{ INVENTORY : "stored as"
    LOCATION ||--o{ INVENTORY : "holds"
    LOCATION ||--o{ STOCK_MOVEMENT : "from (source)"
    LOCATION ||--o{ STOCK_MOVEMENT : "to (destination)"
    SUPPLIER ||--o{ PURCHASE : "supplies"
    PURCHASE ||--o{ PURCHASE_DETAILS : "contains"
    CUSTOMER ||--o{ ORDERS : "places"
    ORDERS ||--o{ ORDER_DETAILS : "contains"
    USER ||--o{ STOCK_MOVEMENT : "performs"
    USER ||--o{ AUDIT_LOG : "logged by"
```

## Relationship Summary

| Relationship | Type | Description |
|---|---|---|
| CATEGORY → PRODUCT | 1:M | Each category has many products |
| PRODUCT → BATCH | 1:M | Each product has many batches |
| PRODUCT → INVENTORY | 1:M | Each product appears in many inventory records |
| PRODUCT → PURCHASE_DETAILS | 1:M | Each product can be in many purchase line items |
| PRODUCT → ORDER_DETAILS | 1:M | Each product can be in many order line items |
| PRODUCT → STOCK_MOVEMENT | 1:M | Each product can have many movements |
| BATCH → INVENTORY | 1:M | Each batch is tracked across inventory locations |
| LOCATION → INVENTORY | 1:M | Each location holds many inventory records |
| LOCATION → STOCK_MOVEMENT (from) | 1:M | Each location is source of movements |
| LOCATION → STOCK_MOVEMENT (to) | 1:M | Each location is destination of movements |
| SUPPLIER → PURCHASE | 1:M | Each supplier has many purchases |
| PURCHASE → PURCHASE_DETAILS | 1:M | Each purchase has many line items |
| CUSTOMER → ORDERS | 1:M | Each customer places many orders |
| ORDERS → ORDER_DETAILS | 1:M | Each order has many line items |
| USER → STOCK_MOVEMENT | 1:M | Each user performs many movements |
| USER → AUDIT_LOG | 1:M | Each user's actions are logged |

> [!IMPORTANT]
> **LOCATION** is used as a single entity. `stock_movement` has two foreign keys into it:
> - `from_location_id` → `location.location_id` (source)
> - `to_location_id` → `location.location_id` (destination)

> [!NOTE]
> **PRODUCT** is the central entity in the schema, connected to 6 other tables.
