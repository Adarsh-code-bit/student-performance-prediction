const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

exports.getAll = async (req, res) => {
  try {
    let sql = `
      SELECT p.*, c.category_name 
      FROM product p 
      JOIN category c ON p.category_id = c.category_id 
      WHERE 1=1
    `;
    const params = [];

    if (req.query.category_id) {
      sql += ' AND p.category_id = ?';
      params.push(req.query.category_id);
    }
    if (req.query.active !== undefined) {
      sql += ' AND p.is_active = ?';
      params.push(req.query.active === 'true' ? 1 : 0);
    }
    if (req.query.search) {
      sql += ' AND p.product_name LIKE ?';
      params.push(`%${req.query.search}%`);
    }

    sql += ' ORDER BY p.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const sql = `
      SELECT p.*, c.category_name 
      FROM product p 
      JOIN category c ON p.category_id = c.category_id 
      WHERE p.product_id = ?
    `;
    const [rows] = await pool.query(sql, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { category_id, product_name, sku, unit, unit_price, description, reorder_level, barcode, image_url, brand, external_source, external_product_id } = req.body;
    
    if (!category_id || !product_name || !sku || !unit || unit_price === undefined || unit_price === null) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const trimmedSku = String(sku).trim();
    const trimmedBarcode = barcode ? String(barcode).trim() : null;
    const trimmedImageUrl = image_url ? String(image_url).trim() : null;
    const trimmedBrand = brand ? String(brand).trim() : null;

    if (trimmedImageUrl && !offService.isValidImageUrl(trimmedImageUrl)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid image URL format. Only secure HTTP/HTTPS URLs from public domains are allowed.' 
      });
    }

    // Check duplicate SKU
    const [existingSku] = await pool.query('SELECT product_id FROM product WHERE sku = ?', [trimmedSku]);
    if (existingSku.length > 0) {
      return res.status(409).json({ success: false, message: `SKU "${trimmedSku}" is already registered to another product` });
    }

    // Check duplicate barcode if provided
    if (trimmedBarcode) {
      const [existingBarcode] = await pool.query('SELECT product_id, product_name FROM product WHERE barcode = ?', [trimmedBarcode]);
      if (existingBarcode.length > 0) {
        return res.status(409).json({ 
          success: false, 
          message: `Barcode "${trimmedBarcode}" is already assigned to "${existingBarcode[0].product_name}"` 
        });
      }
    }

    const sql = `
      INSERT INTO product (category_id, product_name, sku, unit, unit_price, description, reorder_level, barcode, image_url, brand, external_source, external_product_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [
      category_id, 
      String(product_name).trim(), 
      trimmedSku, 
      String(unit).trim(), 
      parseFloat(unit_price), 
      description ? String(description).trim() : null, 
      reorder_level ? parseInt(reorder_level, 10) : 10,
      trimmedBarcode,
      trimmedImageUrl,
      trimmedBrand,
      external_source ? String(external_source).trim() : 'Local',
      external_product_id ? String(external_product_id).trim() : null
    ]);

    // Audit Log
    const userId = req.user ? req.user.user_id : 1;
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) VALUES (?, 'INSERT', 'product', ?, ?)`,
      [userId, result.insertId, `Created product: ${product_name} (SKU: ${trimmedSku}, Barcode: ${trimmedBarcode || 'None'})`]
    );

    res.status(201).json({ 
      success: true, 
      data: { 
        insertId: result.insertId,
        product_id: result.insertId,
        product_name: String(product_name).trim(),
        sku: trimmedSku,
        barcode: trimmedBarcode,
        image_url: trimmedImageUrl,
        brand: trimmedBrand,
        unit_price: parseFloat(unit_price)
      }, 
      message: 'Product created in catalog with 0 stock. Stock receiving is required to record physical inventory.' 
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'SKU or Barcode already exists' });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const { category_id, product_name, sku, unit, unit_price, description, reorder_level, is_active, barcode, image_url, brand } = req.body;

    const trimmedSku = sku !== undefined ? String(sku).trim() : undefined;
    const trimmedBarcode = barcode !== undefined ? (barcode ? String(barcode).trim() : null) : undefined;
    const trimmedImageUrl = image_url !== undefined ? (image_url ? String(image_url).trim() : null) : undefined;
    const trimmedBrand = brand !== undefined ? (brand ? String(brand).trim() : null) : undefined;

    if (trimmedImageUrl && !offService.isValidImageUrl(trimmedImageUrl)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid image URL format. Only secure HTTP/HTTPS URLs from public domains are allowed.' 
      });
    }

    // Check duplicate SKU if updating
    if (trimmedSku) {
      const [existingSku] = await pool.query('SELECT product_id FROM product WHERE sku = ? AND product_id != ?', [trimmedSku, id]);
      if (existingSku.length > 0) {
        return res.status(409).json({ success: false, message: `SKU "${trimmedSku}" is already registered to another product` });
      }
    }

    // Check duplicate barcode if updating
    if (trimmedBarcode) {
      const [existingBarcode] = await pool.query('SELECT product_id, product_name FROM product WHERE barcode = ? AND product_id != ?', [trimmedBarcode, id]);
      if (existingBarcode.length > 0) {
        return res.status(409).json({ 
          success: false, 
          message: `Barcode "${trimmedBarcode}" is already assigned to "${existingBarcode[0].product_name}"` 
        });
      }
    }

    const sql = `
      UPDATE product 
      SET category_id = COALESCE(?, category_id),
          product_name = COALESCE(?, product_name),
          sku = COALESCE(?, sku),
          unit = COALESCE(?, unit),
          unit_price = COALESCE(?, unit_price),
          description = CASE WHEN ? = 1 THEN ? ELSE description END,
          reorder_level = COALESCE(?, reorder_level),
          is_active = COALESCE(?, is_active),
          barcode = CASE WHEN ? = 1 THEN ? ELSE barcode END,
          image_url = CASE WHEN ? = 1 THEN ? ELSE image_url END,
          brand = CASE WHEN ? = 1 THEN ? ELSE brand END
      WHERE product_id = ?
    `;
    const [result] = await pool.query(sql, [
      category_id, 
      product_name !== undefined ? String(product_name).trim() : null, 
      trimmedSku, 
      unit, 
      unit_price !== undefined ? parseFloat(unit_price) : null, 
      description !== undefined ? 1 : 0, description ? String(description).trim() : null, 
      reorder_level !== undefined ? parseInt(reorder_level, 10) : null, 
      is_active, 
      trimmedBarcode !== undefined ? 1 : 0, trimmedBarcode,
      trimmedImageUrl !== undefined ? 1 : 0, trimmedImageUrl,
      trimmedBrand !== undefined ? 1 : 0, trimmedBrand,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    // Audit Log
    const userId = req.user ? req.user.user_id : 1;
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) VALUES (?, 'UPDATE', 'product', ?, ?)`,
      [userId, id, `Updated product ID: ${id}`]
    );

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'SKU or Barcode already exists' });
    }
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/products/:id/receive-stock
 * Initial stock receiving for a catalog product.
 * Reuses atomic purchase, batch, and inventory workflow.
 */
