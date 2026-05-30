# Architecture Overview

## Tech Stack
- **Frontend**: React (Vite), React Router v6, Vanilla CSS (Custom Design System), Lucide React (Icons).
- **Backend**: Node.js, Express.js.
- **Database**: MySQL (using Knex.js query builder for migrations and queries).
- **Real-time Communication**: Socket.IO.
- **Authentication**: JWT (JSON Web Tokens), bcryptjs (PIN hashing).

## System Design
The system follows a classic Client-Server architecture with a real-time event-driven layer built on top of WebSockets.

### 1. Frontend Architecture
The React application is structurally divided by "Portals" corresponding to user roles.
- `src/admin/*`: The Admin Portal components (Menu, Employees, Stations, Analytics, Ledger, etc.).
- `src/waiter/*`: The Waiter Portal components (Table overview, order management).
- `src/kitchen/*`: The Kitchen Portal components (Station-wise pending/preparing orders).
- `src/customer/*`: The Self-Service QR code landing page and ordering interface.
- `src/components/*`: Reusable UI components (Modals, ThemeToggles).
- `src/contexts/*`: Global state management (`AuthContext`, `ToastContext`, `SocketProvider`).
- `src/api/*`: Axios client configuration and Socket wrapper.

### 2. Backend Architecture
The Express API acts as both a RESTful JSON API provider and a WebSocket server.
- `server/src/routes/*`: REST controllers divided by entity (`menu.js`, `orders.js`, `employees.js`, `stations.js`).
- `server/src/socket/*`: Socket event handlers. Broadcasts are emitted from the REST controllers (e.g., when an order is created, emit `order:new`).
- `server/src/middleware/*`: JWT validation (`verifyToken`) and Role-Based Access Control (`requireRole`).
- `server/src/config/db.js`: Knex database connection pooling.

### 3. Database Schema
Key tables and their relationships:
- `employees`: Stores staff details, hashed PINs, roles, and an optional `station_id`.
- `restaurant_tables`: Physical tables, QR code URLs, and current availability status.
- `stations`: Physical kitchen zones (e.g., Grill, Bar).
- `menu_categories` & `menu_items`: Food catalog. `menu_items` belongs to a category and optionally to a `station_id`.
- `orders` & `order_items`: A central `orders` record tied to a `table_id`. Multiple `order_items` belong to an order, tracking individual item statuses (`pending`, `accepted`, `prepared`).
- `payments`: Financial records tied to a finalized order.
- `promo_codes`: Discount logic.
- `ledger`: Daily accounting entries (Revenues/Expenses).

### 4. Real-time Event Flow
1. **Action**: Customer submits an order via REST POST `/api/orders`.
2. **Database**: Server inserts `orders` and `order_items` into MySQL.
3. **Socket Emitting**: Server retrieves the `io` instance and emits `io.to('kitchen').emit('order:new', data)`.
4. **Client Reception**: The Kitchen React app is subscribed to `order:new`. It filters the items by the logged-in user's `station_id`.
5. **UI & Audio**: Kitchen app triggers the Text-to-Speech Web API to read the order aloud and updates the React state to render the new item.
