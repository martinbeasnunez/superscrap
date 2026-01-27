'use client';

import { useState, useEffect } from 'react';
import { KanbanBusiness, KanbanColumnId, DecisionMaker } from '@/app/api/kanban/route';
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

interface EmailModal {
  to: string;
  subject: string;
  body: string;
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

// Genera email pitch killer con FOMO y CTA
function getEmailPitch(businessName: string, businessType: string | null): { subject: string; body: string } {
  const typeLower = (businessType || '').toLowerCase();

  // Detectar industria
  let industria = 'empresa';
  let textiles = 'textiles';
  let beneficio = 'optimizar sus costos de lavandería';

  if (typeLower.includes('hotel') || typeLower.includes('hostal')) {
    industria = 'hotel';
    textiles = 'sábanas, toallas y uniformes';
    beneficio = 'mantener la experiencia 5 estrellas que sus huéspedes merecen';
  } else if (typeLower.includes('clinic') || typeLower.includes('hospital') || typeLower.includes('médic') || typeLower.includes('salud') || typeLower.includes('estetica')) {
    industria = 'centro de salud';
    textiles = 'uniformes médicos, sábanas y batas';
    beneficio = 'cumplir con los más altos estándares de higiene';
  } else if (typeLower.includes('spa') || typeLower.includes('gym') || typeLower.includes('fitness') || typeLower.includes('gimnasio')) {
    industria = 'centro de bienestar';
    textiles = 'toallas y batas';
    beneficio = 'ofrecer la experiencia premium que sus clientes esperan';
  } else if (typeLower.includes('restaurante') || typeLower.includes('comida') || typeLower.includes('cevich')) {
    industria = 'restaurante';
    textiles = 'manteles, servilletas y uniformes';
    beneficio = 'proyectar la imagen de calidad que su establecimiento merece';
  } else if (typeLower.includes('seguridad') || typeLower.includes('vigilancia')) {
    industria = 'empresa de seguridad';
    textiles = 'uniformes de su personal';
    beneficio = 'mantener la imagen profesional de sus guardias';
  }

  // Asuntos killer - generan curiosidad
  const subjects = [
    `¿Están pagando de más por lavandería? (pregunta seria)`,
    `Propuesta para reducir 40% en costos de ${textiles}`,
    `Re: Cotización lavandería industrial - propuesta especial`,
    `Pregunta rápida sobre sus ${textiles}`,
    `¿10 min esta semana? Tengo algo que mostrarles`,
  ];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];

  const body = `Hola equipo de *${businessName}* 👋

Les escribo porque aparecieron en nuestra lista de empresas que podrían estar *pagando de más* por su lavandería.

Como ${industria}, sabemos que ${textiles} son críticos para ${beneficio}. Pero... ¿cuánto les está costando mantenerlos impecables? 🤔

---
*⚠️ LA REALIDAD QUE NADIE CUENTA*

El 73% de empresas en Perú gastan hasta *40% más* de lo necesario en lavandería (ya sea con equipo interno o proveedores ineficientes).

---
*✅ LO QUE OFRECEMOS*

• 🏭 Lavandería industrial con capacidad de +2 toneladas/día
• 🚚 Recojo y entrega en SU local (ustedes no mueven un dedo)
• 💰 Hasta 40% menos que hacerlo internamente
• 🛡️ Estándares de higiene certificados

---
*🏆 ¿POR QUÉ CONFIAR EN NOSOTROS?*

+800 empresas en Perú ya lo hacen: hoteles 5 estrellas, clínicas premium, corporaciones multinacionales.

---
*🎯 MI PROPUESTA*

Una llamada de *10 minutos*.
• ❌ Si no les conviene: habrán perdido 10 minutos
• ✅ Si les conviene: podrían ahorrar *miles de soles* al mes

¿Esta semana les funciona? 📅

---

Saludos,

*Alejandro Ramos*
Business Development Executive (B2B)
GetLavado - Lavandería Industrial 🧺
📞 +51 928 113 653
🌐 getlavado.com/industrial`;

  return { subject, body };
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
  const [emailModal, setEmailModal] = useState<EmailModal | null>(null);

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

