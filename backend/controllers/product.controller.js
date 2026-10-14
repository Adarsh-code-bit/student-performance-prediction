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
    const { category_id, product_name, sku, unit, unit_price, description, reorder_level } = req.body;
    
    if (!category_id || !product_name || !sku || !unit || !unit_price) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const sql = `
      INSERT INTO product (category_id, product_name, sku, unit, unit_price, description, reorder_level) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [
      category_id, 
      product_name, 
      sku, 
      unit, 
      unit_price, 
      description || null, 
      reorder_level || 10
    ]);

    // Audit Log
    const userId = req.user ? req.user.user_id : 1;
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) VALUES (?, 'INSERT', 'product', ?, ?)`,
      [userId, result.insertId, `Created product: ${product_name} (SKU: ${sku})`]
    );

    res.status(201).json({ 
      success: true, 
      data: { insertId: result.insertId }, 
      message: 'Product created successfully' 
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const { category_id, product_name, sku, unit, unit_price, description, reorder_level, is_active } = req.body;

    const sql = `
      UPDATE product 
      SET category_id = COALESCE(?, category_id),
          product_name = COALESCE(?, product_name),
          sku = COALESCE(?, sku),
          unit = COALESCE(?, unit),
          unit_price = COALESCE(?, unit_price),
          description = COALESCE(?, description),
          reorder_level = COALESCE(?, reorder_level),
          is_active = COALESCE(?, is_active)
      WHERE product_id = ?
    `;
    const [result] = await pool.query(sql, [
      category_id, 
      product_name, 
      sku, 
      unit, 
      unit_price, 
      description, 
      reorder_level, 
      is_active, 
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
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
  if (!barcode) return res.status(400).json({ success: false, message: 'Missing barcode' });
  
  const result = await offService.getProductByBarcode(barcode);
  if (!result.success) return res.status(404).json(result);
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
