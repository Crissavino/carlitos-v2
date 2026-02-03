import { useState, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { Plus, RefreshCw, Bot } from 'lucide-react';
import { api, type Task, type TaskStatus } from '../api/client';
import { KanbanColumn } from '../components/KanbanColumn';
import { TaskModal } from '../components/TaskModal';
import { NewTaskModal } from '../components/NewTaskModal';

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'backlog', title: 'Pendientes' },
  { status: 'todo', title: 'Por Hacer' },
  { status: 'in_progress', title: 'En Progreso' },
  { status: 'review', title: 'Revisión' },
  { status: 'done', title: 'Hecho' },
];

export function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks('backlog,todo,in_progress,review,done');
      setTasks(data.tasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const taskId = parseInt(draggableId, 10);
    const newStatus = destination.droppableId as TaskStatus;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await api.updateTask(taskId, { status: newStatus });
    } catch (error) {
      console.error('Failed to update task:', error);
      loadTasks(); // Revert on error
    }
  };

  const handleGenerateTasks = async () => {
    setGenerating(true);
    setGenerationResult(null);
    try {
      const result = await api.generateTasks();
      setGenerationResult({ created: result.created, skipped: result.skipped });
      if (result.created > 0) {
        await loadTasks();
      }
    } catch (error) {
      console.error('Failed to generate tasks:', error);
    } finally {
      setGenerating(false);
    }
  };

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="text-3xl">📋</span>
            <div>
              <h1 className="text-2xl font-bold">Kanban</h1>
              <p className="text-sm text-gray-500">{tasks.length} tareas activas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {generationResult && (
              <span className="text-sm text-gray-400">
                {generationResult.created} creadas, {generationResult.skipped} omitidas
              </span>
            )}
            <button
              onClick={handleGenerateTasks}
              disabled={generating}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm"
            >
              <Bot className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
              {generating ? 'Generando...' : 'Generar desde DecisionEngine'}
            </button>
            <button
              onClick={() => setShowNewTask(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva Tarea
            </button>
            <button
              onClick={loadTasks}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Board */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                title={col.title}
                tasks={getTasksByStatus(col.status)}
                onTaskClick={(task) => setSelectedTaskId(task.id)}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Modals */}
      {selectedTaskId && (
        <TaskModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={loadTasks}
        />
      )}

      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreated={loadTasks}
        />
      )}
    </div>
  );
}
