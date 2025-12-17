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
import AutonomousAgents from './pages/AutonomousAgents';
import AgentTasks from './pages/AgentTasks';
import Integrations from './pages/Integrations';
import VoiceBots from './pages/VoiceBots';
import CallHistory from './pages/CallHistory';
import WorkClone from './pages/WorkClone';
import CloneTraining from './pages/CloneTraining';
import CloneSettings from './pages/CloneSettings';
import VoiceToBot from './pages/VoiceToBot';
import FineTuning from './pages/FineTuning';

// New SaaS Pages
import Billing from './pages/Billing';
import ApiTokens from './pages/APITokens';
import Webhooks from './pages/Webhooks';
import Usage from './pages/Usage';
import Settings from './pages/Settings';
import SecuritySettings from './pages/SecuritySettings';
import OrganizationSettings from './pages/OrganizationSettings';
import TeamSettings from './pages/TeamSettings';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminHealth from './pages/AdminHealth';
import WhiteLabelSettings from './pages/WhiteLabelSettings';
import AdminStats from './pages/AdminStats';
import AdminRateLimiting from './pages/AdminRateLimiting';
import AdminRoles from './pages/AdminRoles';
import AdminLogin from './pages/AdminLogin';

// Superadmin Pages
import SuperadminDashboard from './pages/Superadmin/Dashboard';
import SuperadminRouteGuard from './components/SuperadminRouteGuard';

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
import PrivateRoute from './components/PrivateRoute';

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

          {/* Admin Login - Separate secure login for admins */}
          <Route path="/admin/login" element={<AdminLogin />} />

        {/* Authenticated Routes - With Sidebar and Organization Context */}
        <Route path="/dashboard" element={<PrivateRoute><AuthenticatedApp><Layout><Dashboard /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/create-bot" element={<PrivateRoute><AuthenticatedApp><Layout><CreateBot /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/mybots" element={<PrivateRoute><AuthenticatedApp><Layout><MyBots /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/my-bots" element={<PrivateRoute><AuthenticatedApp><Layout><MyBots /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bot/:botId/messages" element={<PrivateRoute><AuthenticatedApp><Layout><BotMessages /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bot/:botId/edit" element={<PrivateRoute><AuthenticatedApp><Layout><EditBot /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/flow" element={<PrivateRoute><AuthenticatedApp><FlowBuilder /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/ai-config" element={<PrivateRoute><AuthenticatedApp><Layout><AIConfiguration /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/agents" element={<PrivateRoute><AuthenticatedApp><Layout><AgentStudio /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/workflows" element={<PrivateRoute><AuthenticatedApp><WorkflowBuilder /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/workflows/:workflowId" element={<PrivateRoute><AuthenticatedApp><WorkflowBuilder /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/executions" element={<PrivateRoute><AuthenticatedApp><ExecutionHistory /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/executions/:executionId" element={<PrivateRoute><AuthenticatedApp><ExecutionHistory /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/tools" element={<PrivateRoute><AuthenticatedApp><Layout><ToolStudio /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/analytics" element={<PrivateRoute><AuthenticatedApp><Layout><Analytics /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Multi-Agent AI Routes (without bot context) */}
        <Route path="/agent-studio" element={<PrivateRoute><AuthenticatedApp><Layout><AgentStudio /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/workflows" element={<PrivateRoute><AuthenticatedApp><Layout><WorkflowBuilder /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/workflow-builder" element={<PrivateRoute><AuthenticatedApp><Layout><WorkflowBuilder /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/executions" element={<PrivateRoute><AuthenticatedApp><Layout><ExecutionHistory /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/knowledge" element={<PrivateRoute><AuthenticatedApp><Layout><KnowledgeBase /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/channels" element={<PrivateRoute><AuthenticatedApp><Layout><Channels /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/marketplace" element={<PrivateRoute><AuthenticatedApp><Layout><Marketplace /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/ai-flow" element={<PrivateRoute><AuthenticatedApp><AIFlowStudio /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/orchestrations" element={<PrivateRoute><AuthenticatedApp><Layout><Orchestrations /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/orchestrations" element={<PrivateRoute><AuthenticatedApp><Layout><Orchestrations /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/orchestrations/:orchestrationId" element={<PrivateRoute><AuthenticatedApp><OrchestrationBuilder /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/intents" element={<PrivateRoute><AuthenticatedApp><Layout><IntentEntityBuilder /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/intents" element={<PrivateRoute><AuthenticatedApp><Layout><IntentEntityBuilder /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/widget" element={<PrivateRoute><AuthenticatedApp><WidgetSettings /></AuthenticatedApp></PrivateRoute>} />

        {/* Autonomous Agents Routes */}
        <Route path="/autonomous-agents" element={<PrivateRoute><AuthenticatedApp><Layout><AutonomousAgents /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/autonomous" element={<PrivateRoute><AuthenticatedApp><Layout><AutonomousAgents /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/autonomous-agents/:id/tasks" element={<PrivateRoute><AuthenticatedApp><Layout><AgentTasks /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/autonomous/:id/tasks" element={<PrivateRoute><AuthenticatedApp><Layout><AgentTasks /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/integrations" element={<PrivateRoute><AuthenticatedApp><Layout><Integrations /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Voice AI Routes */}
        <Route path="/voice-bots" element={<PrivateRoute><AuthenticatedApp><Layout><VoiceBots /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/call-history" element={<PrivateRoute><AuthenticatedApp><Layout><CallHistory /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Work Clone Routes */}
        <Route path="/work-clone" element={<PrivateRoute><AuthenticatedApp><Layout><WorkClone /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/clone-training/:id" element={<PrivateRoute><AuthenticatedApp><Layout><CloneTraining /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/clone-settings/:id" element={<PrivateRoute><AuthenticatedApp><Layout><CloneSettings /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Voice-to-Bot Route */}
        <Route path="/voice-to-bot" element={<PrivateRoute><AuthenticatedApp><Layout><VoiceToBot /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* AI Fine-tuning Route */}
        <Route path="/fine-tuning" element={<PrivateRoute><AuthenticatedApp><Layout><FineTuning /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* New SaaS Routes - With Sidebar and Organization Context */}
        <Route path="/billing" element={<PrivateRoute><AuthenticatedApp><Layout><Billing /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/api-tokens" element={<PrivateRoute><AuthenticatedApp><Layout><ApiTokens /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/webhooks" element={<PrivateRoute><AuthenticatedApp><Layout><Webhooks /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/usage" element={<PrivateRoute><AuthenticatedApp><Layout><Usage /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><AuthenticatedApp><Layout><Settings /></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings/security" element={<PrivateRoute><AuthenticatedApp><Layout><SecuritySettings /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Organization Routes */}
        <Route path="/organizations/settings" element={<PrivateRoute><AuthenticatedApp><Layout><OrganizationSettings /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Team Routes */}
        <Route path="/team" element={<PrivateRoute><AuthenticatedApp><Layout><TeamSettings /></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Admin Routes - Protected by AdminRouteGuard */}
        <Route path="/admin/dashboard" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><AdminDashboard /></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/audit-logs" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><AdminAuditLogs /></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/health" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><AdminHealth /></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/whitelabel" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><WhiteLabelSettings /></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/stats" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><AdminStats /></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/rate-limiting" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><AdminRateLimiting /></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/roles" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><AdminRoles /></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />

        {/* Superadmin Routes - Protected by SuperadminRouteGuard */}
        <Route path="/superadmin/dashboard" element={<SuperadminRouteGuard><Layout><SuperadminDashboard /></Layout></SuperadminRouteGuard>} />
      </Routes>
        <ToastContainer />
        </Router>
        </NotificationProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}

export default App;