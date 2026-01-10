import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

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
const StatusPage = lazy(() => import('./pages/StatusPage'));
const Changelog = lazy(() => import('./pages/Changelog'));

// Forum Pages
const ForumHome = lazy(() => import('./pages/forum/ForumHome'));
const ForumCategory = lazy(() => import('./pages/forum/ForumCategory'));
const ForumTopic = lazy(() => import('./pages/forum/ForumTopic'));
const ForumTopicEditor = lazy(() => import('./pages/forum/ForumTopicEditor'));
const ForumUserProfile = lazy(() => import('./pages/forum/ForumUserProfile'));
const ForumSearch = lazy(() => import('./pages/forum/ForumSearch'));

// Auth Pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));

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
const WhatsAppChannel = lazy(() => import('./pages/channels/WhatsAppChannel'));
const TelegramChannel = lazy(() => import('./pages/channels/TelegramChannel'));
const SlackChannel = lazy(() => import('./pages/channels/SlackChannel'));
const InstagramChannel = lazy(() => import('./pages/channels/InstagramChannel'));
const FacebookChannel = lazy(() => import('./pages/channels/FacebookChannel'));
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
const IVRBuilder = lazy(() => import('./pages/IVRBuilder'));

// Work Clone Pages
const WorkClone = lazy(() => import('./pages/WorkClone'));
const CloneTraining = lazy(() => import('./pages/CloneTraining'));
const CloneSettings = lazy(() => import('./pages/CloneSettings'));

// Voice-to-Bot & Fine-tuning
const VoiceToBot = lazy(() => import('./pages/VoiceToBot'));
const FineTuning = lazy(() => import('./pages/FineTuning'));

// Product Tours Pages
const ToursListPage = lazy(() => import('./pages/tours/ToursListPage'));
const TourBuilderPage = lazy(() => import('./pages/tours/TourBuilderPage'));
const TourAnalyticsPage = lazy(() => import('./pages/tours/TourAnalyticsPage'));

// A/B Testing Pages
const ABTestsListPage = lazy(() => import('./pages/ab-tests/ABTestsListPage'));
const ABTestBuilderPage = lazy(() => import('./pages/ab-tests/ABTestBuilderPage'));
const ABTestResultsPage = lazy(() => import('./pages/ab-tests/ABTestResultsPage'));

// Tickets/Helpdesk Pages
const TicketsListPage = lazy(() => import('./pages/tickets/TicketsListPage'));
const TicketDetailPage = lazy(() => import('./pages/tickets/TicketDetailPage'));
const TicketCreatePage = lazy(() => import('./pages/tickets/TicketCreatePage'));
const TicketsSettingsPage = lazy(() => import('./pages/tickets/TicketsSettingsPage'));
const TicketAnalyticsDashboardPage = lazy(() => import('./pages/tickets/analytics/TicketAnalyticsDashboardPage'));

// Email Marketing Pages
const ContactsListPage = lazy(() => import('./pages/email/ContactsListPage'));
const ContactDetailPage = lazy(() => import('./pages/email/ContactDetailPage'));
const ContactCreatePage = lazy(() => import('./pages/email/ContactCreatePage'));
const ContactImportPage = lazy(() => import('./pages/email/ContactImportPage'));
const ListsPage = lazy(() => import('./pages/email/ListsPage'));
const ListDetailPage = lazy(() => import('./pages/email/ListDetailPage'));
const ListCreatePage = lazy(() => import('./pages/email/ListCreatePage'));

// Email Builder & Templates Pages
const TemplatesListPage = lazy(() => import('./pages/email/TemplatesListPage'));
const TemplateBuilderPage = lazy(() => import('./pages/email/TemplateBuilderPage'));
const TemplatePreviewPage = lazy(() => import('./pages/email/TemplatePreviewPage'));
const SystemTemplatesPage = lazy(() => import('./pages/email/SystemTemplatesPage'));

// Email Campaigns Pages
const CampaignsListPage = lazy(() => import('./pages/email/CampaignsListPage'));
const CampaignBuilderPage = lazy(() => import('./pages/email/CampaignBuilderPage'));
const CampaignReportPage = lazy(() => import('./pages/email/CampaignReportPage'));
const UnsubscribePage = lazy(() => import('./pages/email/UnsubscribePage'));

