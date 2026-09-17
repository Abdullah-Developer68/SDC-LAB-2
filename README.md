# SDC Lab 2: Software Quality & NFR Audit (Order & Inventory Management System)

**GitHub Repository:** [https://github.com/Abdullah-Developer68/SDC-LAB-2](https://github.com/Abdullah-Developer68/SDC-LAB-2)

This repository contains the software quality audit and architectural refactoring for Software Development & Construction (SDC) Lab 2. The project implements an in-memory Order Processing & Inventory Reservation engine in Node.js, evaluated against three Non-Functional Requirements (NFRs): **Modularity**, **Readability**, and **Maintainability**.

Both the original codebase and the improved refactored codebase are provided side-by-side for comparison.

---

## Repository Structure

```text
SDC-LAB-2/
├── old_code/                 # Original unrefactored project (Baseline)
│   ├── package.json          # Legacy project configuration
│   ├── models.js             # Domain entities with public mutable fields
│   ├── inventoryRepository.js # Repository layer with adjustStock() logic bleed
│   ├── orderService.js       # Vulnerable to duplicate SKU cart atomicity bug
│   └── index.js              # Runner with manual console inspection
│
├── refactor/                 # Refactored project applying all audit recommendations
│   ├── package.json          # Refactored project configuration & scripts
│   ├── models.js             # Private fields (#stock, #price) & rich Order domain methods
│   ├── inventoryRepository.js # Pure CRUD persistence layer (adjustStock removed)
│   ├── orderService.js       # aggregateLineItems() bug fix, named constants, contract checks
│   ├── index.js              # Demonstration runner verifying encapsulation & atomicity
│   └── test.js               # Automated unit test suite using node:test and node:assert
│
└── .gitignore                # Excludes node_modules/, scripts/, and PDF artifacts
```

---

## Improvements Implemented in `refactor/`

### 1. Modularity & Encapsulation
- **ES2022 Private Fields (`refactor/models.js`):** Enforces true information hiding by converting `#id`, `#name`, `#price`, and `#stock` to private fields in `Product`. External code cannot bypass validation by assigning `product.stock = -50`. Read-only access is provided via getters.
- **Pure Persistence Layer (`refactor/inventoryRepository.js`):** Removed `adjustStock()` from the repository to eliminate cross-layer logic bleed. The repository now acts strictly as a collection gateway (CRUD), while stock mutations are performed through domain methods (`product.deductStock()`, `product.restock()`).
- **Rich Domain Model (`refactor/models.js`):** `Order` encapsulates its own financial applications (`applyFinancials()`) and status transitions (`markCompleted()`, `markCancelled()`) instead of exposing raw properties for external tampering.
- **Contract Verification (`refactor/orderService.js`):** The constructor defensively verifies that the injected repository implements the required `findById` interface.

### 2. Readability & Code Clarity
- **Elimination of Magic Numbers (`refactor/orderService.js`):** Extracted default values into named, self-documenting constants:
  - `DEFAULT_TAX_RATE = 0.08` (8% sales tax)
  - `DEFAULT_DISCOUNT_THRESHOLD = 100.0` (Volume discount boundary)
  - `DEFAULT_DISCOUNT_PERCENTAGE = 0.10` (10% volume discount)
- **Formal JSDoc Specifications:** Added comprehensive JSDoc `@param`, `@returns`, and `@throws` annotations across all classes, constructors, and methods, clarifying object schemas and type expectations.
- **Decoupled Validation Roles:** Distinct separation between business-level pre-flight checks and entity-level invariant guards.

### 3. Maintainability & Transaction Atomicity
- **Critical Duplicate SKU Atomicity Fix (`refactor/orderService.js`):**
  - *Identified Flaw:* If an order contained multiple line items for the same SKU (e.g. 6 units + 5 units when only 10 exist), sequential pre-flight checks evaluated each item independently and mistakenly passed. The subsequent mutation deducted 6 units and then crashed on the second item, leaving inventory in an inconsistent state.
  - *Solution:* Implemented `aggregateLineItems()` to group duplicate product IDs and sum their requested quantities prior to running pre-flight verification and stock deduction, preserving transaction atomicity.
- **Automated Unit Testing (`refactor/test.js`):** Implemented an automated test suite with Node's native test runner (`node:test`) and strict assertions (`node:assert/strict`), testing encapsulation, repository decoupling, parameterized pricing, and atomicity resilience.

---

## How to Run

### 1. Run Original Baseline Project
```bash
node old_code/index.js
# or: cd old_code && npm start
```

### 2. Run Refactored Project Demo
```bash
node refactor/index.js
# or: cd refactor && npm start
```

### 3. Run Automated Unit Test Suite
```bash
node --test refactor/test.js
# or: cd refactor && npm test
```

---

## Student Information
- **Name:** Abdullah
- **Registration:** FA23-BSE-137
- **Subject:** Software Development & Construction (SDC)
- **Lab Assignment:** 02 (Codebase Quality & NFR Audit)
