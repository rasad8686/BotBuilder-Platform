import Sidebar from './Sidebar';
import DemoBanner from './DemoBanner';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* Main Content Area - offset for sidebar on desktop */}
      <main className="flex-1 lg:ml-64 transition-all duration-300">
        {/* Demo Banner - Shows when in demo mode */}
        <DemoBanner />
        {children}
      </main>
    </div>
  );
}
