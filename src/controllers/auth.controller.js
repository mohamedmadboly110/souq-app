'use strict';

const { authService } = require('../services/auth.service');
const asyncHandler = require('../middlewares/asyncHandler');
const { success, created } = require('../utils/response');

const authController = {
  register: asyncHandler(async (req, res) => {
    const result = await authService.register({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
    });
    return created(res, result);
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
    });
    return success(res, result);
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.user.id);
    return success(res, { user });
  }),
};

module.exports = authController;
