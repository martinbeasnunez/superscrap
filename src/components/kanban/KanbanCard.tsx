'use client';

import { Draggable } from '@hello-pangea/dnd';
import { KanbanBusiness } from '@/app/api/kanban/route';

interface KanbanCardProps {
  business: KanbanBusiness;
  index: number;
  onClick: () => void;
}

// Extraer distrito de la dirección
function extractDistrict(address: string | null): string {
  if (!address) return '';
  const lower = address.toLowerCase();
  const districts = [
    'miraflores', 'san isidro', 'surco', 'santiago de surco',
    'san borja', 'la molina', 'barranco', 'lince', 'jesus maria',
    'magdalena', 'pueblo libre', 'san miguel', 'chorrillos',
  ];
  for (const d of districts) {
    if (lower.includes(d)) {
      return d === 'santiago de surco' ? 'Surco' : d.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return '';
}

export default function KanbanCard({ business, index, onClick }: KanbanCardProps) {
  const district = extractDistrict(business.address);
  const hasWhatsapp = business.contact_actions?.includes('whatsapp');
  const hasEmail = business.contact_actions?.includes('email');
  const hasCall = business.contact_actions?.includes('call');

  // Formatear días desde contacto
  const daysText = business.daysSinceContact !== null
    ? business.daysSinceContact === 0
      ? 'hoy'
      : business.daysSinceContact === 1
        ? '1d'
        : `${business.daysSinceContact}d`
    : null;

  return (
    <Draggable draggableId={business.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`
            bg-white rounded-lg border p-2.5 mb-2 cursor-pointer
            transition-all hover:shadow-md hover:border-blue-300
            ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400 rotate-1' : 'shadow-sm'}
          `}
        >
          {/* Nombre del negocio */}
          <h4 className="font-medium text-gray-900 text-sm truncate leading-tight" title={business.name}>
            {business.name}
          </h4>

          {/* Info secundaria */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {district && (
                <span className="text-xs text-gray-500 truncate">
                  📍 {district}
                </span>
              )}
              {!district && business.business_type && (
                <span className="text-xs text-gray-500 truncate">
                  {business.business_type.split(' ').slice(0, 2).join(' ')}
                </span>
              )}
            </div>

            {/* Indicadores de acción y tiempo */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {hasWhatsapp && <span className="text-xs" title="WhatsApp">📱</span>}
              {hasEmail && <span className="text-xs" title="Email">📧</span>}
              {hasCall && <span className="text-xs" title="Llamada">📞</span>}
              {daysText && (
                <span className={`text-xs ml-1 ${business.daysSinceContact && business.daysSinceContact >= 3 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                  {daysText}
                </span>
              )}
            </div>
          </div>

          {/* Contactos realizados */}
          {business.contactCount > 0 && (
            <div className="mt-1 text-xs text-gray-400">
              {business.contactCount} {business.contactCount === 1 ? 'contacto' : 'contactos'}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
