'use strict';

const categoryService = require('../services/category.service');
const asyncHandler = require('../middlewares/asyncHandler');
const { success, created, noContent } = require('../utils/response');

const categoryController = {
  list: asyncHandler(async (req, res) => {
    const categories = await categoryService.list({ withProductCount: true });
    return success(res, categories);
  }),

  getById: asyncHandler(async (req, res) => {
    const category = await categoryService.getById(req.params.id);
    return success(res, category);
  }),

  create: asyncHandler(async (req, res) => {
    const category = await categoryService.create({
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description,
    });
    return created(res, category);
  }),

  update: asyncHandler(async (req, res) => {
    const category = await categoryService.update(req.params.id, req.body);
    return success(res, category);
  }),

  remove: asyncHandler(async (req, res) => {
    await categoryService.remove(req.params.id);
    return noContent(res);
  }),
};

module.exports = categoryController;
