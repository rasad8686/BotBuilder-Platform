import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import DemoBanner from './DemoBanner';
import EmailVerificationBanner from './EmailVerificationBanner';
import Footer from './Footer';
import { NotificationCenter } from './notifications';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Layout({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        // Check verification status from backend
        checkVerificationStatus(parsedUser.email);
      } catch (e) {
        // Silent fail
      }
    }
  }, []);

  const checkVerificationStatus = async (email) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      // If already verified, update localStorage and state
      if (data.alreadyVerified) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.isVerified = true;
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
        }
      }
    } catch (e) {
      // Silent fail - don't block UI
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* Main Content Area - offset for sidebar on desktop */}
      <main className="flex-1 lg:ml-64 transition-all duration-300">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-end gap-4">
            {/* Notification Center */}
            <NotificationCenter />

            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-600 text-sm font-medium">
                  {user?.name?.charAt(0)?.toUpperCase() || '👤'}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {user?.name || 'User'}
              </span>
            </div>
          </div>
        </header>

        {/* Demo Banner - Shows when in demo mode */}
        <DemoBanner />

        {/* Email Verification Banner - Shows when email not verified */}
        <div className="px-6 pt-4">
          <EmailVerificationBanner user={user} />
        </div>

        {children}
        <Footer />
      </main>
    </div>
  );
}
