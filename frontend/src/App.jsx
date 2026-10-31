import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';
import PrivateRoute from './components/layout/PrivateRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

// Route-level lazy loading to optimize initial load and split bundles
const Products = lazy(() => import('./pages/Products'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const ProductImport = lazy(() => import('./pages/ProductImport'));
const Categories = lazy(() => import('./pages/Categories'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Batches = lazy(() => import('./pages/Batches'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Locations = lazy(() => import('./pages/Locations'));
const StockMovements = lazy(() => import('./pages/StockMovements'));
const Customers = lazy(() => import('./pages/Customers'));
const Orders = lazy(() => import('./pages/Orders'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Users = lazy(() => import('./pages/Users'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const StaffAllocation = lazy(() => import('./pages/StaffAllocation'));
const StockAudits = lazy(() => import('./pages/StockAudits'));

const Signup = lazy(() => import('./pages/Signup'));

import { PickerAlertProvider } from './context/PickerAlertContext';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <PickerAlertProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetails />} />
                <Route path="/import-products" element={<ProductImport />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/batches" element={<Batches />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/locations" element={<Locations />} />
                <Route path="/stock-movements" element={<StockMovements />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/staff-allocation" element={<StaffAllocation />} />
                <Route path="/stock-audits" element={<StockAudits />} />
                <Route path="/users" element={<Users />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        </PickerAlertProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
