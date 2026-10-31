const axios = require('axios');

const BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const USER_AGENT = 'QUICKSTOCK-SmartInventory/1.0 (Quick Commerce Warehouse Management; admin@example.com)';
const API_TIMEOUT_MS = 7000; // 7 seconds timeout

// In-memory barcode cache with TTL to avoid redundant external API calls
const barcodeCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Validates and normalizes barcode input.
 * Accepts standard 4 to 18 digit numeric barcodes (EAN-8, EAN-13, UPC-A, UPC-E, ITF-14, Code 128).
 * Prevents path traversal, URL injection, and invalid characters.
 */
function validateAndNormalizeBarcode(rawBarcode) {
  if (!rawBarcode || typeof rawBarcode !== 'string') {
    return { valid: false, error: 'Barcode must be provided as a non-empty string.' };
  }

  const normalized = rawBarcode.trim();

  // Must consist of 4 to 18 numeric digits
  if (!/^\d{4,18}$/.test(normalized)) {
    return {
      valid: false,
      error: 'Invalid barcode format. Barcodes must contain between 4 and 18 numeric digits without special characters.'
    };
  }

  return { valid: true, barcode: normalized };
}

/**
 * Validates an image URL for safety.
 * Only allows HTTP / HTTPS schemes from public addresses, preventing SSRF attacks.
 */
function isValidImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    // Block local loopback, private ranges, link-local, and cloud metadata IPs
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '169.254.169.254' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Category mapping to group external Open Food Facts tags into QUICKSTOCK categories
const categoryMap = {
  'milks': 'Dairy & Frozen',
  'dairy': 'Dairy & Frozen',
  'cheeses': 'Dairy & Frozen',
  'yogurts': 'Dairy & Frozen',
  'breads': 'Bakery',
  'biscuits': 'Snacks',
  'cookies': 'Snacks',
  'pastries': 'Bakery',
  'snacks': 'Snacks',
  'chips': 'Snacks',
  'salty-snacks': 'Snacks',
  'sweet-snacks': 'Snacks',
  'beverages': 'Beverages',
  'waters': 'Beverages',
  'sodas': 'Beverages',
  'juices': 'Beverages',
  'instant-foods': 'Instant Food',
  'canned-foods': 'Instant Food',
  'cereals': 'Instant Food',
  'meats': 'Fresh Produce',
  'produce': 'Fresh Produce',
  'fruits': 'Fresh Produce',
  'vegetables': 'Fresh Produce',
  'personal-care': 'Personal Care',
  'soaps': 'Personal Care',
  'shampoos': 'Personal Care',
  'home-care': 'Household Essentials',
  'cleaning': 'Household Essentials',
  'detergents': 'Household Essentials',
  'baby-care': 'Baby Care',
  'diapers': 'Baby Care',
  'health': 'Health & Wellness',
  'supplements': 'Health & Wellness'
};

function normalizeCategory(offCategoryString) {
  if (!offCategoryString) return 'Instant Food';
  const categories = offCategoryString.toLowerCase().split(',');
  for (const cat of categories) {
    const cleanCat = cat.trim().replace(/^[a-z]{2}:/, '');
    for (const [key, value] of Object.entries(categoryMap)) {
      if (cleanCat.includes(key)) {
        return value;
      }
    }
  }
  return 'Instant Food';
}

/**
 * Normalizes Open Food Facts product structure.
 * Extracts best available front image URL and fallback representations.
 */
function normalizeProductData(product) {
  if (!product || (!product.product_name && !product.product_name_en)) {
    return null;
  }

  const name = (product.product_name || product.product_name_en || '').trim();
  const brands = product.brands ? product.brands.split(',')[0].trim() : (product.brand_owner || null);

  // Extract highest quality front display image
  let bestImageUrl = product.image_front_url || product.image_url || null;

  if (!bestImageUrl && product.selected_images?.front?.display) {
    const displayObj = product.selected_images.front.display;
    const langKey = Object.keys(displayObj)[0];
    if (langKey && displayObj[langKey]) {
      bestImageUrl = displayObj[langKey];
    }
  }

  if (!bestImageUrl && product.image_front_small_url) {
    bestImageUrl = product.image_front_small_url;
  }

  return {
    barcode: product.code || null,
    product_name: name,
    brand: brands || 'Unknown Brand',
    category: normalizeCategory(product.categories),
    unit: product.quantity || '1 pack',
    image_url: bestImageUrl || null,
    has_image: Boolean(bestImageUrl)
  };
}