// Email Automations Pages
const AutomationsListPage = lazy(() => import('./pages/email/AutomationsListPage'));
const AutomationBuilderPage = lazy(() => import('./pages/email/AutomationBuilderPage'));
const AutomationReportPage = lazy(() => import('./pages/email/AutomationReportPage'));

// Email Analytics Pages
const EmailAnalyticsDashboardPage = lazy(() => import('./pages/email/EmailAnalyticsDashboardPage'));

// Email Bounce Management
const BounceManagementPage = lazy(() => import('./pages/email/BounceManagementPage'));

// Email Settings, Domains, AB Testing
const EmailSettings = lazy(() => import('./pages/email/EmailSettings'));
const DomainManagement = lazy(() => import('./pages/email/DomainManagement'));
const EmailABTesting = lazy(() => import('./pages/email/EmailABTesting'));

// Surveys Pages
const SurveysPage = lazy(() => import('./pages/surveys/SurveysPage'));
const SurveyBuilderPage = lazy(() => import('./pages/surveys/SurveyBuilderPage'));
const SurveyResponsesPage = lazy(() => import('./pages/surveys/SurveyResponsesPage'));
const SurveyAnalyticsPage = lazy(() => import('./pages/surveys/SurveyAnalyticsPage'));
const SurveyTemplatesPage = lazy(() => import('./pages/surveys/SurveyTemplatesPage'));
const SurveyAllResponsesPage = lazy(() => import('./pages/surveys/SurveyAllResponsesPage'));
const SurveyOverviewAnalyticsPage = lazy(() => import('./pages/surveys/SurveyOverviewAnalyticsPage'));
const PublicSurveyPage = lazy(() => import('./pages/surveys/PublicSurveyPage'));

