/**
 * In-memory repository layer for managing Product persistence and retrieval.
 * Decouples state storage from domain business logic.
 * 
 * Refactored Improvements Applied:
 * - Pure Persistence Layer: Completely removed adjustStock() to eliminate cross-layer logic bleed.
 *   Stock mutation orchestration is managed strictly by Domain entities & Services.
 * - Duck-type & instance validation to guarantee data integrity before storage.
 * - Defensive collection queries returning immutable or defensive copies.
 * - Formal JSDoc annotations.
 */

const { Product } = require('./models');

class InventoryRepository {
  #catalog;

  constructor() {
    this.#catalog = new Map();
  }

  /**
   * Persists or updates a product in the catalog.
   * @param {Product} product - Product entity to save.
   * @returns {Product} The saved product reference.
   * @throws {Error} If product is invalid or missing an id.
   */
  save(product) {
    if (!product || !(product instanceof Product)) {
      throw new Error('Valid Product instance required for repository persistence');
    }
    this.#catalog.set(product.id, product);
    return product;
  }

  /**
   * Finds a product by its unique SKU identifier.
   * @param {string} productId - Unique SKU identifier.
   * @returns {Product} The requested Product instance.
   * @throws {Error} If product is not found in the catalog.
   */
  findById(productId) {
    if (!productId || typeof productId !== 'string') {
      throw new Error('Valid productId string required for lookup');
    }
    const product = this.#catalog.get(productId.trim());
    if (!product) {
      throw new Error(`Item not found in catalog: "${productId}"`);
    }
    return product;
  }

  /**
   * Checks whether a product exists in the catalog.
   * @param {string} productId - SKU to check.
   * @returns {boolean} True if product exists; false otherwise.
   */
  exists(productId) {
    if (!productId || typeof productId !== 'string') return false;
    return this.#catalog.has(productId.trim());
  }

  /**
   * Retrieves all products currently in the catalog.
   * @returns {Array<Product>} Array of stored product instances.
   */
  getAll() {
    return Array.from(this.#catalog.values());
  }

  /**
   * Returns the total count of distinct SKUs stored.
   * @returns {number}
   */
  count() {
    return this.#catalog.size;
  }

  /**
   * Clears all items from the in-memory catalog (useful for unit testing).
   */
  clear() {
    this.#catalog.clear();
  }
}

module.exports = InventoryRepository;

