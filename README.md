# Smart Inventory Management System for Quick Commerce

## Project Introduction
The Smart Inventory Management System is an enterprise-grade web application built to handle the complex logistical requirements of modern Quick Commerce. It provides a real-time, single-pane-of-glass dashboard for tracking products, managing suppliers, orchestrating purchases, monitoring batch lifecycles, and fulfilling customer orders. 

## Features
- **Strict Role-Based Access Control (RBAC):** Secure JWT authentication isolating Admin, Manager, and Staff functionalities.
- **Transactional Consistency:** Deep MySQL ACID compliance preventing negative stock levels.
- **Intelligent Analytics:** Live SQL aggregations automatically identifying Low Stock, Reorder metrics, and Expiry lifecycles.
- **Stock Movement Engine:** Granular tracking of physical product migrations across distinct warehouse locations.
- **Global Audit System:** Intercepts and records every structural database mutation into a unified Audit Log.

## Technology Stack
- **Frontend:** React.js 18, Vite, React Router, Recharts, Lucide Icons, Axios.
- **Backend:** Node.js (v18+), Express.js, JSON Web Tokens, bcryptjs.
- **Database:** MySQL 8+ (relational structure with strictly defined Foreign Keys and CHECK constraints).

## Folder Structure
```text
smart-inventory/
├── backend/
│   ├── config/          # DB connections
│   ├── controllers/     # Business logic & SQL queries
│   ├── middleware/      # JWT authentication interceptors
│   ├── routes/          # Express route definitions
│   ├── .env             # Environment variables
│   └── server.js        # Main application entry point
├── database/
│   ├── schema.sql       # Complete database definition
│   └── seed-users.sql   # Demo user injector
├── docs/
│   └── project_report.md# Full university-level documentation
└── frontend/
    ├── src/
    │   ├── components/  # Reusable UI elements (Sidebar, StatCards)
    │   ├── context/     # Auth Context & Toast Context
    │   ├── pages/       # Core module views (Products, Analytics, etc.)
    │   ├── services/    # Axios API interceptor configurations
    │   ├── App.jsx      # React Router DOM tree
    │   └── index.css    # Global custom styling
    └── index.html
```

## MySQL Setup
The application requires a running MySQL 8 instance. You do **not** need to manually copy/paste SQL schemas. A setup script has been provided to build the environment automatically.

### Environment Variables
Inside the `backend/` folder, configure your `.env` file to match your local MySQL credentials:

```env
PORT=5000
CLIENT_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smart_inventory

JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
```

## Installation & Setup

1. **Clone the repository and install dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Database Setup:**
   Ensure your MySQL server is running, then execute the automated setup script to generate the database, schemas, and demo accounts:
   ```bash
   cd backend
   node setup-db.js
   ```

3. **Running the Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   *(Runs on http://localhost:5000)*

4. **Running the Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
   *(Runs on http://localhost:5173)*

## Demo Login
The `setup-db.js` script automatically generates the following demo accounts:
- **Email:** `admin@example.com` | **Password:** `password123`
- **Email:** `manager@example.com` | **Password:** `password123`
- **Email:** `staff@example.com` | **Password:** `password123`

## Core API Endpoints
- `POST /api/auth/login`: Authenticate and receive JWT.
- `GET /api/dashboard/stats`: Retrieve aggregate KPIs.
- `GET /api/analytics/low-stock`: Returns items breaching their defined reorder thresholds.
- `GET /api/inventory`: Fetches distinct product/batch combinations mapped to physical locations.
- `POST /api/purchases`: Conducts a massive multi-table transaction (Purchase → Purchase Details → Batches → Inventory).
- `POST /api/orders`: Reduces stock, throwing an explicit error if `requested > available`.

## Smart Features
Instead of utilizing heavy external dependencies or Machine Learning, this application computes Smart Analytics natively using MySQL:
- **Reorder Suggestion:** Computation utilizing `GREATEST((reorder_level * 2) - current_stock, 0)`.
- **Near Expiry:** Filters batches where `expiry_date` rests inside a dynamic +30 day sliding window from `CURDATE()`.
- **Fast Moving:** Ranks products based on pure gross movement inside `order_details` across dynamic 7, 30, and 90 day windows.
- **Slow/Non-Selling:** Employs `LEFT JOIN` aggregations to locate items with precisely 0 sales movement within a requested period.

## Deployment configuration

Backend requires `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` (32+ random characters), and `CLIENT_URL`. `FRONTEND_ORIGINS` may contain additional comma-separated trusted browser origins. Never put database credentials or JWT secrets in frontend `VITE_` variables.

Frontend reads `VITE_API_BASE_URL`; use `/api` behind a same-origin reverse proxy, or a public API URL for a separately hosted API. Local Vite development proxies `/api` to `http://localhost:5000`.

Before deployment, use a least-privilege database account, inspect the live schema read-only, back up and verify a restore to a separate database, and review a versioned migration. `backend/utils/run-migration.js` is metadata preflight only. Do not run historical setup or schema update SQL against an existing database. Order allocation uses earliest-expiry eligible batches, but inventory is not linked to stores in the source schema; store-specific stock allocation remains unsupported until that relationship is verified/designed.