/**
 * Retrieves product details and image from Open Food Facts API by barcode.
 * Handles rate limits, timeouts, missing products, and caching.
 */
exports.getProductByBarcode = async (rawBarcode) => {
  // 1. Validate & normalize barcode
  const validation = validateAndNormalizeBarcode(rawBarcode);
  if (!validation.valid) {
    return {
      success: false,
      status: 400,
      message: validation.error
    };
  }

  const barcode = validation.barcode;

  // 2. Check in-memory cache to avoid repeated API requests
  const cached = barcodeCache.get(barcode);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return {
      success: true,
      data: cached.data,
      from_cache: true
    };
  }

  // 3. Make external API request to Open Food Facts v2 endpoint
  try {
    const url = `${BASE_URL}/product/${encodeURIComponent(barcode)}.json`;
    const response = await axios.get(url, {
      params: {
        fields: 'code,product_name,product_name_en,brands,brand_owner,categories,quantity,image_url,image_front_url,image_front_small_url,selected_images'
      },
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: API_TIMEOUT_MS
    });

    if (response.data.status !== 1 || !response.data.product) {
      return {
        success: false,
        status: 404,
        message: `Product not found in Open Food Facts database for barcode: ${barcode}`
      };
    }

    const normalized = normalizeProductData(response.data.product);
    if (!normalized) {
      return {
        success: false,
        status: 422,
        message: `Product found for barcode ${barcode}, but missing valid product name in catalog.`
      };
    }

    // Cache the result
    if (barcodeCache.size > 500) {
      const oldestKey = barcodeCache.keys().next().value;
      barcodeCache.delete(oldestKey);
    }
    barcodeCache.set(barcode, {
      timestamp: Date.now(),
      data: normalized
    });

    return {
      success: true,
      data: normalized,
      message: normalized.has_image
        ? 'Product details and image retrieved successfully from Open Food Facts.'
        : 'Product details retrieved from Open Food Facts, but no product image is available.'
    };
  } catch (error) {
    if (error.response) {
      const statusCode = error.response.status;
      if (statusCode === 404) {
        return {
          success: false,
          status: 404,
          message: `Product not found in Open Food Facts database for barcode: ${barcode}`
        };
      }
      if (statusCode === 429) {
        return {
          success: false,
          status: 429,
          message: 'Open Food Facts rate limit reached. Please wait a moment before trying again.'
        };
      }
      return {
        success: false,
        status: statusCode,
        message: `Open Food Facts service returned HTTP ${statusCode}: ${error.response.statusText || 'Error'}`
      };
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        success: false,
        status: 504,
        message: 'Open Food Facts request timed out. Please try again or enter image URL manually.'
      };
    }

    return {
      success: false,
      status: 502,
      message: `Unable to connect to Open Food Facts service: ${error.message}`
    };
  }
};

/**
 * Searches products in Open Food Facts by search term.
 */
exports.searchProducts = async (query, limit = 20) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { success: false, status: 400, message: 'Valid search query is required.' };
  }

  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        search_terms: query.trim(),
        fields: 'code,product_name,product_name_en,brands,categories,quantity,image_url,image_front_url',
        page_size: Math.min(limit, 50),
        json: 1
      },
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: API_TIMEOUT_MS
    });

    const products = response.data.products || [];
    const normalized = products
      .map(normalizeProductData)
      .filter(p => p !== null);

    return { success: true, data: normalized };
  } catch (error) {
    return {
      success: false,
      status: 502,
      message: `Failed to search Open Food Facts: ${error.message}`
    };
  }
};

// Expose validation helpers for controllers
exports.validateAndNormalizeBarcode = validateAndNormalizeBarcode;
exports.isValidImageUrl = isValidImageUrl;
exports.clearCache = () => barcodeCache.clear();
