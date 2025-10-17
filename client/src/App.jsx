import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateBot from './pages/CreateBot';
import MyBots from './pages/MyBots';
import BotMessages from './pages/BotMessages';
import EditBot from './pages/EditBot';
import Analytics from './pages/Analytics';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-bot" element={<CreateBot />} />
        <Route path="/mybots" element={<MyBots />} />
        <Route path="/bot/:botId/messages" element={<BotMessages />} />
        <Route path="/bot/:botId/edit" element={<EditBot />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Router>
  );
}

export default App;