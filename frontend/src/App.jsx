import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';
import PrivateRoute from './components/layout/PrivateRoute';
import Dashboard from './pages/Dashboard';

// Modules from all phases
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import ProductImport from './pages/ProductImport';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Batches from './pages/Batches';
import Inventory from './pages/Inventory';
import Locations from './pages/Locations';
import StockMovements from './pages/StockMovements';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import StaffAllocation from './pages/StaffAllocation';
import StockAudits from './pages/StockAudits';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
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
      </ToastProvider>
    </AuthProvider>
  );
}