exports.receiveInitialStock = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid product ID' });

  const {
    quantity,
    location_id,
    batch_code,
    manufacturing_date,
    expiry_date,
    cost_price,
    supplier_id
  } = req.body;

  // Strict backend validation
  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a positive integer greater than zero' });
  }

  const locId = parseId(location_id);
  if (!locId) {
    return res.status(400).json({ success: false, message: 'Valid storage location is required' });
  }

  if (!batch_code || typeof batch_code !== 'string' || !batch_code.trim()) {
    return res.status(400).json({ success: false, message: 'batch_code is required' });
  }

  if (!manufacturing_date || isNaN(Date.parse(manufacturing_date))) {
    return res.status(400).json({ success: false, message: 'Valid manufacturing_date is required (YYYY-MM-DD)' });
  }

  if (!expiry_date || isNaN(Date.parse(expiry_date))) {
    return res.status(400).json({ success: false, message: 'Valid expiry_date is required (YYYY-MM-DD)' });
  }

  if (new Date(expiry_date) <= new Date(manufacturing_date)) {
    return res.status(400).json({ success: false, message: 'Expiry date must be after manufacturing date' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify product exists and is active
    const [prodRows] = await connection.query('SELECT product_id, product_name, unit_price FROM product WHERE product_id = ? AND is_active = TRUE', [id]);
    if (prodRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Product not found or inactive' });
    }
    const product = prodRows[0];

    // 2. Verify location exists and is active
    const [locRows] = await connection.query('SELECT location_id, location_name FROM location WHERE location_id = ? AND is_active = TRUE', [locId]);
    if (locRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Location not found or inactive' });
    }

    // 3. Resolve supplier
    let resolvedSupplierId = supplier_id ? parseId(supplier_id) : null;
    if (!resolvedSupplierId) {
      const [supRows] = await connection.query('SELECT supplier_id FROM supplier WHERE is_active = TRUE LIMIT 1');
      resolvedSupplierId = supRows.length > 0 ? supRows[0].supplier_id : 1;
    }

    // 4. Validate duplicate batch_code
    const cleanBatch = batch_code.trim();
    const [existingBatch] = await connection.query('SELECT batch_id FROM batch WHERE batch_code = ?', [cleanBatch]);
    if (existingBatch.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: `Batch code "${cleanBatch}" already exists` });
    }

    const unitCost = cost_price !== undefined && !isNaN(parseFloat(cost_price)) ? parseFloat(cost_price) : parseFloat(product.unit_price);
    const totalAmount = (qty * unitCost).toFixed(2);
    const today = new Date().toISOString().split('T')[0];

    // 5. Create purchase order with status 'received'
    const [purchaseResult] = await connection.query(
      `INSERT INTO purchase (supplier_id, purchase_date, total_amount, status, notes) 
       VALUES (?, ?, ?, 'received', ?)`,
      [resolvedSupplierId, today, totalAmount, `Initial stock receiving for product #${id} (${product.product_name})`]
    );
    const purchaseId = purchaseResult.insertId;

    // 6. Insert purchase_details
    await connection.query(
      `INSERT INTO purchase_details (purchase_id, product_id, quantity, unit_price, total_price) 
       VALUES (?, ?, ?, ?, ?)`,
      [purchaseId, id, qty, unitCost, totalAmount]
    );

    // 7. Insert batch
    const [batchResult] = await connection.query(
      `INSERT INTO batch (product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, cleanBatch, manufacturing_date, expiry_date, qty, unitCost]
    );
    const batchId = batchResult.insertId;

    // 8. Insert or update inventory
    await connection.query(
      `INSERT INTO inventory (product_id, batch_id, location_id, quantity) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [id, batchId, locId, qty]
    );

    // 9. Audit log
    const userId = req.user ? req.user.user_id : 1;
    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) VALUES (?, 'INSERT', 'inventory', ?, ?)`,
      [userId, batchId, `Initial stock receiving: ${qty} units of product #${id} (${product.product_name}) at location #${locId} (Batch: ${cleanBatch})`]
    );

    await connection.commit();
    res.status(201).json({
      success: true,
      message: `Successfully received ${qty} units of "${product.product_name}" into warehouse inventory`,
      data: {
        purchase_id: purchaseId,
        product_id: id,
        product_name: product.product_name,
        batch_id: batchId,
        batch_code: cleanBatch,
        location_id: locId,
        quantity: qty
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error receiving initial stock:', error);
    res.status(500).json({ success: false, message: 'Internal server error receiving stock' });
  } finally {
    connection.release();
  }
};

exports.delete = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const sql = 'UPDATE product SET is_active = FALSE WHERE product_id = ?';
    const [result] = await pool.query(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    // Audit Log
    const userId = req.user ? req.user.user_id : 1;
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) VALUES (?, 'DELETE', 'product', ?, ?)`,
      [userId, id, `Soft-deleted product ID: ${id}`]
    );

    res.json({ success: true, message: 'Product soft-deleted successfully' });
  } catch (error) {
    console.error('Error soft-deleting product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==========================================
// OPEN FOOD FACTS INTEGRATION
// ==========================================

const offService = require('../services/openfoodfacts.service');
const demoGenerator = require('../utils/demo-inventory.generator');

exports.searchExternal = async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ success: false, message: 'Missing search query' });
  
  const result = await offService.searchProducts(query);
  if (!result.success) return res.status(500).json(result);
  res.json(result);
};

exports.getExternalByBarcode = async (req, res) => {
  const barcode = req.params.barcode;
  if (!barcode) return res.status(400).json({ success: false, message: 'Missing barcode parameter' });
  
  const result = await offService.getProductByBarcode(barcode);
  if (!result.success) {
    return res.status(result.status || 500).json(result);
  }
  res.json(result);
};

// Internal helper to find or create category
async function findOrCreateCategory(categoryName) {
  const [rows] = await pool.query('SELECT category_id FROM category WHERE category_name = ?', [categoryName]);
  if (rows.length > 0) return rows[0].category_id;
  
  const [insert] = await pool.query('INSERT INTO category (category_name, description) VALUES (?, ?)', [categoryName, 'Generated from external import']);
  return insert.insertId;
}

exports.importProduct = async (req, res) => {
  try {
    const { product_name, brand, barcode, category, unit, image_url } = req.body;
    
    if (!product_name) return res.status(400).json({ success: false, message: 'Product name is required' });

    // Check duplicate barcode
    if (barcode) {
      const [existing] = await pool.query('SELECT product_id FROM product WHERE barcode = ?', [barcode]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'Product already exists', product_id: existing[0].product_id });
      }
    }

    const categoryId = await findOrCreateCategory(category || 'Other');
    
    // Generate a SKU
    const sku = `OFF-${barcode || Date.now().toString().slice(-6)}`;
    const unitPrice = (Math.random() * 200 + 10).toFixed(2); // Dummy price

    const sql = `
      INSERT INTO product (category_id, product_name, brand, barcode, sku, unit, unit_price, image_url, external_source, external_product_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open Food Facts', ?)
    `;
    const [result] = await pool.query(sql, [
      categoryId, product_name, brand, barcode || null, sku, unit, unitPrice, image_url || null, barcode || null
    ]);

    // Log import
    const userId = req.user ? req.user.user_id : 1;
    await pool.query(
      'INSERT INTO product_import_log (imported_by, source, number_of_products, success_count, failed_count) VALUES (?, ?, ?, ?, ?)',
      [userId, 'Open Food Facts - Single', 1, 1, 0]
    );

    res.status(201).json({ success: true, message: 'Product imported successfully', data: { product_id: result.insertId } });
  } catch (error) {
    console.error('Import Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to import product' });
  }
};

exports.bulkImportProducts = async (req, res) => {
  try {
    const { search_term, max_products = 50 } = req.body;
    if (!search_term) return res.status(400).json({ success: false, message: 'Search term required' });

    const searchResult = await offService.searchProducts(search_term, Math.min(max_products, 100));
    if (!searchResult.success) return res.status(500).json({ success: false, message: 'External API failure' });

    let imported = 0;
    let existed = 0;
    let skipped = 0;

    for (const p of searchResult.data) {
      if (!p.product_name || !p.barcode) {
        skipped++;
        continue;
      }

      const [existing] = await pool.query('SELECT product_id FROM product WHERE barcode = ?', [p.barcode]);
      if (existing.length > 0) {
        existed++;
        continue;
      }

      try {
        const categoryId = await findOrCreateCategory(p.category);
        const sku = `OFF-${p.barcode}`;
        const unitPrice = (Math.random() * 200 + 10).toFixed(2);
        
        await pool.query(
          `INSERT INTO product (category_id, product_name, brand, barcode, sku, unit, unit_price, image_url, external_source, external_product_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open Food Facts', ?)`,
          [categoryId, p.product_name, p.brand, p.barcode, sku, p.unit, unitPrice, p.image_url, p.barcode]
        );
        imported++;
      } catch (err) {
        console.error('Failed inserting item', err.message);
        skipped++;
      }
    }

    const userId = req.user ? req.user.user_id : 1;
    await pool.query(
      'INSERT INTO product_import_log (imported_by, source, number_of_products, success_count, failed_count) VALUES (?, ?, ?, ?, ?)',
      [userId, `Bulk: ${search_term}`, searchResult.data.length, imported, skipped]
    );

    res.json({
      success: true,
      data: {
        requested: max_products,
        found: searchResult.data.length,
        imported,
        already_existed: existed,
        skipped,
        failed: 0
      }
    });

  } catch (error) {
    console.error('Bulk Import Error:', error.message);
    res.status(500).json({ success: false, message: 'Bulk import failed' });
  }
};

