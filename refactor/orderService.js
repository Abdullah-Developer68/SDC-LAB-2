/**
 * Service orchestrating order lifecycle, pricing rules, and inventory verification.
 * Adheres to Single Responsibility, Dependency Inversion, and Transaction Atomicity.
 * 
 * Refactored Improvements Applied:
 * - Critical Atomicity Bug Fix: Implements aggregateLineItems() to consolidate duplicate line items
 *   for the same SKU before pre-flight checks, preventing partial deductions and mid-transaction failures.
 * - Eliminated Magic Numbers: Extracted DEFAULT_TAX_RATE, DEFAULT_DISCOUNT_THRESHOLD, and
 *   DEFAULT_DISCOUNT_PERCENTAGE into named configurable constants.
 * - Decoupled Stock Mutation: Directly invokes Product domain methods (deductStock) rather than
 *   depending on non-standard repository mutation methods.
 * - Injected Contract Validation: Verifies that the supplied repository implements required interfaces.
 * - Comprehensive JSDoc annotations.
 */

const { Order } = require('./models');

const DEFAULT_TAX_RATE = 0.08;              // 8% Sales Tax
const DEFAULT_DISCOUNT_THRESHOLD = 100.0;   // Orders >= $100 trigger volume discount
const DEFAULT_DISCOUNT_PERCENTAGE = 0.10;  // 10% Volume Discount

class OrderService {
  #repo;
  #taxRate;
  #discountThreshold;
  #discountPercentage;

  /**
   * Constructs an OrderService instance with configurable business rules.
   * @param {object} inventoryRepository - Data access repository implementing findById.
   * @param {number} [taxRate=0.08] - Configurable sales tax rate (e.g. 0.08 for 8%).
   * @param {number} [discountThreshold=100.0] - Subtotal threshold required for volume discount.
   * @param {number} [discountPercentage=0.10] - Volume discount percentage (e.g. 0.10 for 10%).
   */
  constructor(
    inventoryRepository,
    taxRate = DEFAULT_TAX_RATE,
    discountThreshold = DEFAULT_DISCOUNT_THRESHOLD,
    discountPercentage = DEFAULT_DISCOUNT_PERCENTAGE
  ) {
    if (!inventoryRepository || typeof inventoryRepository.findById !== 'function') {
      throw new Error('OrderService requires a repository implementing findById(productId)');
    }
    if (typeof taxRate !== 'number' || taxRate < 0) {
      throw new Error('Tax rate must be a non-negative number');
    }
    if (typeof discountThreshold !== 'number' || discountThreshold < 0) {
      throw new Error('Discount threshold must be a non-negative number');
    }
    if (typeof discountPercentage !== 'number' || discountPercentage < 0 || discountPercentage > 1) {
      throw new Error('Discount percentage must be between 0.0 and 1.0');
    }

    this.#repo = inventoryRepository;
    this.#taxRate = taxRate;
    this.#discountThreshold = discountThreshold;
    this.#discountPercentage = discountPercentage;
  }

  get taxRate() { return this.#taxRate; }
  get discountThreshold() { return this.#discountThreshold; }
  get discountPercentage() { return this.#discountPercentage; }

  /**
   * Consolidates duplicate product line items by aggregating their quantities.
   * Essential for guaranteeing transaction atomicity when an order lists the same SKU multiple times.
   * @param {Array<{productId: string, quantity: number}>} lineItems
   * @returns {Array<{productId: string, quantity: number}>}
   * @throws {Error} If line items array is invalid or contains malformed quantities.
   */
  aggregateLineItems(lineItems) {
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      throw new Error('An order must contain at least one line item');
    }

    const aggregated = new Map();
    for (const item of lineItems) {
      if (!item || typeof item.productId !== 'string' || item.productId.trim().length === 0) {
        throw new Error('Each line item must specify a valid productId string');
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`Invalid item quantity for product: ${item.productId}`);
      }

      const id = item.productId.trim();
      const currentQty = aggregated.get(id) || 0;
      aggregated.set(id, currentQty + item.quantity);
    }

    return Array.from(aggregated.entries()).map(([productId, quantity]) => ({
      productId,
      quantity
    }));
  }

  /**
   * Calculates financial breakdown for a list of resolved line items.
   * Applies volume discount if subtotal meets the threshold, followed by sales tax.
   * @param {Array<{productId: string, quantity: number}>} consolidatedItems
   * @returns {{ resolvedItems: Array<object>, subtotal: number, discount: number, tax: number, total: number }}
   */
  calculatePricing(consolidatedItems) {
    let subtotal = 0;
    const resolvedItems = consolidatedItems.map(({ productId, quantity }) => {
      const product = this.#repo.findById(productId);
      const lineCost = Number((product.price * quantity).toFixed(2));
      subtotal += lineCost;

      return {
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.price,
        lineCost
      };
    });

    const roundedSubtotal = Number(subtotal.toFixed(2));
    const discount = roundedSubtotal >= this.#discountThreshold
      ? Number((roundedSubtotal * this.#discountPercentage).toFixed(2))
      : 0;

    const taxableTotal = Number((roundedSubtotal - discount).toFixed(2));
    const tax = Number((taxableTotal * this.#taxRate).toFixed(2));
    const total = Number((taxableTotal + tax).toFixed(2));

    return {
      resolvedItems,
      subtotal: roundedSubtotal,
      discount,
      tax,
      total
    };
  }

  /**
   * Orchestrates full order checkout with four-phase atomic execution:
   * 1. Cart aggregation & pre-flight stock verification
   * 2. Financial calculation
   * 3. State mutation (atomic stock deduction)
   * 4. Domain entity construction & completion
   * 
   * @param {string} orderId - Unique order identifier.
   * @param {string} customerId - Customer identifier.
   * @param {Array<{productId: string, quantity: number}>} lineItems - Raw order line items.
   * @returns {Order} Finalized and completed Order entity.
   * @throws {Error} If validation fails at any point prior to mutation.
   */
  processOrder(orderId, customerId, lineItems) {
    // Phase 1: Aggregate duplicate cart items and execute defensive pre-flight validation
    const consolidatedItems = this.aggregateLineItems(lineItems);
    const resolvedProducts = [];

    for (const item of consolidatedItems) {
      const product = this.#repo.findById(item.productId);
      if (!product.hasSufficientStock(item.quantity)) {
        throw new Error(`Order checkout rejected: insufficient stock for "${product.name}". Requested: ${item.quantity}, Available: ${product.stock}`);
      }
      resolvedProducts.push({ product, quantity: item.quantity });
    }

    // Phase 2: Compute pricing and financial totals
    const { resolvedItems, subtotal, discount, tax, total } = this.calculatePricing(consolidatedItems);

    // Phase 3: Execute atomic state mutation (deduct stock from verified domain models)
    for (const { product, quantity } of resolvedProducts) {
      product.deductStock(quantity);
    }

    // Phase 4: Construct and transition order domain entity
    const order = new Order(orderId, customerId, resolvedItems);
    order.applyFinancials({ subtotal, discount, tax, total });
    order.markCompleted();

    return order;
  }
}

module.exports = OrderService;

