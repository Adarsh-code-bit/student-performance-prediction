/**
 * Response Helper Utility
 * Standardized API response format:
 *   { success: true/false, message: "...", data: ... }
 */

const success = (res, data = null, message = 'Success', statusCode = 200) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

const created = (res, data = null, message = 'Created successfully') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'Internal server error', statusCode = 500) => {
  return res.status(statusCode).json({ success: false, message });
};

const notFound = (res, resource = 'Resource') => {
  return error(res, `${resource} not found`, 404);
};

const badRequest = (res, message = 'Bad request') => {
  return error(res, message, 400);
};

const validationError = (res, missing) => {
  return error(res, `Missing required fields: ${missing.join(', ')}`, 400);
};

module.exports = { success, created, error, notFound, badRequest, validationError };
