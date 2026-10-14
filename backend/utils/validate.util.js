/**
 * Validation Utility
 * Reusable validation functions for request data.
 */

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const isPositiveInt = (value) => {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
};

const isNonNegativeInt = (value) => {
  const num = Number(value);
  return Number.isInteger(num) && num >= 0;
};

const isValidDate = (dateStr) => {
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d.getTime());
};

/**
 * Checks that all required fields are present and non-empty in the body.
 * Returns an array of missing field names (empty array = valid).
 */
const checkRequired = (body, fields) => {
  const missing = [];
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  return missing;
};

/**
 * Validates that req.params.id is a positive integer.
 * Returns the parsed integer or null if invalid.
 */
const parseId = (idStr) => {
  const id = parseInt(idStr, 10);
  return isPositiveInt(id) ? id : null;
};

module.exports = {
  isValidEmail,
  isPositiveInt,
  isNonNegativeInt,
  isValidDate,
  checkRequired,
  parseId,
};
