import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import CreateBot from './pages/CreateBot';
import MyBots from './pages/MyBots';
import BotMessages from './pages/BotMessages';
import EditBot from './pages/EditBot';
import FlowBuilder from './pages/FlowBuilder';
import Analytics from './pages/Analytics';
import AIConfiguration from './pages/AIConfiguration';
import AgentStudio from './pages/AgentStudio';
import WorkflowBuilder from './pages/WorkflowBuilder';
import ExecutionHistory from './pages/ExecutionHistory';
import ToolStudio from './pages/ToolStudio';
import KnowledgeBase from './pages/KnowledgeBase';
import Channels from './pages/Channels';
import Marketplace from './pages/Marketplace';
import AIFlowStudio from './pages/AIFlowStudio';
import Orchestrations from './pages/Orchestrations';
import OrchestrationBuilder from './components/orchestration/OrchestrationBuilder';
import IntentEntityBuilder from './pages/IntentEntityBuilder';
import WidgetSettings from './pages/WidgetSettings';

// New SaaS Pages
import Billing from './pages/Billing';
import ApiTokens from './pages/APITokens';
import Webhooks from './pages/Webhooks';
import Usage from './pages/Usage';
import Settings from './pages/Settings';
import OrganizationSettings from './pages/OrganizationSettings';
import TeamSettings from './pages/TeamSettings';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminHealth from './pages/AdminHealth';
import WhiteLabelSettings from './pages/WhiteLabelSettings';
import AdminStats from './pages/AdminStats';

// Legal Pages
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

// Layout & Contexts
import Layout from './components/Layout';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { BrandProvider } from './contexts/BrandContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastContainer } from './components/notifications';
import AdminRouteGuard from './utils/AdminRouteGuard';

// Wrapper component for authenticated routes
function AuthenticatedApp({ children }) {
  return <OrganizationProvider>{children}</OrganizationProvider>;
}

