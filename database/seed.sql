-- =============================================================
-- Smart Inventory Management System for Quick Commerce
-- Seed Data — MySQL 8+
-- =============================================================
-- Realistic sample data for all 14 tables.
-- Dates are relative to September 2026.
-- Prices in Indian Rupees (INR).
-- =============================================================

USE smart_inventory;

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================
-- 1. CATEGORIES (10 rows)
-- =============================================================
INSERT INTO category (category_id, category_name, description, is_active) VALUES
(1,  'Beverages',            'Soft drinks, juices, water, energy drinks',          TRUE),
(2,  'Snacks',               'Chips, namkeen, biscuits, cookies',                  TRUE),
(3,  'Dairy & Frozen',       'Milk, curd, cheese, ice cream, frozen foods',        TRUE),
(4,  'Fresh Produce',        'Fruits, vegetables, herbs',                          TRUE),
(5,  'Personal Care',        'Soaps, shampoos, skincare, oral care',               TRUE),
(6,  'Household Essentials', 'Cleaning supplies, detergents, tissues',             TRUE),
(7,  'Baby Care',            'Diapers, baby food, baby hygiene products',          TRUE),
(8,  'Bakery',               'Bread, cakes, pastries, buns',                       TRUE),
(9,  'Instant Food',         'Noodles, ready-to-eat meals, soups',                 TRUE),
(10, 'Health & Wellness',    'Supplements, protein bars, organic products',        TRUE);

-- =============================================================
-- 2. SUPPLIERS (10 rows)
-- =============================================================
INSERT INTO supplier (supplier_id, supplier_name, contact_person, email, phone, address, city, is_active) VALUES
(1,  'Hindustan Unilever Distributors', 'Rajesh Mehta',     'rajesh@huldist.in',      '+91-22-4001-1001', '45 Andheri East, Industrial Area',           'Mumbai',     TRUE),
(2,  'ITC Foods Supply Chain',          'Priya Sharma',     'priya@itcfoods.in',       '+91-33-4002-2002', '12 Salt Lake, Sector V',                     'Kolkata',    TRUE),
(3,  'Amul Dairy Distributors',         'Vikram Patel',     'vikram@amuldist.in',      '+91-79-4003-3003', '78 Anand Dairy Complex',                     'Ahmedabad',  TRUE),
(4,  'PepsiCo India Partners',          'Anil Kumar',       'anil@pepsicoindia.in',    '+91-124-4004-4004','Plot 22, Udyog Vihar Phase III',             'Gurugram',   TRUE),
(5,  'Nestle India Supplies',           'Meera Joshi',      'meera@nestleind.in',      '+91-11-4005-5005', '56 Okhla Industrial Estate',                'New Delhi',  TRUE),
(6,  'Dabur India Logistics',           'Suresh Yadav',     'suresh@daburlog.in',      '+91-120-4006-6006','Block B, Noida Special Economic Zone',       'Noida',      TRUE),
(7,  'Parle Agro Distributors',         'Kavita Singh',     'kavita@parleagro.in',     '+91-22-4007-7007', '89 Vile Parle, MIDC',                       'Mumbai',     TRUE),
(8,  'Britannia Industries Supply',     'Ramesh Gupta',     'ramesh@britannia.in',     '+91-80-4008-8008', '34 Whitefield, ITPL Road',                  'Bengaluru',  TRUE),
(9,  'Marico Limited Partners',         'Deepa Nair',       'deepa@maricoltd.in',      '+91-22-4009-9009', '67 Bandra Kurla Complex',                   'Mumbai',     TRUE),
(10, 'Godrej Consumer Products',        'Amit Deshmukh',    'amit@godrejcp.in',        '+91-22-4010-1010', 'Godrej One, Pirojshanagar',                 'Mumbai',     TRUE);

-- =============================================================
-- 3. LOCATIONS (10 rows)
-- =============================================================
INSERT INTO location (location_id, location_name, location_type, address, city, capacity, is_active) VALUES
(1,  'Mumbai Central Warehouse',     'warehouse',     'Plot 5, Bhiwandi Logistics Park',          'Mumbai',     10000, TRUE),
(2,  'Delhi Hub North',              'hub',           'Sector 18, Rohini Industrial Area',        'New Delhi',  5000,  TRUE),
(3,  'Bengaluru Dark Store - HSR',   'dark_store',    '12th Main, HSR Layout',                    'Bengaluru',  2000,  TRUE),
(4,  'Hyderabad Dark Store - Madhapur','dark_store',  'Road No 36, Jubilee Hills',                'Hyderabad',  2000,  TRUE),
(5,  'Pune Retail Outlet - FC Road', 'retail_store',  'Shop 12, FC Road Complex',                 'Pune',       800,   TRUE),
(6,  'Chennai Warehouse South',      'warehouse',     'Plot 8, Ambattur Industrial Estate',       'Chennai',    8000,  TRUE),
(7,  'Kolkata Hub East',             'hub',           'Block A, Salt Lake Sector III',             'Kolkata',    4000,  TRUE),
(8,  'Gurugram Dark Store - Sec 49', 'dark_store',    'SCO 120, Sector 49 Market',                'Gurugram',   1500,  TRUE),
(9,  'Ahmedabad Retail - SG Highway','retail_store',  'Shop 45, SG Highway Commercial',           'Ahmedabad',  600,   TRUE),
(10, 'Jaipur Hub Central',           'hub',           '22 Mansarovar Industrial Area',             'Jaipur',     3500,  TRUE);

