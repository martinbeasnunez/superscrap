'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ContactHistory {
  date: string;
  action: string;
  userName: string | null;
}

interface FollowUpBusiness {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  lead_status: string | null;
  contact_actions: string[];
  search_id: string;
  businessType: string;
  city: string;
  contactedByName: string | null;
  lastContactDate: string | null;
  daysSinceContact: number | null;
  contactCount: number;
  lastAction: string;
  contactHistory: ContactHistory[];
}

interface Stats {
  total: number;
  needsFollowUp: number;
  contactedToday: number;
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

// Genera el pitch de WhatsApp para follow up
function getFollowUpPitch(businessName: string, contactCount: number): string {
  if (contactCount === 1) {
    return `Hola! Soy de GetLavado, les escribi hace unos dias sobre el servicio de lavanderia para *${businessName}*.

Queria saber si tuvieron chance de revisar la propuesta?

Estamos con disponibilidad esta semana para una llamada rapida de 10 min. Que dia les funciona?`;
  } else if (contactCount === 2) {
    return `Hola! De nuevo de GetLavado para *${businessName}*.

Se que estan ocupados, pero no queria dejar pasar la oportunidad de ayudarles a optimizar sus costos de lavanderia.

Ultima vez que les escribo por este medio. Si prefieren una llamada rapida, me dicen y los contacto yo.

Que dicen?`;
  } else {
    return `Hola *${businessName}*!

Solo un ultimo follow up de GetLavado. Si no es buen momento, sin problema.

Pero si en algun momento necesitan cotizar lavanderia industrial, aqui estamos.

Saludos!`;
  }
}

// Obtiene distrito de la dirección
function getDistrict(address: string | null): string | null {
  if (!address) return null;
  const districts = ['miraflores', 'surco', 'santiago de surco', 'san borja', 'la molina', 'barranco', 'san isidro'];
  const addressLower = address.toLowerCase();
  for (const district of districts) {
    if (addressLower.includes(district)) {
      return district.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  // Extraer distrito genérico de la dirección
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  return null;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'hace menos de 1 hora';
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  if (diffDays === 1) return 'hace 1 dia';
  return `hace ${diffDays} dias`;
}

function getActionIcon(action: string): string {
  switch (action) {
    case 'whatsapp': return '📱';
    case 'email': return '📧';
    case 'call': return '📞';
    default: return '📱';
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case 'whatsapp': return 'text-green-600';
    case 'email': return 'text-red-500';
    case 'call': return 'text-blue-500';
    default: return 'text-gray-500';
  }
}

export default function SeguimientoPage() {
  const [needsFollowUp, setNeedsFollowUp] = useState<FollowUpBusiness[]>([]);
  const [contactedToday, setContactedToday] = useState<FollowUpBusiness[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState(3);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/follow-ups?days=${daysFilter}`);
        const data = await res.json();
        setNeedsFollowUp(data.needsFollowUp || []);
        setContactedToday(data.contactedToday || []);
        setStats(data.stats || null);
      } catch (error) {
        console.error('Error fetching follow-ups:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [daysFilter]);

  const markAsProspect = async (businessId: string) => {
    try {
      await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_status: 'prospect' }),
      });
      // Remover de la lista
      setNeedsFollowUp(prev => prev.filter(b => b.id !== businessId));
      setContactedToday(prev => prev.filter(b => b.id !== businessId));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const markAsDiscarded = async (businessId: string) => {
    try {
      await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_status: 'discarded' }),
      });
      // Remover de la lista
      setNeedsFollowUp(prev => prev.filter(b => b.id !== businessId));
      setContactedToday(prev => prev.filter(b => b.id !== businessId));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const registerFollowUp = async (business: FollowUpBusiness, action: string) => {
    try {
      const savedUser = localStorage.getItem('superscrap_user');
      const userId = savedUser ? JSON.parse(savedUser).id : null;

      await fetch('/api/contact-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          userId,
          actionType: action,
        }),
      });

      // Actualizar el contactCount local
      setNeedsFollowUp(prev => prev.map(b =>
        b.id === business.id
          ? { ...b, contactCount: b.contactCount + 1, lastContactDate: new Date().toISOString(), daysSinceContact: 0 }
          : b
      ));
    } catch (error) {
      console.error('Error registering follow-up:', error);
    }
  };

  const FollowUpCard = ({ business, showUrgency = true }: { business: FollowUpBusiness; showUrgency?: boolean }) => {
    const showWhatsApp = isPeruvianMobile(business.phone);
    const district = getDistrict(business.address);
    const whatsAppMessage = encodeURIComponent(getFollowUpPitch(business.name, business.contactCount));

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">{business.name}</h3>
              {showUrgency && business.daysSinceContact !== null && business.daysSinceContact >= 5 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                  Urgente
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              {district && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  {district}
                </span>
              )}
              {business.phone && (
                <>
                  <span>•</span>
                  <span>{business.phone}</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">{business.businessType}</p>
          </div>
          <div className="text-right ml-4">
            {business.lastContactDate && (
              <p className={`text-sm font-medium ${getActionColor(business.lastAction)}`}>
                {getActionIcon(business.lastAction)} {formatTimeAgo(business.lastContactDate)}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {business.contactCount === 1 ? '1er contacto' : `${business.contactCount} contactos`}
            </p>
          </div>
        </div>

        {/* Historial expandible */}
        {business.contactHistory.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setExpandedHistory(expandedHistory === business.id ? null : business.id)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <svg
                className={`w-3 h-3 transition-transform ${expandedHistory === business.id ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Ver historial
            </button>
            {expandedHistory === business.id && (
              <div className="mt-2 space-y-1 pl-4 border-l-2 border-gray-200">
                {business.contactHistory.slice(0, 5).map((h, idx) => (
                  <div key={idx} className="text-xs text-gray-500">
                    <span className={getActionColor(h.action)}>{getActionIcon(h.action)}</span>
                    {' '}{formatTimeAgo(h.date)}
                    {h.userName && <span className="text-gray-400"> por {h.userName}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Acciones rápidas */}
        <div className="flex flex-wrap gap-2">
          {showWhatsApp && (
            <a
              href={`https://wa.me/${getWhatsAppNumber(business.phone!)}?text=${whatsAppMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => registerFollowUp(business, 'whatsapp')}
              className="flex-1 min-w-[100px] px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          )}
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              onClick={() => registerFollowUp(business, 'call')}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Llamar
            </a>
          )}
          <button
            onClick={() => markAsProspect(business.id)}
            className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium"
            title="Marcar como prospecto interesado"
          >
            Prospecto
          </button>
          <button
            onClick={() => markAsDiscarded(business.id)}
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            title="Descartar"
          >
            Descartar
          </button>
          <Link
            href={`/busquedas/${business.search_id}`}
            className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            title="Ver en búsqueda original"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Seguimiento</h1>
            <p className="text-gray-500 mt-1">Leads que necesitan follow up</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/busquedas"
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Busquedas
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Nueva busqueda
            </Link>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total contactados</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-orange-200 bg-orange-50">
              <p className="text-3xl font-bold text-orange-600">{stats.needsFollowUp}</p>
              <p className="text-sm text-gray-500">Necesitan follow up</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-green-200 bg-green-50">
              <p className="text-3xl font-bold text-green-600">{stats.contactedToday}</p>
              <p className="text-sm text-gray-500">Contactados hoy</p>
            </div>
          </div>
        )}

        {/* Filtro de días */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-gray-600">Mostrar leads sin contacto hace</span>
          <select
            value={daysFilter}
            onChange={(e) => setDaysFilter(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={1}>1+ dia</option>
            <option value={2}>2+ dias</option>
            <option value={3}>3+ dias</option>
            <option value={5}>5+ dias</option>
            <option value={7}>7+ dias</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <>
            {/* Necesitan Follow Up */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Necesitan Follow Up</h2>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-sm rounded-full font-medium">
                  {needsFollowUp.length}
                </span>
              </div>
              {needsFollowUp.length > 0 ? (
                <div className="space-y-3">
                  {needsFollowUp.map((business) => (
                    <FollowUpCard key={business.id} business={business} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <p className="text-gray-500">No hay leads que necesiten follow up</p>
                  <p className="text-sm text-gray-400 mt-1">Todos los leads han sido contactados recientemente</p>
                </div>
              )}
            </section>

            {/* Contactados Hoy */}
            {contactedToday.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Contactados Hoy</h2>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-sm rounded-full font-medium">
                    {contactedToday.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {contactedToday.map((business) => (
                    <FollowUpCard key={business.id} business={business} showUrgency={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
