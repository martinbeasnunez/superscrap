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
  description: string;
}

export const COLUMN_CONFIG: Record<KanbanColumnId, ColumnConfig> = {
  nuevo: {
    id: 'nuevo',
    title: 'Nuevos',
    icon: '📋',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'Sin contactar',
  },
  contactado: {
    id: 'contactado',
    title: 'Contactados',
    icon: '💬',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Esperando respuesta',
  },
  interesado: {
    id: 'interesado',
    title: 'Interesados',
    icon: '⭐',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Mostraron interes',
  },
  cotizado: {
    id: 'cotizado',
    title: 'Cotizados',
    icon: '💰',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Tienen precio',
  },
  cliente: {
    id: 'cliente',
    title: 'Clientes',
    icon: '🎉',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Cerraron venta',
  },
  perdido: {
    id: 'perdido',
    title: 'Perdidos',
    icon: '❌',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'No interesados',
  },
};

interface KanbanColumnProps {
  columnId: KanbanColumnId;
  businesses: KanbanBusiness[];
  onCardClick: (business: KanbanBusiness) => void;
}

export default function KanbanColumn({ columnId, businesses, onCardClick }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[columnId];

  return (
    <div className={`flex flex-col min-w-[260px] max-w-[260px] rounded-xl ${config.bgColor} border ${config.borderColor}`}>
      {/* Header */}
      <div className={`px-3 py-2.5 border-b ${config.borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{config.icon}</span>
            <h3 className={`font-semibold text-sm ${config.color}`}>{config.title}</h3>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} border ${config.borderColor}`}>
            {businesses.length}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
      </div>

      {/* Cards container */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 p-2 overflow-y-auto min-h-[150px] max-h-[calc(100vh-280px)]
              transition-colors
              ${snapshot.isDraggingOver ? 'bg-opacity-70 ring-2 ring-inset ring-blue-300' : ''}
            `}
          >
            {businesses.length === 0 ? (
              <div className="flex items-center justify-center h-16 text-gray-400 text-xs">
                {snapshot.isDraggingOver ? 'Suelta aquí' : 'Sin leads'}
              </div>
            ) : (
              businesses.map((business, index) => (
                <KanbanCard
                  key={business.id}
                  business={business}
                  index={index}
                  onClick={() => onCardClick(business)}
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
