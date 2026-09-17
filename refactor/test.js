/**
 * Automated Unit Test Suite for Refactored Architecture.
 * Executed via Node.js native test runner: node --test refactor/test.js
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { Product, Order, OrderStatus } = require('./models');
const InventoryRepository = require('./inventoryRepository');
const OrderService = require('./orderService');

describe('SDC Lab 2 Refactored Architecture Test Suite', () => {
  let repository;
  let orderService;

  beforeEach(() => {
    repository = new InventoryRepository();
    orderService = new OrderService(repository, 0.08, 100.0, 0.10);

    repository.save(new Product('SKU-001', 'Test Item A', 50.0, 10));
    repository.save(new Product('SKU-002', 'Test Item B', 25.0, 5));
  });

  describe('NFR 1: Modularity & Encapsulation', () => {
    test('Product encapsulates state with private fields; external mutation has no effect', () => {
      const product = repository.findById('SKU-001');
      assert.strictEqual(product.stock, 10);
      assert.strictEqual(product.price, 50.0);

      // Attempt raw property modification (fails to mutate private #stock)
      product.stock = -999;
      product.price = 0.0;
      assert.strictEqual(product.stock, 10, 'Stock must remain protected by getter');
      assert.strictEqual(product.price, 50.0, 'Price must remain protected by getter');
    });

    test('InventoryRepository provides pure persistence without domain logic bleed', () => {
      assert.strictEqual(repository.count(), 2);
      assert.strictEqual(repository.exists('SKU-001'), true);
      assert.strictEqual(repository.exists('NON-EXISTENT'), false);
      assert.strictEqual(typeof repository.adjustStock, 'undefined', 'adjustStock must not exist on repository');
    });

    test('OrderService enforces Dependency Inversion contract', () => {
      assert.throws(() => new OrderService(null), /requires a repository/);
      assert.throws(() => new OrderService({}), /requires a repository implementing findById/);
    });
  });

  describe('NFR 2: Readability & Parameterized Rules', () => {
    test('OrderService exposes configurable constants with sensible defaults', () => {
      assert.strictEqual(orderService.taxRate, 0.08);
      assert.strictEqual(orderService.discountThreshold, 100.0);
      assert.strictEqual(orderService.discountPercentage, 0.10);
    });

    test('calculatePricing correctly computes volume discounts and tax precision', () => {
      // 2 units of Item A ($50 * 2 = $100) -> triggers 10% discount ($10)
      // Taxable: $90 + 8% tax ($7.20) = $97.20
      const pricing = orderService.calculatePricing([{ productId: 'SKU-001', quantity: 2 }]);
      assert.strictEqual(pricing.subtotal, 100.0);
      assert.strictEqual(pricing.discount, 10.0);
      assert.strictEqual(pricing.tax, 7.20);
      assert.strictEqual(pricing.total, 97.20);
    });
  });

  describe('NFR 3: Maintainability & Critical Cart Aggregation Fix', () => {
    test('Consolidates duplicate line items in order and rejects aggregated deficit atomically', () => {
      // Available stock for SKU-002 is 5
      // Line item 1: 3 units. Line item 2: 3 units. Total: 6 (exceeds 5)
      // In unrefactored code, item 1 passed, item 2 failed mid-way, corrupting stock!
      assert.throws(
        () => orderService.processOrder('ORD-DUP', 'CUST-01', [
          { productId: 'SKU-002', quantity: 3 },
          { productId: 'SKU-002', quantity: 3 }
        ]),
        /insufficient stock for "Test Item B"/
      );

      // Verify stock was NOT partially deducted
      const product = repository.findById('SKU-002');
      assert.strictEqual(product.stock, 5, 'Inventory must remain completely untouched on rejection');
    });

    test('Consolidates duplicate line items and processes order successfully when sufficient stock exists', () => {
      // Available stock for SKU-001 is 10
      // Requesting 2 units + 3 units = 5 units total
      const order = orderService.processOrder('ORD-SUCCESS', 'CUST-02', [
        { productId: 'SKU-001', quantity: 2 },
        { productId: 'SKU-001', quantity: 3 }
      ]);

      assert.strictEqual(order.status, OrderStatus.COMPLETED);
      assert.strictEqual(order.items.length, 1, 'Cart items should be consolidated into one line entry');
      assert.strictEqual(order.items[0].quantity, 5);

      const product = repository.findById('SKU-001');
      assert.strictEqual(product.stock, 5, 'Stock should be accurately decremented by aggregate total');
    });
  });
});
