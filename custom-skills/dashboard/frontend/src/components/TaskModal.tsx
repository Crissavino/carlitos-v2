import { useState, useEffect } from 'react';
import { X, Bot, User, Tag, Play, MessageSquare, FileText, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api, type TaskDetails, type TaskStatus } from '../api/client';

interface Props {
  taskId: number;
  onClose: () => void;
  onUpdate: () => void;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function TaskModal({ taskId, onClose, onUpdate }: Props) {
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'runs' | 'artifacts'>('details');

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      const data = await api.getTaskDetails(taskId);
      setTask(data);
    } catch (error) {
      console.error('Failed to load task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: TaskStatus) => {
    if (!task) return;
    try {
      await api.updateTask(taskId, { status });
      setTask({ ...task, status });
      onUpdate();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    setSubmitting(true);
    try {
      await api.addComment(taskId, newComment);
      setNewComment('');
      await loadTask();
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // TODO: Re-enable when OpenClaw autonomous mode is ready
  // const handleStartRun = async () => {
  //   if (!task) return;
  //   try {
  //     await api.startRun(taskId);
  //     await loadTask();
  //     onUpdate();
  //   } catch (error) {
  //     console.error('Failed to start run:', error);
  //   }
  // };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  const priorityClass = priorityColors[task.priority] || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${priorityClass} uppercase`}>
                {task.priority}
              </span>
              {task.source === 'decision_engine' && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Bot className="w-3 h-3" /> Auto-generated
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-white">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Status & Actions */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Estado:</span>
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            disabled
            title="Próximamente: ejecución autónoma con OpenClaw"
            className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-gray-400 rounded text-sm cursor-not-allowed opacity-50"
          >
            <Play className="w-4 h-4" />
            Ejecutar con OpenClaw
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { id: 'details', label: 'Detalles', icon: FileText },
            { id: 'comments', label: `Comentarios (${task.comments.length})`, icon: MessageSquare },
            { id: 'runs', label: `Ejecuciones (${task.runs.length})`, icon: Play },
            { id: 'artifacts', label: `Artifacts (${task.artifacts.length})`, icon: Tag },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'details' && (
            <div className="space-y-4">
              {task.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Descripción</h4>
                  <div className="prose prose-sm prose-invert max-w-none bg-gray-800/50 rounded p-3">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-4 mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold text-white mt-3 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>,
                        p: ({ children }) => <p className="text-sm text-gray-300 mb-2">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside text-sm text-gray-300 mb-2 ml-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-gray-300 mb-2 ml-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ children }) => <code className="bg-gray-900 px-1 py-0.5 rounded text-xs text-blue-300">{children}</code>,
                        pre: ({ children }) => <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto mb-2">{children}</pre>,
                        hr: () => <hr className="border-gray-700 my-3" />,
                        a: ({ href, children }) => <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      }}
                    >
                      {task.description}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Área:</span>
                  <span className="ml-2 text-white">{task.area || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Creado:</span>
                  <span className="ml-2 text-white">
                    {new Date(task.created_at).toLocaleDateString('es')}
                  </span>
                </div>
                {task.decision_rule_id && (
                  <div className="col-span-2">
                    <span className="text-gray-400">Rule ID:</span>
                    <span className="ml-2 text-white font-mono text-xs">{task.decision_rule_id}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {task.comments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Sin comentarios</p>
              ) : (
                task.comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {comment.author === 'openclaw' ? (
                        <Bot className="w-4 h-4 text-blue-400" />
                      ) : (
                        <User className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm font-medium">{comment.author}</span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {new Date(comment.created_at).toLocaleString('es')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{comment.comment}</p>
                  </div>
                ))
              )}

              {/* Add comment */}
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Agregar comentario..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button
                  onClick={handleAddComment}
                  disabled={submitting || !newComment.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'runs' && (
            <div className="space-y-3">
              {task.runs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Sin ejecuciones</p>
              ) : (
                task.runs.map((run) => (
                  <div key={run.id} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        run.status === 'success' ? 'bg-green-500/20 text-green-400' :
                        run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        run.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {run.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(run.started_at).toLocaleString('es')}
                      </span>
                      {run.duration_ms && (
                        <span className="text-xs text-gray-500 ml-auto">
                          {(run.duration_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    {run.output && (
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{run.output}</p>
                    )}
                    {run.error_message && (
                      <p className="text-sm text-red-400">{run.error_message}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'artifacts' && (
            <div className="space-y-3">
              {task.artifacts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Sin artifacts</p>
              ) : (
                task.artifacts.map((artifact) => (
                  <div key={artifact.id} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                        {artifact.artifact_type}
                      </span>
                      <span className="text-sm font-medium">{artifact.name}</span>
                    </div>
                    {artifact.content && (
                      <pre className="text-xs text-gray-300 bg-gray-900 rounded p-2 overflow-x-auto">
                        {artifact.content.slice(0, 500)}
                        {artifact.content.length > 500 && '...'}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
