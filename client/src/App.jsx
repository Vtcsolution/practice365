import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Matters from './pages/Matters';
import Contacts from './pages/Contacts';
import Tasks from './pages/Tasks';
import Calendar from './pages/Calendar';
import Activities from './pages/Activities';
import Billing from './pages/Billing';
import Leads from './pages/Leads';
import LeadIntake from './pages/LeadIntake';
import Documents from './pages/Documents';
import SigningPage from './pages/SigningPage';
import { PortalLayout, PortalMatters, PortalDocuments, PortalInvoices, PortalMessages } from './pages/Portal';
import AuditLog from './pages/AuditLog';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function PortalRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'client') return <Navigate to="/" />;
  return children;
}

function FirmRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'client') return <Navigate to="/portal" />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/intake" element={<LeadIntake />} />
      <Route path="/sign/:token" element={<SigningPage />} />

      {/* Client Portal */}
      <Route path="/portal" element={<PortalRoute><PortalLayout /></PortalRoute>}>
        <Route index element={<PortalMatters />} />
        <Route path="documents" element={<PortalDocuments />} />
        <Route path="invoices" element={<PortalInvoices />} />
        <Route path="messages" element={<PortalMessages />} />
      </Route>

      {/* Firm app */}
      <Route path="/" element={<FirmRoute><Layout /></FirmRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/intake" element={<LeadIntake />} />
        <Route path="matters" element={<Matters />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="activities" element={<Activities />} />
        <Route path="documents" element={<Documents />} />
        <Route path="billing" element={<Billing />} />
        <Route path="audit-log" element={<AuditLog />} />
      </Route>
    </Routes>
  );
}
