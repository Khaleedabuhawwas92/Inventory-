const express = require('express');
const categoryController = require('../controllers/category.controller');
const { categoryRules } = require('../validators/category.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();
router.use(authenticate);

router.get('/', permit('categories.view'), categoryController.list);
router.get('/:id', permit('categories.view'), categoryController.getById);
router.post('/', permit('categories.create'), categoryRules, validate, categoryController.create);
router.put('/:id', permit('categories.edit'), categoryController.update);
router.delete('/:id', permit('categories.delete'), categoryController.remove);

module.exports = router;
