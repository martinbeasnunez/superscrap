'use client';

import { Draggable } from '@hello-pangea/dnd';
import { KanbanBusiness } from '@/app/api/kanban/route';
import { useI18n } from '@/lib/i18n';

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

// Determina el nivel de urgencia de follow-up
function getFollowUpUrgency(daysSinceContact: number | null, contactCount: number, t?: (key: string) => string): {
  level: 'none' | 'ok' | 'warning' | 'urgent' | 'critical';
  message: string;
  color: string;
  bgColor: string;
  pulseColor: string;
} {
  if (daysSinceContact === null || contactCount === 0) {
    return { level: 'none', message: '', color: '', bgColor: '', pulseColor: '' };
  }

  if (daysSinceContact === 0) {
    return {
      level: 'ok',
      message: t?.('card.today') || 'Hoy',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      pulseColor: '',
    };
  }

  if (daysSinceContact === 1) {
    return {
      level: 'ok',
      message: t?.('card.yesterday') || 'Ayer',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      pulseColor: '',
    };
  }

  if (daysSinceContact === 2) {
    return {
      level: 'warning',
      message: t?.('card.2days') || '2 días',
      color: 'text-[#B8923F]',
      bgColor: 'bg-[#FFE9B3]',
      pulseColor: '',
    };
  }

  if (daysSinceContact >= 3 && daysSinceContact <= 4) {
    return {
      level: 'urgent',
      message: `${daysSinceContact}d - ${t?.('card.followup') || '¡Seguimiento!'}`,
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      pulseColor: 'animate-pulse',
    };
  }

  // 5+ días - crítico
  return {
    level: 'critical',
    message: `${daysSinceContact}d - ${t?.('card.urgent') || '¡URGENTE!'}`,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    pulseColor: 'animate-pulse',
  };
}

// Obtener label corto del resultado de llamada IA
function getAICallLabel(outcome: string | null, t?: (key: string) => string): { text: string; color: string; bg: string } {
  switch (outcome) {
    case 'wants_quote':
      return { text: `💰 ${t?.('biz.call_wants_quote') || 'Quiere cotización'}`, color: 'text-green-700', bg: 'bg-green-100' };
    case 'interested':
      return { text: `🎯 ${t?.('biz.call_interested') || 'Interesado'}`, color: 'text-blue-700', bg: 'bg-blue-100' };
    case 'not_interested':
      return { text: `❌ ${t?.('biz.call_not_interested') || 'No interesado'}`, color: 'text-gray-600', bg: 'bg-gray-100' };
    case 'callback':
      return { text: `📅 ${t?.('biz.call_later') || 'Llamar después'}`, color: 'text-[#9A7A35]', bg: 'bg-[#FFE9B3]' };
    case 'no_answer':
      return { text: `📵 ${t?.('biz.call_no_answer') || 'No contestó'}`, color: 'text-red-600', bg: 'bg-red-50' };
    case 'voicemail':
      return { text: `📭 ${t?.('card.voicemail') || 'Buzón de voz'}`, color: 'text-gray-500', bg: 'bg-gray-50' };
    default:
      return { text: `🤖 ${t?.('card.ai_call') || 'Llamada IA'}`, color: 'text-purple-700', bg: 'bg-purple-100' };
  }
}

