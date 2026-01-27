'use client';

import { useState, useEffect } from 'react';
import { KanbanBusiness, KanbanColumnId } from '@/app/api/kanban/route';
import { COLUMN_CONFIG } from './KanbanColumn';

interface LeadDetailModalProps {
  business: KanbanBusiness | null;
  onClose: () => void;
  onStageChange: (businessId: string, newStage: KanbanColumnId) => void;
  onActionRegistered: () => void;
}

interface ContactHistory {
  id: string;
  action_type: string;
  created_at: string;
  notes: string | null;
}

// Detecta si es número de celular peruano
function isPeruvianMobile(phone: string | null): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return (
    (cleaned.length === 9 && cleaned.startsWith('9')) ||
    (cleaned.length === 11 && cleaned.startsWith('519')) ||
    (cleaned.length === 12 && cleaned.startsWith('519'))
  );
}

function getWhatsAppNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('51')) return cleaned;
  return `51${cleaned}`;
}

// Pitch de WhatsApp según industria
function getWhatsAppPitch(businessName: string, businessType: string | null): string {
  const typeLower = (businessType || '').toLowerCase();

  if (typeLower.includes('hotel') || typeLower.includes('hostal')) {
    return `Hola! Les escribo de GetLavado a *${businessName}*

Caso real: Un hotel boutique en Barranco redujo su costo de lavanderia 35%. Antes tenian 2 personas lavando, ahora nadie.

Lo que hacemos:
- Sabanas y toallas impecables, siempre a tiempo
- Capacidad para alto volumen
- Servicio diario si lo necesitan

Cuantas habitaciones tienen? Les paso cotizacion sin compromiso`;
  }

  if (typeLower.includes('gym') || typeLower.includes('gimnasio') || typeLower.includes('fitness')) {
    return `Hola! Les escribo de GetLavado a *${businessName}*

Caso real: Un gimnasio en Miraflores paso de gastar S/4,200 a S/2,500 mensuales. Mismo volumen de toallas, mejor calidad.

Lo que hacemos diferente:
- Toallas siempre blancas y suaves
- Recojo y entrega en tu local
- *40% menos* que hacerlo internamente

Cuantas toallas manejan aprox? Les paso cotizacion en 24h`;
  }

  if (typeLower.includes('spa') || typeLower.includes('masaje') || typeLower.includes('wellness')) {
    return `Hola! Les escribo de GetLavado a *${businessName}*

Dato: Un spa en San Isidro nos dijo que sus clientes ahora comentan lo suave de las toallas.

El secreto de los spas premium: *tercerizan su lavanderia*.

Lo que ofrecemos:
- Blancura y suavidad de hotel 5 estrellas
- Sin preocupaciones, recogemos y entregamos

10 min para contarles como elevamos la experiencia de sus clientes?`;
  }

  if (typeLower.includes('clinic') || typeLower.includes('hospital') || typeLower.includes('medic')) {
    return `Hola! Les escribo de GetLavado a *${businessName}*

Caso: Una clinica en Surco nos eligio porque su proveedor anterior fallaba en entregas. Con nosotros: *cero fallas en 18 meses*.

En salud no hay margen de error:
- Protocolos de esterilizacion certificados
- Trazabilidad de cada pieza
- Entregas puntuales garantizadas

Les comparto nuestros protocolos?`;
  }

  if (typeLower.includes('restaurante') || typeLower.includes('comida') || typeLower.includes('cevich')) {
    return `Hola! Les escribo de GetLavado a *${businessName}*

Dato real: Un restaurante en Miraflores ahorraba S/800/mes haciendo lavanderia interna. Pero perdia 15 horas semanales de un cocinero.

Lo que hacemos:
- Manteles impecables, quitamos manchas dificiles
- Uniformes listos cuando los necesitan

Cuantos manteles/uniformes manejan? Les paso numeros`;
  }

  // Default pitch
  return `Hola! Les escribo de GetLavado a *${businessName}*

Somos lavanderia industrial con +800 clientes y 8 anos en el mercado:
- Recojo y entrega en tu local
- Tu solo apilas, nosotros hacemos el resto
- Cotizacion en 24 horas

Manejan toallas, uniformes, sabanas o manteles? Cuentenme y les paso numeros`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'hace menos de 1 hora';
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays === 1) return 'hace 1 día';
  return `hace ${diffDays} días`;
}

function getActionIcon(action: string): string {
  switch (action) {
    case 'whatsapp': return '📱';
    case 'email': return '📧';
    case 'call': return '📞';
    default: return '📝';
  }
}

