import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout & Contexts (loaded immediately - needed for app structure)
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import CookieConsent from './components/CookieConsent';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { BrandProvider } from './contexts/BrandContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastContainer } from './components/notifications';
import AdminRouteGuard from './utils/AdminRouteGuard';
import PrivateRoute from './components/PrivateRoute';
import { PageLoading } from './components/LazyLoadWrapper';

// ============================================
// LAZY LOADED PAGES - Route-based Code Splitting
// ============================================

// Public Pages
const Landing = lazy(() => import('./pages/Landing'));
const Demo = lazy(() => import('./pages/Demo'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

// Auth Pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));

// Core Dashboard Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateBot = lazy(() => import('./pages/CreateBot'));
const MyBots = lazy(() => import('./pages/MyBots'));
const BotMessages = lazy(() => import('./pages/BotMessages'));
const EditBot = lazy(() => import('./pages/EditBot'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Flow & Builder Pages (heavy components)
const FlowBuilder = lazy(() => import('./pages/FlowBuilder'));
const AIConfiguration = lazy(() => import('./pages/AIConfiguration'));
const AgentStudio = lazy(() => import('./pages/AgentStudio'));
const WorkflowBuilder = lazy(() => import('./pages/WorkflowBuilder'));
const ExecutionHistory = lazy(() => import('./pages/ExecutionHistory'));
const ToolStudio = lazy(() => import('./pages/ToolStudio'));
const AIFlowStudio = lazy(() => import('./pages/AIFlowStudio'));
const OrchestrationBuilder = lazy(() => import('./components/orchestration/OrchestrationBuilder'));

// Feature Pages
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Channels = lazy(() => import('./pages/Channels'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Orchestrations = lazy(() => import('./pages/Orchestrations'));
const IntentEntityBuilder = lazy(() => import('./pages/IntentEntityBuilder'));
const WidgetSettings = lazy(() => import('./pages/WidgetSettings'));

// Autonomous Agents Pages
const AutonomousAgents = lazy(() => import('./pages/AutonomousAgents'));
const AgentTasks = lazy(() => import('./pages/AgentTasks'));
const Integrations = lazy(() => import('./pages/Integrations'));

// Voice AI Pages
const VoiceBots = lazy(() => import('./pages/VoiceBots'));
const CallHistory = lazy(() => import('./pages/CallHistory'));

// Work Clone Pages
const WorkClone = lazy(() => import('./pages/WorkClone'));
const CloneTraining = lazy(() => import('./pages/CloneTraining'));
const CloneSettings = lazy(() => import('./pages/CloneSettings'));

// Voice-to-Bot & Fine-tuning
const VoiceToBot = lazy(() => import('./pages/VoiceToBot'));
const FineTuning = lazy(() => import('./pages/FineTuning'));

// SaaS Pages
const Billing = lazy(() => import('./pages/Billing'));
const ApiTokens = lazy(() => import('./pages/APITokens'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const Usage = lazy(() => import('./pages/Usage'));
const Settings = lazy(() => import('./pages/Settings'));
const SecuritySettings = lazy(() => import('./pages/SecuritySettings'));
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings'));
const TeamSettings = lazy(() => import('./pages/TeamSettings'));
const SSOSettings = lazy(() => import('./pages/SSOSettings'));
const SSOCallback = lazy(() => import('./pages/SSOCallback'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'));
const AdminHealth = lazy(() => import('./pages/AdminHealth'));
const WhiteLabelSettings = lazy(() => import('./pages/WhiteLabelSettings'));
const AdminStats = lazy(() => import('./pages/AdminStats'));
const AdminRateLimiting = lazy(() => import('./pages/AdminRateLimiting'));
const AdminRoles = lazy(() => import('./pages/AdminRoles'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));

// Superadmin Pages
const SuperadminDashboard = lazy(() => import('./pages/Superadmin/Dashboard'));
const SuperadminRouteGuard = lazy(() => import('./components/SuperadminRouteGuard'));

// Recovery Engine Pages
const RecoveryDashboard = lazy(() => import('./pages/RecoveryDashboard'));
const RecoveryCampaigns = lazy(() => import('./pages/RecoveryCampaigns'));
const AbandonedCarts = lazy(() => import('./pages/AbandonedCarts'));
const CustomerHealth = lazy(() => import('./pages/CustomerHealth'));

// Error Pages
const NotFound = lazy(() => import('./pages/NotFound'));

// Wrapper component for authenticated routes
function AuthenticatedApp({ children }) {
  return <OrganizationProvider>{children}</OrganizationProvider>;
}

// Suspense wrapper for lazy loaded routes
function SuspenseWrapper({ children }) {
  return (
    <Suspense fallback={<PageLoading />}>
      {children}
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrandProvider>
        <NotificationProvider>
        <ErrorBoundary>
        <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<SuspenseWrapper><Landing /></SuspenseWrapper>} />
          <Route path="/demo" element={<SuspenseWrapper><Demo /></SuspenseWrapper>} />
          <Route path="/privacy" element={<SuspenseWrapper><PrivacyPolicy /></SuspenseWrapper>} />
          <Route path="/terms" element={<SuspenseWrapper><TermsOfService /></SuspenseWrapper>} />

          {/* Auth Routes - No Sidebar, No Organization Context */}
          <Route path="/login" element={<SuspenseWrapper><Login /></SuspenseWrapper>} />
          <Route path="/register" element={<SuspenseWrapper><Register /></SuspenseWrapper>} />
          <Route path="/forgot-password" element={<SuspenseWrapper><ForgotPassword /></SuspenseWrapper>} />
          <Route path="/reset-password" element={<SuspenseWrapper><ResetPassword /></SuspenseWrapper>} />
          <Route path="/verify-email" element={<SuspenseWrapper><VerifyEmail /></SuspenseWrapper>} />

          {/* Admin Login - Separate secure login for admins */}
          <Route path="/admin/login" element={<SuspenseWrapper><AdminLogin /></SuspenseWrapper>} />

          {/* SSO Callback - Handles token after SSO authentication */}
          <Route path="/sso/callback" element={<SuspenseWrapper><SSOCallback /></SuspenseWrapper>} />

        {/* Authenticated Routes - With Sidebar and Organization Context */}
        <Route path="/dashboard" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Dashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/create-bot" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CreateBot /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/mybots" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MyBots /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/my-bots" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MyBots /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bot/:botId/messages" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><BotMessages /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bot/:botId/edit" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><EditBot /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/flow" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><FlowBuilder /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/ai-config" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AIConfiguration /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/agents" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AgentStudio /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/workflows" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><WorkflowBuilder /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/workflows/:workflowId" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><WorkflowBuilder /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/executions" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><ExecutionHistory /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/executions/:executionId" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><ExecutionHistory /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/tools" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ToolStudio /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/analytics" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Analytics /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Multi-Agent AI Routes (without bot context) */}
        <Route path="/agent-studio" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AgentStudio /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/workflows" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><WorkflowBuilder /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/workflow-builder" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><WorkflowBuilder /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/executions" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ExecutionHistory /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/knowledge" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><KnowledgeBase /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/channels" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Channels /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/marketplace" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Marketplace /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/ai-flow" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><AIFlowStudio /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />
        <Route path="/orchestrations" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Orchestrations /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/orchestrations" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Orchestrations /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/orchestrations/:orchestrationId" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><OrchestrationBuilder /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />
        <Route path="/intents" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><IntentEntityBuilder /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/intents" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><IntentEntityBuilder /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots/:botId/widget" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><WidgetSettings /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />

        {/* Autonomous Agents Routes */}
        <Route path="/autonomous-agents" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AutonomousAgents /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/autonomous" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AutonomousAgents /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/autonomous-agents/:id/tasks" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AgentTasks /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/autonomous/:id/tasks" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AgentTasks /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/integrations" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Integrations /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Voice AI Routes */}
        <Route path="/voice-bots" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><VoiceBots /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/call-history" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CallHistory /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Work Clone Routes */}
        <Route path="/work-clone" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><WorkClone /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/clone-training/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CloneTraining /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/clone-settings/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CloneSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Voice-to-Bot Route */}
        <Route path="/voice-to-bot" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><VoiceToBot /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* AI Fine-tuning Route */}
        <Route path="/fine-tuning" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><FineTuning /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* New SaaS Routes - With Sidebar and Organization Context */}
        <Route path="/billing" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Billing /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/api-tokens" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ApiTokens /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/webhooks" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Webhooks /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/usage" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Usage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Settings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings/security" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SecuritySettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings/sso" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SSOSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Organization Routes */}
        <Route path="/organizations/settings" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><OrganizationSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Team Routes */}
        <Route path="/team" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TeamSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Admin Routes - Protected by AdminRouteGuard */}
        <Route path="/admin/dashboard" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminDashboard /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/audit-logs" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminAuditLogs /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/health" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminHealth /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/whitelabel" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><WhiteLabelSettings /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/stats" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminStats /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/rate-limiting" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminRateLimiting /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/roles" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminRoles /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />

        {/* Superadmin Routes - Protected by SuperadminRouteGuard */}
        <Route path="/superadmin/dashboard" element={<SuspenseWrapper><SuperadminRouteGuard><Layout><SuperadminDashboard /></Layout></SuperadminRouteGuard></SuspenseWrapper>} />

        {/* Recovery Engine Routes */}
        <Route path="/recovery" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><RecoveryDashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/recovery/campaigns" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><RecoveryCampaigns /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/recovery/carts" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AbandonedCarts /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/recovery/customers" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CustomerHealth /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* 404 Catch-all Route */}
        <Route path="*" element={<SuspenseWrapper><NotFound /></SuspenseWrapper>} />
      </Routes>
        <ToastContainer />
        </Router>
        <CookieConsent />
        </ErrorBoundary>
        </NotificationProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}

export default App;