      // Actualizar contact_actions y sales_stage si es primer contacto
      const currentActions = business.contact_actions || [];
      const isFirstContact = currentActions.length === 0;
      const newActions = currentActions.includes(action) ? currentActions : [...currentActions, action];

      // Si es primer contacto y está en "nuevo", mover a "contactado"
      const updateData: Record<string, unknown> = {
        contact_actions: newActions,
        user_id: userId,
      };

      if (isFirstContact && (!business.sales_stage || business.sales_stage === 'nuevo')) {
        updateData.sales_stage = 'contactado';
      }

      await fetch(`/api/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

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

  const handleEmailClick = (email?: string) => {
    if (!business) return;
    const pitch = getEmailPitch(business.name, business.business_type);
    const targetEmail = email || (business.decision_makers?.find(dm => dm.email)?.email) || '';
    setEmailModal({ to: targetEmail, subject: pitch.subject, body: pitch.body });
    registerAction('email');
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
          {/* Thumbnail */}
          {business.thumbnail_url && (
            <div className="mb-4">
              <img
                src={business.thumbnail_url}
                alt={business.name}
                className="w-full h-32 object-cover rounded-lg"
              />
            </div>
          )}

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
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name + ' ' + business.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  {business.address}
                </a>
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
            <div className="flex items-center gap-4">
              {business.rating && (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">⭐</span>
                  <span className="text-gray-700 font-medium">{business.rating.toFixed(1)}</span>
                </div>
              )}
              {business.reviews_count && (
                <span className="text-gray-500 text-sm">({business.reviews_count} reseñas)</span>
              )}
            </div>
          </div>

          {/* Descripción */}
          {business.description && (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Descripción</label>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{business.description}</p>
            </div>
          )}

          {/* Decision Makers / Contactos */}
          {business.decision_makers && business.decision_makers.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                Contactos encontrados ({business.decision_makers.length})
              </label>
              <div className="space-y-2">
                {business.decision_makers.map((dm, idx) => {
                  const isMobile = dm.phone ? isPeruvianMobile(dm.phone) : false;
                  return (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {dm.fullName || (dm.email ? dm.email.split('@')[0] : dm.phone || 'Contacto')}
                        </p>
                        {dm.position && (
                          <p className="text-xs text-gray-500">{dm.position}</p>
                        )}
                        {dm.email && (
                          <p className="text-xs text-blue-600">{dm.email}</p>
                        )}
                        {dm.phone && (
                          <p className="text-xs text-gray-500">
                            {isMobile ? '📱' : '☎️'} {dm.phone}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {dm.linkedin && (
                          <a
                            href={dm.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="LinkedIn"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                          </a>
                        )}
                        {dm.email && (
                          <button
                            onClick={() => handleEmailClick(dm.email!)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Ver pitch de email"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        {dm.phone && isMobile && (
                          <a
                            href={`https://wa.me/${getWhatsAppNumber(dm.phone)}?text=${encodeURIComponent(getWhatsAppPitch(business.name, business.business_type))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="WhatsApp"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}
                        {dm.phone && (
                          <a
                            href={`tel:${dm.phone}`}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                            title={`Llamar: ${dm.phone}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acciones rápidas */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Acciones</label>
            <div className="flex gap-2 flex-wrap">
              {showWhatsApp && (
                <button
                  onClick={handleWhatsAppClick}
                  disabled={actionLoading === 'whatsapp'}
                  className="flex-1 min-w-[100px] px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
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
                  className="flex-1 min-w-[100px] px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                >
                  {actionLoading === 'call' ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>📞 Llamar</>
                  )}
                </button>
              )}
              <button
                onClick={() => handleEmailClick()}
                disabled={actionLoading === 'email'}
                className="flex-1 min-w-[100px] px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
              >
                {actionLoading === 'email' ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>📧 Email</>
                )}
              </button>
            </div>
          </div>

          {/* Historial de contactos */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Historial de seguimiento ({contactHistory.length})
            </label>
            {loadingHistory ? (
              <div className="text-center py-4 text-gray-400">Cargando...</div>
            ) : contactHistory.length === 0 ? (
              <div className="text-center py-6 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-2xl mb-2 block">📋</span>
                <p className="text-amber-800 font-medium">Sin contactos registrados</p>
                <p className="text-amber-600 text-xs mt-1">¡Haz tu primer contacto ahora!</p>
              </div>
            ) : (
              <>
                {/* Tip de seguimiento si solo hay 1 contacto */}
                {contactHistory.length === 1 && (
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                    💡 <strong>Tip:</strong> Un solo contacto rara vez cierra una venta. Los mejores vendedores hacen 3-5 follow-ups.
                  </div>
                )}
                {contactHistory.length >= 2 && contactHistory.length < 5 && (
                  <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                    ✅ <strong>¡Buen trabajo!</strong> {contactHistory.length} contactos. Continúa así para cerrar esta venta.
                  </div>
                )}
                {contactHistory.length >= 5 && (
                  <div className="mb-2 p-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                    🏆 <strong>¡Excelente persistencia!</strong> {contactHistory.length} contactos. Este lead tiene alta probabilidad de cierre.
                  </div>
                )}

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {contactHistory.map((h, idx) => (
                    <div key={h.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-400 text-xs font-medium">#{contactHistory.length - idx}</span>
                      <span>{getActionIcon(h.action_type)}</span>
                      <span className="text-gray-700 capitalize">{h.action_type}</span>
                      <span className="text-gray-400 text-xs ml-auto">{formatTimeAgo(h.created_at)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Recordatorio de seguimiento si hace más de 2 días */}
          {business.daysSinceContact !== null && business.daysSinceContact >= 2 && business.contactCount > 0 && (
            <div className={`mt-4 p-3 rounded-lg border-2 ${
              business.daysSinceContact >= 5
                ? 'bg-red-50 border-red-300'
                : business.daysSinceContact >= 3
                  ? 'bg-orange-50 border-orange-300'
                  : 'bg-amber-50 border-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {business.daysSinceContact >= 5 ? '🔥' : business.daysSinceContact >= 3 ? '⏰' : '⚠️'}
                </span>
                <div>
                  <p className={`font-bold text-sm ${
                    business.daysSinceContact >= 5 ? 'text-red-800' : business.daysSinceContact >= 3 ? 'text-orange-800' : 'text-amber-800'
                  }`}>
                    {business.daysSinceContact >= 5
                      ? '¡Urgente! Último contacto hace ' + business.daysSinceContact + ' días'
                      : business.daysSinceContact >= 3
                        ? 'Necesita seguimiento (' + business.daysSinceContact + ' días)'
                        : 'Han pasado ' + business.daysSinceContact + ' días'
                    }
                  </p>
                  <p className={`text-xs ${
                    business.daysSinceContact >= 5 ? 'text-red-600' : business.daysSinceContact >= 3 ? 'text-orange-600' : 'text-amber-600'
                  }`}>
                    {business.daysSinceContact >= 5
                      ? 'El interés se enfría rápido. Haz un follow-up HOY.'
                      : 'Un mensaje ahora puede mantener el interés vivo.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
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

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={() => setEmailModal(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Email Pitch</h3>
              <button
                onClick={() => setEmailModal(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-gray-500 uppercase flex-1">Para:</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(emailModal.to); }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Copiar email"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded">
                  {emailModal.to || <span className="text-gray-400 italic">No hay email disponible</span>}
                </p>
              </div>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-gray-500 uppercase flex-1">Asunto:</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(emailModal.subject); }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Copiar asunto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded">{emailModal.subject}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-gray-500 uppercase flex-1">Cuerpo:</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(emailModal.body); }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Copiar cuerpo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <div
                  className="text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: emailModal.body
                      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                      .replace(/^• /gm, '<span class="text-blue-600">&#8226;</span> ')
                      .replace(/---/g, '<hr class="my-3 border-gray-300">')
                  }}
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2 justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Para: ${emailModal.to}\nAsunto: ${emailModal.subject}\n\n${emailModal.body}`);
                  alert('Copiado al portapapeles');
                }}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Copiar todo
              </button>
              <button
                onClick={() => setEmailModal(null)}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