export default function LeadDetailModal({ business, onClose, onStageChange, onActionRegistered }: LeadDetailModalProps) {
  const [contactHistory, setContactHistory] = useState<ContactHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showStageMenu, setShowStageMenu] = useState(false);

  useEffect(() => {
    if (business) {
      fetchContactHistory();
    }
  }, [business]);

  const fetchContactHistory = async () => {
    if (!business) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/contact-history?businessId=${business.id}`);
      if (res.ok) {
        const data = await res.json();
        setContactHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching contact history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const registerAction = async (action: 'whatsapp' | 'email' | 'call') => {
    if (!business) return;
    setActionLoading(action);

    try {
      // Obtener userId
      let userId = null;
      try {
        const savedUser = localStorage.getItem('superscrap_user');
        if (savedUser) userId = JSON.parse(savedUser).id;
      } catch {}

      await fetch('/api/contact-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          userId,
          actionType: action,
          isFollowUp: (business.contact_actions?.length || 0) > 0,
        }),
      });

      // Actualizar contact_actions
      const currentActions = business.contact_actions || [];
      if (!currentActions.includes(action)) {
        await fetch(`/api/businesses/${business.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_actions: [...currentActions, action],
          }),
        });
      }

      // Refrescar historial y notificar
      await fetchContactHistory();
      onActionRegistered();
    } catch (err) {
      console.error('Error registering action:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleWhatsAppClick = () => {
    if (!business?.phone) return;
    const pitch = getWhatsAppPitch(business.name, business.business_type);
    const url = `https://wa.me/${getWhatsAppNumber(business.phone)}?text=${encodeURIComponent(pitch)}`;
    window.open(url, '_blank');
    registerAction('whatsapp');
  };

  const handleCallClick = () => {
    if (!business?.phone) return;
    window.open(`tel:${business.phone}`, '_self');
    registerAction('call');
  };

  const handleStageChange = (newStage: KanbanColumnId) => {
    if (!business) return;
    onStageChange(business.id, newStage);
    setShowStageMenu(false);
  };

  if (!business) return null;

  const showWhatsApp = isPeruvianMobile(business.phone);
  const currentStage = (business.sales_stage || 'nuevo') as KanbanColumnId;
  const currentConfig = COLUMN_CONFIG[currentStage];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">{business.name}</h2>
            {business.business_type && (
              <p className="text-sm text-gray-500 mt-0.5">{business.business_type}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Etapa actual */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Etapa</label>
            <div className="relative mt-1">
              <button
                onClick={() => setShowStageMenu(!showStageMenu)}
                className={`w-full px-3 py-2 rounded-lg border ${currentConfig.borderColor} ${currentConfig.bgColor} ${currentConfig.color} font-medium text-left flex items-center justify-between`}
              >
                <span>{currentConfig.icon} {currentConfig.title}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showStageMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {Object.values(COLUMN_CONFIG).map((config) => (
                    <button
                      key={config.id}
                      onClick={() => handleStageChange(config.id)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                        config.id === currentStage ? 'bg-gray-50' : ''
                      }`}
                    >
                      <span>{config.icon}</span>
                      <span className={config.color}>{config.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info de contacto */}
          <div className="space-y-3 mb-4">
            {business.phone && (
              <div className="flex items-center gap-3">
                <span className="text-gray-400">📞</span>
                <span className="text-gray-900">{business.phone}</span>
              </div>
            )}
            {business.address && (
              <div className="flex items-start gap-3">
                <span className="text-gray-400">📍</span>
                <span className="text-gray-700 text-sm">{business.address}</span>
              </div>
            )}
            {business.website && (
              <div className="flex items-center gap-3">
                <span className="text-gray-400">🌐</span>
                <a
                  href={business.website.startsWith('http') ? business.website : `https://${business.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm truncate"
                >
                  {business.website}
                </a>
              </div>
            )}
            {business.rating && (
              <div className="flex items-center gap-3">
                <span className="text-gray-400">⭐</span>
                <span className="text-gray-700">{business.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Acciones</label>
            <div className="flex gap-2">
              {showWhatsApp && (
                <button
                  onClick={handleWhatsAppClick}
                  disabled={actionLoading === 'whatsapp'}
                  className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                >
                  {actionLoading === 'whatsapp' ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>📱 WhatsApp</>
                  )}
                </button>
              )}
              {business.phone && (
                <button
                  onClick={handleCallClick}
                  disabled={actionLoading === 'call'}
                  className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                >
                  {actionLoading === 'call' ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>📞 Llamar</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Historial de contactos */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Historial ({contactHistory.length})
            </label>
            {loadingHistory ? (
              <div className="text-center py-4 text-gray-400">Cargando...</div>
            ) : contactHistory.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">Sin contactos registrados</div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {contactHistory.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span>{getActionIcon(h.action_type)}</span>
                    <span className="text-gray-700 capitalize">{h.action_type}</span>
                    <span className="text-gray-400 text-xs ml-auto">{formatTimeAgo(h.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {business.contactCount} {business.contactCount === 1 ? 'contacto' : 'contactos'} realizados
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
