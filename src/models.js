/**
 * Domain Models for Product and Order entities.
 * Enforces business invariants and data integrity at the domain level.
 */

const OrderStatus = Object.freeze({
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

class Product {
  constructor(id, name, price, stock) {
    if (!id || typeof id !== 'string') {
      throw new Error('Product id must be a non-empty string');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Product name must be a non-empty string');
    }
    if (typeof price !== 'number' || price < 0) {
      throw new Error('Product price must be a non-negative number');
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('Stock must be a non-negative integer');
    }

    this.id = id;
    this.name = name;
    this.price = price;
    this.stock = stock;
  }

  hasSufficientStock(quantity) {
    return this.stock >= quantity;
  }

  deductStock(quantity) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid stock deduction amount: ${quantity}`);
    }
    if (!this.hasSufficientStock(quantity)) {
      throw new Error(`Insufficient stock for "${this.name}". Requested: ${quantity}, Available: ${this.stock}`);
    }
    this.stock -= quantity;
  }

  restock(quantity) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Restock quantity must be a positive integer`);
    }
    this.stock += quantity;
  }
}

class Order {
  constructor(id, customerId, items = []) {
    if (!id || !customerId) {
      throw new Error('Order id and customerId are required');
    }
    this.id = id;
    this.customerId = customerId;
    this.items = items;
    this.subtotal = 0;
    this.discount = 0;
    this.tax = 0;
    this.total = 0;
    this.status = OrderStatus.PENDING;
    this.createdAt = new Date();
  }
}

module.exports = { Product, Order, OrderStatus };
