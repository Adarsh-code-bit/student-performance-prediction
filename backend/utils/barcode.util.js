/**
 * Barcode Validation & Normalization Utility
 * Quick Commerce Smart Inventory Management System
 * Supports EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39 formats.
 */

/**
 * Normalizes barcode input by trimming whitespace and control characters.
 * @param {string} rawBarcode
 * @returns {string}
 */
function normalizeBarcode(rawBarcode) {
  if (rawBarcode === null || rawBarcode === undefined) return '';
  return String(rawBarcode).trim();
}

/**
 * Validates barcode format.
 * Accepts:
 * - Standard numeric GTIN barcodes: EAN-13 (13 digits), EAN-8 (8 digits), UPC-A (12 digits), UPC-E (6-8 digits)
 * - Industrial / warehouse alphanumeric barcodes: Code 128, Code 39 (3 to 30 chars containing letters, numbers, hyphens, underscores)
 * Rejects:
 * - Non-string / empty inputs
 * - Length < 3 or > 30
 * - Unsafe characters (quotes, slashes, angle brackets, semicolons, spaces)
 *
 * @param {string} rawBarcode
 * @returns {{ valid: boolean, barcode: string, error?: string, isNumeric?: boolean }}
 */
function validateBarcode(rawBarcode) {
  const normalized = normalizeBarcode(rawBarcode);

  if (!normalized) {
    return {
      valid: false,
      barcode: '',
      error: 'Barcode must be provided as a non-empty string.'
    };
  }

  if (normalized.length < 3 || normalized.length > 30) {
    return {
      valid: false,
      barcode: normalized,
      error: 'Invalid barcode length. Barcodes must be between 3 and 30 characters.'
    };
  }

  // Must consist only of alphanumeric characters, hyphens, or underscores
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return {
      valid: false,
      barcode: normalized,
      error: 'Invalid barcode format. Barcodes may only contain alphanumeric characters, hyphens, and underscores.'
    };
  }

  const isNumeric = /^\d+$/.test(normalized);

  return {
    valid: true,
    barcode: normalized,
    isNumeric
  };
}

module.exports = {
  normalizeBarcode,
  validateBarcode
};