export default function KanbanCard({ business, index, onClick }: KanbanCardProps) {
  const { t } = useI18n();
  const district = extractDistrict(business.address);
  const hasWhatsapp = business.contact_actions?.includes('whatsapp');
  const hasEmail = business.contact_actions?.includes('email');
  const hasCall = business.contact_actions?.includes('call');
  const hasAnyContact = business.contact_actions && business.contact_actions.length > 0;
  const hasAICall = business.aiCallResult?.hasAICall;
  const isInbound = business.lead_status === 'inbound';

  const urgency = getFollowUpUrgency(business.daysSinceContact, business.contactCount, t);
  const aiLabel = hasAICall ? getAICallLabel(business.aiCallResult?.outcome || null, t) : null;

  // Borde especial según urgencia (Orcas sin urgencia tienen borde azul)
  const getBorderStyle = () => {
    if (urgency.level === 'critical') return 'border-l-4 border-l-red-500';
    if (urgency.level === 'urgent') return 'border-l-4 border-l-blue-500';
    if (urgency.level === 'warning') return 'border-l-4 border-l-[#E6B85E]';
    if (business.potential_tier === 'orca') return 'border-l-4 border-l-blue-400';
    return '';
  };

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
            ${getBorderStyle()}
            ${urgency.level === 'critical' ? 'ring-1 ring-red-200' : ''}
          `}
        >
          {/* Badge INBOUND - lead caliente que nos buscó */}
          {isInbound && (
            <div className="mb-2 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-300 animate-pulse">
              <span>🔥</span>
              {t('card.inbound_call_now')}
            </div>
          )}

          {/* Orca/Delfin tier badge */}
          {business.potential_tier === 'orca' && (
            <div className="mb-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
              🐋 ORCA
              {business.estimated_revenue_min != null && business.estimated_revenue_max != null && (
                <span className="font-normal opacity-75">
                  ~S/{((business.estimated_revenue_min + business.estimated_revenue_max) / 2 / 1000).toFixed(0)}k/mes
                </span>
              )}
            </div>
          )}
          {business.potential_tier === 'delfin' && (
            <span className="mb-1.5 px-1.5 py-0.5 rounded text-[10px] text-emerald-600 bg-emerald-50 inline-block">
              🐬
            </span>
          )}

          {/* Badge de urgencia - prominente arriba */}
          {!isInbound && urgency.level !== 'none' && urgency.level !== 'ok' && (
            <div className={`mb-2 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${urgency.bgColor} ${urgency.color} ${urgency.pulseColor}`}>
              {urgency.level === 'critical' && <span>🔥</span>}
              {urgency.level === 'urgent' && <span>⏰</span>}
              {urgency.level === 'warning' && <span>⚠️</span>}
              {urgency.message}
            </div>
          )}

          {/* Nombre del negocio */}
          <h4 className="font-medium text-gray-900 text-sm truncate leading-tight" title={business.name}>
            {business.name}
          </h4>

          {/* Decision maker indicator */}
          {(() => {
            const dms = business.decision_makers;
            const primaryDM = dms && dms.length > 0
              ? dms[business.primary_dm_index ?? 0] || dms[0]
              : null;
            if (primaryDM) {
              const dmName = primaryDM.fullName || primaryDM.firstName || primaryDM.email?.split('@')[0] || 'Contacto';
              return (
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-700 font-medium truncate max-w-full">
                    👤 {dmName}{primaryDM.position ? ` · ${primaryDM.position}` : ''}
                  </span>
                </div>
              );
            }
            return (
              <div className="mt-0.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-500 font-medium">
                  {t('card.no_dm')}
                </span>
              </div>
            );
          })()}

          {/* Auto follow-up badge */}
          {business.auto_followup_enabled && (
            <div className="mt-0.5">
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 font-medium">
                🤖 {t('card.auto_followup')}
              </span>
            </div>
          )}

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

            {/* Indicadores de acción */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {hasAICall && <span className="text-sm" title="Llamada con Agente IA">🤖</span>}
              {hasWhatsapp && <span className="text-xs opacity-70" title="WhatsApp enviado">📱</span>}
              {hasEmail && <span className="text-xs opacity-70" title="Email enviado">📧</span>}
              {hasCall && !hasAICall && <span className="text-xs opacity-70" title="Llamada realizada">📞</span>}
            </div>
          </div>

          {/* Resultado de llamada IA */}
          {hasAICall && aiLabel && (
            <div className={`mt-1.5 px-2 py-1 rounded text-xs font-medium ${aiLabel.bg} ${aiLabel.color}`}>
              {aiLabel.text}
              {business.aiCallResult?.contactName && (
                <span className="font-normal opacity-80"> • {business.aiCallResult.contactName}</span>
              )}
            </div>
          )}

          {/* Contador de contactos + tiempo desde último */}
          <div className="mt-1.5 flex items-center justify-between">
            {business.contactCount > 0 ? (
              <span className="text-xs text-gray-500">
                {business.contactCount} {business.contactCount === 1 ? t('lead.contact_singular') : t('lead.contact_plural')}
              </span>
            ) : (
              <span className="text-xs text-gray-400 italic">{t('card.not_contacted')}</span>
            )}

            {urgency.level === 'ok' && hasAnyContact && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${urgency.bgColor} ${urgency.color}`}>
                ✓ {urgency.message}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
