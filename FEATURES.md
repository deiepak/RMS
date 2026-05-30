# RMS Features Overview

## 1. Authentication & Role-Based Access
- PIN-based authentication system for rapid login in a fast-paced restaurant environment.
- Four distinct roles: `Admin`, `Waiter`, `Kitchen`, and `Customer`.
- Session persistence and security via JSON Web Tokens (JWT).

## 2. Customer Portal (Self-Service)
- Dynamic QR-code style access via URL (e.g., `/table/5`).
- View the entire available menu with beautiful categorization and imagery.
- Add items to cart with special instructions (e.g., "Less spicy").
- Submit orders directly to the kitchen.
- Track real-time status of orders (Pending -> Accepted -> Preparing -> Prepared -> Delivered).
- Request bill settlement from the table directly.

## 3. Waiter Portal
- Overview of all tables and their current status (Available, Occupied, Checkout Requested).
- Create manual orders for guests who prefer traditional service.
- Add items to existing active orders.
- Receive real-time socket notifications when a table requests the bill.
- Mark prepared items as "Delivered" once brought to the table.
- Send the final bill to the Admin for final payment collection.

## 4. Kitchen Portal (Station-Wise)
- **Station Segregation**: Kitchen staff are assigned to stations (e.g., Bar, Grill). They only see items relevant to their station.
- **Audio Notifications**: Text-to-speech announces incoming orders (e.g., "New order from Table 5: 2x Momo").
- **Pending Orders**: Accept or reject incoming requests. If rejecting, provide a reason.
- **Preparing Orders**: Move accepted items to "Preparing", and finally mark them "Prepared" which alerts the waiter to pick them up.
- **Table-Wise View**: A consolidated view of all tables currently waiting for food from this station.
- **Menu Availability**: Quickly toggle the "In Stock" / "Out of Stock" status of menu items to instantly hide them from customers.

## 5. Admin Portal
The Admin Portal is the central nervous system of the restaurant.
- **Operations**
  - **Live Orders**: See every active order, manage statuses, and oversee the entire floor.
  - **Bill Settlement**: Finalize bills with split payment support (e.g., partial cash, partial card), applying promos, and calculating taxes.
- **Catalog**
  - **Menu Management**: Full CRUD for categories and items. Assign items to specific Kitchen Stations, upload images, and set availability.
  - **Promos**: Create discount codes (percentage or fixed amount) with usage limits and expiry dates.
- **Inventory**
  - **Stock Tracking**: Monitor raw ingredients.
  - **Vendors**: Keep track of supplier details.
- **Administration**
  - **Employees**: Manage staff, assign roles, reset PINs, and link kitchen staff to specific stations.
  - **Stations**: Create physical kitchen zones (Bar, Tandoor, Main Kitchen) to logically separate menu items and kitchen screens.
  - **Books & Ledger**: Keep track of daily revenues, expenses, and cash flow.
  - **Analytics**: Beautiful charts for daily revenue, popular items, and overall performance.
  - **Communication**: Broadcast announcements to all active portals (Kitchen, Waiters) in real-time.

## 6. Real-Time Socket Architecture
- Seamless real-time sync using `Socket.IO`.
- No page refreshes needed. Orders pop up on kitchen screens the second a customer taps "Order".
- Waiters are instantly notified when food is ready to be picked up.
