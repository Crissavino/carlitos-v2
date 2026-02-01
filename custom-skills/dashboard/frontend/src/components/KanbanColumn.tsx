import { Droppable } from '@hello-pangea/dnd';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../api/client';

interface Props {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const columnColors: Record<TaskStatus, string> = {
  backlog: 'bg-gray-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  review: 'bg-purple-500',
  done: 'bg-green-500',
  archived: 'bg-gray-600',
};

export function KanbanColumn({ status, title, tasks, onTaskClick }: Props) {
  const dotColor = columnColors[status] || 'bg-gray-500';

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px] bg-gray-900/50 rounded-lg flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${dotColor}`} />
          <h3 className="font-medium text-white">{title}</h3>
          <span className="ml-auto bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Tasks */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 p-2 overflow-y-auto min-h-[200px]
              ${snapshot.isDraggingOver ? 'bg-gray-800/50' : ''}
            `}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onClick={() => onTaskClick(task)}
              />
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center text-gray-600 text-sm py-8">
                Sin tareas
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
