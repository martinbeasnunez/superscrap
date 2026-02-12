'use client';

import { Droppable } from '@hello-pangea/dnd';
import { KanbanBusiness, KanbanColumnId } from '@/app/api/kanban/route';
import KanbanCard from './KanbanCard';

interface ColumnConfig {
  id: KanbanColumnId;
  title: string;
  shortTitle: string;
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
    shortTitle: 'Nuevos',
    icon: '📋',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'Sin contactar aún',
  },
  contactado: {
    id: 'contactado',
    title: '1er Contacto',
    shortTitle: '1er',
    icon: '💬',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Contactados hace 0-2 días',
  },
  seguimiento_1: {
    id: 'seguimiento_1',
    title: 'Seguimiento 1',
    shortTitle: 'Seg 1',
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
    shortTitle: 'Seg 2',
    icon: '🔥',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    description: '6-8 días - ¡URGENTE!',
    isFollowUp: true,
  },
  seguimiento_3: {
    id: 'seguimiento_3',
    title: 'Último Intento',
    shortTitle: 'Último',
    icon: '💀',
    color: 'text-gray-900',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-400',
    description: '9+ días - Sí o No',
    isFollowUp: true,
  },
  interesado: {
    id: 'interesado',
    title: 'Interesados',
    shortTitle: 'Interés',
    icon: '⭐',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Respondieron con interés',
  },
  cotizado: {
    id: 'cotizado',
    title: 'Cotizados',
    shortTitle: 'Cotiz',
    icon: '💰',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Tienen cotización',
  },
  cliente: {
    id: 'cliente',
    title: 'Clientes',
    shortTitle: 'Cliente',
    icon: '🎉',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: '¡Venta cerrada!',
  },
  perdido: {
    id: 'perdido',
    title: 'Perdidos',
    shortTitle: 'Perdido',
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
  onCardClick: (business: KanbanBusiness, column: KanbanColumnId) => void;
}

export default function KanbanColumn({ columnId, businesses, onCardClick }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[columnId];

  return (
    <div className={`
      flex flex-col rounded-xl ${config.bgColor} border-2 ${config.borderColor}
      min-w-[180px] w-[180px] sm:min-w-[220px] sm:w-[220px] lg:min-w-[240px] lg:w-[240px]
      snap-center flex-shrink-0
      ${config.isFollowUp ? 'ring-2 ring-offset-1 ' + (columnId === 'seguimiento_2' ? 'ring-red-300' : 'ring-orange-300') : ''}
    `}>
      {/* Header */}
      <div className={`px-2 sm:px-3 py-2 sm:py-2.5 border-b ${config.borderColor} ${config.isFollowUp ? 'bg-gradient-to-r ' + (columnId === 'seguimiento_2' ? 'from-red-100 to-red-50' : 'from-orange-100 to-orange-50') : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className={`text-sm sm:text-base ${config.isFollowUp ? 'animate-pulse' : ''}`}>{config.icon}</span>
            <h3 className={`font-bold text-xs sm:text-sm ${config.color} truncate`}>
              <span className="sm:hidden">{config.shortTitle}</span>
              <span className="hidden sm:inline">{config.title}</span>
            </h3>
          </div>
          <span className={`text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${config.isFollowUp ? (columnId === 'seguimiento_2' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800') : config.bgColor + ' ' + config.color} border ${config.borderColor}`}>
            {businesses.length}
          </span>
        </div>
        <p className={`hidden sm:block text-xs mt-0.5 ${config.isFollowUp ? (columnId === 'seguimiento_2' ? 'text-red-600 font-medium' : 'text-orange-600 font-medium') : 'text-gray-500'}`}>
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
              flex-1 p-1.5 sm:p-2 overflow-y-auto min-h-[100px] sm:min-h-[150px] max-h-[calc(100vh-380px)] sm:max-h-[calc(100vh-320px)]
              transition-colors
              ${snapshot.isDraggingOver ? 'bg-opacity-70 ring-2 ring-inset ring-blue-300' : ''}
            `}
          >
            {businesses.length === 0 ? (
              <div className={`flex items-center justify-center h-12 sm:h-16 text-xs ${config.isFollowUp ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                {snapshot.isDraggingOver
                  ? 'Suelta aquí'
                  : config.isFollowUp
                    ? '✅'
                    : 'Sin leads'
                }
              </div>
            ) : (
              businesses.map((business, index) => (
                <KanbanCard
                  key={business.id}
                  business={business}
                  index={index}
                  onClick={() => onCardClick(business, columnId)}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Footer con tip para columnas de seguimiento - Hidden on small mobile */}
      {config.isFollowUp && businesses.length > 0 && (
        <div className={`hidden sm:block px-2 py-1.5 border-t ${config.borderColor} text-center`}>
          <p className={`text-xs font-medium ${columnId === 'seguimiento_2' ? 'text-red-700' : 'text-orange-700'}`}>
            {columnId === 'seguimiento_2'
              ? '¡Actúa HOY!'
              : 'Haz follow-up'
            }
          </p>
        </div>
      )}
    </div>
  );
}
