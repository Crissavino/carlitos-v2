import { Draggable } from '@hello-pangea/dnd';
import { Bot, User, AlertCircle, Clock } from 'lucide-react';
import type { Task } from '../api/client';

interface Props {
  task: Task;
  index: number;
  onClick: () => void;
}

const priorityColors: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-500',
};

const priorityBadges: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-blue-500/20 text-blue-400',
};

const sourceIcons: Record<string, typeof Bot> = {
  decision_engine: Bot,
  manual: User,
  alert: AlertCircle,
};

export function TaskCard({ task, index, onClick }: Props) {
  const SourceIcon = sourceIcons[task.source] || User;
  const borderColor = priorityColors[task.priority] || 'border-l-gray-500';
  const badgeColor = priorityBadges[task.priority] || 'bg-gray-500/20 text-gray-400';

  const createdDate = new Date(task.created_at).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`
            bg-gray-800 rounded-lg border-l-4 ${borderColor} p-3 mb-2 cursor-pointer
            hover:bg-gray-750 transition-colors
            ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500/50' : ''}
          `}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className={`text-xs px-1.5 py-0.5 rounded uppercase font-medium ${badgeColor}`}>
              {task.priority}
            </span>
            <SourceIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-white line-clamp-2 mb-2">
            {task.title}
          </h4>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {createdDate}
            </div>
            {task.area && (
              <span className="bg-gray-700 px-1.5 py-0.5 rounded">
                {task.area}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
