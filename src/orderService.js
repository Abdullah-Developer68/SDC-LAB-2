/**
 * Service orchestrating order lifecycle, pricing rules, and inventory verification.
 * Adheres to Single Responsibility and Dependency Inversion principles.
 */

const { Order, OrderStatus } = require('./models');

class OrderService {
  constructor(inventoryRepository, taxRate = 0.08, discountThreshold = 100.0) {
    if (!inventoryRepository) {
      throw new Error('OrderService requires a valid InventoryRepository instance');
    }
    this.repo = inventoryRepository;
    this.taxRate = taxRate;
    this.discountThreshold = discountThreshold;
  }

  calculatePricing(lineItems) {
    let subtotal = 0;
    const resolvedItems = lineItems.map(({ productId, quantity }) => {
      const product = this.repo.findById(productId);
      const lineCost = product.price * quantity;
      subtotal += lineCost;
      return {
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.price,
        lineCost: Number(lineCost.toFixed(2))
      };
    });

    const discount = subtotal >= this.discountThreshold ? Number((subtotal * 0.1).toFixed(2)) : 0;
    const taxableTotal = subtotal - discount;
    const tax = Number((taxableTotal * this.taxRate).toFixed(2));
    const total = Number((taxableTotal + tax).toFixed(2));

    return { resolvedItems, subtotal: Number(subtotal.toFixed(2)), discount, tax, total };
  }

  processOrder(orderId, customerId, lineItems) {
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      throw new Error('An order must contain at least one line item');
    }

    // Phase 1: Pre-flight validation (Defensive verification before mutations)
    for (const item of lineItems) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`Invalid item quantity for product: ${item.productId}`);
      }
      const product = this.repo.findById(item.productId);
      if (!product.hasSufficientStock(item.quantity)) {
        throw new Error(`Order checkout rejected: insufficient stock for "${product.name}"`);
      }
    }

    // Phase 2: Calculate pricing and totals
    const { resolvedItems, subtotal, discount, tax, total } = this.calculatePricing(lineItems);

    // Phase 3: Execute state mutation (deduct stock)
    for (const item of resolvedItems) {
      this.repo.adjustStock(item.productId, -item.quantity);
    }

    // Phase 4: Construct and finalize order record
    const order = new Order(orderId, customerId, resolvedItems);
    order.subtotal = subtotal;
    order.discount = discount;
    order.tax = tax;
    order.total = total;
    order.status = OrderStatus.COMPLETED;

    return order;
  }
}

module.exports = OrderService;
