/**
 * Application Entry Point and Execution Demonstration.
 * Demonstrates modular interaction, domain validation, and error resilience.
 */

const { Product } = require('./models');
const InventoryRepository = require('./inventoryRepository');
const OrderService = require('./orderService');

function printSeparator(title) {
  console.log(`\n=== ${title} ===`);
}

function runDemo() {
  console.log('Starting SDC Lab-2: Order Processing System');

  // Setup domain dependencies via Dependency Injection
  const repository = new InventoryRepository();
  const orderService = new OrderService(repository, 0.08, 100.0);

  // Seed inventory
  repository.save(new Product('SKU-101', 'Ergonomic Keyboard', 85.0, 10));
  repository.save(new Product('SKU-102', 'Precision Mouse', 40.0, 12));
  repository.save(new Product('SKU-103', 'Aluminium Laptop Stand', 25.0, 3));

  printSeparator('Initial Inventory State');
  repository.getAll().forEach((item) => {
    console.log(`[${item.id}] ${item.name} | Price: $${item.price.toFixed(2)} | Qty: ${item.stock}`);
  });

  // Test Case 1: Valid checkout triggering volume discount (> $100)
  printSeparator('Test 1: Standard Checkout with Volume Discount');
  try {
    const order1 = orderService.processOrder('ORD-001', 'USER-402', [
      { productId: 'SKU-101', quantity: 1 },
      { productId: 'SKU-102', quantity: 1 }
    ]);
    console.log(`Order ${order1.id} finalized successfully for customer ${order1.customerId}.`);
    console.log(`Subtotal: $${order1.subtotal} | Discount: -$${order1.discount} | Tax: $${order1.tax} | Total: $${order1.total}`);
    console.log(`Status: ${order1.status}`);
  } catch (err) {
    console.error(`Checkout failed: ${err.message}`);
  }

  // Test Case 2: Stock deficit rejection (atomic prevention of partial mutations)
  printSeparator('Test 2: Stock Deficit Boundary Check');
  try {
    orderService.processOrder('ORD-002', 'USER-512', [
      { productId: 'SKU-103', quantity: 5 } // Only 3 in stock
    ]);
  } catch (err) {
    console.log(`Expected validation caught: "${err.message}"`);
  }

  // Test Case 3: Restocking followed by re-attempt
  printSeparator('Test 3: Restock and Order Fulfillment');
  repository.adjustStock('SKU-103', 10);
  console.log(`Restocked SKU-103. Current available: ${repository.findById('SKU-103').stock}`);
  const order3 = orderService.processOrder('ORD-003', 'USER-512', [
    { productId: 'SKU-103', quantity: 5 }
  ]);
  console.log(`Order ${order3.id} placed successfully. Total: $${order3.total}`);

  printSeparator('Final Inventory State');
  repository.getAll().forEach((item) => {
    console.log(`[${item.id}] ${item.name} | Remaining Stock: ${item.stock}`);
  });
}

if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };
