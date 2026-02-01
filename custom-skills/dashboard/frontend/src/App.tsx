import { useState } from 'react';
import { LayoutDashboard, Kanban as KanbanIcon } from 'lucide-react';
import { Executive } from './pages/Executive';
import { Kanban } from './pages/Kanban';

type Page = 'executive' | 'kanban';

function App() {
  const [page, setPage] = useState<Page>('executive');

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
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-14">
        {page === 'executive' && <Executive />}
        {page === 'kanban' && <Kanban />}
      </main>
    </div>
  );
}

export default App;
