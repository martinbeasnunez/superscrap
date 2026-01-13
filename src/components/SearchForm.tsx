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
  const [servicesInput, setServicesInput] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const addService = () => {
    const trimmed = servicesInput.trim().toLowerCase();
    if (trimmed && !services.includes(trimmed)) {
      setServices([...services, trimmed]);
      setServicesInput('');
    }
  };

  const removeService = (service: string) => {
    setServices(services.filter((s) => s !== service));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addService();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProgress(null);

    if (!businessType.trim()) {
      setError('Ingresa el tipo de negocio');
      return;
    }

    if (services.length === 0) {
      setError('Agrega al menos un servicio requerido');
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
          requiredServices: services,
          userId,
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de negocio
        </label>
        <input
          type="text"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="ej: gimnasios, restaurantes, spas..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Servicios requeridos
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={servicesInput}
            onChange={(e) => setServicesInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ej: sauna, masajes, toallas..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="button"
            onClick={addService}
            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Agregar
          </button>
        </div>

        {services.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {services.map((service) => (
              <span
                key={service}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {service}
                <button
                  type="button"
                  onClick={() => removeService(service)}
                  className="hover:text-blue-600"
                  disabled={loading}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
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
