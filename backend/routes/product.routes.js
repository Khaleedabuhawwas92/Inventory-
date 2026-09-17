const express = require('express');
const productController = require('../controllers/product.controller');
const { productRules } = require('../validators/product.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');
const { makeUploader } = require('../middleware/upload');

const router = express.Router();
const uploadProductImage = makeUploader('products');

router.use(authenticate);

router.get('/', permit('products.view'), productController.list);
router.get('/barcode/:barcode', permit('products.view'), productController.findByBarcode);
router.get('/:id', permit('products.view'), productController.getById);
router.get('/:id/stock', permit('products.view'), productController.stockByWarehouse);
router.get('/:id/movements', permit('stock.view'), productController.movementHistory);
router.post('/', permit('products.create'), productRules, validate, productController.create);
router.put('/:id', permit('products.edit'), productController.update);
router.post('/:id/image', permit('products.edit'), uploadProductImage.single('image'), productController.uploadImage);

module.exports = router;
