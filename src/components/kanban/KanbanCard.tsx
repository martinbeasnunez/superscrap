'use client';

import { Draggable } from '@hello-pangea/dnd';
import { KanbanBusiness } from '@/app/api/kanban/route';
import { useI18n } from '@/lib/i18n';

interface KanbanCardProps {
  business: KanbanBusiness;
  index: number;
  onClick: () => void;
  onFocusToggled?: () => void;
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

// Etiqueta corta para razón de pérdida (solo en columna "perdido")
function getLostReasonBadge(reason: string | null): { emoji: string; label: string } | null {
  switch (reason) {
    case 'precio': return { emoji: '💰', label: 'Precio' };
    case 'lavado_interno': return { emoji: '🏠', label: 'Lav. interno' };
    case 'tiene_proveedor': return { emoji: '🤝', label: 'Tiene prov.' };
    case 'mal_timing': return { emoji: '⏰', label: 'Timing' };
    case 'no_interesado': return { emoji: '🚫', label: 'No interesa' };
    case 'no_contesta': return { emoji: '📵', label: 'No contesta' };
    case 'no_decisor': return { emoji: '🚪', label: 'No decisor' };
    case 'otro': return { emoji: '❓', label: 'Otro' };
    default: return null;
  }
}

// Etiqueta corta para el canal de adquisición (solo leads manuales)
function getChannelBadge(channel: string | null): { emoji: string; label: string } | null {
  switch (channel) {
    case 'comercial': return { emoji: '🤝', label: 'Comercial' };
    case 'google_seo': return { emoji: '🌱', label: 'SEO' };
    case 'google_sem': return { emoji: '💸', label: 'SEM' };
    case 'laundryheap': return { emoji: '🧺', label: 'LH' };
    case 'getlavado_b2c': return { emoji: '🌐', label: 'B2C' };
    case 'getlavado_b2b': return { emoji: '🏢', label: 'B2B' };
    case 'referido': return { emoji: '👥', label: 'Referido' };
    case 'linkedin': return { emoji: '💼', label: 'LinkedIn' };
    case 'eventos': return { emoji: '🎪', label: 'Evento' };
    case 'otro': return { emoji: '❓', label: 'Otro' };
    default: return null;
  }
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

export default function KanbanCard({ business, index, onClick, onFocusToggled }: KanbanCardProps) {
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

  // Borde especial según urgencia (Orcas sin urgencia tienen borde azul; ⭐ pisa todo)
  const getBorderStyle = () => {
    if (business.is_focus) return 'border-l-4 border-l-yellow-400 ring-1 ring-yellow-200';
    if (urgency.level === 'critical') return 'border-l-4 border-l-red-500';
    if (urgency.level === 'urgent') return 'border-l-4 border-l-blue-500';
    if (urgency.level === 'warning') return 'border-l-4 border-l-[#E6B85E]';
    if (business.potential_tier === 'orca') return 'border-l-4 border-l-blue-400';
    return '';
  };

  const toggleFocus = async (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_focus: !business.is_focus }),
      });
      onFocusToggled?.();
    } catch (err) {
      console.error('Error toggling focus:', err);
    }
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
            relative bg-white rounded-lg border p-2.5 mb-2 cursor-pointer
            transition-all hover:shadow-md hover:border-blue-300
            ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400 rotate-1' : 'shadow-sm'}
            ${getBorderStyle()}
            ${urgency.level === 'critical' ? 'ring-1 ring-red-200' : ''}
          `}
        >
          {/* ⭐ Star button — top-right corner */}
          <button
            onClick={toggleFocus}
            onPointerDown={(e) => e.stopPropagation()}
            title={business.is_focus ? t('card.unfocus') : t('card.focus')}
            className={`absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full text-sm transition-all z-10 ${
              business.is_focus
                ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50'
                : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50 opacity-60 hover:opacity-100'
            }`}
          >
            {business.is_focus ? '⭐' : '☆'}
          </button>

          {/* Badge INBOUND - lead caliente que nos buscó */}
          {isInbound && (
            <div className="mb-2 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-300 animate-pulse">
              <span>🔥</span>
              {t('card.inbound_call_now')}
            </div>
          )}

          {/* Badge RESPONDIÓ — distingue cliente real vs bot del cliente */}
          {business.has_unread_reply && business.has_human_reply && (
            <div className="mb-1.5 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 bg-gradient-to-r from-green-50 to-emerald-100 text-green-800 border border-green-400 animate-pulse">
              <span>💬</span>
              Cliente respondió
              {business.last_reply_text && (
                <span className="font-normal truncate max-w-[140px]">• {business.last_reply_text}</span>
              )}
            </div>
          )}
          {business.has_unread_reply && !business.has_human_reply && (
            <div className="mb-1.5 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 bg-gray-100 text-gray-600 border border-gray-300">
              <span>🤖</span>
              Bot del cliente
              {business.last_reply_text && (
                <span className="font-normal truncate max-w-[140px] opacity-70">• {business.last_reply_text}</span>
              )}
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

          {/* Nombre del negocio (pr-7 reserves room for the star button) */}
          <h4 className="font-medium text-gray-900 text-sm truncate leading-tight flex items-center gap-1 pr-7" title={business.name}>
            {business.source === 'manual' && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0"
                title="Lead agregado a mano por Alejandro — sin automatización de WhatsApp"
              >
                ✋ {t('card.manual_badge')}
              </span>
            )}
            {(() => {
              const ch = getChannelBadge(business.lead_channel);
              if (!ch) return null;
              return (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-stone-100 text-stone-700 border border-stone-200 flex-shrink-0"
                  title={`Canal: ${ch.label}`}
                >
                  {ch.emoji} {ch.label}
                </span>
              );
            })()}
            {business.sales_stage === 'perdido' && (() => {
              const r = getLostReasonBadge(business.lost_reason);
              if (r) {
                return (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-50 text-red-700 border border-red-200 flex-shrink-0"
                    title={`Razón: ${r.label}`}
                  >
                    {r.emoji} {r.label}
                  </span>
                );
              }
              // Perdido sin razón → CTA muted que invita a clickear
              return (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500 border border-gray-200 flex-shrink-0"
                  title="Click para marcar la razón de pérdida"
                >
                  {t('card.lost_reason_missing')}
                </span>
              );
            })()}
            <span className="truncate">{business.name}</span>
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
              {hasWhatsapp && <span className="text-xs opacity-70" title="WhatsApp enviado">📱</span>}
              {hasEmail && <span className="text-xs opacity-70" title="Email enviado">📧</span>}
              {hasCall && <span className="text-xs opacity-70" title="Llamada realizada">📞</span>}
            </div>
          </div>

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
