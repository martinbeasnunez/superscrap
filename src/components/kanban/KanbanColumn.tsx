'use client';

import { Droppable } from '@hello-pangea/dnd';
import { KanbanBusiness, KanbanColumnId } from '@/app/api/kanban/route';
import KanbanCard from './KanbanCard';

interface ColumnConfig {
  id: KanbanColumnId;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const COLUMN_CONFIG: Record<KanbanColumnId, ColumnConfig> = {
  sin_contactar: {
    id: 'sin_contactar',
    title: 'Sin Contactar',
    icon: '📋',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  contactados: {
    id: 'contactados',
    title: 'Contactados',
    icon: '💬',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  interesados: {
    id: 'interesados',
    title: 'Interesados',
    icon: '⭐',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  follow_up: {
    id: 'follow_up',
    title: 'Follow Up',
    icon: '⏰',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  descartados: {
    id: 'descartados',
    title: 'Descartados',
    icon: '❌',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

interface KanbanColumnProps {
  columnId: KanbanColumnId;
  businesses: KanbanBusiness[];
  onAction?: (businessId: string, action: 'whatsapp' | 'email' | 'call') => void;
}

export default function KanbanColumn({ columnId, businesses, onAction }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[columnId];

  return (
    <div className={`flex flex-col min-w-[280px] max-w-[280px] rounded-xl ${config.bgColor} border ${config.borderColor}`}>
      {/* Header */}
      <div className={`px-3 py-2.5 border-b ${config.borderColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{config.icon}</span>
          <h3 className={`font-semibold text-sm ${config.color}`}>{config.title}</h3>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} border ${config.borderColor}`}>
          {businesses.length}
        </span>
      </div>

      {/* Cards container */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 p-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-220px)]
              transition-colors
              ${snapshot.isDraggingOver ? 'bg-opacity-70 ring-2 ring-inset ring-blue-300' : ''}
            `}
          >
            {businesses.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                {snapshot.isDraggingOver ? 'Suelta aquí' : 'Sin negocios'}
              </div>
            ) : (
              businesses.map((business, index) => (
                <KanbanCard
                  key={business.id}
                  business={business}
                  index={index}
                  onAction={onAction}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
