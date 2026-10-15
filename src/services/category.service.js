'use strict';

const categoryRepository = require('../repositories/category.repository');
const { slugify } = require('../utils/slug');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

const categoryService = {
  list({ withProductCount = false } = {}) {
    return withProductCount
      ? categoryRepository.listWithProductCount()
      : categoryRepository.list();
  },

  async getById(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found');
    }
    return category;
  },

  async create({ name, slug, description }) {
    const computedSlug = slug ? slugify(slug) : slugify(name);
    if (!computedSlug) {
      throw ApiError.badRequest('A valid slug could not be generated from the name');
    }

    const existing = await categoryRepository.findBySlug(computedSlug);
    if (existing) {
      throw ApiError.conflict('A category with this slug already exists', ERROR_CODES.DUPLICATE_RESOURCE);
    }

    return categoryRepository.create({ name: String(name).trim(), slug: computedSlug, description });
  },

  async update(id, payload) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found');
    }

    const fields = {};
    if (payload.name !== undefined) fields.name = String(payload.name).trim();
    if (payload.description !== undefined) fields.description = payload.description;
    if (payload.slug !== undefined) {
      const newSlug = slugify(payload.slug);
      if (!newSlug) {
        throw ApiError.badRequest('Invalid slug');
      }
      if (newSlug !== category.slug) {
        const existing = await categoryRepository.findBySlug(newSlug);
        if (existing && existing.id !== id) {
          throw ApiError.conflict('A category with this slug already exists', ERROR_CODES.DUPLICATE_RESOURCE);
        }
      }
      fields.slug = newSlug;
    }

    if (Object.keys(fields).length === 0) {
      return category;
    }

    return categoryRepository.update(id, fields);
  },

  /**
   * Categories cannot be deleted while products still reference them, which
   * would otherwise leave those products with an invalid category.
   */
  async remove(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found');
    }

    const productCount = await categoryRepository.countProducts(id);
    if (productCount > 0) {
      throw ApiError.conflict(
        `Cannot delete category: ${productCount} product(s) still reference it. Reassign or remove them first.`,
        ERROR_CODES.CATEGORY_IN_USE,
      );
    }

    await categoryRepository.remove(id);
    return true;
  },
};

module.exports = categoryService;