function App() {
  return (
    <ThemeProvider>
      <BrandProvider>
        <NotificationProvider>
        <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Auth Routes - No Sidebar, No Organization Context */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Authenticated Routes - With Sidebar and Organization Context */}
        <Route path="/dashboard" element={<AuthenticatedApp><Layout><Dashboard /></Layout></AuthenticatedApp>} />
        <Route path="/create-bot" element={<AuthenticatedApp><Layout><CreateBot /></Layout></AuthenticatedApp>} />
        <Route path="/mybots" element={<AuthenticatedApp><Layout><MyBots /></Layout></AuthenticatedApp>} />
        <Route path="/my-bots" element={<AuthenticatedApp><Layout><MyBots /></Layout></AuthenticatedApp>} />
        <Route path="/bot/:botId/messages" element={<AuthenticatedApp><Layout><BotMessages /></Layout></AuthenticatedApp>} />
        <Route path="/bot/:botId/edit" element={<AuthenticatedApp><Layout><EditBot /></Layout></AuthenticatedApp>} />
        <Route path="/bots/:botId/flow" element={<AuthenticatedApp><FlowBuilder /></AuthenticatedApp>} />
        <Route path="/bots/:botId/ai-config" element={<AuthenticatedApp><Layout><AIConfiguration /></Layout></AuthenticatedApp>} />
        <Route path="/bots/:botId/agents" element={<AuthenticatedApp><Layout><AgentStudio /></Layout></AuthenticatedApp>} />
        <Route path="/bots/:botId/workflows" element={<AuthenticatedApp><WorkflowBuilder /></AuthenticatedApp>} />
        <Route path="/bots/:botId/workflows/:workflowId" element={<AuthenticatedApp><WorkflowBuilder /></AuthenticatedApp>} />
        <Route path="/bots/:botId/executions" element={<AuthenticatedApp><ExecutionHistory /></AuthenticatedApp>} />
        <Route path="/bots/:botId/executions/:executionId" element={<AuthenticatedApp><ExecutionHistory /></AuthenticatedApp>} />
        <Route path="/bots/:botId/tools" element={<AuthenticatedApp><Layout><ToolStudio /></Layout></AuthenticatedApp>} />
        <Route path="/analytics" element={<AuthenticatedApp><Layout><Analytics /></Layout></AuthenticatedApp>} />

        {/* Multi-Agent AI Routes (without bot context) */}
        <Route path="/agent-studio" element={<AuthenticatedApp><Layout><AgentStudio /></Layout></AuthenticatedApp>} />
        <Route path="/workflows" element={<AuthenticatedApp><Layout><WorkflowBuilder /></Layout></AuthenticatedApp>} />
        <Route path="/workflow-builder" element={<AuthenticatedApp><Layout><WorkflowBuilder /></Layout></AuthenticatedApp>} />
        <Route path="/executions" element={<AuthenticatedApp><Layout><ExecutionHistory /></Layout></AuthenticatedApp>} />
        <Route path="/knowledge" element={<AuthenticatedApp><Layout><KnowledgeBase /></Layout></AuthenticatedApp>} />
        <Route path="/channels" element={<AuthenticatedApp><Layout><Channels /></Layout></AuthenticatedApp>} />
        <Route path="/marketplace" element={<AuthenticatedApp><Layout><Marketplace /></Layout></AuthenticatedApp>} />
        <Route path="/ai-flow" element={<AuthenticatedApp><AIFlowStudio /></AuthenticatedApp>} />
        <Route path="/orchestrations" element={<AuthenticatedApp><Layout><Orchestrations /></Layout></AuthenticatedApp>} />
        <Route path="/bots/:botId/orchestrations" element={<AuthenticatedApp><Layout><Orchestrations /></Layout></AuthenticatedApp>} />
        <Route path="/bots/:botId/orchestrations/:orchestrationId" element={<AuthenticatedApp><OrchestrationBuilder /></AuthenticatedApp>} />
        <Route path="/intents" element={<AuthenticatedApp><Layout><IntentEntityBuilder /></Layout></AuthenticatedApp>} />
        <Route path="/bots/:botId/intents" element={<AuthenticatedApp><Layout><IntentEntityBuilder /></Layout></AuthenticatedApp>} />
        <Route path="/bots/:botId/widget" element={<AuthenticatedApp><WidgetSettings /></AuthenticatedApp>} />

        {/* New SaaS Routes - With Sidebar and Organization Context */}
        <Route path="/billing" element={<AuthenticatedApp><Layout><Billing /></Layout></AuthenticatedApp>} />
        <Route path="/api-tokens" element={<AuthenticatedApp><Layout><ApiTokens /></Layout></AuthenticatedApp>} />
        <Route path="/webhooks" element={<AuthenticatedApp><Layout><Webhooks /></Layout></AuthenticatedApp>} />
        <Route path="/usage" element={<AuthenticatedApp><Layout><Usage /></Layout></AuthenticatedApp>} />
        <Route path="/settings" element={<AuthenticatedApp><Layout><Settings /></Layout></AuthenticatedApp>} />

        {/* Organization Routes */}
        <Route path="/organizations/settings" element={<AuthenticatedApp><Layout><OrganizationSettings /></Layout></AuthenticatedApp>} />

        {/* Team Routes */}
        <Route path="/team" element={<AuthenticatedApp><Layout><TeamSettings /></Layout></AuthenticatedApp>} />

        {/* Admin Routes - Protected by AdminRouteGuard */}
        <Route path="/admin/dashboard" element={<AuthenticatedApp><AdminRouteGuard><Layout><AdminDashboard /></Layout></AdminRouteGuard></AuthenticatedApp>} />
        <Route path="/admin/audit-logs" element={<AuthenticatedApp><AdminRouteGuard><Layout><AdminAuditLogs /></Layout></AdminRouteGuard></AuthenticatedApp>} />
        <Route path="/admin/health" element={<AuthenticatedApp><AdminRouteGuard><Layout><AdminHealth /></Layout></AdminRouteGuard></AuthenticatedApp>} />
        <Route path="/admin/whitelabel" element={<AuthenticatedApp><AdminRouteGuard><Layout><WhiteLabelSettings /></Layout></AdminRouteGuard></AuthenticatedApp>} />
        <Route path="/admin/stats" element={<AuthenticatedApp><AdminRouteGuard><Layout><AdminStats /></Layout></AdminRouteGuard></AuthenticatedApp>} />
      </Routes>
        <ToastContainer />
        </Router>
        </NotificationProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}

export default App;