// SaaS Pages
const Billing = lazy(() => import('./pages/Billing'));
const UsageBilling = lazy(() => import('./pages/UsageBilling'));
const CostCalculator = lazy(() => import('./pages/CostCalculator'));
const ApiTokens = lazy(() => import('./pages/APITokens'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const Usage = lazy(() => import('./pages/Usage'));
const Settings = lazy(() => import('./pages/Settings'));
const SecuritySettings = lazy(() => import('./pages/SecuritySettings'));
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings'));
const Organizations = lazy(() => import('./pages/Organizations'));
const TeamSettings = lazy(() => import('./pages/TeamSettings'));
const SSOSettings = lazy(() => import('./pages/SSOSettings'));
const SSOCallback = lazy(() => import('./pages/SSOCallback'));
const RegionSettings = lazy(() => import('./pages/RegionSettings'));
const CustomDomains = lazy(() => import('./pages/CustomDomains'));
const SLADashboard = lazy(() => import('./pages/SLADashboard'));
const Workspaces = lazy(() => import('./pages/Workspaces'));

// Developer Portal Pages
const APIUsageDashboard = lazy(() => import('./pages/DeveloperPortal/APIUsageDashboard'));
const RateLimits = lazy(() => import('./pages/DeveloperPortal/RateLimits'));
const APIPlayground = lazy(() => import('./pages/DeveloperPortal/APIPlayground'));
const AlertSettings = lazy(() => import('./pages/DeveloperPortal/AlertSettings'));
const ServiceAccounts = lazy(() => import('./pages/DeveloperPortal/ServiceAccounts'));
const AuditLogs = lazy(() => import('./pages/DeveloperPortal/AuditLogs'));
const BatchJobs = lazy(() => import('./pages/DeveloperPortal/BatchJobs'));
const SDKDownload = lazy(() => import('./pages/DeveloperPortal/SDKDownload'));
const WebhooksManagement = lazy(() => import('./pages/DeveloperPortal/WebhooksManagement'));
const APIVersions = lazy(() => import('./pages/DeveloperPortal/APIVersions'));
const GraphQLExplorer = lazy(() => import('./pages/DeveloperPortal/GraphQLExplorer'));
const AnalyticsPro = lazy(() => import('./pages/AnalyticsPro'));

// Reseller Portal Pages
const ResellerApply = lazy(() => import('./pages/ResellerPortal/ResellerApply'));
const ResellerDashboard = lazy(() => import('./pages/ResellerPortal/ResellerDashboard'));
const ResellerCustomers = lazy(() => import('./pages/ResellerPortal/ResellerCustomers'));
const ResellerCommissions = lazy(() => import('./pages/ResellerPortal/ResellerCommissions'));
const ResellerPayouts = lazy(() => import('./pages/ResellerPortal/ResellerPayouts'));
const ResellerBranding = lazy(() => import('./pages/ResellerPortal/ResellerBranding'));

// Marketplace Pages
const MarketplaceBrowse = lazy(() => import('./pages/Marketplace/MarketplaceBrowse'));
const MarketplaceDetail = lazy(() => import('./pages/Marketplace/MarketplaceDetail'));
const MarketplaceCart = lazy(() => import('./pages/Marketplace/MarketplaceCart'));
const MyPurchases = lazy(() => import('./pages/Marketplace/MyPurchases'));
const SellerDashboard = lazy(() => import('./pages/Marketplace/SellerDashboard'));
const SellerItemEditor = lazy(() => import('./pages/Marketplace/SellerItemEditor'));
const SellerEarnings = lazy(() => import('./pages/Marketplace/SellerEarnings'));

// Certification Pages
const CertificationsList = lazy(() => import('./pages/Certifications/CertificationsList'));
const CertificationDetail = lazy(() => import('./pages/Certifications/CertificationDetail'));
const CertificationExam = lazy(() => import('./pages/Certifications/CertificationExam'));
const CertificationResults = lazy(() => import('./pages/Certifications/CertificationResults'));
const MyCertifications = lazy(() => import('./pages/Certifications/MyCertifications'));
const CertificateView = lazy(() => import('./pages/Certifications/CertificateView'));
const CertificationAdmin = lazy(() => import('./pages/Certifications/CertificationAdmin'));

// Affiliate Portal Pages
const AffiliateDashboard = lazy(() => import('./pages/AffiliatePortal/AffiliateDashboard'));
const AffiliateLinks = lazy(() => import('./pages/AffiliatePortal/AffiliateLinks'));
const AffiliateConversions = lazy(() => import('./pages/AffiliatePortal/AffiliateConversions'));
const AffiliatePayouts = lazy(() => import('./pages/AffiliatePortal/AffiliatePayouts'));
const AffiliateAssets = lazy(() => import('./pages/AffiliatePortal/AffiliateAssets'));

// Blog/Tutorial Pages
const BlogHome = lazy(() => import('./pages/Blog/BlogHome'));
const BlogPost = lazy(() => import('./pages/Blog/BlogPost'));
const BlogCategory = lazy(() => import('./pages/Blog/BlogCategory'));
const TutorialsList = lazy(() => import('./pages/Blog/TutorialsList'));
const TutorialDetail = lazy(() => import('./pages/Blog/TutorialDetail'));
const TutorialProgress = lazy(() => import('./pages/Blog/TutorialProgress'));
const BlogAdmin = lazy(() => import('./pages/Blog/BlogAdmin'));
const TutorialAdmin = lazy(() => import('./pages/Blog/TutorialAdmin'));

// Video Academy Pages
const VideoTutorials = lazy(() => import('./pages/Tutorials'));

// Roadmap Pages
const RoadmapBoard = lazy(() => import('./pages/Roadmap/RoadmapBoard'));
const RoadmapTimeline = lazy(() => import('./pages/Roadmap/RoadmapTimeline'));
const RoadmapItemDetail = lazy(() => import('./pages/Roadmap/RoadmapItemDetail'));
const FeatureRequests = lazy(() => import('./pages/Roadmap/FeatureRequests'));
const FeatureRequestForm = lazy(() => import('./pages/Roadmap/FeatureRequestForm'));
const RoadmapAdmin = lazy(() => import('./pages/Roadmap/RoadmapAdmin'));

// Showcase Pages
const ShowcaseGallery = lazy(() => import('./pages/Showcase/ShowcaseGallery'));
const ShowcaseDetail = lazy(() => import('./pages/Showcase/ShowcaseDetail'));
const ShowcaseSubmit = lazy(() => import('./pages/Showcase/ShowcaseSubmit'));
const MyShowcaseProjects = lazy(() => import('./pages/Showcase/MyShowcaseProjects'));
const ShowcaseAdmin = lazy(() => import('./pages/Showcase/ShowcaseAdmin'));

// Enterprise Contracts Pages
const ContractsList = lazy(() => import('./pages/EnterpriseContracts/ContractsList'));
const ContractDetail = lazy(() => import('./pages/EnterpriseContracts/ContractDetail'));
const ContractBuilder = lazy(() => import('./pages/EnterpriseContracts/ContractBuilder'));
const EnterpriseInvoices = lazy(() => import('./pages/EnterpriseContracts/EnterpriseInvoices'));
const ContractAmendments = lazy(() => import('./pages/EnterpriseContracts/ContractAmendments'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'));
const AdminHealth = lazy(() => import('./pages/AdminHealth'));
const WhiteLabelSettings = lazy(() => import('./pages/WhiteLabelSettings'));
const AdminStats = lazy(() => import('./pages/AdminStats'));
const AdminRateLimiting = lazy(() => import('./pages/AdminRateLimiting'));
const RateLimitSettings = lazy(() => import('./pages/admin/RateLimitSettings'));
const AdminRoles = lazy(() => import('./pages/AdminRoles'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const ChangelogAdmin = lazy(() => import('./pages/admin/ChangelogAdmin'));
const AdminBanners = lazy(() => import('./pages/admin/Banners'));
const SMSSettings = lazy(() => import('./pages/admin/SMSSettings'));

// Superadmin Pages
const SuperadminDashboard = lazy(() => import('./pages/Superadmin/Dashboard'));
const SuperadminRouteGuard = lazy(() => import('./components/SuperadminRouteGuard'));

// Recovery Engine Pages
const RecoveryDashboard = lazy(() => import('./pages/RecoveryDashboard'));
const RecoveryCampaigns = lazy(() => import('./pages/RecoveryCampaigns'));
const AbandonedCarts = lazy(() => import('./pages/AbandonedCarts'));
const CustomerHealth = lazy(() => import('./pages/CustomerHealth'));

// Documentation Page
const Docs = lazy(() => import('./pages/Docs'));

// API Playground Page
const Playground = lazy(() => import('./pages/Playground'));

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
    <QueryClientProvider client={queryClient}>
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
          <Route path="/status" element={<SuspenseWrapper><StatusPage /></SuspenseWrapper>} />
          <Route path="/changelog" element={<SuspenseWrapper><Changelog /></SuspenseWrapper>} />
          <Route path="/docs" element={<SuspenseWrapper><Docs /></SuspenseWrapper>} />
          <Route path="/playground" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><Playground /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />

          {/* Auth Routes - No Sidebar, No Organization Context */}
          <Route path="/login" element={<SuspenseWrapper><Login /></SuspenseWrapper>} />
          <Route path="/register" element={<SuspenseWrapper><Register /></SuspenseWrapper>} />
          <Route path="/forgot-password" element={<SuspenseWrapper><ForgotPassword /></SuspenseWrapper>} />
          <Route path="/reset-password" element={<SuspenseWrapper><ResetPassword /></SuspenseWrapper>} />
          <Route path="/verify-email" element={<SuspenseWrapper><VerifyEmail /></SuspenseWrapper>} />

          {/* OAuth Callback - Handles token after Google/Microsoft authentication */}
          <Route path="/auth/callback" element={<SuspenseWrapper><AuthCallback /></SuspenseWrapper>} />

          {/* Admin Login - Separate secure login for admins */}
          <Route path="/admin/login" element={<SuspenseWrapper><AdminLogin /></SuspenseWrapper>} />

          {/* SSO Callback - Handles token after SSO authentication */}
          <Route path="/sso/callback" element={<SuspenseWrapper><SSOCallback /></SuspenseWrapper>} />

        {/* Authenticated Routes - With Sidebar and Organization Context */}
        <Route path="/dashboard" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Dashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/create-bot" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CreateBot /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/bots" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MyBots /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
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
        <Route path="/channels/whatsapp" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><WhatsAppChannel /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/channels/telegram" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TelegramChannel /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/channels/slack" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SlackChannel /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/channels/instagram" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><InstagramChannel /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/channels/facebook" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><FacebookChannel /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/marketplace" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MarketplaceBrowse /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/marketplace/cart" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MarketplaceCart /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/marketplace/my/purchases" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MyPurchases /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/marketplace/:slug" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MarketplaceDetail /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Seller Portal Routes */}
        <Route path="/seller/dashboard" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SellerDashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/seller/items" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SellerDashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/seller/items/new" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SellerItemEditor /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/seller/items/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SellerItemEditor /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/seller/earnings" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SellerEarnings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        <Route path="/ai-flow" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AIFlowStudio /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
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
        <Route path="/ivr-builder" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><IVRBuilder /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/ivr-builder/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><IVRBuilder /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Work Clone Routes */}
        <Route path="/work-clone" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><WorkClone /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/clone-training/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CloneTraining /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/clone-settings/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CloneSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Voice-to-Bot Route */}
        <Route path="/voice-to-bot" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><VoiceToBot /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* AI Fine-tuning Route */}
        <Route path="/fine-tuning" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><FineTuning /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

{/* Product Tours Routes */}
        <Route path="/tours" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ToursListPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/tours/new" element={<PrivateRoute><AuthenticatedApp><TourBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/tours/:id" element={<PrivateRoute><AuthenticatedApp><TourBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/tours/:id/analytics" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TourAnalyticsPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* A/B Testing Routes */}
        <Route path="/ab-tests" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ABTestsListPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/ab-tests/new" element={<PrivateRoute><AuthenticatedApp><ABTestBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/ab-tests/:id" element={<PrivateRoute><AuthenticatedApp><ABTestBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/ab-tests/:id/results" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ABTestResultsPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Tickets/Helpdesk Routes */}
        <Route path="/tickets" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TicketsListPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/tickets/new" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TicketCreatePage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/tickets/settings" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TicketsSettingsPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/tickets/analytics" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TicketAnalyticsDashboardPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/tickets/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TicketDetailPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Email Marketing Routes */}
        <Route path="/email/contacts" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ContactsListPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/contacts/new" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ContactCreatePage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/contacts/import" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ContactImportPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/contacts/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ContactDetailPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/lists" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ListsPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/lists/new" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ListCreatePage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/lists/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ListDetailPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/lists/:id/edit" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ListCreatePage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Email Templates Routes */}
        <Route path="/email/templates" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TemplatesListPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/templates/system" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SystemTemplatesPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/templates/new" element={<PrivateRoute><AuthenticatedApp><TemplateBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/templates/:id" element={<PrivateRoute><AuthenticatedApp><TemplateBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/templates/:id/preview" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TemplatePreviewPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Email Campaigns Routes */}
        <Route path="/email/campaigns" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CampaignsListPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/campaigns/new" element={<PrivateRoute><AuthenticatedApp><CampaignBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/campaigns/:id" element={<PrivateRoute><AuthenticatedApp><CampaignBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/campaigns/:id/report" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CampaignReportPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Email Automations Routes */}
        <Route path="/email/automations" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AutomationsListPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/automations/new" element={<PrivateRoute><AuthenticatedApp><AutomationBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/automations/:id" element={<PrivateRoute><AuthenticatedApp><AutomationBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/automations/:id/report" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AutomationReportPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Email Analytics Routes */}
        <Route path="/email/analytics" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><EmailAnalyticsDashboardPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Email Bounce Management Routes */}
        <Route path="/email/bounces" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><BounceManagementPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Email Settings, Domains, AB Testing Routes */}
        <Route path="/email/settings" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><EmailSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/domains" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><DomainManagement /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/email/ab-tests" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><EmailABTesting /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Public Email Routes */}
        <Route path="/unsubscribe/:token" element={<SuspenseWrapper><UnsubscribePage /></SuspenseWrapper>} />

        {/* Surveys Routes */}
        <Route path="/surveys" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SurveysPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/surveys/templates" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SurveyTemplatesPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/surveys/responses" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SurveyAllResponsesPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/surveys/analytics" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SurveyOverviewAnalyticsPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/surveys/new" element={<PrivateRoute><AuthenticatedApp><SurveyBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/surveys/:id/edit" element={<PrivateRoute><AuthenticatedApp><SurveyBuilderPage /></AuthenticatedApp></PrivateRoute>} />
        <Route path="/surveys/:id/responses" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SurveyResponsesPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/surveys/:id/analytics" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SurveyAnalyticsPage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Public Survey Route */}
        <Route path="/s/:id" element={<SuspenseWrapper><PublicSurveyPage /></SuspenseWrapper>} />

        {/* Developer Portal Routes */}
        <Route path="/developer/usage" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><APIUsageDashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/rate-limits" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><RateLimits /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/playground" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><APIPlayground /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/alerts" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AlertSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/service-accounts" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ServiceAccounts /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/audit-logs" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AuditLogs /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/batch" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><BatchJobs /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/sdks" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SDKDownload /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/webhooks" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><WebhooksManagement /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/api-versions" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><APIVersions /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/graphql" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><GraphQLExplorer /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/developer/analytics-pro" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AnalyticsPro /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* New SaaS Routes - With Sidebar and Organization Context */}
        <Route path="/billing" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Billing /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/billing/usage" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><UsageBilling /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/cost-calculator" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CostCalculator /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/api-tokens" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ApiTokens /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/webhooks" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Webhooks /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/usage" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Usage /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Settings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings/security" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SecuritySettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings/sso" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SSOSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings/regions" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><RegionSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/settings/domains" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CustomDomains /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/sla" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><SLADashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Organization Routes */}
        <Route path="/organizations" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Organizations /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/organizations/settings" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><OrganizationSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Team Routes */}
        <Route path="/team" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TeamSettings /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Workspace Routes */}
        <Route path="/workspaces" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Workspaces /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/workspaces/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><Workspaces /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Admin Routes - Protected by AdminRouteGuard */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminDashboard /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/audit-logs" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminAuditLogs /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/health" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminHealth /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/whitelabel" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><WhiteLabelSettings /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/stats" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminStats /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/rate-limiting" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><RateLimitSettings /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/rate-limiting-legacy" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminRateLimiting /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/roles" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminRoles /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/changelog" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><ChangelogAdmin /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/certifications" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><CertificationAdmin /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/banners" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><AdminBanners /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/sms" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><SMSSettings /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />

        {/* Certification Routes */}
        <Route path="/certifications" element={<SuspenseWrapper><CertificationsList /></SuspenseWrapper>} />
        <Route path="/certifications/my" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MyCertifications /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/certifications/verify/:number" element={<SuspenseWrapper><CertificateView /></SuspenseWrapper>} />
        <Route path="/certifications/:slug" element={<SuspenseWrapper><CertificationDetail /></SuspenseWrapper>} />
        <Route path="/certifications/:slug/exam" element={<PrivateRoute><AuthenticatedApp><SuspenseWrapper><CertificationExam /></SuspenseWrapper></AuthenticatedApp></PrivateRoute>} />
        <Route path="/certifications/:slug/results/:attemptId" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CertificationResults /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Superadmin Routes - Protected by SuperadminRouteGuard */}
        <Route path="/superadmin/dashboard" element={<SuspenseWrapper><SuperadminRouteGuard><Layout><SuperadminDashboard /></Layout></SuperadminRouteGuard></SuspenseWrapper>} />

        {/* Recovery Engine Routes */}
        <Route path="/recovery" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><RecoveryDashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/recovery/campaigns" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><RecoveryCampaigns /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/recovery/carts" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AbandonedCarts /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/recovery/customers" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><CustomerHealth /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Reseller Portal Routes */}
        <Route path="/reseller/apply" element={<SuspenseWrapper><ResellerApply /></SuspenseWrapper>} />
        <Route path="/reseller/dashboard" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ResellerDashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/reseller/customers" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ResellerCustomers /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/reseller/commissions" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ResellerCommissions /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/reseller/payouts" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ResellerPayouts /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/reseller/branding" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ResellerBranding /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Affiliate Portal Routes */}
        <Route path="/affiliate/dashboard" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AffiliateDashboard /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/affiliate/links" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AffiliateLinks /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/affiliate/conversions" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AffiliateConversions /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/affiliate/payouts" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AffiliatePayouts /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/affiliate/assets" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><AffiliateAssets /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Enterprise Contracts Routes */}
        <Route path="/enterprise/contracts" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ContractsList /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/enterprise/contracts/new" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ContractBuilder /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/enterprise/contracts/:id" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ContractDetail /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/enterprise/contracts/:id/amend" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ContractAmendments /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/enterprise/invoices" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><EnterpriseInvoices /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Roadmap Routes - Public */}
        <Route path="/roadmap" element={<SuspenseWrapper><Layout><RoadmapBoard /></Layout></SuspenseWrapper>} />
        <Route path="/roadmap/timeline" element={<SuspenseWrapper><Layout><RoadmapTimeline /></Layout></SuspenseWrapper>} />
        <Route path="/roadmap/:slug" element={<SuspenseWrapper><Layout><RoadmapItemDetail /></Layout></SuspenseWrapper>} />

        {/* Feature Requests Routes */}
        <Route path="/feature-requests" element={<SuspenseWrapper><Layout><FeatureRequests /></Layout></SuspenseWrapper>} />
        <Route path="/feature-requests/new" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><FeatureRequestForm /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />

        {/* Roadmap Admin Route */}
        <Route path="/admin/roadmap" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><RoadmapAdmin /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />

        {/* Showcase Routes - Public */}
        <Route path="/showcase" element={<SuspenseWrapper><Layout><ShowcaseGallery /></Layout></SuspenseWrapper>} />
        <Route path="/showcase/submit" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ShowcaseSubmit /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/showcase/my" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><MyShowcaseProjects /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/showcase/:slug" element={<SuspenseWrapper><Layout><ShowcaseDetail /></Layout></SuspenseWrapper>} />

        {/* Showcase Admin Route */}
        <Route path="/admin/showcase" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><ShowcaseAdmin /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />

        {/* Blog/Tutorial Routes */}
        <Route path="/blog" element={<SuspenseWrapper><Layout><BlogHome /></Layout></SuspenseWrapper>} />
        <Route path="/blog/category/:category" element={<SuspenseWrapper><Layout><BlogCategory /></Layout></SuspenseWrapper>} />
        <Route path="/blog/:slug" element={<SuspenseWrapper><Layout><BlogPost /></Layout></SuspenseWrapper>} />
        <Route path="/tutorials" element={<SuspenseWrapper><Layout><TutorialsList /></Layout></SuspenseWrapper>} />
        <Route path="/tutorials/:slug" element={<SuspenseWrapper><Layout><TutorialDetail /></Layout></SuspenseWrapper>} />
        <Route path="/tutorials/my/progress" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><TutorialProgress /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/blog" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><BlogAdmin /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />
        <Route path="/admin/tutorials" element={<PrivateRoute><AuthenticatedApp><AdminRouteGuard><Layout><SuspenseWrapper><TutorialAdmin /></SuspenseWrapper></Layout></AdminRouteGuard></AuthenticatedApp></PrivateRoute>} />

        {/* Video Academy Routes */}
        <Route path="/academy" element={<SuspenseWrapper><Layout><VideoTutorials /></Layout></SuspenseWrapper>} />
        <Route path="/academy/:id" element={<SuspenseWrapper><Layout><VideoTutorials /></Layout></SuspenseWrapper>} />

        {/* Forum Routes */}
        <Route path="/forum" element={<SuspenseWrapper><Layout><ForumHome /></Layout></SuspenseWrapper>} />
        <Route path="/forum/category/:slug" element={<SuspenseWrapper><Layout><ForumCategory /></Layout></SuspenseWrapper>} />
        <Route path="/forum/topic/:slug" element={<SuspenseWrapper><Layout><ForumTopic /></Layout></SuspenseWrapper>} />
        <Route path="/forum/new" element={<PrivateRoute><AuthenticatedApp><Layout><SuspenseWrapper><ForumTopicEditor /></SuspenseWrapper></Layout></AuthenticatedApp></PrivateRoute>} />
        <Route path="/forum/user/:userId" element={<SuspenseWrapper><Layout><ForumUserProfile /></Layout></SuspenseWrapper>} />
        <Route path="/forum/search" element={<SuspenseWrapper><Layout><ForumSearch /></Layout></SuspenseWrapper>} />

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
    </QueryClientProvider>
  );
}

export default App;
