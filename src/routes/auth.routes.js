'use strict';

const express = require('express');
const authController = require('../controllers/auth.controller');
const { registerRules, loginRules } = require('../validators/auth.validator');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginRules, validate, authController.login);
router.get('/me', protect, authController.me);

module.exports = router;
