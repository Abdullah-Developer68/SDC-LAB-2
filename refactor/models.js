/**
 * Domain Models for Product and Order entities.
 * Enforces business invariants and data integrity at the domain level.
 * 
 * Refactored Improvements Applied:
 * - True Encapsulation: Enforces private class fields (#id, #name, #price, #stock) to prevent external state mutation.
 * - Public Accessor Properties (getters) for read-only access.
 * - Rich Domain Model: Order class encapsulates state transitions (applyFinancials, markCompleted, markCancelled)
 *   rather than allowing external code to directly mutate its internal totals and status.
 * - Formal JSDoc annotations specifying parameter types, return contracts, and invariant guarantees.
 */

/**
 * Frozen immutable enumeration of allowed order lifecycle states.
 * @readonly
 * @enum {string}
 */
const OrderStatus = Object.freeze({
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

/**
 * Domain Entity representing an inventory item.
 * Encapsulates internal stock and pricing state via ES2022 private fields.
 */
class Product {
  #id;
  #name;
  #price;
  #stock;

  /**
   * Constructs a new Product entity with defensive invariant checks.
   * @param {string} id - Unique product SKU identifier.
   * @param {string} name - Descriptive product name.
   * @param {number} price - Unit price (must be a non-negative number).
   * @param {number} stock - Available stock quantity (must be a non-negative integer).
   * @throws {Error} If any parameter fails invariant validation.
   */
  constructor(id, name, price, stock) {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Product id must be a non-empty string');
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Product name must be a non-empty string');
    }
    if (typeof price !== 'number' || Number.isNaN(price) || price < 0) {
      throw new Error('Product price must be a non-negative number');
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('Stock must be a non-negative integer');
    }

    this.#id = id.trim();
    this.#name = name.trim();
    this.#price = Number(price.toFixed(2));
    this.#stock = stock;
  }

  /** @returns {string} Unique SKU identifier. */
  get id() {
    return this.#id;
  }

  /** @returns {string} Product name. */
  get name() {
    return this.#name;
  }

  /** @returns {number} Current unit price. */
  get price() {
    return this.#price;
  }

  /** @returns {number} Current available stock. */
  get stock() {
    return this.#stock;
  }

  /**
   * Checks whether the product has at least the specified stock quantity.
   * @param {number} quantity - Quantity to check against inventory.
   * @returns {boolean} True if sufficient stock is available; false otherwise.
   */
  hasSufficientStock(quantity) {
    return Number.isInteger(quantity) && quantity > 0 && this.#stock >= quantity;
  }

  /**
   * Safely deducts a specified quantity from stock.
   * @param {number} quantity - Positive integer amount to deduct.
   * @throws {Error} If quantity is invalid or exceeds available stock.
   */
  deductStock(quantity) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid stock deduction amount: ${quantity}`);
    }
    if (!this.hasSufficientStock(quantity)) {
      throw new Error(`Insufficient stock for "${this.#name}". Requested: ${quantity}, Available: ${this.#stock}`);
    }
    this.#stock -= quantity;
  }

  /**
   * Replenishes stock by a positive integer amount.
   * @param {number} quantity - Positive integer amount to add.
   * @throws {Error} If quantity is not a positive integer.
   */
  restock(quantity) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Restock quantity must be a positive integer');
    }
    this.#stock += quantity;
  }

  /**
   * Returns a clean JSON representation of the product.
   * @returns {{ id: string, name: string, price: number, stock: number }}
   */
  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      price: this.#price,
      stock: this.#stock
    };
  }
}

/**
 * Domain Entity representing a customer order.
 * Encapsulates order metadata and financial summary states.
 */
class Order {
  #id;
  #customerId;
  #items;
  #subtotal;
  #discount;
  #tax;
  #total;
  #status;
  #createdAt;

  /**
   * Constructs a new Order entity.
   * @param {string} id - Unique order identifier.
   * @param {string} customerId - Unique customer identifier.
   * @param {Array<object>} items - Resolved line items in the order.
   */
  constructor(id, customerId, items = []) {
    if (!id || typeof id !== 'string') {
      throw new Error('Order id must be a valid non-empty string');
    }
    if (!customerId || typeof customerId !== 'string') {
      throw new Error('customerId must be a valid non-empty string');
    }

    this.#id = id.trim();
    this.#customerId = customerId.trim();
    this.#items = Array.isArray(items) ? Object.freeze([...items]) : Object.freeze([]);
    this.#subtotal = 0;
    this.#discount = 0;
    this.#tax = 0;
    this.#total = 0;
    this.#status = OrderStatus.PENDING;
    this.#createdAt = new Date();
  }

  get id() { return this.#id; }
  get customerId() { return this.#customerId; }
  get items() { return this.#items; }
  get subtotal() { return this.#subtotal; }
  get discount() { return this.#discount; }
  get tax() { return this.#tax; }
  get total() { return this.#total; }
  get status() { return this.#status; }
  get createdAt() { return this.#createdAt; }

  /**
   * Encapsulates applying financial calculation results to the order.
   * @param {{ subtotal: number, discount: number, tax: number, total: number }} financials
   */
  applyFinancials({ subtotal, discount, tax, total }) {
    if (this.#status !== OrderStatus.PENDING) {
      throw new Error(`Cannot modify financials on an order in status: ${this.#status}`);
    }
    this.#subtotal = subtotal;
    this.#discount = discount;
    this.#tax = tax;
    this.#total = total;
  }

  /**
   * Transitions the order status to COMPLETED.
   */
  markCompleted() {
    if (this.#status !== OrderStatus.PENDING) {
      throw new Error(`Cannot complete order from status: ${this.#status}`);
    }
    this.#status = OrderStatus.COMPLETED;
  }

  /**
   * Transitions the order status to CANCELLED.
   */
  markCancelled() {
    this.#status = OrderStatus.CANCELLED;
  }

  toJSON() {
    return {
      id: this.#id,
      customerId: this.#customerId,
      items: this.#items,
      subtotal: this.#subtotal,
      discount: this.#discount,
      tax: this.#tax,
      total: this.#total,
      status: this.#status,
      createdAt: this.#createdAt
    };
  }
}

module.exports = { Product, Order, OrderStatus };
