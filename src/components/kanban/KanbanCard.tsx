'use client';

import { Draggable } from '@hello-pangea/dnd';
import { KanbanBusiness } from '@/app/api/kanban/route';

interface KanbanCardProps {
  business: KanbanBusiness;
  index: number;
  onAction?: (businessId: string, action: 'whatsapp' | 'email' | 'call') => void;
}

// Extraer distrito de la dirección
function extractDistrict(address: string | null): string {
  if (!address) return '';
  const lower = address.toLowerCase();
  const districts = [
    'miraflores', 'san isidro', 'surco', 'santiago de surco',
    'san borja', 'la molina', 'barranco', 'lince', 'jesus maria',
    'magdalena', 'pueblo libre', 'san miguel', 'chorrillos',
    'ate', 'santa anita', 'los olivos', 'san martin de porres',
  ];
  for (const d of districts) {
    if (lower.includes(d)) {
      return d === 'santiago de surco' ? 'Surco' : d.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  // Si no encuentra distrito, tomar las primeras palabras
  const parts = address.split(',');
  return parts.length > 1 ? parts[parts.length - 2].trim().slice(0, 20) : '';
}

export default function KanbanCard({ business, index, onAction }: KanbanCardProps) {
  const district = extractDistrict(business.address);
  const hasWhatsapp = business.contact_actions?.includes('whatsapp');
  const hasEmail = business.contact_actions?.includes('email');
  const hasCall = business.contact_actions?.includes('call');
  const hasAnyContact = hasWhatsapp || hasEmail || hasCall;

  // Formatear días desde contacto
  const daysText = business.daysSinceContact !== null
    ? business.daysSinceContact === 0
      ? 'hoy'
      : business.daysSinceContact === 1
        ? 'hace 1 día'
        : `hace ${business.daysSinceContact} días`
    : null;

  return (
    <Draggable draggableId={business.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            bg-white rounded-lg border p-3 mb-2 cursor-grab
            transition-shadow hover:shadow-md
            ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400 rotate-2' : 'shadow-sm'}
          `}
        >
          {/* Nombre del negocio */}
          <h4 className="font-medium text-gray-900 text-sm truncate" title={business.name}>
            {business.name}
          </h4>

          {/* Distrito y tipo de negocio */}
          <div className="flex items-center gap-2 mt-1">
            {district && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {district}
              </span>
            )}
            {business.business_type && (
              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={business.business_type}>
                {business.business_type.split(' ').slice(0, 2).join(' ')}
              </span>
            )}
          </div>

          {/* Acciones realizadas y tiempo */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              {hasWhatsapp && (
                <span className="w-5 h-5 flex items-center justify-center bg-green-100 text-green-600 rounded text-xs" title="WhatsApp enviado">
                  📱
                </span>
              )}
              {hasEmail && (
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded text-xs" title="Email enviado">
                  📧
                </span>
              )}
              {hasCall && (
                <span className="w-5 h-5 flex items-center justify-center bg-amber-100 text-amber-600 rounded text-xs" title="Llamada realizada">
                  📞
                </span>
              )}
              {!hasAnyContact && (
                <span className="text-xs text-gray-400">Sin contacto</span>
              )}
            </div>

            {daysText && (
              <span className={`text-xs ${business.daysSinceContact && business.daysSinceContact >= 3 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                {daysText}
              </span>
            )}
          </div>

          {/* Rating si existe */}
          {business.rating && business.rating > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs text-yellow-500">★</span>
              <span className="text-xs text-gray-500">{business.rating.toFixed(1)}</span>
            </div>
          )}

          {/* Botones de acción rápida (hover) */}
          {onAction && (
            <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onAction(business.id, 'whatsapp'); }}
                className="flex-1 text-xs py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded transition-colors"
              >
                📱
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAction(business.id, 'email'); }}
                className="flex-1 text-xs py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors"
              >
                📧
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAction(business.id, 'call'); }}
                className="flex-1 text-xs py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors"
              >
                📞
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
