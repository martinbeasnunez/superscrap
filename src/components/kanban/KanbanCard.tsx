'use client';

import { useState, useRef } from 'react';
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

// Determina el nivel de urgencia de follow-up
function getFollowUpUrgency(daysSinceContact: number | null, contactCount: number): {
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
      message: 'Hoy',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      pulseColor: '',
    };
  }

  if (daysSinceContact === 1) {
    return {
      level: 'ok',
      message: 'Ayer',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      pulseColor: '',
    };
  }

  if (daysSinceContact === 2) {
    return {
      level: 'warning',
      message: '2 días',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      pulseColor: '',
    };
  }

  if (daysSinceContact >= 3 && daysSinceContact <= 4) {
    return {
      level: 'urgent',
      message: `${daysSinceContact}d - ¡Seguimiento!`,
      color: 'text-orange-700',
      bgColor: 'bg-orange-100',
      pulseColor: 'animate-pulse',
    };
  }

  // 5+ días - crítico
  return {
    level: 'critical',
    message: `${daysSinceContact}d - ¡URGENTE!`,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    pulseColor: 'animate-pulse',
  };
}

// Obtener label corto del resultado de llamada IA
function getAICallLabel(outcome: string | null): { text: string; color: string; bg: string } {
  switch (outcome) {
    case 'wants_quote':
      return { text: '💰 Quiere cotización', color: 'text-green-700', bg: 'bg-green-100' };
    case 'interested':
      return { text: '🎯 Interesado', color: 'text-blue-700', bg: 'bg-blue-100' };
    case 'not_interested':
      return { text: '❌ No interesado', color: 'text-gray-600', bg: 'bg-gray-100' };
    case 'callback':
      return { text: '📅 Llamar después', color: 'text-amber-700', bg: 'bg-amber-100' };
    case 'no_answer':
      return { text: '📵 No contestó', color: 'text-red-600', bg: 'bg-red-50' };
    case 'voicemail':
      return { text: '📭 Buzón de voz', color: 'text-gray-500', bg: 'bg-gray-50' };
    default:
      return { text: '🤖 Llamada IA', color: 'text-purple-700', bg: 'bg-purple-100' };
  }
}

export default function KanbanCard({ business, index, onClick }: KanbanCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const district = extractDistrict(business.address);
  const hasWhatsapp = business.contact_actions?.includes('whatsapp');
  const hasEmail = business.contact_actions?.includes('email');
  const hasCall = business.contact_actions?.includes('call');
  const hasAnyContact = business.contact_actions && business.contact_actions.length > 0;
  const hasAICall = business.aiCallResult?.hasAICall;
  const conversationId = business.aiCallResult?.conversationId;

  const urgency = getFollowUpUrgency(business.daysSinceContact, business.contactCount);
  const aiLabel = hasAICall ? getAICallLabel(business.aiCallResult?.outcome || null) : null;

  // Manejar reproducción de audio
  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que se abra el modal

    if (!conversationId) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);

    if (!audioRef.current) {
      audioRef.current = new Audio(`/api/ai-call/audio?conversationId=${conversationId}`);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.oncanplaythrough = () => {
        setIsLoading(false);
        audioRef.current?.play();
        setIsPlaying(true);
      };
      audioRef.current.onerror = () => {
        setIsLoading(false);
        setIsPlaying(false);
        alert('Error al cargar el audio');
      };
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
      setIsLoading(false);
    }
  };

  // Borde especial según urgencia
  const getBorderStyle = () => {
    if (urgency.level === 'critical') return 'border-l-4 border-l-red-500';
    if (urgency.level === 'urgent') return 'border-l-4 border-l-orange-500';
    if (urgency.level === 'warning') return 'border-l-4 border-l-amber-400';
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
          {/* Badge de urgencia - prominente arriba */}
          {urgency.level !== 'none' && urgency.level !== 'ok' && (
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
            <div className={`mt-1.5 px-2 py-1 rounded text-xs font-medium flex items-center justify-between ${aiLabel.bg} ${aiLabel.color}`}>
              <div className="truncate">
                {aiLabel.text}
                {business.aiCallResult?.contactName && (
                  <span className="font-normal opacity-80"> • {business.aiCallResult.contactName}</span>
                )}
              </div>
              {conversationId && (
                <button
                  onClick={handlePlayAudio}
                  disabled={isLoading}
                  className={`ml-2 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isPlaying
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-white/80 hover:bg-white text-gray-700'
                  } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                  title={isPlaying ? 'Pausar' : 'Escuchar llamada'}
                >
                  {isLoading ? (
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : isPlaying ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Contador de contactos + tiempo desde último */}
          <div className="mt-1.5 flex items-center justify-between">
            {business.contactCount > 0 ? (
              <span className="text-xs text-gray-500">
                {business.contactCount} {business.contactCount === 1 ? 'contacto' : 'contactos'}
              </span>
            ) : (
              <span className="text-xs text-gray-400 italic">Sin contactar</span>
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
