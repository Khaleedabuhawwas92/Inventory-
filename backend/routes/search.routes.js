const express = require('express');
const searchController = require('../controllers/search.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.get('/', authenticate, searchController.globalSearch);

module.exports = router;
