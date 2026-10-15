'use strict';

const express = require('express');
const healthController = require('../controllers/health.controller');

const router = express.Router();

router.get('/', healthController.live);
router.get('/ready', healthController.ready);

module.exports = router;
