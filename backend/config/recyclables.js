/**
 * Recyclable Categories, Types, and Price Ranges
 * Organized by category with specific types and per-kilogram pricing
 */

const RECYCLABLE_CATEGORIES = {
  plastics: {
    name: 'Plastics',
    types: {
      plastic_bottles: {
        name: 'Plastic Bottles',
        priceMin: 5,
        priceMax: 10,
      },
      hard_plastics: {
        name: 'Hard Plastics',
        priceMin: 4,
        priceMax: 9,
      },
      plastic_containers: {
        name: 'Plastic Containers',
        priceMin: 3,
        priceMax: 8,
      },
    },
  },
  metals: {
    name: 'Metals',
    types: {
      scrap_iron: {
        name: 'Scrap Iron',
        priceMin: 10,
        priceMax: 18,
      },
      aluminum: {
        name: 'Aluminum',
        priceMin: 40,
        priceMax: 70,
      },
      copper: {
        name: 'Copper',
        priceMin: 150,
        priceMax: 300,
      },
      mixed_metals: {
        name: 'Mixed Metals',
        priceMin: 15,
        priceMax: 30,
      },
    },
  },
  paper: {
    name: 'Paper',
    types: {
      carton: {
        name: 'Carton',
        priceMin: 3,
        priceMax: 8,
      },
      newspaper: {
        name: 'Newspaper',
        priceMin: 2,
        priceMax: 5,
      },
      bond_paper: {
        name: 'Bond Paper',
        priceMin: 4,
        priceMax: 10,
      },
    },
  },
  electronics: {
    name: 'Electronics',
    types: {
      wires: {
        name: 'Wires',
        priceMin: 50,
        priceMax: 100,
      },
      small_appliances: {
        name: 'Small Appliances',
        priceMin: 100,
        priceMax: 300,
      },
    },
  },
};

/**
 * Non-acceptable recyclable materials
 */
const NON_ACCEPTABLE_ITEMS = [
  'Hazardous Chemicals',
  'Medical Waste',
  'Explosives',
  'Leaking Batteries',
  'Flammable Materials',
  'Contaminated Waste',
  'Radioactive Materials',
  'Asbestos',
  'Paint Cans',
  'Oil or Grease',
  'Any Glass'
];

/**
 * Gamification points calculation
 * Returns points based on kilograms recycled with tiered bonuses
 * Base: 5 kg = 1 point
 * Tier 1 (50+ kg): 10% bonus = 5.5 points per 50kg
 * Tier 2 (100+ kg): 20% bonus = 11 points per 100kg
 * Tier 3 (200+ kg): 30% bonus = 22.5 points per 200kg
 */
function calculatePointsFromKilograms(weightInKg) {
  if (!weightInKg || weightInKg <= 0) return 0;
  
  const basePoints = weightInKg / 5; // 5 kg = 1 point (base)
  
  // Apply tiered multipliers
  if (weightInKg >= 200) return Math.floor(basePoints * 1.3); // 30% bonus
  if (weightInKg >= 100) return Math.floor(basePoints * 1.2); // 20% bonus
  if (weightInKg >= 50) return Math.floor(basePoints * 1.1); // 10% bonus
  
  return Math.floor(basePoints);
}

/**
 * Get category object by key
 */
function getCategoryByKey(categoryKey) {
  return RECYCLABLE_CATEGORIES[categoryKey] || null;
}

/**
 * Get type object by category key and type key
 */
function getTypeByKeys(categoryKey, typeKey) {
  const category = RECYCLABLE_CATEGORIES[categoryKey];
  if (!category) return null;
  return category.types[typeKey] || null;
}

/**
 * Calculate estimated earnings for a recyclable submission
 */
function calculateEstimatedEarnings(categoryKey, typeKey, weightInKg) {
  const type = getTypeByKeys(categoryKey, typeKey);
  if (!type || !weightInKg || weightInKg <= 0) {
    return { min: 0, max: 0 };
  }

  const min = type.priceMin * weightInKg;
  const max = type.priceMax * weightInKg;

  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
  };
}

/**
 * Get all categories for frontend display
 */
function getAllCategories() {
  return Object.entries(RECYCLABLE_CATEGORIES).map(([key, category]) => ({
    key,
    name: category.name,
    types: Object.entries(category.types).map(([typeKey, type]) => ({
      key: typeKey,
      name: type.name,
      priceMin: type.priceMin,
      priceMax: type.priceMax,
    })),
  }));
}

module.exports = {
  RECYCLABLE_CATEGORIES,
  NON_ACCEPTABLE_ITEMS,
  calculatePointsFromKilograms,
  getCategoryByKey,
  getTypeByKeys,
  calculateEstimatedEarnings,
  getAllCategories,
};