exports.generateDemoInventory = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    // Ensure product exists
    const [rows] = await pool.query('SELECT p.product_id, c.category_name FROM product p JOIN category c ON p.category_id = c.category_id WHERE p.product_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });

    const result = await demoGenerator.generateInventoryForProduct(id, rows[0].category_name);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Generate inventory error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const { validateBarcode } = require('../utils/barcode.util');

exports.lookupByBarcode = async (req, res) => {
  try {
    const rawBarcode = req.params.barcode || req.query.barcode;
    const validation = validateBarcode(rawBarcode);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        found: false,
        message: validation.error || 'Invalid barcode format.'
      });
    }

    const barcode = validation.barcode;

    // 1. Search MySQL product table
    const [localRows] = await pool.query(
      `SELECT p.*, c.category_name,
              (SELECT COALESCE(SUM(quantity), 0) FROM inventory i WHERE i.product_id = p.product_id AND i.quantity > 0) AS current_stock
       FROM product p 
       LEFT JOIN category c ON p.category_id = c.category_id 
       WHERE p.barcode = ? AND p.is_active = 1`,
      [barcode]
    );

    if (localRows.length > 0) {
      const product = localRows[0];
      return res.json({
        success: true,
        found: true,
        source: 'local',
        message: `Product "${product.product_name}" found in catalog`,
        data: {
          ...product,
          current_stock: Number(product.current_stock || 0)
        }
      });
    }

    // 2. If not found locally and lookupExternal is allowed
    const includeExternal = req.query.includeExternal !== 'false';
    if (includeExternal && validation.isNumeric) {
      try {
        const offResult = await offService.getProductByBarcode(barcode);
        if (offResult && offResult.success && offResult.data) {
          return res.json({
            success: true,
            found: true,
            source: 'external',
            message: `Product "${offResult.data.product_name}" found in Open Food Facts catalog`,
            data: {
              ...offResult.data,
              external_match: true
            }
          });
        }
      } catch (extErr) {
        console.warn('External barcode lookup error:', extErr.message);
      }
    }

    // 3. Not found
    return res.status(404).json({
      success: false,
      found: false,
      source: 'none',
      message: 'Product not found. You can add this product manually.'
    });
  } catch (error) {
    console.error('Barcode lookup error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error during barcode lookup' });
  }
};

