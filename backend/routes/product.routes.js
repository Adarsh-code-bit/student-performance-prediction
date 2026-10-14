const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { verifyToken, isAdmin, isManagerOrAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken);

// External API Integration Routes (Admin only)
router.get('/external/search', isAdmin, productController.searchExternal);
router.get('/external/barcode/:barcode', isAdmin, productController.getExternalByBarcode);
router.post('/import', isAdmin, productController.importProduct);
router.post('/import/bulk', isAdmin, productController.bulkImportProducts);
router.post('/:id/generate-inventory', isManagerOrAdmin, productController.generateDemoInventory);

// Standard CRUD Routes
router.get('/', productController.getAll);
router.get('/:id', productController.getOne);
router.post('/', isAdmin, productController.create);
router.put('/:id', isAdmin, productController.update);
router.delete('/:id', isAdmin, productController.delete);

module.exports = router;