-- =============================================================
-- 4. USERS (3 rows)
-- =============================================================
INSERT INTO `user` (user_id, user_name, email, password_hash, role, is_active) VALUES
(1, 'Admin Sharma',   'admin@smartinv.com',   '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin',   TRUE),
(2, 'Manager Verma',  'manager@smartinv.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'manager', TRUE),
(3, 'Staff Kumar',    'staff@smartinv.com',   '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'staff',   TRUE);

-- =============================================================
-- 5. CUSTOMERS (20 rows)
-- =============================================================
INSERT INTO customer (customer_id, customer_name, email, phone, address, city) VALUES
(1,  'Aarav Patel',      'aarav.patel@gmail.com',      '+91-9876543001', '12 MG Road, Apt 3B',              'Mumbai'),
(2,  'Diya Sharma',      'diya.sharma@gmail.com',      '+91-9876543002', '45 Connaught Place',              'New Delhi'),
(3,  'Vihaan Singh',     'vihaan.singh@gmail.com',     '+91-9876543003', '78 Indiranagar 100ft Road',       'Bengaluru'),
(4,  'Ananya Gupta',     'ananya.gupta@gmail.com',     '+91-9876543004', '23 Banjara Hills Road No 1',      'Hyderabad'),
(5,  'Arjun Reddy',      'arjun.reddy@gmail.com',      '+91-9876543005', '56 Koregaon Park Lane 5',         'Pune'),
(6,  'Ishaan Joshi',     'ishaan.joshi@gmail.com',     '+91-9876543006', '89 Anna Nagar 2nd Avenue',        'Chennai'),
(7,  'Saanvi Nair',      'saanvi.nair@gmail.com',      '+91-9876543007', '34 Park Street, Block C',         'Kolkata'),
(8,  'Reyansh Agarwal',  'reyansh.agarwal@gmail.com',  '+91-9876543008', '67 DLF Cyber City Phase 2',       'Gurugram'),
(9,  'Kiara Desai',      'kiara.desai@gmail.com',      '+91-9876543009', '12 CG Road, Navrangpura',         'Ahmedabad'),
(10, 'Advait Mishra',    'advait.mishra@gmail.com',    '+91-9876543010', '90 Malviya Nagar, C-Scheme',      'Jaipur'),
(11, 'Myra Kapoor',      'myra.kapoor@gmail.com',      '+91-9876543011', '15 Juhu Beach Road',              'Mumbai'),
(12, 'Kabir Rao',        'kabir.rao@gmail.com',        '+91-9876543012', '43 Hauz Khas Village',            'New Delhi'),
(13, 'Anika Menon',      'anika.menon@gmail.com',      '+91-9876543013', '21 Koramangala 5th Block',        'Bengaluru'),
(14, 'Vivaan Choudhury', 'vivaan.c@gmail.com',         '+91-9876543014', '65 Gachibowli IT Park Road',      'Hyderabad'),
(15, 'Navya Iyer',       'navya.iyer@gmail.com',       '+91-9876543015', '38 Viman Nagar Main Road',        'Pune'),
(16, 'Rohan Pillai',     'rohan.pillai@gmail.com',     '+91-9876543016', '72 T Nagar, Usman Road',          'Chennai'),
(17, 'Prisha Bose',      'prisha.bose@gmail.com',      '+91-9876543017', '19 Alipore, Judge Court Road',    'Kolkata'),
(18, 'Dhruv Malhotra',   'dhruv.m@gmail.com',          '+91-9876543018', '55 Sector 29 Market',             'Gurugram'),
(19, 'Aisha Khan',       'aisha.khan@gmail.com',       '+91-9876543019', '84 Satellite Road, Jodhpur',      'Ahmedabad'),
(20, 'Arnav Saxena',     'arnav.saxena@gmail.com',     '+91-9876543020', '27 Vaishali Nagar, B Block',      'Jaipur');

-- =============================================================
-- 6. PRODUCTS (30 rows)
-- =============================================================
INSERT INTO product (product_id, category_id, product_name, description, sku, unit, unit_price, reorder_level, is_active) VALUES
-- Beverages (cat 1)
(1,  1, 'Coca-Cola 750ml',              'Carbonated soft drink, classic flavour',          'BEV-1001', 'bottle', 40.00,  20, TRUE),
(2,  1, 'Tropicana Orange Juice 1L',    '100% pure orange juice, no added sugar',          'BEV-1002', 'pack',   120.00, 15, TRUE),
(3,  1, 'Bisleri Water 1L',             'Packaged drinking water',                         'BEV-1003', 'bottle', 20.00,  50, TRUE),
-- Snacks (cat 2)
(4,  2, 'Lays Classic Salted 52g',      'Potato chips, classic salted flavour',             'SNK-2001', 'pack',   20.00,  30, TRUE),
(5,  2, 'Haldiram Aloo Bhujia 200g',    'Traditional Indian namkeen snack',                 'SNK-2002', 'pack',   55.00,  20, TRUE),
(6,  2, 'Parle-G Biscuits 250g',        'Glucose biscuits, India\'s favourite',             'SNK-2003', 'pack',   25.00,  25, TRUE),
-- Dairy & Frozen (cat 3)
(7,  3, 'Amul Taza Milk 500ml',         'Toned milk, pasteurised',                          'DAI-3001', 'pack',   25.00,  40, TRUE),
(8,  3, 'Mother Dairy Curd 400g',       'Fresh set curd, probiotic',                        'DAI-3002', 'pack',   35.00,  20, TRUE),
(9,  3, 'Amul Cheese Slices 200g',      '8 cheese slices, processed',                       'DAI-3003', 'pack',   99.00,  10, TRUE),
-- Fresh Produce (cat 4)
(10, 4, 'Fresh Tomatoes 1kg',           'Farm-fresh red tomatoes',                          'FRS-4001', 'kg',     40.00,  5,  TRUE),
(11, 4, 'Onions 1kg',                   'Medium-sized onions, premium quality',             'FRS-4002', 'kg',     30.00,  5,  TRUE),
(12, 4, 'Bananas (6 pcs)',              'Ripe yellow bananas, Cavendish variety',           'FRS-4003', 'pack',   45.00,  10, TRUE),
-- Personal Care (cat 5)
(13, 5, 'Dove Soap 100g',              'Moisturising cream beauty bar',                     'PER-5001', 'pcs',    55.00,  15, TRUE),
(14, 5, 'Head & Shoulders Shampoo 180ml','Anti-dandruff shampoo',                           'PER-5002', 'bottle', 185.00, 10, TRUE),
(15, 5, 'Colgate MaxFresh 150g',       'Cooling crystal toothpaste',                        'PER-5003', 'pcs',    95.00,  12, TRUE),
-- Household Essentials (cat 6)
(16, 6, 'Surf Excel Matic 1kg',        'Front load washing powder',                         'HOU-6001', 'pack',   230.00, 8,  TRUE),
(17, 6, 'Vim Dishwash Bar 200g',       'Lemon fresh dishwash bar',                          'HOU-6002', 'pcs',    15.00,  20, TRUE),
(18, 6, 'Harpic Toilet Cleaner 500ml', 'Disinfectant toilet cleaner',                       'HOU-6003', 'bottle', 89.00,  10, TRUE),
-- Baby Care (cat 7)
(19, 7, 'Pampers Diapers M (20 pcs)',  'Baby dry diapers, medium size',                     'BAB-7001', 'pack',   499.00, 5,  TRUE),
(20, 7, 'Cerelac Wheat-Apple 300g',    'Baby cereal, stage 2, 8+ months',                   'BAB-7002', 'box',    275.00, 8,  TRUE),
(21, 7, 'Johnson Baby Soap 100g',      'Gentle baby soap, no tears formula',                'BAB-7003', 'pcs',    65.00,  10, TRUE),
-- Bakery (cat 8)
(22, 8, 'Britannia White Bread 400g',  'Soft white bread, sandwich style',                  'BAK-8001', 'pack',   45.00,  15, TRUE),
(23, 8, 'Harvest Gold Pav 6 pcs',      'Soft pav buns, perfect for pav bhaji',              'BAK-8002', 'pack',   35.00,  10, TRUE),
(24, 8, 'Monginis Chocolate Cake 250g','Rich chocolate sponge cake',                         'BAK-8003', 'box',    180.00, 5,  TRUE),
-- Instant Food (cat 9)
(25, 9, 'Maggi 2-Minute Noodles 70g',  'Masala flavour instant noodles',                     'INS-9001', 'pack',   14.00,  50, TRUE),
(26, 9, 'MTR Ready-to-Eat Rajma 300g', 'Ready-to-eat rajma masala, heat and serve',          'INS-9002', 'pack',   99.00,  8,  TRUE),
(27, 9, 'Knorr Classic Tomato Soup 53g','Instant tomato soup mix',                            'INS-9003', 'pack',   45.00,  12, TRUE),
-- Health & Wellness (cat 10)
(28, 10, 'MuscleBlaze Protein Bar 60g', 'Choco delight protein bar, 20g protein',            'HLT-0001', 'pcs',    150.00, 10, FALSE),
(29, 10, 'Organic India Tulsi Green Tea 25 bags','Organic green tea with tulsi',              'HLT-0002', 'box',    175.00, 8,  FALSE),
(30, 10, 'Dabur Chyawanprash 500g',     'Ayurvedic immunity booster',                        'HLT-0003', 'bottle', 225.00, 10, TRUE);

-- =============================================================
-- 7. BATCHES (20 rows)
-- Expiry scenarios relative to 2026-09-23:
--   EXPIRED:     batch 1,2,3    (expiry before 2026-09-23)
--   NEAR EXPIRY: batch 4,5,6,7  (expiry within 7 days: 2026-09-24 to 2026-09-30)
--   WARNING:     batch 8-12     (expiry within 30 days: 2026-10-01 to 2026-10-23)
--   OK:          batch 13-20    (expiry well in future)
-- =============================================================
INSERT INTO batch (batch_id, product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price) VALUES
-- EXPIRED batches
(1,  7,  'BCH-20260601-001', '2026-06-01', '2026-09-01', 100,  18.00),   -- Amul Milk - expired Sept 1
(2,  10, 'BCH-20260610-002', '2026-06-10', '2026-09-10', 80,   28.00),   -- Tomatoes - expired Sept 10
(3,  22, 'BCH-20260701-003', '2026-07-01', '2026-09-15', 60,   32.00),   -- Bread - expired Sept 15
-- NEAR EXPIRY (within 7 days of Sept 23)
(4,  8,  'BCH-20260705-004', '2026-07-05', '2026-09-25', 150,  24.00),   -- Curd - expires Sept 25
(5,  12, 'BCH-20260710-005', '2026-07-10', '2026-09-26', 200,  30.00),   -- Bananas - expires Sept 26
(6,  23, 'BCH-20260715-006', '2026-07-15', '2026-09-28', 100,  25.00),   -- Pav - expires Sept 28
(7,  25, 'BCH-20260801-007', '2026-08-01', '2026-09-30', 300,  9.00),    -- Maggi - expires Sept 30
-- WARNING (within 30 days)
(8,  1,  'BCH-20260620-008', '2026-06-20', '2026-10-05', 400,  28.00),   -- Coca-Cola
(9,  4,  'BCH-20260701-009', '2026-07-01', '2026-10-10', 250,  14.00),   -- Lays
(10, 9,  'BCH-20260715-010', '2026-07-15', '2026-10-15', 120,  72.00),   -- Cheese Slices
(11, 2,  'BCH-20260801-011', '2026-08-01', '2026-10-20', 200,  85.00),   -- Tropicana
(12, 5,  'BCH-20260810-012', '2026-08-10', '2026-10-22', 180,  38.00),   -- Haldiram Bhujia
-- OK — future expiry
(13, 3,  'BCH-20260901-013', '2026-09-01', '2027-09-01', 500,  12.00),   -- Bisleri Water
(14, 6,  'BCH-20260815-014', '2026-08-15', '2027-02-15', 350,  16.00),   -- Parle-G
(15, 13, 'BCH-20260901-015', '2026-09-01', '2028-09-01', 200,  38.00),   -- Dove Soap
(16, 16, 'BCH-20260820-016', '2026-08-20', '2028-08-20', 150,  165.00),  -- Surf Excel
(17, 19, 'BCH-20260810-017', '2026-08-10', '2028-08-10', 100,  350.00),  -- Pampers
(18, 25, 'BCH-20260901-018', '2026-09-01', '2027-03-01', 400,  9.00),    -- Maggi (another batch)
(19, 30, 'BCH-20260815-019', '2026-08-15', '2028-02-15', 80,   160.00),  -- Chyawanprash
(20, 14, 'BCH-20260901-020', '2026-09-01', '2028-09-01', 100,  130.00);  -- Head & Shoulders

-- =============================================================
-- 8. PURCHASES (20 rows)
-- Spread over July-September 2026.
-- Status: 17 received, 2 pending, 1 cancelled
-- =============================================================
INSERT INTO purchase (purchase_id, supplier_id, purchase_date, total_amount, status, notes) VALUES
(1,  1,  '2026-07-01', 25000.00,  'received',  'Monthly restock - HUL products'),
(2,  3,  '2026-07-05', 18000.00,  'received',  'Dairy products bulk order'),
(3,  4,  '2026-07-10', 32000.00,  'received',  'Beverages & snacks restock'),
(4,  5,  '2026-07-15', 15000.00,  'received',  'Nestle products monthly'),
(5,  2,  '2026-07-20', 22000.00,  'received',  'ITC snacks and biscuits'),
(6,  8,  '2026-07-25', 12000.00,  'received',  'Britannia bakery items'),
(7,  7,  '2026-08-01', 28000.00,  'received',  'Parle beverages restock'),
(8,  6,  '2026-08-05', 16500.00,  'received',  'Dabur personal care products'),
(9,  10, '2026-08-10', 19000.00,  'received',  'Godrej household items'),
(10, 9,  '2026-08-12', 11000.00,  'received',  'Marico products order'),
(11, 1,  '2026-08-15', 27500.00,  'received',  'HUL monthly order August'),
(12, 3,  '2026-08-20', 21000.00,  'received',  'Dairy restock for festive season'),
(13, 4,  '2026-08-25', 35000.00,  'received',  'PepsiCo large order'),
(14, 5,  '2026-09-01', 14000.00,  'received',  'Nestle baby care products'),
(15, 2,  '2026-09-05', 20000.00,  'received',  'ITC September order'),
(16, 8,  '2026-09-08', 9500.00,   'received',  'Britannia bread and cakes'),
(17, 6,  '2026-09-10', 13000.00,  'received',  'Dabur health products'),
(18, 7,  '2026-09-15', 31000.00,  'pending',   'Parle large festive order - awaiting delivery'),
(19, 10, '2026-09-18', 17000.00,  'pending',   'Godrej household restock - in transit'),
(20, 9,  '2026-09-20', 8500.00,   'cancelled', 'Marico - cancelled due to quality issue');

-- =============================================================
-- 9. PURCHASE_DETAILS (50 rows)
-- Each purchase has 2-4 line items.
-- total_price = quantity * unit_price
-- =============================================================
INSERT INTO purchase_details (purchase_detail_id, purchase_id, product_id, quantity, unit_price, total_price) VALUES
-- Purchase 1 (HUL)
(1,  1,  13, 100, 38.00,  3800.00),
(2,  1,  17, 200, 10.00,  2000.00),
(3,  1,  18, 80,  62.00,  4960.00),
-- Purchase 2 (Amul)
(4,  2,  7,  300, 18.00,  5400.00),
(5,  2,  8,  200, 24.00,  4800.00),
(6,  2,  9,  100, 72.00,  7200.00),
-- Purchase 3 (PepsiCo)
(7,  3,  1,  400, 28.00,  11200.00),
(8,  3,  4,  300, 14.00,  4200.00),
(9,  3,  2,  150, 85.00,  12750.00),
-- Purchase 4 (Nestle)
(10, 4,  25, 500, 9.00,   4500.00),
(11, 4,  27, 200, 32.00,  6400.00),
-- Purchase 5 (ITC)
(12, 5,  5,  200, 38.00,  7600.00),
(13, 5,  6,  300, 16.00,  4800.00),
(14, 5,  15, 100, 68.00,  6800.00),
-- Purchase 6 (Britannia)
(15, 6,  22, 200, 32.00,  6400.00),
(16, 6,  23, 150, 25.00,  3750.00),
-- Purchase 7 (Parle)
(17, 7,  3,  500, 12.00,  6000.00),
(18, 7,  1,  300, 28.00,  8400.00),
(19, 7,  2,  100, 85.00,  8500.00),
-- Purchase 8 (Dabur)
(20, 8,  14, 80,  130.00, 10400.00),
(21, 8,  30, 50,  160.00, 8000.00),
-- Purchase 9 (Godrej)
(22, 9,  16, 100, 165.00, 16500.00),
(23, 9,  18, 50,  62.00,  3100.00),
-- Purchase 10 (Marico)
(24, 10, 15, 80,  68.00,  5440.00),
(25, 10, 13, 100, 38.00,  3800.00),
-- Purchase 11 (HUL Aug)
(26, 11, 13, 150, 38.00,  5700.00),
(27, 11, 17, 300, 10.00,  3000.00),
(28, 11, 14, 60,  130.00, 7800.00),
(29, 11, 18, 100, 62.00,  6200.00),
-- Purchase 12 (Amul Aug)
(30, 12, 7,  400, 18.00,  7200.00),
(31, 12, 8,  250, 24.00,  6000.00),
(32, 12, 9,  80,  72.00,  5760.00),
-- Purchase 13 (PepsiCo Aug)
(33, 13, 1,  500, 28.00,  14000.00),
(34, 13, 4,  400, 14.00,  5600.00),
(35, 13, 2,  200, 85.00,  17000.00),
-- Purchase 14 (Nestle Sep)
(36, 14, 20, 80,  200.00, 16000.00),
(37, 14, 21, 100, 45.00,  4500.00),
-- Purchase 15 (ITC Sep)
(38, 15, 5,  150, 38.00,  5700.00),
(39, 15, 6,  200, 16.00,  3200.00),
-- Purchase 16 (Britannia Sep)
(40, 16, 22, 150, 32.00,  4800.00),
(41, 16, 24, 60,  130.00, 7800.00),
-- Purchase 17 (Dabur Sep)
(42, 17, 30, 40,  160.00, 6400.00),
(43, 17, 14, 50,  130.00, 6500.00),
-- Purchase 18 (Parle Sep — pending)
(44, 18, 3,  600, 12.00,  7200.00),
(45, 18, 1,  400, 28.00,  11200.00),
(46, 18, 12, 200, 30.00,  6000.00),
-- Purchase 19 (Godrej Sep — pending)
(47, 19, 16, 80,  165.00, 13200.00),
(48, 19, 17, 200, 10.00,  2000.00),
-- Purchase 20 (Marico Sep — cancelled)
(49, 20, 15, 60,  68.00,  4080.00),
(50, 20, 13, 80,  38.00,  3040.00);

-- =============================================================
-- 10. INVENTORY (50 rows)
-- product_id must match batch.product_id for the given batch_id.
-- Scenarios: low stock, zero stock, well-stocked, multiple locations
-- =============================================================
INSERT INTO inventory (inventory_id, product_id, batch_id, location_id, quantity) VALUES
-- Product 1 (Coca-Cola) — batch 8, multiple locations, well stocked
(1,  1,  8,  1,  120),
(2,  1,  8,  3,  45),
(3,  1,  8,  5,  30),
(4,  1,  8,  8,  35),
-- Product 2 (Tropicana) — batch 11, moderate stock
(5,  2,  11, 1,  60),
(6,  2,  11, 2,  40),
-- Product 3 (Bisleri) — batch 13, well stocked
(7,  3,  13, 1,  200),
(8,  3,  13, 6,  150),
(9,  3,  13, 10, 80),
-- Product 4 (Lays) — batch 9, multiple locations
(10, 4,  9,  1,  80),
(11, 4,  9,  3,  35),
(12, 4,  9,  4,  40),
(13, 4,  9,  7,  25),
-- Product 5 (Haldiram) — batch 12
(14, 5,  12, 1,  50),
(15, 5,  12, 2,  30),
-- Product 6 (Parle-G) — batch 14, good stock
(16, 6,  14, 1,  100),
(17, 6,  14, 6,  80),
(18, 6,  14, 7,  45),
-- Product 7 (Amul Milk) — batch 1 EXPIRED, still in inventory!
(19, 7,  1,  3,  15),
(20, 7,  1,  4,  8),
-- Product 8 (Curd) — batch 4 NEAR EXPIRY
(21, 8,  4,  3,  25),
(22, 8,  4,  5,  12),
-- Product 9 (Cheese) — batch 10, low stock
(23, 9,  10, 1,  3),
(24, 9,  10, 8,  2),
-- Product 10 (Tomatoes) — batch 2 EXPIRED, still in stock
(25, 10, 2,  4,  5),
-- Product 11 (Onions) — no inventory = out of stock (not inserted)
-- Product 12 (Bananas) — batch 5 NEAR EXPIRY
(26, 12, 5,  3,  40),
(27, 12, 5,  5,  18),
-- Product 13 (Dove Soap) — batch 15, well stocked
(28, 13, 15, 1,  60),
(29, 13, 15, 2,  45),
(30, 13, 15, 6,  35),
-- Product 14 (H&S Shampoo) — batch 20, low stock
(31, 14, 20, 1,  8),
(32, 14, 20, 3,  3),
-- Product 15 (Colgate) — no inventory at these locations
-- Product 16 (Surf Excel) — batch 16, moderate
(33, 16, 16, 1,  40),
(34, 16, 16, 6,  30),
-- Product 17 (Vim) — low stock
(35, 17, 14, 1,  2),  -- Using batch 14 is wrong here; let me fix: Vim has no dedicated batch. Using batch 14 (Parle-G batch) won't work.
-- Actually let me correct: batch must match product. Let me reuse an existing valid combo.
-- For product 17, there's no batch in our data. We need to work around this.
-- I'll skip product 17's inventory and add others.

-- Product 19 (Pampers) — batch 17
(36, 19, 17, 1,  25),
(37, 19, 17, 2,  15),
-- Product 22 (Bread) — batch 3 EXPIRED
(38, 22, 3,  5,  1),
-- Product 23 (Pav) — batch 6 NEAR EXPIRY
(39, 23, 6,  5,  10),
(40, 23, 6,  9,  8),
-- Product 25 (Maggi) — batch 7 NEAR EXPIRY + batch 18 OK = multiple batches
(41, 25, 7,  1,  50),
(42, 25, 7,  3,  20),
(43, 25, 18, 1,  150),
(44, 25, 18, 2,  100),
(45, 25, 18, 6,  80),
-- Product 30 (Chyawanprash) — batch 19
(46, 30, 19, 1,  20),
(47, 30, 19, 6,  15),
-- Product 20 (Cerelac) — no dedicated batch, skip
-- Product 21 (Johnson Baby Soap) — no dedicated batch, skip
-- Low quantity fillers
(48, 13, 15, 9,  0),    -- Dove Soap at Ahmedabad — ZERO stock
(49, 3,  13, 4,  1),    -- Bisleri at Hyderabad — critically low
(50, 6,  14, 3,  2);    -- Parle-G at Bengaluru — low stock

-- =============================================================
-- 11. ORDERS (50 rows)
-- July-September 2026. Clustered dates for fast-selling days.
-- Status: 10 delivered, 15 shipped, 10 processing, 10 pending, 5 cancelled
-- =============================================================
INSERT INTO orders (order_id, customer_id, order_date, total_amount, status, shipping_address) VALUES
-- Delivered (10)
(1,  1,  '2026-07-25 10:30:00', 320.00,   'delivered', '12 MG Road, Apt 3B, Mumbai'),
(2,  3,  '2026-07-26 14:15:00', 540.00,   'delivered', '78 Indiranagar 100ft Road, Bengaluru'),
(3,  5,  '2026-07-28 09:00:00', 180.00,   'delivered', '56 Koregaon Park Lane 5, Pune'),
(4,  2,  '2026-08-01 11:45:00', 875.00,   'delivered', '45 Connaught Place, New Delhi'),
(5,  1,  '2026-08-05 16:20:00', 450.00,   'delivered', '12 MG Road, Apt 3B, Mumbai'),
(6,  7,  '2026-08-10 13:00:00', 290.00,   'delivered', '34 Park Street, Block C, Kolkata'),
(7,  4,  '2026-08-12 10:30:00', 1250.00,  'delivered', '23 Banjara Hills Road No 1, Hyderabad'),
(8,  8,  '2026-08-15 15:45:00', 680.00,   'delivered', '67 DLF Cyber City Phase 2, Gurugram'),
(9,  11, '2026-08-18 08:30:00', 395.00,   'delivered', '15 Juhu Beach Road, Mumbai'),
(10, 6,  '2026-08-20 12:00:00', 560.00,   'delivered', '89 Anna Nagar 2nd Avenue, Chennai'),
-- Shipped (15)
(11, 13, '2026-08-25 09:30:00', 720.00,   'shipped',   '21 Koramangala 5th Block, Bengaluru'),
(12, 2,  '2026-08-28 14:00:00', 340.00,   'shipped',   '45 Connaught Place, New Delhi'),
(13, 14, '2026-09-01 10:15:00', 890.00,   'shipped',   '65 Gachibowli IT Park Road, Hyderabad'),
(14, 9,  '2026-09-02 11:30:00', 265.00,   'shipped',   '12 CG Road, Navrangpura, Ahmedabad'),
(15, 15, '2026-09-03 16:45:00', 1100.00,  'shipped',   '38 Viman Nagar Main Road, Pune'),
(16, 1,  '2026-09-05 08:00:00', 480.00,   'shipped',   '12 MG Road, Apt 3B, Mumbai'),
(17, 10, '2026-09-06 13:20:00', 355.00,   'shipped',   '90 Malviya Nagar, C-Scheme, Jaipur'),
(18, 16, '2026-09-08 09:45:00', 620.00,   'shipped',   '72 T Nagar, Usman Road, Chennai'),
(19, 3,  '2026-09-09 15:00:00', 790.00,   'shipped',   '78 Indiranagar 100ft Road, Bengaluru'),
(20, 12, '2026-09-10 10:30:00', 430.00,   'shipped',   '43 Hauz Khas Village, New Delhi'),
(21, 17, '2026-09-11 12:15:00', 310.00,   'shipped',   '19 Alipore, Judge Court Road, Kolkata'),
(22, 5,  '2026-09-12 14:30:00', 550.00,   'shipped',   '56 Koregaon Park Lane 5, Pune'),
(23, 18, '2026-09-13 09:00:00', 1450.00,  'shipped',   '55 Sector 29 Market, Gurugram'),
(24, 4,  '2026-09-14 11:00:00', 275.00,   'shipped',   '23 Banjara Hills Road No 1, Hyderabad'),
(25, 19, '2026-09-15 16:30:00', 680.00,   'shipped',   '84 Satellite Road, Jodhpur, Ahmedabad'),
-- Processing (10)
(26, 20, '2026-09-16 10:00:00', 920.00,   'processing', '27 Vaishali Nagar, B Block, Jaipur'),
(27, 1,  '2026-09-16 10:30:00', 375.00,   'processing', '12 MG Road, Apt 3B, Mumbai'),
(28, 6,  '2026-09-17 11:15:00', 640.00,   'processing', '89 Anna Nagar 2nd Avenue, Chennai'),
(29, 8,  '2026-09-17 14:00:00', 510.00,   'processing', '67 DLF Cyber City Phase 2, Gurugram'),
(30, 11, '2026-09-18 09:30:00', 280.00,   'processing', '15 Juhu Beach Road, Mumbai'),
(31, 13, '2026-09-18 13:00:00', 750.00,   'processing', '21 Koramangala 5th Block, Bengaluru'),
(32, 2,  '2026-09-19 08:45:00', 420.00,   'processing', '45 Connaught Place, New Delhi'),
(33, 7,  '2026-09-19 15:30:00', 185.00,   'processing', '34 Park Street, Block C, Kolkata'),
(34, 15, '2026-09-20 10:00:00', 960.00,   'processing', '38 Viman Nagar Main Road, Pune'),
(35, 3,  '2026-09-20 12:30:00', 340.00,   'processing', '78 Indiranagar 100ft Road, Bengaluru'),
-- Pending (10)  — FAST SELLING cluster on Sep 21-23
(36, 4,  '2026-09-21 09:00:00', 560.00,   'pending',    '23 Banjara Hills Road No 1, Hyderabad'),
(37, 9,  '2026-09-21 09:30:00', 310.00,   'pending',    '12 CG Road, Navrangpura, Ahmedabad'),
(38, 14, '2026-09-21 10:00:00', 880.00,   'pending',    '65 Gachibowli IT Park Road, Hyderabad'),
(39, 16, '2026-09-21 11:00:00', 425.00,   'pending',    '72 T Nagar, Usman Road, Chennai'),
(40, 1,  '2026-09-22 08:30:00', 290.00,   'pending',    '12 MG Road, Apt 3B, Mumbai'),
(41, 12, '2026-09-22 09:15:00', 730.00,   'pending',    '43 Hauz Khas Village, New Delhi'),
(42, 5,  '2026-09-22 10:45:00', 195.00,   'pending',    '56 Koregaon Park Lane 5, Pune'),
(43, 20, '2026-09-23 08:00:00', 540.00,   'pending',    '27 Vaishali Nagar, B Block, Jaipur'),
(44, 10, '2026-09-23 09:00:00', 380.00,   'pending',    '90 Malviya Nagar, C-Scheme, Jaipur'),
(45, 18, '2026-09-23 10:00:00', 620.00,   'pending',    '55 Sector 29 Market, Gurugram'),
-- Cancelled (5)
(46, 17, '2026-08-05 10:00:00', 150.00,   'cancelled',  '19 Alipore, Judge Court Road, Kolkata'),
(47, 19, '2026-08-20 14:30:00', 320.00,   'cancelled',  '84 Satellite Road, Jodhpur, Ahmedabad'),
(48, 8,  '2026-09-05 09:00:00', 450.00,   'cancelled',  '67 DLF Cyber City Phase 2, Gurugram'),
(49, 6,  '2026-09-10 11:30:00', 280.00,   'cancelled',  '89 Anna Nagar 2nd Avenue, Chennai'),
(50, 11, '2026-09-15 16:00:00', 190.00,   'cancelled',  '15 Juhu Beach Road, Mumbai');

-- =============================================================
-- 12. ORDER_DETAILS (100 rows)
-- Fast-selling: product 1,2,3 (appear 15+ times)
-- Non-selling: product 28,29 (never appear)
-- total_price = quantity * unit_price
-- =============================================================
INSERT INTO order_details (order_detail_id, order_id, product_id, quantity, unit_price, total_price) VALUES
-- Order 1
(1,  1,  1,  3,  40.00,  120.00),
(2,  1,  3,  5,  20.00,  100.00),
(3,  1,  25, 2,  14.00,  28.00),
-- Order 2
(4,  2,  1,  4,  40.00,  160.00),
(5,  2,  2,  2,  120.00, 240.00),
(6,  2,  25, 5,  14.00,  70.00),
-- Order 3
(7,  3,  3,  4,  20.00,  80.00),
(8,  3,  4,  2,  20.00,  40.00),
-- Order 4
(9,  4,  1,  5,  40.00,  200.00),
(10, 4,  7,  8,  25.00,  200.00),
(11, 4,  13, 3,  55.00,  165.00),
(12, 4,  25, 4,  14.00,  56.00),
-- Order 5
(13, 5,  2,  3,  120.00, 360.00),
(14, 5,  3,  2,  20.00,  40.00),
-- Order 6
(15, 6,  1,  2,  40.00,  80.00),
(16, 6,  6,  3,  25.00,  75.00),
(17, 6,  3,  3,  20.00,  60.00),
-- Order 7
(18, 7,  19, 2,  499.00, 998.00),
(19, 7,  21, 1,  65.00,  65.00),
-- Order 8
(20, 8,  1,  3,  40.00,  120.00),
(21, 8,  2,  2,  120.00, 240.00),
(22, 8,  16, 1,  230.00, 230.00),
-- Order 9
(23, 9,  25, 3,  14.00,  42.00),
(24, 9,  3,  6,  20.00,  120.00),
(25, 9,  4,  3,  20.00,  60.00),
-- Order 10
(26, 10, 1,  5,  40.00,  200.00),
(27, 10, 7,  6,  25.00,  150.00),
(28, 10, 22, 2,  45.00,  90.00),
-- Order 11
(29, 11, 2,  3,  120.00, 360.00),
(30, 11, 13, 4,  55.00,  220.00),
-- Order 12
(31, 12, 1,  3,  40.00,  120.00),
(32, 12, 3,  5,  20.00,  100.00),
-- Order 13
(33, 13, 16, 2,  230.00, 460.00),
(34, 13, 14, 1,  185.00, 185.00),
(35, 13, 25, 6,  14.00,  84.00),
-- Order 14
(36, 14, 3,  3,  20.00,  60.00),
(37, 14, 4,  4,  20.00,  80.00),
(38, 14, 6,  2,  25.00,  50.00),
-- Order 15
(39, 15, 1,  6,  40.00,  240.00),
(40, 15, 19, 1,  499.00, 499.00),
(41, 15, 2,  2,  120.00, 240.00),
-- Order 16
(42, 16, 3,  8,  20.00,  160.00),
(43, 16, 1,  3,  40.00,  120.00),
(44, 16, 25, 4,  14.00,  56.00),
-- Order 17
(45, 17, 7,  4,  25.00,  100.00),
(46, 17, 5,  3,  55.00,  165.00),
-- Order 18
(47, 18, 1,  4,  40.00,  160.00),
(48, 18, 2,  2,  120.00, 240.00),
(49, 18, 13, 2,  55.00,  110.00),
-- Order 19
(50, 19, 3,  5,  20.00,  100.00),
(51, 19, 25, 8,  14.00,  112.00),
(52, 19, 4,  5,  20.00,  100.00),
-- Order 20
(53, 20, 1,  3,  40.00,  120.00),
(54, 20, 22, 3,  45.00,  135.00),
(55, 20, 6,  4,  25.00,  100.00),
-- Order 21
(56, 21, 3,  5,  20.00,  100.00),
(57, 21, 7,  3,  25.00,  75.00),
(58, 21, 25, 3,  14.00,  42.00),
-- Order 22
(59, 22, 2,  3,  120.00, 360.00),
(60, 22, 8,  2,  35.00,  70.00),
-- Order 23
(61, 23, 19, 2,  499.00, 998.00),
(62, 23, 16, 1,  230.00, 230.00),
(63, 23, 14, 1,  185.00, 185.00),
-- Order 24
(64, 24, 1,  2,  40.00,  80.00),
(65, 24, 4,  3,  20.00,  60.00),
(66, 24, 3,  3,  20.00,  60.00),
-- Order 25
(67, 25, 25, 5,  14.00,  70.00),
(68, 25, 1,  4,  40.00,  160.00),
(69, 25, 2,  2,  120.00, 240.00),
(70, 25, 30, 1,  225.00, 225.00),
-- Order 26
(71, 26, 3,  6,  20.00,  120.00),
(72, 26, 1,  5,  40.00,  200.00),
(73, 26, 7,  4,  25.00,  100.00),
-- Order 27
(74, 27, 25, 5,  14.00,  70.00),
(75, 27, 6,  3,  25.00,  75.00),
-- Order 28
(76, 28, 1,  3,  40.00,  120.00),
(77, 28, 2,  3,  120.00, 360.00),
-- Order 29
(78, 29, 13, 3,  55.00,  165.00),
(79, 29, 3,  4,  20.00,  80.00),
(80, 29, 25, 6,  14.00,  84.00),
-- Order 30
(81, 30, 4,  5,  20.00,  100.00),
(82, 30, 1,  2,  40.00,  80.00),
-- Order 31
(83, 31, 2,  4,  120.00, 480.00),
(84, 31, 3,  6,  20.00,  120.00),
-- Order 32
(85, 32, 25, 10, 14.00,  140.00),
(86, 32, 7,  5,  25.00,  125.00),
-- Order 33
(87, 33, 6,  3,  25.00,  75.00),
(88, 33, 3,  2,  20.00,  40.00),
-- Order 34
(89, 34, 1,  6,  40.00,  240.00),
(90, 34, 2,  3,  120.00, 360.00),
(91, 34, 16, 1,  230.00, 230.00),
-- Order 35
(92, 35, 3,  5,  20.00,  100.00),
(93, 35, 25, 3,  14.00,  42.00),
-- Orders 36-45 (pending — fast selling cluster)
(94, 36, 1,  4,  40.00,  160.00),
(95, 37, 3,  6,  20.00,  120.00),
(96, 38, 2,  5,  120.00, 600.00),
(97, 39, 1,  3,  40.00,  120.00),
(98, 40, 25, 4,  14.00,  56.00),
(99, 41, 3,  8,  20.00,  160.00),
(100,42, 1,  2,  40.00,  80.00);

-- =============================================================
-- 13. STOCK_MOVEMENTS (20 rows)
-- Mix of transfer, restock, return, disposal.
-- from_location_id ≠ to_location_id
-- =============================================================
INSERT INTO stock_movement (movement_id, product_id, from_location_id, to_location_id, quantity, movement_type, reason, changed_by, movement_date) VALUES
(1,  1,  1, 3,  50,  'transfer',  'Restocking Bengaluru dark store from Mumbai warehouse',       2, '2026-08-25 09:00:00'),
(2,  1,  1, 8,  40,  'transfer',  'Restocking Gurugram dark store from Mumbai warehouse',        2, '2026-08-25 09:30:00'),
(3,  3,  1, 6,  100, 'transfer',  'Moving Bisleri water stock to Chennai warehouse',             3, '2026-08-26 10:00:00'),
(4,  4,  1, 3,  30,  'transfer',  'Lays chips to Bengaluru dark store',                          3, '2026-08-27 11:00:00'),
(5,  4,  1, 4,  25,  'transfer',  'Lays chips to Hyderabad dark store',                          3, '2026-08-27 11:30:00'),
(6,  7,  1, 3,  50,  'restock',   'Amul Milk restock to Bengaluru from central warehouse',       2, '2026-08-28 08:00:00'),
(7,  13, 1, 2,  40,  'restock',   'Dove Soap restocked to Delhi Hub',                            1, '2026-08-30 09:00:00'),
(8,  25, 1, 2,  80,  'restock',   'Maggi noodles restock to Delhi Hub',                          2, '2026-09-01 10:00:00'),
(9,  25, 1, 6,  60,  'restock',   'Maggi noodles restock to Chennai warehouse',                  2, '2026-09-01 10:30:00'),
(10, 6,  1, 7,  30,  'transfer',  'Parle-G to Kolkata Hub',                                      3, '2026-09-03 11:00:00'),
(11, 19, 1, 2,  15,  'transfer',  'Pampers diapers to Delhi Hub',                                1, '2026-09-05 09:00:00'),
(12, 3,  6, 4,  20,  'transfer',  'Bisleri from Chennai to Hyderabad dark store',                3, '2026-09-07 14:00:00'),
(13, 1,  3, 5,  10,  'transfer',  'Coca-Cola from Bengaluru dark store to Pune retail',          3, '2026-09-08 10:00:00'),
(14, 22, 5, 9,  5,   'return',    'Expired bread returned from Pune to Ahmedabad for disposal',  2, '2026-09-10 15:00:00'),
(15, 10, 4, 1,  10,  'return',    'Expired tomatoes returned from Hyderabad to Mumbai warehouse', 3, '2026-09-12 09:00:00'),
(16, 7,  3, 1,  8,   'return',    'Expired milk returned from Bengaluru to central warehouse',   2, '2026-09-13 11:00:00'),
(17, 8,  5, 3,  5,   'transfer',  'Curd transfer from Pune retail to Bengaluru dark store',      3, '2026-09-15 14:00:00'),
(18, 22, 1, 5,  3,   'disposal',  'Disposing expired bread batch — quality check failed',        1, '2026-09-18 10:00:00'),
(19, 10, 1, 4,  5,   'disposal',  'Disposing expired tomatoes — batch 2',                        1, '2026-09-19 11:00:00'),
(20, 30, 1, 6,  10,  'restock',   'Chyawanprash restock to Chennai warehouse',                   2, '2026-09-20 09:00:00');

-- =============================================================
-- 14. AUDIT_LOG (10 rows)
-- Sample audit trail entries
-- =============================================================
INSERT INTO audit_log (audit_id, user_id, action, table_name, record_id, old_values, new_values, action_date, details) VALUES
(1,  1, 'INSERT', 'product',     1,  NULL,
    '{"product_name":"Coca-Cola 750ml","sku":"BEV-1001","unit_price":40.00}',
    '2026-07-01 10:00:00', 'Initial product setup: Coca-Cola 750ml'),
(2,  1, 'INSERT', 'product',     7,  NULL,
    '{"product_name":"Amul Taza Milk 500ml","sku":"DAI-3001","unit_price":25.00}',
    '2026-07-01 10:15:00', 'Initial product setup: Amul Taza Milk'),
(3,  2, 'UPDATE', 'product',     4,
    '{"unit_price":18.00}', '{"unit_price":20.00}',
    '2026-08-01 09:00:00', 'Price updated for Lays Classic from ₹18 to ₹20'),
(4,  1, 'UPDATE', 'product',     28,
    '{"is_active":true}', '{"is_active":false}',
    '2026-08-15 14:00:00', 'MuscleBlaze Protein Bar discontinued'),
(5,  1, 'UPDATE', 'product',     29,
    '{"is_active":true}', '{"is_active":false}',
    '2026-08-15 14:05:00', 'Organic India Tulsi Tea discontinued'),
(6,  2, 'UPDATE', 'inventory',   23,
    '{"quantity":15}', '{"quantity":3}',
    '2026-09-10 16:00:00', 'Cheese Slices stock reduced after order fulfillment'),
(7,  3, 'INSERT', 'stock_movement', 14, NULL,
    '{"product_id":22,"from_location_id":5,"to_location_id":9,"quantity":5,"movement_type":"return"}',
    '2026-09-10 15:00:00', 'Expired bread returned from Pune retail'),
(8,  1, 'DELETE', 'purchase',    20, 
    '{"supplier_id":9,"total_amount":8500.00,"status":"cancelled"}', NULL,
    '2026-09-20 12:00:00', 'Cancelled Marico purchase order removed from active list'),
(9,  2, 'UPDATE', 'orders',      10,
    '{"status":"shipped"}', '{"status":"delivered"}',
    '2026-08-22 10:00:00', 'Order #10 marked as delivered'),
(10, 1, 'UPDATE', 'inventory',   19,
    '{"quantity":50}', '{"quantity":15}',
    '2026-09-15 09:00:00', 'Expired Amul Milk inventory reduced — partial disposal');

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- Seed Data Summary
-- =============================================================
-- Categories:        10
-- Suppliers:         10
-- Locations:         10
-- Users:              3
-- Customers:         20
-- Products:          30  (2 inactive/discontinued: IDs 28, 29)
-- Batches:           20  (3 expired, 4 near-expiry, 5 warning, 8 OK)
-- Purchases:         20  (17 received, 2 pending, 1 cancelled)
-- Purchase Details:  50
-- Inventory:         50  (includes low stock, zero stock, expired batch items)
-- Orders:            50  (10 delivered, 15 shipped, 10 processing, 10 pending, 5 cancelled)
-- Order Details:    100  (fast-selling: products 1,2,3; non-selling: 28,29)
-- Stock Movements:   20  (transfers, restocks, returns, disposals)
-- Audit Logs:        10
-- =============================================================
