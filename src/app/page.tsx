import SearchForm from '@/components/SearchForm';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">SuperScrap</h1>
          <p className="text-lg text-gray-600">
            Encuentra negocios locales con los servicios que necesitas
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <SearchForm />
        </div>

        <div className="text-center mt-6">
          <Link
            href="/busquedas"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver búsquedas anteriores →
          </Link>
        </div>
      </div>
    </div>
  );
}
