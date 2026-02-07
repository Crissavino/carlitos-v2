import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Kanban as KanbanIcon, BarChart3, Building2, Key, Search, Users, LogOut, Loader2, MessageSquare, Menu, X, ChevronDown, Globe, Activity, Map, Megaphone, GitBranch } from 'lucide-react';
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
import { GlobalView } from './pages/GlobalView';
import { WEBSITES, type WebsiteId } from './api/client';

type Page = 'executive' | 'kanban' | 'campaigns' | 'keywords' | 'search-terms' | 'business' | 'users' | 'chat' | 'global' | 'companies' | 'websites' | 'countries' | 'campaigns-v2' | 'funnel';

function App() {
  const { user, isLoading, isAdmin, logout } = useAuth();
  const [page, setPage] = useState<Page>('global');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adsDropdownOpen, setAdsDropdownOpen] = useState(false);
  const [websiteId, setWebsiteId] = useState<WebsiteId>(() => {
    const saved = localStorage.getItem('selectedWebsiteId');
    return (saved ? parseInt(saved, 10) : 1) as WebsiteId;
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const websiteDropdownRef = useRef<HTMLDivElement>(null);
  const dashboardDropdownRef = useRef<HTMLDivElement>(null);
  const [websiteDropdownOpen, setWebsiteDropdownOpen] = useState(false);
  const [dashboardDropdownOpen, setDashboardDropdownOpen] = useState(false);

  // Save website selection
  useEffect(() => {
    localStorage.setItem('selectedWebsiteId', websiteId.toString());
  }, [websiteId]);

  // Close website dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (websiteDropdownRef.current && !websiteDropdownRef.current.contains(event.target as Node)) {
        setWebsiteDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedWebsite = WEBSITES.find(w => w.id === websiteId) || WEBSITES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAdsDropdownOpen(false);
      }
      if (dashboardDropdownRef.current && !dashboardDropdownRef.current.contains(event.target as Node)) {
        setDashboardDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdsPage = page === 'campaigns' || page === 'keywords' || page === 'search-terms';
  const isDashboardPage = page === 'global' || page === 'companies' || page === 'websites' || page === 'countries' || page === 'campaigns-v2' || page === 'funnel';

  const navigateTo = (newPage: Page) => {
    setPage(newPage);
    setMobileMenuOpen(false);
    setAdsDropdownOpen(false);
    setDashboardDropdownOpen(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-gray-400">Cargando...</span>
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
              {/* Dashboard Views Dropdown */}
              <div className="relative" ref={dashboardDropdownRef}>
                <button
                  onClick={() => setDashboardDropdownOpen(!dashboardDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isDashboardPage
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${dashboardDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dashboardDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[200px] z-50">
                    <button
                      onClick={() => navigateTo('global')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'global' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      Global
                    </button>
                    <button
                      onClick={() => navigateTo('companies')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'companies' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      Empresas
                    </button>
                    <button
                      onClick={() => navigateTo('websites')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'websites' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Activity className="w-4 h-4" />
                      Websites
                    </button>
                    <button
                      onClick={() => navigateTo('countries')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'countries' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Map className="w-4 h-4" />
                      Países
                    </button>
                    <button
                      onClick={() => navigateTo('campaigns-v2')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'campaigns-v2' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Megaphone className="w-4 h-4" />
                      Campañas
                    </button>
                    <button
                      onClick={() => navigateTo('funnel')}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        page === 'funnel' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <GitBranch className="w-4 h-4" />
                      Funnel & Cohortes
                    </button>
                  </div>
                )}
              </div>

              <NavButton targetPage="executive" icon={LayoutDashboard} label="Panel (legacy)" />
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
                      Campañas
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
                      Términos de Búsqueda
                    </button>
                  </div>
                )}
              </div>

              <NavButton targetPage="business" icon={Building2} label="Negocio" />

              {isAdmin && (
                <>
                  <NavButton targetPage="chat" icon={MessageSquare} label="Chat" />
                  <NavButton targetPage="users" icon={Users} label="Usuarios" />
                </>
              )}
            </div>

            {/* Website Selector + User info and logout (Desktop) */}
            <div className="hidden md:flex items-center gap-3">
              {/* Website Selector */}
              <div className="relative" ref={websiteDropdownRef}>
                <button
                  onClick={() => setWebsiteDropdownOpen(!websiteDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                >
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span>{selectedWebsite.name}</span>
                  <span className="text-xs text-gray-500">({selectedWebsite.currency})</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${websiteDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {websiteDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px] z-50">
                    {WEBSITES.map(website => (
                      <button
                        key={website.id}
                        onClick={() => {
                          setWebsiteId(website.id as WebsiteId);
                          setWebsiteDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                          websiteId === website.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        <span>{website.name}</span>
                        <span className="text-xs text-gray-500">{website.currency}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-sm text-gray-400 truncate max-w-[150px]">{user.email}</span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
                title="Cerrar sesión"
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
                Panel
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
                Campañas
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
                Términos de Búsqueda
              </button>

              <div className="pt-2">
                <button
                  onClick={() => navigateTo('business')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    page === 'business' ? 'bg-gray-800 text-white' : 'text-gray-400'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                  Negocio
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
                    Usuarios
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
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="pt-14">
        {/* New Dashboard Views */}
        {page === 'global' && <GlobalView />}
        {page === 'companies' && <div className="p-6 text-center text-gray-400">Vista Empresas - Próximamente</div>}
        {page === 'websites' && <div className="p-6 text-center text-gray-400">Vista Websites - Próximamente</div>}
        {page === 'countries' && <div className="p-6 text-center text-gray-400">Vista Países - Próximamente</div>}
        {page === 'campaigns-v2' && <div className="p-6 text-center text-gray-400">Vista Campañas v2 - Próximamente</div>}
        {page === 'funnel' && <div className="p-6 text-center text-gray-400">Vista Funnel & Cohortes - Próximamente</div>}

        {/* Legacy Views */}
        {page === 'executive' && <Executive websiteId={websiteId} />}
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
