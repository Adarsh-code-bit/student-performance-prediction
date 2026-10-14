const axios = require('axios');

const BASE_URL = 'https://world.openfoodfacts.org/api/v2';

/**
 * Open Food Facts Service
 * Handles fetching and normalizing external product data.
 */

// Basic category mapping to group messy external categories into our defined Q-commerce categories
const categoryMap = {
  'milks': 'Dairy & Breakfast',
  'dairy': 'Dairy & Breakfast',
  'cheeses': 'Dairy & Breakfast',
  'yogurts': 'Dairy & Breakfast',
  'breads': 'Bakery',
  'biscuits': 'Bakery',
  'pastries': 'Bakery',
  'snacks': 'Snacks',
  'salty-snacks': 'Snacks',
  'sweet-snacks': 'Snacks',
  'beverages': 'Beverages',
  'waters': 'Beverages',
  'sodas': 'Beverages',
  'instant-foods': 'Instant & Packaged Food',
  'canned-foods': 'Instant & Packaged Food',
  'cereals': 'Instant & Packaged Food',
  'meats': 'Instant & Packaged Food',
  'personal-care': 'Personal Care',
  'home-care': 'Home Care',
  'cleaning': 'Home Care',
  'baby-care': 'Baby Care',
  'pet-food': 'Pet Care',
};

function normalizeCategory(offCategoryString) {
  if (!offCategoryString) return 'Other';
  const categories = offCategoryString.toLowerCase().split(',');
  for (const cat of categories) {
    const cleanCat = cat.trim().replace(/^en:/, '');
    for (const [key, value] of Object.entries(categoryMap)) {
      if (cleanCat.includes(key)) {
        return value;
      }
    }
  }
  return 'Other'; // Fallback
}

function normalizeProductData(product) {
  if (!product.product_name) return null; // Reject meaningless products

  return {
    barcode: product.code || null,
    product_name: product.product_name,
    brand: product.brands ? product.brands.split(',')[0].trim() : 'Unknown Brand',
    category: normalizeCategory(product.categories),
    unit: product.quantity || '1 unit',
    image_url: product.image_url || null
  };
}

exports.searchProducts = async (query, limit = 50) => {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        search_terms: query,
        fields: 'code,product_name,brands,categories,quantity,image_url',
        page_size: limit,
        json: 1
      },
      timeout: 10000 // 10 sec timeout
    });

    const products = response.data.products || [];
    
    // Normalize and filter out invalid ones
    const normalized = products
      .map(normalizeProductData)
      .filter(p => p !== null);

    return { success: true, data: normalized };
  } catch (error) {
    console.error('OpenFoodFacts Search Error:', error.message);
    return { success: false, message: 'External API Error' };
  }
};

exports.getProductByBarcode = async (barcode) => {
  try {
    const response = await axios.get(`${BASE_URL}/product/${barcode}?fields=code,product_name,brands,categories,quantity,image_url`, {
      timeout: 10000
    });

    if (response.data.status !== 1) {
      return { success: false, message: 'Product not found' };
    }

    const product = normalizeProductData(response.data.product);
    if (!product) return { success: false, message: 'Invalid product data from API' };

    return { success: true, data: product };
  } catch (error) {
    console.error('OpenFoodFacts Barcode Error:', error.message);
    return { success: false, message: 'External API Error' };
  }
};
