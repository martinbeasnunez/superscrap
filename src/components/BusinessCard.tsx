'use client';

import { useState } from 'react';
import { BusinessWithAnalysis } from '@/types';

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

// Genera el pitch de WhatsApp según la industria
function getWhatsAppPitch(businessName: string, businessType: string): string {
  const typeLower = businessType.toLowerCase();

  const pitches: Record<string, string> = {
    gimnasio: `Hola ${businessName}!

Soy de GetLavado, especialistas en lavanderia industrial para gimnasios.

Sabemos que mantener toallas frescas e impecables para tus clientes es clave para su experiencia. Nosotros nos encargamos de eso:

- Toallas siempre blancas y sin manchas
- Recojo y entrega en tu local
- Puntualidad garantizada
- +800 empresas confian en nosotros

Te gustaria una cotizacion sin compromiso?`,

    spa: `Hola ${businessName}!

Soy de GetLavado, expertos en lavanderia para Spas de lujo.

Entendemos que cada toalla y bata debe transmitir pureza y relajacion. Ofrecemos:

- Blancura inmaculada en cada pieza
- Suavidad premium que tus clientes merecen
- Servicio puntual sin preocupaciones
- 8 anos cuidando la imagen de spas premium

Conversamos sobre como podemos elevar la experiencia de tus clientes?`,

    hotel: `Hola ${businessName}!

Soy de GetLavado, especialistas en lavanderia hotelera.

Sabemos que la primera impresion cuenta: sabanas impecables, toallas suaves, uniformes impecables.

- Blancura y confort en cada pieza
- Capacidad para alto volumen
- Entregas puntuales garantizadas
- Hoteles lideres confian en nosotros

Agendamos una llamada para cotizarte?`,

    clinica: `Hola ${businessName}!

Soy de GetLavado, expertos en lavanderia para el sector salud.

Cumplimos con los mas altos estandares de higiene y esterilizacion que tu clinica necesita:

- Protocolos de esterilizacion certificados
- Trazabilidad de cada pieza
- Puntualidad critica para tu operacion
- +8 anos sirviendo al sector salud

Te envio informacion sobre nuestros protocolos?`,

    restaurante: `Hola ${businessName}!

Soy de GetLavado, lavanderia industrial para restaurantes.

Manteles impecables, servilletas perfectas, uniformes de cocina siempre listos:

- Desmanchado profesional
- Servicio diario disponible
- Precios transparentes
- +800 negocios satisfechos

Te paso una cotizacion rapida?`,

    club: `Hola ${businessName}!

Soy de GetLavado, especialistas en lavanderia para clubs y centros recreativos.

Entendemos las necesidades de clubs con hospedaje, piscinas y areas deportivas:

- Ropa de cama impecable para sus bungalows
- Toallas siempre frescas para sus socios
- Uniformes del personal listos a tiempo
- Servicio puntual y de alta calidad

Agendamos una llamada para conocer sus necesidades?`,

    default: `Hola ${businessName}!

Soy de GetLavado, lavanderia industrial con +8 anos de experiencia.

Nos especializamos en mantener la imagen de negocios como el tuyo impecable:

- Calidad garantizada
- Puntualidad en cada entrega
- Precios competitivos
- +800 empresas confian en nosotros

Te gustaria una cotizacion personalizada?`
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

  return pitches.default;
}

function getGoogleMapsUrl(address: string, businessName: string): string {
  const query = encodeURIComponent(`${businessName} ${address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function isValidWebsite(website: string | null): boolean {
  if (!website) return false;
  if (website.length < 10) return false;
  if (website === 'http://' || website === 'https://') return false;
  return true;
}

export default function BusinessCard({
  business,
  requiredServices,
  businessType,
}: BusinessCardProps) {
  const [contactStatus, setContactStatus] = useState<string | null>(
    business.contact_status || null
  );
  const [updating, setUpdating] = useState(false);

  const analysis = business.analysis;
  const matchPercentage = analysis?.match_percentage || 0;
  const matchPercent = Math.round(matchPercentage * 100);

  const updateContactStatus = async (status: string | null) => {
    // SIEMPRE obtener userId fresco del localStorage
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
        body: JSON.stringify({ contact_status: status, user_id: currentUserId }),
      });

      if (response.ok) {
        setContactStatus(status);
      }
    } catch (error) {
      console.error('Error updating contact status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const toggleContactStatus = (status: string) => {
    if (contactStatus === status) {
      updateContactStatus(null);
    } else {
      updateContactStatus(status);
    }
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

  return (
    <div
      className={`p-5 rounded-xl border-2 ${getMatchColor(matchPercent)} transition-all hover:shadow-lg ${contactStatus ? 'opacity-80' : ''}`}
    >
      {/* Contact status indicator */}
      {contactStatus && (
        <div className="mb-3 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium inline-flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {contactStatus === 'whatsapp' && 'WhatsApp enviado'}
          {contactStatus === 'called' && 'Llamado'}
          {contactStatus === 'contacted' && 'Contactado'}
          {business.contacted_by_name && (
            <span className="text-purple-600 ml-1">por {business.contacted_by_name}</span>
          )}
        </div>
      )}

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
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(dm.email!);
                        alert('Email copiado: ' + dm.email);
                      }}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                      title={`Copiar: ${dm.email}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
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

      {/* Contact status checkboxes */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 w-full">Marcar como:</p>
        <label className={`inline-flex items-center gap-1.5 cursor-pointer ${updating ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={contactStatus === 'whatsapp'}
            onChange={() => toggleContactStatus('whatsapp')}
            disabled={updating}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-xs text-gray-700">WhatsApp enviado</span>
        </label>
        <label className={`inline-flex items-center gap-1.5 cursor-pointer ${updating ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={contactStatus === 'called'}
            onChange={() => toggleContactStatus('called')}
            disabled={updating}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-700">Llamado</span>
        </label>
        <label className={`inline-flex items-center gap-1.5 cursor-pointer ${updating ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={contactStatus === 'contacted'}
            onChange={() => toggleContactStatus('contacted')}
            disabled={updating}
            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-xs text-gray-700">Contactado</span>
        </label>
      </div>
    </div>
  );
}
