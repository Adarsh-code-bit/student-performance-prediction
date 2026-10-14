const pool = require('../config/db.config');

/**
 * Controlled Demo Inventory Generator
 * Generates realistic operational data (Batches, Locations, Inventory) for a newly imported product.
 */

// Helper to add days to a date
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

exports.generateInventoryForProduct = async (productId, categoryName) => {
  try {
    // 1. Determine shelf life based on category mapping
    let shelfLifeDays = 365;
    let preferredZone = 'Ambient';
    
    if (categoryName.includes('Dairy') || categoryName.includes('Bakery')) {
      shelfLifeDays = 7; // Short shelf life
      preferredZone = 'Chilled';
    } else if (categoryName.includes('Snacks') || categoryName.includes('Beverages')) {
      shelfLifeDays = 180; // Medium
    }

    // 2. Fetch or create a random location for this zone
    const [locations] = await pool.query('SELECT location_id FROM location WHERE zone = ?', [preferredZone]);
    let locationId;
    if (locations.length > 0) {
      locationId = locations[Math.floor(Math.random() * locations.length)].location_id;
    } else {
      // Create a default location if none exist
      const rack = `${preferredZone.substring(0,3).toUpperCase()}-${Math.floor(Math.random()*100)}`;
      const [locResult] = await pool.query(
        'INSERT INTO location (location_name, rack_number, zone, description) VALUES (?, ?, ?, ?)',
        [`${preferredZone} Storage`, rack, preferredZone, 'Generated Demo Location']
      );
      locationId = locResult.insertId;
    }

    // 3. Generate 1 to 3 Batches
    const numBatches = Math.floor(Math.random() * 3) + 1;
    const now = new Date();
    
    for (let i = 0; i < numBatches; i++) {
      // Create interesting expiry scenarios: Healthy, Near Expiry, or Expired
      let expiryDate;
      const scenario = Math.random();
      
      if (scenario < 0.7) {
        // 70% Healthy (far in future)
        expiryDate = addDays(now, Math.floor(Math.random() * shelfLifeDays) + 31);
      } else if (scenario < 0.85) {
        // 15% Near Expiry
        expiryDate = addDays(now, Math.floor(Math.random() * 20) + 1);
      } else {
        // 15% Expired
        expiryDate = addDays(now, -(Math.floor(Math.random() * 30) + 1));
      }

      const mfgDate = addDays(expiryDate, -shelfLifeDays);
      const batchCode = `B-${productId}-${Date.now().toString().slice(-4)}-${i}`;
      const qty = Math.floor(Math.random() * 100) + 10;
      const cost = (Math.random() * 50 + 10).toFixed(2);

      const [batchResult] = await pool.query(
        `INSERT INTO batch (product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, batchCode, mfgDate, expiryDate, qty, cost]
      );

      // 4. Insert into Inventory
      await pool.query(
        `INSERT INTO inventory (product_id, batch_id, location_id, quantity) 
         VALUES (?, ?, ?, ?)`,
        [productId, batchResult.insertId, locationId, qty]
      );
    }

    return { success: true, message: 'Demo inventory generated successfully' };
  } catch (error) {
    console.error('Demo Generator Error:', error.message);
    return { success: false, message: 'Failed to generate demo inventory' };
  }
};
