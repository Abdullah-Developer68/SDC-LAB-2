/**
 * In-memory repository layer for managing Product persistence and retrieval.
 * Decouples state storage from domain business logic.
 */

class InventoryRepository {
  constructor() {
    this.catalog = new Map();
  }

  save(product) {
    if (!product || !product.id) {
      throw new Error('Valid product with unique id required for saving');
    }
    this.catalog.set(product.id, product);
    return product;
  }

  findById(productId) {
    const product = this.catalog.get(productId);
    if (!product) {
      throw new Error(`Item not found in catalog: "${productId}"`);
    }
    return product;
  }

  exists(productId) {
    return this.catalog.has(productId);
  }

  getAll() {
    return Array.from(this.catalog.values());
  }

  adjustStock(productId, delta) {
    const product = this.findById(productId);
    if (delta < 0) {
      product.deductStock(Math.abs(delta));
    } else {
      product.restock(delta);
    }
    return product;
  }
}

module.exports = InventoryRepository;
