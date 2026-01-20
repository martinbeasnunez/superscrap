'use client';

import { useState } from 'react';
import { BusinessWithAnalysis, ContactAction, LeadStatus } from '@/types';

interface BusinessCardProps {
  business: BusinessWithAnalysis;
  requiredServices: string[];
  businessType: string;
}

// Obtener userId del localStorage como fallback
function getUserIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const savedUser = localStorage.getItem('superscrap_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      return user.id || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Obtener email del usuario logueado
function getUserEmailFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const savedUser = localStorage.getItem('superscrap_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      return user.email || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Detecta si es número de celular peruano (9 dígitos empezando con 9)
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

// Genera el pitch de WhatsApp killer seller según la industria
function getWhatsAppPitch(businessName: string, businessType: string): string {
  const typeLower = businessType.toLowerCase();

  const pitches: Record<string, string> = {
    gimnasio: `Pregunta rapida para ${businessName} 🏋️

¿Cuanto estan pagando por mantener las toallas impecables?

El 73% de gimnasios en Peru gastan *40% de mas* en lavanderia (equipo interno o proveedores caros) 😱

Nosotros lavamos para +800 empresas incluyendo gimnasios top:
✅ Toallas siempre blancas, suaves, sin olor
✅ Recojo y entrega en TU local
✅ Hasta 40% menos que hacerlo ustedes

¿Les paso una cotizacion rapida? Solo necesito saber cuantas toallas manejan aprox 🧺`,

    spa: `Pregunta para ${businessName} 🧖‍♀️

¿Sus toallas y batas transmiten la experiencia premium que sus clientes esperan?

El secreto de los spas 5 estrellas: *tercerizan su lavanderia* con expertos.

Llevamos 8 años cuidando la imagen de spas premium:
✅ Blancura y suavidad de hotel de lujo
✅ Sin preocupaciones, nosotros recogemos y entregamos
✅ +800 empresas confian en nosotros

¿10 min para contarles como elevamos la experiencia de sus clientes? 💆‍♀️`,

    hotel: `Pregunta rapida para ${businessName} 🏨

¿Estan 100% satisfechos con su servicio de lavanderia actual?

Los hoteles que mas crecen en Peru tienen algo en comun: *no pierden tiempo lavando*.

Lo que ofrecemos:
✅ Sabanas y toallas impecables, siempre a tiempo
✅ Capacidad para alto volumen (2+ toneladas/dia)
✅ Hoteles lideres ya trabajan con nosotros

¿Les interesa una cotizacion sin compromiso? Solo me dicen cuantas habitaciones tienen 🛏️`,

    clinica: `Pregunta importante para ${businessName} 🏥

¿Su proveedor de lavanderia cumple con protocolos de higiene certificados?

En el sector salud, *no hay margen de error* con la limpieza.

Llevamos +8 años sirviendo a clinicas y hospitales:
✅ Protocolos de esterilizacion certificados
✅ Trazabilidad de cada pieza
✅ Cumplimiento garantizado

¿Les comparto nuestros protocolos y certificaciones? 🩺`,

    restaurante: `Pregunta para ${businessName} 🍽️

¿Cuanto tiempo pierde su equipo lavando manteles y uniformes?

El 80% de restaurantes exitosos *tercerizan la lavanderia*. ¿Por que? Mas tiempo para lo que importa: la comida.

Lo que hacemos:
✅ Manteles impecables, sin manchas imposibles
✅ Uniformes listos cuando los necesitan
✅ Servicio diario disponible

¿Hablamos 5 min sobre como simplificar su operacion? 👨‍🍳`,

    club: `Pregunta para ${businessName} ⛳

¿Como manejan la lavanderia de toallas, ropa de cama y uniformes?

Los mejores clubs del Peru nos confian sus textiles:
✅ Toallas frescas para socios exigentes
✅ Ropa de cama impecable para bungalows
✅ Uniformes del staff siempre listos

¿Les cuento como podemos ayudarlos? Solo 10 min 🏊‍♂️`,

    seguridad: `Pregunta para ${businessName} 👮

¿Sus guardias proyectan la imagen profesional que sus clientes esperan?

Un uniforme impecable = *confianza instantanea*.

Lavamos uniformes para empresas de seguridad lideres:
✅ Uniformes siempre limpios y planchados
✅ Recojo y entrega en sus locales
✅ Precios corporativos

¿Les paso una cotizacion? Solo necesito saber cuantos uniformes manejan 🛡️`,

    default: `Pregunta rapida para ${businessName} 👋

¿Estan pagando de mas por su lavanderia?

El 73% de empresas en Peru gastan *hasta 40% extra* en lavanderia sin saberlo 😱

Somos GetLavado, lavanderia industrial con +800 clientes:
✅ Recojo y entrega en tu local
✅ Hasta 40% menos que hacerlo internamente
✅ 8 años de experiencia

¿Les interesa una cotizacion rapida sin compromiso? 🧺`
  };

  for (const [key, pitch] of Object.entries(pitches)) {
    if (key !== 'default' && typeLower.includes(key)) {
      return pitch;
    }
  }

  if (typeLower.includes('gym') || typeLower.includes('fitness')) return pitches.gimnasio;
  if (typeLower.includes('wellness') || typeLower.includes('masaje')) return pitches.spa;
  if (typeLower.includes('hostal') || typeLower.includes('airbnb')) return pitches.hotel;
  if (typeLower.includes('médic') || typeLower.includes('salud')) return pitches.clinica;
  if (typeLower.includes('café') || typeLower.includes('comida')) return pitches.restaurante;
  if (typeLower.includes('club') || typeLower.includes('country') || typeLower.includes('regata')) return pitches.club;
  if (typeLower.includes('seguridad') || typeLower.includes('vigilancia')) return pitches.seguridad;

  return pitches.default;
}

function getGoogleMapsUrl(address: string, businessName: string): string {
  const query = encodeURIComponent(`${businessName} ${address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// Genera email pitch killer con FOMO y CTA
function getEmailPitch(businessName: string, businessType: string, detectedServices: string[]): { subject: string; body: string } {
  const typeLower = businessType.toLowerCase();

  // Detectar industria
  let industria = 'empresa';
  let textiles = 'textiles';
  let beneficio = 'optimizar sus costos de lavandería';

  if (typeLower.includes('hotel') || typeLower.includes('hostal')) {
    industria = 'hotel';
    textiles = 'sábanas, toallas y uniformes';
    beneficio = 'mantener la experiencia 5 estrellas que sus huéspedes merecen';
  } else if (typeLower.includes('clinic') || typeLower.includes('hospital') || typeLower.includes('médic') || typeLower.includes('salud')) {
    industria = 'centro de salud';
    textiles = 'uniformes médicos, sábanas y batas';
    beneficio = 'cumplir con los más altos estándares de higiene';
  } else if (typeLower.includes('spa') || typeLower.includes('gym') || typeLower.includes('fitness')) {
    industria = 'centro de bienestar';
    textiles = 'toallas y batas';
    beneficio = 'ofrecer la experiencia premium que sus clientes esperan';
  } else if (typeLower.includes('restaurante') || typeLower.includes('comida')) {
    industria = 'restaurante';
    textiles = 'manteles, servilletas y uniformes';
    beneficio = 'proyectar la imagen de calidad que su establecimiento merece';
  } else if (typeLower.includes('seguridad') || typeLower.includes('vigilancia')) {
    industria = 'empresa de seguridad';
    textiles = 'uniformes de su personal';
    beneficio = 'mantener la imagen profesional de sus guardias';
  } else if (typeLower.includes('limpieza') || typeLower.includes('facility')) {
    industria = 'empresa de limpieza';
    textiles = 'uniformes de su equipo';
    beneficio = 'proyectar profesionalismo en cada servicio';
  } else if (typeLower.includes('farmac') || typeLower.includes('laboratorio')) {
    industria = 'laboratorio farmacéutico';
    textiles = 'batas, uniformes y ropa de trabajo';
    beneficio = 'cumplir con los protocolos de higiene que su industria exige';
  } else if (typeLower.includes('fabrica') || typeLower.includes('industria') || typeLower.includes('planta')) {
    industria = 'planta industrial';
    textiles = 'uniformes y overoles';
    beneficio = 'mantener a su equipo con la imagen profesional que su empresa merece';
  } else if (detectedServices.includes('uniformes')) {
    textiles = 'uniformes de su personal';
    beneficio = 'mantener la imagen profesional de su equipo';
  }

  // Asuntos killer - sin nombre de empresa al inicio, generan curiosidad
  const subjects = [
    `¿Están pagando de más por lavandería? (pregunta seria)`,
    `Propuesta para reducir 40% en costos de ${textiles}`,
    `Re: Cotización lavandería industrial - propuesta especial`,
    `Pregunta rápida sobre sus ${textiles}`,
    `¿10 min esta semana? Tengo algo que mostrarles`,
    `El error que comete el 73% de empresas con su lavandería`,
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

// Copia email pitch al clipboard (asunto + cuerpo formateado)
function copyEmailToClipboard(toEmail: string, subject: string, body: string): void {
  const fullEmail = `Para: ${toEmail}
Asunto: ${subject}

${body}`;

  navigator.clipboard.writeText(fullEmail);
}

function isValidWebsite(website: string | null): boolean {
  if (!website) return false;
  if (website.length < 10) return false;
  if (website === 'http://' || website === 'https://') return false;
  return true;
}

// Migrar datos legacy a nuevo formato
function migrateContactStatus(business: BusinessWithAnalysis): ContactAction[] {
  // Si ya tiene el nuevo formato, usarlo
  if (business.contact_actions && business.contact_actions.length > 0) {
    return business.contact_actions;
  }
  // Si tiene el formato legacy, migrar
  if (business.contact_status) {
    if (business.contact_status === 'whatsapp') return ['whatsapp'];
    if (business.contact_status === 'called') return ['call'];
    if (business.contact_status === 'contacted') return ['whatsapp']; // asumimos whatsapp
  }
  return [];
}

function migrateleadStatus(business: BusinessWithAnalysis): LeadStatus {
  // Si ya tiene el nuevo formato, usarlo
  if (business.lead_status) {
    const rawStatus = business.lead_status as string;
    // Migrar 'lead' a 'prospect' y 'contacted' a 'no_contact'
    if (rawStatus === 'lead') return 'prospect';
    if (rawStatus === 'contacted') return 'no_contact';
    if (rawStatus === 'prospect') return 'prospect';
    if (rawStatus === 'discarded') return 'discarded';
  }
  return 'no_contact';
}

export default function BusinessCard({
  business,
  requiredServices,
  businessType,
}: BusinessCardProps) {
  const [contactActions, setContactActions] = useState<ContactAction[]>(
    migrateContactStatus(business)
  );
  const [leadStatus, setLeadStatus] = useState<LeadStatus>(
    migrateleadStatus(business)
  );
  const [updating, setUpdating] = useState(false);
  const [emailModal, setEmailModal] = useState<{ to: string; subject: string; body: string } | null>(null);

  const analysis = business.analysis;
  const matchPercentage = analysis?.match_percentage || 0;
  const matchPercent = Math.round(matchPercentage * 100);

  const updateBusiness = async (actions: ContactAction[], status: LeadStatus) => {
    const currentUserId = getUserIdFromStorage();

    if (!currentUserId) {
      console.error('No se encontró userId en localStorage');
      alert('Error: No se pudo identificar tu usuario. Por favor recarga la página.');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_actions: actions,
          lead_status: status,
          user_id: currentUserId
        }),
      });

      if (response.ok) {
        setContactActions(actions);
        setLeadStatus(status);
      }
    } catch (error) {
      console.error('Error updating business:', error);
    } finally {
      setUpdating(false);
    }
  };

  const toggleContactAction = (action: ContactAction) => {
    const newActions = contactActions.includes(action)
      ? contactActions.filter(a => a !== action)
      : [...contactActions, action];
    updateBusiness(newActions, leadStatus);
  };

  const updateLeadStatus = (status: LeadStatus) => {
    updateBusiness(contactActions, status);
  };

  const getMatchColor = (percent: number) => {
    if (percent >= 75) return 'bg-green-100 text-green-800 border-green-200';
    if (percent >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getMatchBadgeColor = (percent: number) => {
    if (percent >= 75) return 'bg-green-500';
    if (percent >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const showWebsite = isValidWebsite(business.website);
  const showWhatsApp = isPeruvianMobile(business.phone);

  const whatsAppMessage = showWhatsApp
    ? encodeURIComponent(getWhatsAppPitch(business.name, businessType))
    : '';

  // Colores del estado del lead
  const getLeadStatusStyle = () => {
    switch (leadStatus) {
      case 'prospect': return 'bg-green-100 text-green-800 border-green-300';
      case 'discarded': return 'bg-gray-200 text-gray-500 border-gray-300';
      default: return '';
    }
  };

  const getLeadStatusLabel = () => {
    switch (leadStatus) {
      case 'prospect': return 'Prospecto';
      case 'discarded': return 'Descartado';
      default: return null;
    }
  };

  return (
    <div
      className={`p-5 rounded-xl border-2 ${getMatchColor(matchPercent)} transition-all hover:shadow-lg ${leadStatus === 'discarded' ? 'opacity-50' : ''}`}
    >
      {/* Lead status + contact actions indicator */}
      <div className="flex flex-wrap gap-2 mb-3">
        {getLeadStatusLabel() && (
          <span className={`px-2 py-1 rounded text-xs font-medium border ${getLeadStatusStyle()}`}>
            {getLeadStatusLabel()}
          </span>
        )}
        {contactActions.includes('whatsapp') && (
          <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
            📱 WhatsApp
          </span>
        )}
        {contactActions.includes('email') && (
          <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
            📧 Email
          </span>
        )}
        {contactActions.includes('call') && (
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
            📞 Llamada
          </span>
        )}
        {business.contacted_by_name && contactActions.length > 0 && (
          <span className="text-xs text-gray-500 self-center">
            por {business.contacted_by_name}
          </span>
        )}
      </div>

      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {business.name}
          </h3>
          {business.business_type && (
            <p className="text-xs text-gray-500 mt-0.5">{business.business_type}</p>
          )}
          {business.address && (
            <a
              href={getGoogleMapsUrl(business.address, business.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline mt-1 inline-flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {business.address}
            </a>
          )}
        </div>
        <div
          className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getMatchBadgeColor(matchPercent)}`}
        >
          {matchPercent}% match
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
        {business.rating && (
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4 text-yellow-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {business.rating}
          </span>
        )}
        {business.reviews_count && (
          <span>({business.reviews_count} reseñas)</span>
        )}
        {business.phone && <span>{business.phone}</span>}
      </div>

      {analysis && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">
              Necesidades de lavandería
            </p>
            <div className="flex flex-wrap gap-2">
              {requiredServices.map((service) => {
                const serviceLower = service.toLowerCase();
                const isDetected = analysis.detected_services.some((ds) => {
                  const dsLower = ds.toLowerCase();
                  return (
                    dsLower.includes(serviceLower) ||
                    serviceLower.includes(dsLower) ||
                    (serviceLower === 'spa' && (dsLower.includes('bienestar') || dsLower.includes('relax'))) ||
                    (serviceLower === 'sauna' && dsLower.includes('vapor')) ||
                    (serviceLower === 'masajes' && (dsLower.includes('masaje') || dsLower.includes('massage'))) ||
                    (serviceLower.includes('entrenamiento') && (dsLower.includes('personal') || dsLower.includes('trainer')))
                  );
                });
                return (
                  <span
                    key={service}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      isDetected
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {isDetected ? '✓' : '✗'} {service}
                  </span>
                );
              })}
            </div>
          </div>

          {analysis.evidence && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                Análisis
              </p>
              <p className="text-sm text-gray-700">{analysis.evidence}</p>
            </div>
          )}
        </div>
      )}

      {/* Decision Makers / Contactos */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs font-medium text-gray-500 uppercase mb-2">
          Contactos encontrados
        </p>
        {business.decision_makers && business.decision_makers.length > 0 ? (
          <div className="space-y-2">
            {business.decision_makers.map((dm, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {dm.fullName || (dm.email ? dm.email.split('@')[0] : dm.phone || 'Contacto')}
                  </p>
                  {dm.email && (
                    <p className="text-xs text-gray-500 truncate">{dm.email}</p>
                  )}
                  {dm.position && (
                    <p className="text-xs text-gray-500 truncate">{dm.position}</p>
                  )}
                  {dm.phone && !dm.email && (
                    <p className="text-xs text-gray-500">{dm.phone}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
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
                    <>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(dm.email!);
                          alert('Email copiado');
                        }}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title={`Copiar solo email: ${dm.email}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          const pitch = getEmailPitch(business.name, businessType, analysis?.detected_services || []);
                          setEmailModal({ to: dm.email!, subject: pitch.subject, body: pitch.body });
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Ver pitch de email"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </>
                  )}
                  {dm.phone && (
                    <a
                      href={`tel:${dm.phone}`}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                      title={dm.phone}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            No se encontraron contactos en el sitio web
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
        {showWebsite && (
          <a
            href={business.website!}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Sitio web
          </a>
        )}
        {business.phone && (
          <a
            href={`tel:${business.phone}`}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Llamar
          </a>
        )}
        {showWhatsApp && (
          <a
            href={`https://wa.me/${getWhatsAppNumber(business.phone!)}?text=${whatsAppMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>
        )}
      </div>

      {/* Contact actions (múltiples) */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Acciones realizadas:</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => toggleContactAction('whatsapp')}
            disabled={updating}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              contactActions.includes('whatsapp')
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
            } ${updating ? 'opacity-50' : ''}`}
          >
            📱 WhatsApp
          </button>
          <button
            onClick={() => toggleContactAction('email')}
            disabled={updating}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              contactActions.includes('email')
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-red-400'
            } ${updating ? 'opacity-50' : ''}`}
          >
            📧 Email
          </button>
          <button
            onClick={() => toggleContactAction('call')}
            disabled={updating}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              contactActions.includes('call')
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            } ${updating ? 'opacity-50' : ''}`}
          >
            📞 Llamada
          </button>
        </div>
      </div>

      {/* Lead status (único) - Solo Prospecto y Descartado */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Estado:</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => updateLeadStatus('prospect')}
            disabled={updating}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              leadStatus === 'prospect'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
            } ${updating ? 'opacity-50' : ''}`}
          >
            🟢 Prospecto
          </button>
          <button
            onClick={() => updateLeadStatus('discarded')}
            disabled={updating}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              leadStatus === 'discarded'
                ? 'bg-gray-400 text-white border-gray-400'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            } ${updating ? 'opacity-50' : ''}`}
          >
            ⚫ Descartado
          </button>
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
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
                <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded">{emailModal.to}</p>
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
