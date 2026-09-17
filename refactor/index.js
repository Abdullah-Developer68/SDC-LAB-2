/**
 * Application Entry Point and Execution Demonstration (Refactored Architecture).
 * Demonstrates modular interaction, private field encapsulation, duplicate SKU aggregation,
 * and deterministic financial calculations.
 */

const { Product } = require('./models');
const InventoryRepository = require('./inventoryRepository');
const OrderService = require('./orderService');

function printSeparator(title) {
  console.log(`\n=== ${title} ===`);
}

function runDemo() {
  console.log('Starting SDC Lab-2: Order Processing System [REFACTORED VERSION]');

  // Initialize repository and service with Dependency Injection
  const repository = new InventoryRepository();
  const orderService = new OrderService(repository, 0.08, 100.0, 0.10);

  // Seed Catalog
  repository.save(new Product('SKU-101', 'Ergonomic Keyboard', 85.0, 10));
  repository.save(new Product('SKU-102', 'Precision Mouse', 40.0, 12));
  repository.save(new Product('SKU-103', 'Aluminium Laptop Stand', 25.0, 3));

  printSeparator('Initial Inventory State');
  repository.getAll().forEach((item) => {
    console.log(`[${item.id}] ${item.name} | Price: $${item.price.toFixed(2)} | Qty: ${item.stock}`);
  });

  // Scenario 1: Standard Checkout with Volume Discount (> $100)
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

  // Scenario 2: Duplicate SKU Cart Aggregation & Atomicity Check (NEW TEST CASE)
  // Requesting SKU-103 twice: 2 units + 2 units = 4 units total, but available stock is only 3!
  printSeparator('Test 2: Duplicate SKU Cart Aggregation (Atomicity Verification)');
  try {
    orderService.processOrder('ORD-002', 'USER-512', [
      { productId: 'SKU-103', quantity: 2 },
      { productId: 'SKU-103', quantity: 2 } // Total requested: 4, Available: 3
    ]);
  } catch (err) {
    console.log(`Pre-flight caught aggregated deficit: "${err.message}"`);
    console.log(`Verified catalog stock for SKU-103 remained untouched at: ${repository.findById('SKU-103').stock}`);
  }

  // Scenario 3: Restock and Subsequent Successful Fulfillment
  printSeparator('Test 3: Restock and Order Fulfillment');
  const stand = repository.findById('SKU-103');
  stand.restock(10);
  console.log(`Restocked SKU-103. Current available: ${stand.stock}`);

  const order3 = orderService.processOrder('ORD-003', 'USER-512', [
    { productId: 'SKU-103', quantity: 5 }
  ]);
  console.log(`Order ${order3.id} placed successfully. Total: $${order3.total}`);

  // Scenario 4: Verifying Private Field Encapsulation
  printSeparator('Test 4: Encapsulation Verification (Private Field Security)');
  const keyboard = repository.findById('SKU-101');
  console.log(`Direct property write attempt: keyboard.stock = 999;`);
  keyboard.stock = 999; // Fails to mutate because #stock is private with only a getter!
  console.log(`Verified stock value is still securely encapsulated: ${keyboard.stock}`);

  printSeparator('Final Inventory State');
  repository.getAll().forEach((item) => {
    console.log(`[${item.id}] ${item.name} | Remaining Stock: ${item.stock}`);
  });
}

if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };

