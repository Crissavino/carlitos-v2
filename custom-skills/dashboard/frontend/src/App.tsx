import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Kanban as KanbanIcon, Users, LogOut, Loader2, MessageSquare, Menu, X, ChevronDown, Globe, Building2, Activity, Map, Megaphone, GitBranch, Calendar } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { CohortProvider, useCohort } from './contexts/CohortContext';
import { Login } from './pages/Login';
import { Kanban } from './pages/Kanban';
import { Chat } from './pages/Chat';
import { AdminUsers } from './components/AdminUsers';
import { GlobalView } from './pages/GlobalView';
import { CompaniesView } from './pages/CompaniesView';
import { WebsitesView } from './pages/WebsitesView';
import { CountriesView } from './pages/CountriesView';
import { CampaignsView } from './pages/CampaignsView';
import { FunnelView } from './pages/FunnelView';

type Page = 'global' | 'companies' | 'websites' | 'countries' | 'campaigns' | 'funnel' | 'kanban' | 'users' | 'chat';

function AppContent() {
  const { user, isLoading, isAdmin, logout } = useAuth();
  const { selectedRange, setSelectedRange, availableOptions } = useCohort();
  const [page, setPage] = useState<Page>('global');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardDropdownOpen, setDashboardDropdownOpen] = useState(false);
  const [cohortDropdownOpen, setCohortDropdownOpen] = useState(false);
  const dashboardDropdownRef = useRef<HTMLDivElement>(null);
  const cohortDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dashboardDropdownRef.current && !dashboardDropdownRef.current.contains(event.target as Node)) {
        setDashboardDropdownOpen(false);
      }
      if (cohortDropdownRef.current && !cohortDropdownRef.current.contains(event.target as Node)) {
        setCohortDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDashboardPage = ['global', 'companies', 'websites', 'countries', 'campaigns', 'funnel'].includes(page);

  const navigateTo = (newPage: Page) => {
    setPage(newPage);
    setMobileMenuOpen(false);
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

  const dashboardPages = [
    { id: 'global' as const, label: 'Global', icon: Globe },
    { id: 'companies' as const, label: 'Empresas', icon: Building2 },
    { id: 'websites' as const, label: 'Websites', icon: Activity },
    { id: 'countries' as const, label: 'Países', icon: Map },
    { id: 'campaigns' as const, label: 'Campañas', icon: Megaphone },
    { id: 'funnel' as const, label: 'Funnel & Cohortes', icon: GitBranch },
  ];

  const currentDashboardPage = dashboardPages.find(p => p.id === page);

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
                  <span>{currentDashboardPage ? currentDashboardPage.label : 'Dashboard'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${dashboardDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dashboardDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[200px] z-50">
                    {dashboardPages.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => navigateTo(id)}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                          page === id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Date Range Selector - only show when on dashboard pages */}
              {isDashboardPage && (
                <div className="relative" ref={cohortDropdownRef}>
                  <button
                    onClick={() => setCohortDropdownOpen(!cohortDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-gray-400 hover:text-white hover:bg-gray-800/50 border border-gray-700"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{selectedRange.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${cohortDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {cohortDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[200px] z-50 max-h-80 overflow-y-auto">
                      {/* Periods section */}
                      <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Períodos
                      </div>
                      {availableOptions.filter(o => o.type === 'period').map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setSelectedRange(option);
                            setCohortDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                            selectedRange.id === option.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          }`}
                        >
                          <span>{option.label}</span>
                        </button>
                      ))}

                      {/* Separator */}
                      <div className="my-1 border-t border-gray-700" />

                      {/* Cohorts section */}
                      <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cohortes
                      </div>
                      {availableOptions.filter(o => o.type === 'cohort').map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setSelectedRange(option);
                            setCohortDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                            selectedRange.id === option.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          }`}
                        >
                          <span>{option.label}</span>
                          <span className="text-xs text-gray-500">{option.monthsAvailable}m</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <NavButton targetPage="kanban" icon={KanbanIcon} label="Kanban" />

              {isAdmin && (
                <>
                  <NavButton targetPage="chat" icon={MessageSquare} label="Chat" />
                  <NavButton targetPage="users" icon={Users} label="Usuarios" />
                </>
              )}
            </div>

            {/* User info and logout (Desktop) */}
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm text-gray-400 truncate max-w-[200px]">{user.email}</span>
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
              {/* Dashboard Section */}
              <div className="pb-1">
                <span className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Dashboard</span>
              </div>
              {dashboardPages.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigateTo(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    page === id ? 'bg-gray-800 text-white' : 'text-gray-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}

              <div className="pt-2 pb-1">
                <span className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Herramientas</span>
              </div>
              <button
                onClick={() => navigateTo('kanban')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  page === 'kanban' ? 'bg-gray-800 text-white' : 'text-gray-400'
                }`}
              >
                <KanbanIcon className="w-5 h-5" />
                Kanban
              </button>

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
                    Salir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="pt-14">
        {page === 'global' && <GlobalView />}
        {page === 'companies' && <CompaniesView />}
        {page === 'websites' && <WebsitesView />}
        {page === 'countries' && <CountriesView />}
        {page === 'campaigns' && <CampaignsView />}
        {page === 'funnel' && <FunnelView />}
        {page === 'kanban' && <Kanban />}
        {page === 'users' && isAdmin && <AdminUsers />}
        {page === 'chat' && isAdmin && <Chat />}
      </main>
    </div>
  );
}

function App() {
  return (
    <CohortProvider>
      <AppContent />
    </CohortProvider>
  );
}

export default App;
