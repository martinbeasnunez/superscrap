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
  isFollowUp?: boolean;
}

export const COLUMN_CONFIG: Record<KanbanColumnId, ColumnConfig> = {
  nuevo: {
    id: 'nuevo',
    title: 'Nuevos',
    icon: '📋',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'Sin contactar aún',
  },
  contactado: {
    id: 'contactado',
    title: '1er Contacto',
    icon: '💬',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Contactados hace 0-2 días',
  },
  seguimiento_1: {
    id: 'seguimiento_1',
    title: 'Seguimiento 1',
    icon: '⏰',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    description: '3-5 días sin respuesta',
    isFollowUp: true,
  },
  seguimiento_2: {
    id: 'seguimiento_2',
    title: 'Seguimiento 2',
    icon: '🔥',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    description: '6+ días - ¡URGENTE!',
    isFollowUp: true,
  },
  interesado: {
    id: 'interesado',
    title: 'Interesados',
    icon: '⭐',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Respondieron con interés',
  },
  cotizado: {
    id: 'cotizado',
    title: 'Cotizados',
    icon: '💰',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Tienen cotización',
  },
  cliente: {
    id: 'cliente',
    title: 'Clientes',
    icon: '🎉',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: '¡Venta cerrada!',
  },
  perdido: {
    id: 'perdido',
    title: 'Perdidos',
    icon: '❌',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
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
    <div className={`flex flex-col min-w-[240px] max-w-[240px] rounded-xl ${config.bgColor} border-2 ${config.borderColor} ${config.isFollowUp ? 'ring-2 ring-offset-1 ' + (columnId === 'seguimiento_2' ? 'ring-red-300' : 'ring-orange-300') : ''}`}>
      {/* Header */}
      <div className={`px-3 py-2.5 border-b ${config.borderColor} ${config.isFollowUp ? 'bg-gradient-to-r ' + (columnId === 'seguimiento_2' ? 'from-red-100 to-red-50' : 'from-orange-100 to-orange-50') : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-base ${config.isFollowUp ? 'animate-pulse' : ''}`}>{config.icon}</span>
            <h3 className={`font-bold text-sm ${config.color}`}>{config.title}</h3>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.isFollowUp ? (columnId === 'seguimiento_2' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800') : config.bgColor + ' ' + config.color} border ${config.borderColor}`}>
            {businesses.length}
          </span>
        </div>
        <p className={`text-xs mt-0.5 ${config.isFollowUp ? (columnId === 'seguimiento_2' ? 'text-red-600 font-medium' : 'text-orange-600 font-medium') : 'text-gray-500'}`}>
          {config.description}
        </p>
      </div>

      {/* Cards container */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 p-2 overflow-y-auto min-h-[150px] max-h-[calc(100vh-320px)]
              transition-colors
              ${snapshot.isDraggingOver ? 'bg-opacity-70 ring-2 ring-inset ring-blue-300' : ''}
            `}
          >
            {businesses.length === 0 ? (
              <div className={`flex items-center justify-center h-16 text-xs ${config.isFollowUp ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                {snapshot.isDraggingOver
                  ? 'Suelta aquí'
                  : config.isFollowUp
                    ? '✅ Sin leads pendientes'
                    : 'Sin leads'
                }
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

      {/* Footer con tip para columnas de seguimiento */}
      {config.isFollowUp && businesses.length > 0 && (
        <div className={`px-2 py-1.5 border-t ${config.borderColor} text-center`}>
          <p className={`text-xs font-medium ${columnId === 'seguimiento_2' ? 'text-red-700' : 'text-orange-700'}`}>
            {columnId === 'seguimiento_2'
              ? '¡Actúa HOY! El interés se enfría'
              : 'Haz follow-up para no perderlos'
            }
          </p>
        </div>
      )}
    </div>
  );
}