exports.confirmExternalProduct = async (req, res) => {
  try {
    const { product_name, brand, barcode, category, category_id, unit, unit_price, image_url, reorder_level } = req.body;

    if (!product_name || typeof product_name !== 'string' || !product_name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    const validation = validateBarcode(barcode);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error || 'Valid barcode is required' });
    }

    const normalizedBarcode = validation.barcode;

    // Check duplicate barcode
    const [existing] = await pool.query(
      'SELECT product_id, product_name FROM product WHERE barcode = ?',
      [normalizedBarcode]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Barcode "${normalizedBarcode}" is already assigned to "${existing[0].product_name}"`
      });
    }

    // Validate image URL if provided
    let cleanImageUrl = null;
    if (image_url && typeof image_url === 'string') {
      const trimmedUrl = image_url.trim();
      if (offService.isValidImageUrl(trimmedUrl)) {
        cleanImageUrl = trimmedUrl;
      }
    }

    // Resolve category
    let finalCategoryId = parseId(category_id);
    if (!finalCategoryId) {
      if (category && typeof category === 'string') {
        finalCategoryId = await findOrCreateCategory(category.trim());
      } else {
        const [cats] = await pool.query('SELECT category_id FROM category LIMIT 1');
        finalCategoryId = cats.length > 0 ? cats[0].category_id : 1;
      }
    }

    // Generate unique SKU
    const shortCode = normalizedBarcode.slice(-6);
    let sku = `BC-${shortCode}`;
    const [skuExists] = await pool.query('SELECT product_id FROM product WHERE sku = ?', [sku]);
    if (skuExists.length > 0) {
      sku = `BC-${shortCode}-${Date.now().toString().slice(-4)}`;
    }

    const cleanUnit = (unit && String(unit).trim()) || 'pcs';
    const cleanPrice = Number(unit_price) > 0 ? Number(unit_price) : 20.00;
    const cleanReorder = Number(reorder_level) >= 0 ? Number(reorder_level) : 10;
    const cleanBrand = brand ? String(brand).trim().slice(0, 255) : null;
    const cleanName = product_name.trim().slice(0, 150);

    const [insertResult] = await pool.query(
      `INSERT INTO product (product_name, brand, barcode, sku, category_id, unit, unit_price, image_url, reorder_level, is_active, external_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'OpenFoodFacts')`,
      [cleanName, cleanBrand, normalizedBarcode, sku, finalCategoryId, cleanUnit, cleanPrice, cleanImageUrl, cleanReorder]
    );

    const newProductId = insertResult.insertId;

    // Audit log
    const userId = req.user ? req.user.user_id : 1;
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) VALUES (?, 'INSERT', 'product', ?, ?)`,
      [userId, newProductId, `Added external product "${cleanName}" with barcode ${normalizedBarcode}`]
    );

    // Fetch newly created record
    const [rows] = await pool.query(
      `SELECT p.*, c.category_name, 0 as current_stock 
       FROM product p 
       LEFT JOIN category c ON p.category_id = c.category_id 
       WHERE p.product_id = ?`,
      [newProductId]
    );

    res.status(201).json({
      success: true,
      message: `Product "${cleanName}" added to catalog successfully`,
      data: rows[0]
    });
  } catch (error) {
    console.error('Confirm external product error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error while saving product' });
  }
};
