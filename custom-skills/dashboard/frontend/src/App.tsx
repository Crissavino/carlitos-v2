import { useState } from 'react';
import { LayoutDashboard, Kanban as KanbanIcon, BarChart3, Building2, Key, Search, Users, LogOut, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Executive } from './pages/Executive';
import { Kanban } from './pages/Kanban';
import { Campaigns } from './pages/Campaigns';
import { BusinessViews } from './pages/BusinessViews';
import { Keywords } from './pages/Keywords';
import { SearchTerms } from './pages/SearchTerms';
import { Chat } from './pages/Chat';
import { AdminUsers } from './components/AdminUsers';

type Page = 'executive' | 'kanban' | 'campaigns' | 'keywords' | 'search-terms' | 'business' | 'users' | 'chat';

function App() {
  const { user, isLoading, isAdmin, logout } = useAuth();
  const [page, setPage] = useState<Page>('executive');

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!user) {
    return <Login />;
  }

  // Authenticated - show dashboard
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-14">
            <div className="flex items-center gap-2 mr-8">
              <span className="text-2xl">🦞</span>
              <span className="font-semibold text-lg">OpenClaw</span>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setPage('executive')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  page === 'executive'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setPage('kanban')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  page === 'kanban'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <KanbanIcon className="w-4 h-4" />
                Kanban
              </button>
              <button
                onClick={() => setPage('campaigns')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  page === 'campaigns'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Campaigns
              </button>
              <button
                onClick={() => setPage('keywords')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  page === 'keywords'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Key className="w-4 h-4" />
                Keywords
              </button>
              <button
                onClick={() => setPage('search-terms')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  page === 'search-terms'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Search className="w-4 h-4" />
                Search Terms
              </button>
              <button
                onClick={() => setPage('business')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  page === 'business'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Business
              </button>
              {isAdmin && (
                <button
                  onClick={() => setPage('chat')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                    page === 'chat'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setPage('users')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                    page === 'users'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Users
                </button>
              )}
            </div>

            {/* User info and logout */}
            <div className="ml-auto flex items-center gap-4">
              <span className="text-sm text-gray-400">{user.email}</span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors text-sm"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-14">
        {page === 'executive' && <Executive />}
        {page === 'kanban' && <Kanban />}
        {page === 'campaigns' && <Campaigns />}
        {page === 'keywords' && <Keywords />}
        {page === 'search-terms' && <SearchTerms />}
        {page === 'business' && <BusinessViews />}
        {page === 'users' && isAdmin && <AdminUsers />}
        {page === 'chat' && isAdmin && <Chat />}
      </main>
    </div>
  );
}

export default App;
