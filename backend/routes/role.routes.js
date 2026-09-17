const express = require('express');
const roleController = require('../controllers/role.controller');
const { roleRules } = require('../validators/role.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();

router.use(authenticate);

router.get('/permissions', permit('roles.manage'), roleController.permissionsCatalog);
router.get('/', permit('roles.manage'), roleController.list);
router.get('/:id', permit('roles.manage'), roleController.getById);
router.post('/', permit('roles.manage'), roleRules, validate, roleController.create);
router.put('/:id', permit('roles.manage'), roleController.update);
router.delete('/:id', permit('roles.manage'), roleController.remove);

module.exports = router;
