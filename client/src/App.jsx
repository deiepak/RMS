import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { SocketProvider } from './contexts/SocketContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import CustomerPortal from './customer/CustomerPortal';
import KitchenPortal from './kitchen/KitchenPortal';
import WaiterPortal from './waiter/WaiterPortal';
import TVPortal from './tv/TVPortal';
import CameramanPortal from './cameraman/CameramanPortal';

import AdminPortal from './admin/AdminPortal';
import Dashboard from './admin/Dashboard';
import OrdersManagement from './admin/OrdersManagement';
import AcceptPayment from './admin/AcceptPayment';
import TableManagement from './admin/TableManagement';
import CounterOrders from './components/CounterOrders';
import Packages from './admin/Packages';
import MenuManagement from './admin/MenuManagement';
import StockManagement from './admin/StockManagement';
import VendorManagement from './admin/VendorManagement';
import VendorProfile from './admin/VendorProfile';
import EmployeeManagement from './admin/EmployeeManagement';
import EmployeeProfile from './admin/EmployeeProfile';
import PromoManagement from './admin/PromoManagement';
import BooksLedger from './admin/BooksLedger';
import ExpensesReport from './admin/ExpensesReport';
import FinancialLog from './admin/FinancialLog';
import DamageReport from './admin/DamageReport';
import MaintenanceLog from './admin/MaintenanceLog';
import TipsLedger from './admin/TipsLedger';
import Analytics from './admin/Analytics';
import MenuAnalysis from './admin/MenuAnalysis';
import Communication from './admin/Communication';
import StationManagement from './admin/StationManagement';
import GeneralSettings from './admin/GeneralSettings';
import AdventureManagement from './admin/AdventureManagement';
import AdventurePOS from './admin/AdventurePOS';
import ScanAdventure from './admin/ScanAdventure';
import VideoManagement from './admin/VideoManagement';
import TVContentManagement from './admin/TVContentManagement';
import SocialMediaManagement from './admin/SocialMediaManagement';
import CancelDiscountOrders from './admin/CancelDiscountOrders';
import SalesReturn from './admin/SalesReturn';
import CCTVMonitoring from './admin/CCTVMonitoring';
import WidgetBar from './components/WidgetBar';

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <SocketProvider>
              <WidgetBar />
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route
                  path="/customer"
                  element={<CustomerPortal />}
                />
                <Route
                  path="/kitchen"
                  element={
                    <ProtectedRoute allowedRoles={['kitchen']}>
                      <KitchenPortal />
                    </ProtectedRoute>
                  }
                />
                <Route path="/waiter/*" element={
                  <ProtectedRoute allowedRoles={['waiter', 'admin']}>
                    <WaiterPortal />
                  </ProtectedRoute>
                } />
                
                <Route path="/tv/*" element={
                  <ProtectedRoute allowedRoles={['tv', 'admin']}>
                    <TVPortal />
                  </ProtectedRoute>
                } />

                <Route path="/cameraman/*" element={
                  <ProtectedRoute allowedRoles={['cameraman', 'admin']}>
                    <CameramanPortal />
                  </ProtectedRoute>
                } />

                {/* Admin Portal */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminPortal />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="orders" element={<OrdersManagement />} />
                  <Route path="payments" element={<AcceptPayment />} />
                  <Route path="tables" element={<TableManagement />} />
                  <Route path="counter" element={<CounterOrders isAdminView={true} />} />
                  <Route path="packages" element={<Packages />} />
                  <Route path="menu" element={<MenuManagement />} />
                  <Route path="stock" element={<StockManagement />} />
                  <Route path="vendors" element={<VendorManagement />} />
                  <Route path="vendors/:id" element={<VendorProfile />} />
                  <Route path="employees" element={<EmployeeManagement />} />
                  <Route path="employees/:id" element={<EmployeeProfile />} />
                  <Route path="promos" element={<PromoManagement />} />
                  <Route path="ledger" element={<BooksLedger />} />
                  <Route path="expenses" element={<ExpensesReport />} />
                  <Route path="financial-log" element={<FinancialLog />} />
                  <Route path="tips" element={<TipsLedger />} />
                  <Route path="damage" element={<DamageReport />} />
                  <Route path="maintenance" element={<MaintenanceLog />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="menu-analysis" element={<MenuAnalysis />} />
                  <Route path="communication" element={<Communication />} />
                  <Route path="stations" element={<StationManagement />} />
                  <Route path="settings" element={<GeneralSettings />} />
                  <Route path="adventures/manage" element={<AdventureManagement />} />
                  <Route path="adventures/sell" element={<AdventurePOS />} />
                  <Route path="adventures/scan" element={<ScanAdventure />} />
                  <Route path="adventures/videos" element={<VideoManagement />} />
                  <Route path="tv-content" element={<TVContentManagement />} />
                  <Route path="social-media" element={<SocialMediaManagement />} />
                  <Route path="cancel-discount-orders" element={<CancelDiscountOrders />} />
                  <Route path="sales-return" element={<SalesReturn />} />
                  <Route path="cctv" element={<CCTVMonitoring />} />
                </Route>
              </Routes>
            </SocketProvider>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
