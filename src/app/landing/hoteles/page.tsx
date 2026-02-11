'use client';

import { useState } from 'react';

interface FormData {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  rooms: string;
  frequency: string;
  currentProvider: string;
  comments: string;
}

export default function HotelesLanding() {
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    contactName: '',
    phone: '',
    email: '',
    rooms: '',
    frequency: '',
    currentProvider: 'no',
    comments: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/leads/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: 'landing_hoteles',
          businessType: 'Hotel',
        }),
      });

      if (!response.ok) {
        throw new Error('Error al enviar');
      }

      setSubmitted(true);
    } catch (err) {
      setError('Hubo un error al enviar. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Solicitud Recibida!</h2>
          <p className="text-gray-600 mb-6">
            Nuestro equipo te contactará en las próximas 24 horas con una cotización personalizada.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium">¿Necesitas atención inmediata?</p>
            <a
              href="https://wa.me/51928113653?text=Hola!%20Acabo%20de%20solicitar%20cotización%20para%20mi%20hotel"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-2 text-green-600 font-medium hover:text-green-700"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Content */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm mb-6">
              <span className="text-yellow-400">⭐</span>
              <span>+800 empresas confían en nosotros</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Lavandería Industrial para{' '}
              <span className="text-yellow-400">Hoteles</span>
            </h1>

            <p className="text-xl text-blue-100 mb-8">
              Sábanas, toallas y uniformes impecables. Recojo y entrega en tu hotel.
              <span className="font-semibold text-white"> Ahorra hasta 40%</span> vs hacerlo internamente.
            </p>

            {/* Benefits */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-lg">Recojo y entrega en tu hotel</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-lg">Capacidad para alto volumen</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-lg">8 años de experiencia</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-lg">Prueba 1 semana gratis</span>
              </div>
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-4 text-sm text-blue-200">
              <div className="flex -space-x-2">
                {['🏨', '🏩', '🏪'].map((emoji, i) => (
                  <div key={i} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-lg border-2 border-blue-800">
                    {emoji}
                  </div>
                ))}
              </div>
              <span>Hoteles en Lima, Cusco, Arequipa y más</span>
            </div>
          </div>

          {/* Right - Form */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Solicita tu Cotización</h2>
              <p className="text-gray-600">Respuesta en menos de 24 horas</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Hotel *
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Hotel Miraflores Plaza"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tu Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: María García"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="999 999 999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="correo@hotel.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nº de Habitaciones
                  </label>
                  <select
                    value={formData.rooms}
                    onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar</option>
                    <option value="1-20">1-20 habitaciones</option>
                    <option value="21-50">21-50 habitaciones</option>
                    <option value="51-100">51-100 habitaciones</option>
                    <option value="100+">Más de 100</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frecuencia
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar</option>
                    <option value="diaria">Diaria</option>
                    <option value="3x-semana">3 veces/semana</option>
                    <option value="2x-semana">2 veces/semana</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ¿Actualmente tienen proveedor de lavandería?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="currentProvider"
                      value="no"
                      checked={formData.currentProvider === 'no'}
                      onChange={(e) => setFormData({ ...formData, currentProvider: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700">No / Interno</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="currentProvider"
                      value="si"
                      checked={formData.currentProvider === 'si'}
                      onChange={(e) => setFormData({ ...formData, currentProvider: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700">Sí, tenemos uno</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comentarios (opcional)
                </label>
                <textarea
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Ej: Necesitamos también uniformes del personal"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Enviando...
                  </span>
                ) : (
                  '🧺 Solicitar Cotización Gratis'
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Sin compromiso. Respuesta garantizada en 24 horas.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-blue-950 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-blue-200 text-sm">
          <p className="mb-2">GetLavado - Lavandería Industrial</p>
          <p>Lima, Perú | +51 928 113 653 | info@getlavado.com</p>
        </div>
      </div>
    </div>
  );
}
