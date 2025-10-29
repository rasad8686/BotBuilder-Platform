import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateBot from './pages/CreateBot';
import MyBots from './pages/MyBots';
import BotMessages from './pages/BotMessages';
import EditBot from './pages/EditBot';
import Analytics from './pages/Analytics';

// New SaaS Pages
import Billing from './pages/Billing';
import ApiTokens from './pages/ApiTokens';
import Webhooks from './pages/Webhooks';
import Usage from './pages/Usage';
import Settings from './pages/Settings';

// Layout
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes - No Sidebar */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated Routes - With Sidebar */}
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/create-bot" element={<Layout><CreateBot /></Layout>} />
        <Route path="/mybots" element={<Layout><MyBots /></Layout>} />
        <Route path="/my-bots" element={<Layout><MyBots /></Layout>} />
        <Route path="/bot/:botId/messages" element={<Layout><BotMessages /></Layout>} />
        <Route path="/bot/:botId/edit" element={<Layout><EditBot /></Layout>} />
        <Route path="/analytics" element={<Layout><Analytics /></Layout>} />

        {/* New SaaS Routes - With Sidebar */}
        <Route path="/billing" element={<Layout><Billing /></Layout>} />
        <Route path="/api-tokens" element={<Layout><ApiTokens /></Layout>} />
        <Route path="/webhooks" element={<Layout><Webhooks /></Layout>} />
        <Route path="/usage" element={<Layout><Usage /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
      </Routes>
    </Router>
  );
}

export default App;