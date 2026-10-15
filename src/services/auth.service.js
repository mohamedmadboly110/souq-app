'use strict';

const userRepository = require('../repositories/user.repository');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

// Roles a member of the public is allowed to self-register with.
const PUBLIC_ROLES = ['customer', 'seller'];

/**
 * Never expose password_hash. Build the public representation of a user.
 */
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

const authService = {
  async register({ name, email, password, role }) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const requestedRole = (role || 'customer').toLowerCase();

    if (!PUBLIC_ROLES.includes(requestedRole)) {
      // Public registration can never create an administrator.
      throw ApiError.badRequest(
        `Role must be one of: ${PUBLIC_ROLES.join(', ')}`,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const exists = await userRepository.emailExists(normalizedEmail);
    if (exists) {
      throw ApiError.conflict('An account with this email already exists', ERROR_CODES.DUPLICATE_RESOURCE);
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: requestedRole,
    });

    return { user: toPublicUser(user), token: signToken(user) };
  },

  async login({ email, password }) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await userRepository.findByEmailWithPassword(normalizedEmail);

    // Use the same error for unknown email and wrong password.
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS);
    }

    const matches = await comparePassword(password, user.password_hash);
    if (!matches) {
      throw ApiError.unauthorized('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS);
    }

    return { user: toPublicUser(user), token: signToken(user) };
  },

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return toPublicUser(user);
  },
};

module.exports = { authService, toPublicUser };
