'use strict';

/**
 * Convert arbitrary text into a URL friendly slug.
 * Example: "Home & Kitchen" -> "home-kitchen"
 */
function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

module.exports = { slugify };
