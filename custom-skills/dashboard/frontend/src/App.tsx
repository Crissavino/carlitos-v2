import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Kanban as KanbanIcon, BarChart3, Building2, Key, Search, Users, LogOut, Loader2, MessageSquare, Menu, X, ChevronDown } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adsDropdownOpen, setAdsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAdsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdsPage = page === 'campaigns' || page === 'keywords' || page === 'search-terms';

  const navigateTo = (newPage: Page) => {
    setPage(newPage);
    setMobileMenuOpen(false);
    setAdsDropdownOpen(false);
  };

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

  const NavButton = ({ targetPage, icon: Icon, label }: { targetPage: Page; icon: React.ElementType; label: string }) => (
    <button
      onClick={() => navigateTo(targetPage)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        page === targetPage
          ? 'bg-gray-800 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  // Authenticated - show dashboard
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-14 justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">🦞</span>
              <span className="font-semibold text-lg hidden sm:block">OpenClaw</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              <NavButton targetPage="executive" icon={LayoutDashboard} label="Dashboard" />
              <NavButton targetPage="kanban" icon={KanbanIcon} label="Kanban" />

              {/* Google Ads Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setAdsDropdownOpen(!adsDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isAdsPage
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Google Ads</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${adsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {adsDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                    <button
                      onClick={() => navigateTo('campaigns')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'campaigns' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      Campaigns
                    </button>
                    <button
                      onClick={() => navigateTo('keywords')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'keywords' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Key className="w-4 h-4" />
                      Keywords
                    </button>
                    <button
                      onClick={() => navigateTo('search-terms')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'search-terms' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Search className="w-4 h-4" />
                      Search Terms
                    </button>
                  </div>
                )}
              </div>

              <NavButton targetPage="business" icon={Building2} label="Business" />

              {isAdmin && (
                <>
                  <NavButton targetPage="chat" icon={MessageSquare} label="Chat" />
                  <NavButton targetPage="users" icon={Users} label="Users" />
                </>
              )}
            </div>

            {/* User info and logout (Desktop) */}
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm text-gray-400 truncate max-w-[150px]">{user.email}</span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-gray-900">
            <div className="px-4 py-3 space-y-1">
              <button
                onClick={() => navigateTo('executive')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  page === 'executive' ? 'bg-gray-800 text-white' : 'text-gray-400'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </button>
              <button
                onClick={() => navigateTo('kanban')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  page === 'kanban' ? 'bg-gray-800 text-white' : 'text-gray-400'
                }`}
              >
                <KanbanIcon className="w-5 h-5" />
                Kanban
              </button>

              {/* Google Ads Section */}
              <div className="pt-2 pb-1">
                <span className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Google Ads</span>
              </div>
              <button
                onClick={() => navigateTo('campaigns')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  page === 'campaigns' ? 'bg-gray-800 text-white' : 'text-gray-400'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Campaigns
              </button>
              <button
                onClick={() => navigateTo('keywords')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  page === 'keywords' ? 'bg-gray-800 text-white' : 'text-gray-400'
                }`}
              >
                <Key className="w-5 h-5" />
                Keywords
              </button>
              <button
                onClick={() => navigateTo('search-terms')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  page === 'search-terms' ? 'bg-gray-800 text-white' : 'text-gray-400'
                }`}
              >
                <Search className="w-5 h-5" />
                Search Terms
              </button>

              <div className="pt-2">
                <button
                  onClick={() => navigateTo('business')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    page === 'business' ? 'bg-gray-800 text-white' : 'text-gray-400'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                  Business
                </button>
              </div>

              {isAdmin && (
                <>
                  <div className="pt-2 pb-1">
                    <span className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</span>
                  </div>
                  <button
                    onClick={() => navigateTo('chat')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                      page === 'chat' ? 'bg-gray-800 text-white' : 'text-gray-400'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    Chat
                  </button>
                  <button
                    onClick={() => navigateTo('users')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                      page === 'users' ? 'bg-gray-800 text-white' : 'text-gray-400'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    Users
                  </button>
                </>
              )}

              {/* User section */}
              <div className="pt-4 mt-2 border-t border-gray-800">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-400 truncate">{user.email}</span>
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white bg-gray-800 rounded-lg text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
