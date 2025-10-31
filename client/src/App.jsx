import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateBot from './pages/CreateBot';
import MyBots from './pages/MyBots';
import BotMessages from './pages/BotMessages';
import EditBot from './pages/EditBot';
import FlowBuilder from './pages/FlowBuilder';
import Analytics from './pages/Analytics';

// New SaaS Pages
import Billing from './pages/Billing';
import ApiTokens from './pages/ApiTokens';
import Webhooks from './pages/Webhooks';
import Usage from './pages/Usage';
import Settings from './pages/Settings';
import OrganizationSettings from './pages/OrganizationSettings';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminHealth from './pages/AdminHealth';

// Layout & Contexts
import Layout from './components/Layout';
import { OrganizationProvider } from './contexts/OrganizationContext';
import AdminRouteGuard from './utils/AdminRouteGuard';

// Wrapper component for authenticated routes
function AuthenticatedApp({ children }) {
  return <OrganizationProvider>{children}</OrganizationProvider>;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes - No Sidebar, No Organization Context */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated Routes - With Sidebar and Organization Context */}
        <Route path="/dashboard" element={<AuthenticatedApp><Layout><Dashboard /></Layout></AuthenticatedApp>} />
        <Route path="/create-bot" element={<AuthenticatedApp><Layout><CreateBot /></Layout></AuthenticatedApp>} />
        <Route path="/mybots" element={<AuthenticatedApp><Layout><MyBots /></Layout></AuthenticatedApp>} />
        <Route path="/my-bots" element={<AuthenticatedApp><Layout><MyBots /></Layout></AuthenticatedApp>} />
        <Route path="/bot/:botId/messages" element={<AuthenticatedApp><Layout><BotMessages /></Layout></AuthenticatedApp>} />
        <Route path="/bot/:botId/edit" element={<AuthenticatedApp><Layout><EditBot /></Layout></AuthenticatedApp>} />
        <Route path="/bots/:botId/flow" element={<AuthenticatedApp><FlowBuilder /></AuthenticatedApp>} />
        <Route path="/analytics" element={<AuthenticatedApp><Layout><Analytics /></Layout></AuthenticatedApp>} />

        {/* New SaaS Routes - With Sidebar and Organization Context */}
        <Route path="/billing" element={<AuthenticatedApp><Layout><Billing /></Layout></AuthenticatedApp>} />
        <Route path="/api-tokens" element={<AuthenticatedApp><Layout><ApiTokens /></Layout></AuthenticatedApp>} />
        <Route path="/webhooks" element={<AuthenticatedApp><Layout><Webhooks /></Layout></AuthenticatedApp>} />
        <Route path="/usage" element={<AuthenticatedApp><Layout><Usage /></Layout></AuthenticatedApp>} />
        <Route path="/settings" element={<AuthenticatedApp><Layout><Settings /></Layout></AuthenticatedApp>} />

        {/* Organization Routes */}
        <Route path="/organizations/settings" element={<AuthenticatedApp><Layout><OrganizationSettings /></Layout></AuthenticatedApp>} />

        {/* Admin Routes - Protected by AdminRouteGuard */}
        <Route path="/admin/dashboard" element={<AuthenticatedApp><AdminRouteGuard><Layout><AdminDashboard /></Layout></AdminRouteGuard></AuthenticatedApp>} />
        <Route path="/admin/audit-logs" element={<AuthenticatedApp><AdminRouteGuard><Layout><AdminAuditLogs /></Layout></AdminRouteGuard></AuthenticatedApp>} />
        <Route path="/admin/health" element={<AuthenticatedApp><AdminRouteGuard><Layout><AdminHealth /></Layout></AdminRouteGuard></AuthenticatedApp>} />
      </Routes>
    </Router>
  );
}

export default App;