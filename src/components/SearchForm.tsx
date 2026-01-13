'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProgressState {
  stage: string;
  message: string;
  current?: number;
  total?: number;
  businessName?: string;
  searchId?: string;
}

interface SearchFormProps {
  userId?: string;
}

export default function SearchForm({ userId }: SearchFormProps) {
  const router = useRouter();
  const [businessType, setBusinessType] = useState('');
  const [city, setCity] = useState('Lima');
  const [source, setSource] = useState<'google' | 'directorio'>('google');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProgress(null);

    if (!businessType.trim()) {
      setError('Ingresa el tipo de negocio');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/search-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType: businessType.trim(),
          city: city.trim(),
          userId,
          source,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error en la búsqueda');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No se pudo iniciar la lectura');
      }

      let searchId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setProgress(data);

              if (data.searchId) {
                searchId = data.searchId;
              }

              if (data.stage === 'complete' && searchId) {
                router.push(`/busquedas/${searchId}`);
                return;
              }

              if (data.stage === 'error') {
                throw new Error(data.message);
              }
            } catch (parseError) {
              // Ignorar errores de parsing de líneas vacías
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
      setProgress(null);
    }
  };

  const getProgressPercentage = () => {
    if (!progress?.total || !progress?.current) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getEstimatedTime = () => {
    if (!progress?.total || !progress?.current) return null;
    const remaining = progress.total - progress.current;
    // Estimamos ~3 segundos por negocio (scraping + análisis)
    const seconds = remaining * 3;
    if (seconds < 60) return `~${seconds} segundos`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} minuto${minutes > 1 ? 's' : ''}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selector de fuente */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buscar en
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSource('google')}
            disabled={loading}
            className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
              source === 'google'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="block text-lg mb-1">🗺️</span>
            Google Maps
            <span className="block text-xs font-normal text-gray-500 mt-1">
              Hoteles, spas, restaurantes
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSource('directorio')}
            disabled={loading}
            className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
              source === 'directorio'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="block text-lg mb-1">🏭</span>
            Directorio Industrial
            <span className="block text-xs font-normal text-gray-500 mt-1">
              Fabricas, talleres, empresas
            </span>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {source === 'google' ? 'Tipo de negocio' : 'Buscar empresas de'}
        </label>
        <input
          type="text"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder={source === 'google'
            ? "ej: hotel 5 estrellas, spa, clinica..."
            : "ej: empresa de seguridad, limpieza..."}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />

        {/* Sugerencias de búsqueda */}
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1.5">Sugerencias (ordenadas por potencial):</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {(source === 'google' ? [
              // ALTO POTENCIAL - Hospedaje grande
              'hotel 5 estrellas',
              'hotel 4 estrellas',
              'hotel boutique',
              'resort',
              'hotel spa',
              // ALTO POTENCIAL - Salud
              'hospital',
              'clinica',
              'clinica estetica',
              'clinica dental',
              'centro medico',
              'laboratorio clinico',
              // ALTO POTENCIAL - Clubs/Deportivo
              'country club',
              'club campestre',
              'club deportivo',
              'gimnasio premium',
              'bodytech',
              // ALTO POTENCIAL - Eventos
              'salon de eventos',
              'centro de convenciones',
              'catering',
              // MEDIO-ALTO - Hospedaje mediano
              'hotel 3 estrellas',
              'apart hotel',
              'hostal',
              'hospedaje',
              'albergue',
              'airbnb',
              // MEDIO-ALTO - Bienestar
              'spa',
              'sauna',
              'centro de masajes',
              'salon de belleza',
              'peluqueria',
              // MEDIO - Gastronomia
              'restaurante',
              'restaurante gourmet',
              'cevicheria',
              'chifa',
              'pizzeria',
              'cafeteria',
              // MEDIO - Otros servicios
              'lavanderia',
              'tintoreria',
              'residencia universitaria',
              'residencia adulto mayor',
              'guarderia',
              'colegio',
              'universidad',
              // BAJO - Retail/Otros
              'tienda de ropa',
              'boutique',
              'floristeria',
            ] : [
              // ALTO POTENCIAL - Servicios con uniformes
              'empresa de seguridad',
              'vigilancia',
              'empresa de limpieza',
              'servicios de limpieza',
              'empresa de transporte',
              'transporte de personal',
              'courier',
              'delivery',
              // ALTO POTENCIAL - Salud/Industrial
              'hospital',
              'clinica',
              'laboratorio',
              'laboratorio clinico',
              'farmaceutica',
              // ALTO POTENCIAL - Alimentos
              'catering',
              'concesionario de alimentos',
              'comedor industrial',
              'restaurante industrial',
              // MEDIO-ALTO - Construccion/Industria
              'constructora',
              'empresa constructora',
              'minera',
              'fabrica',
              'manufactura',
              'textil',
              'confecciones',
              // MEDIO-ALTO - Servicios
              'mantenimiento',
              'fumigacion',
              'control de plagas',
              'jardineria',
              'paisajismo',
              // MEDIO - Automotriz/Mecanica
              'taller mecanico',
              'concesionario',
              'lavado de autos',
              // MEDIO - Logistica
              'almacen',
              'operador logistico',
              'distribuidor',
              // MEDIO - Educacion/Otros
              'colegio',
              'universidad',
              'instituto',
              'call center',
              'bpo',
            ]).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setBusinessType(suggestion)}
                disabled={loading}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ciudad
        </label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="ej: Lima, Arequipa..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      {/* Info sobre detección automática */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">Detección automática:</span> La IA analizará cada negocio para identificar si necesita servicios de lavandería (uniformes, toallas, manteles, ropa de cama).
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading && progress && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="font-medium text-blue-800">{progress.message}</span>
          </div>

          {progress.total && progress.current && (
            <>
              <div className="w-full bg-blue-200 rounded-full h-2.5 mb-2">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-blue-700">
                <span>{progress.current} de {progress.total} negocios</span>
                {getEstimatedTime() && (
                  <span>Tiempo restante: {getEstimatedTime()}</span>
                )}
              </div>
              {progress.businessName && (
                <p className="text-xs text-blue-600 mt-1 truncate">
                  Analizando: {progress.businessName}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Procesando...
          </span>
        ) : (
          'Buscar negocios'
        )}
      </button>
    </form>
  );
}
