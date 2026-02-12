'use client';

import { useState, use } from 'react';
import { notFound } from 'next/navigation';
import { getIndustryBySlug, getLocalized, type IndustryConfig } from '@/lib/landing-config';
import { I18nProvider, useI18n, LanguageSelector } from '@/lib/i18n';

interface FormData {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  volume: string;
  frequency: string;
  currentProvider: string;
  comments: string;
}

function LandingContent({ config }: { config: IndustryConfig }) {
  const { locale, t } = useI18n();
  const loc = getLocalized(config, locale);

  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    contactName: '',
    phone: '',
    email: '',
    volume: '',
    frequency: '',
    currentProvider: 'no',
    comments: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/leads/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.businessName,
          contactName: formData.contactName,
          phone: formData.phone,
          email: formData.email,
          rooms: formData.volume,
          frequency: formData.frequency,
          currentProvider: formData.currentProvider,
          comments: formData.comments,
          source: `landing_${config.slug}`,
          businessType: config.name,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al enviar');
      }

      setSubmitted(true);
    } catch {
      setError('Hubo un error al enviar. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToForm = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-[#0890F1] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#313131] mb-3">{t('industry.success_title')}</h2>
          <p className="text-gray-600 mb-8">
            {t('industry.success_desc')}
          </p>
          <a
            href={`https://wa.me/51928113653?text=Hola!%20Acabo%20de%20solicitar%20cotización%20para%20mi%20${config.name.toLowerCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#20B038] hover:bg-[#1a9c2f] text-white font-bold py-4 px-8 rounded-full transition-all"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {t('industry.success_whatsapp')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Hero Section */}
      <div className="relative">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${config.heroImage}')` }}
        >
          <div className="absolute inset-0 bg-black/60"></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left - Content */}
            <div className="text-white">
              <div className="flex items-center justify-between mb-8">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-5 py-2 text-sm font-medium">
                  <span className="text-[#0890F1]">★</span>
                  <span>{t('landing.trust_badge')}</span>
                </div>
                <LanguageSelector />
              </div>

              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                {t('industry.hero_prefix')}{' '}
                <span className="text-[#0890F1]">{loc.namePlural}</span>
              </h1>

              <p className="text-base sm:text-xl text-white/90 mb-8 sm:mb-10 leading-relaxed">
                {loc.textiles.join(', ')} {t('industry.hero_suffix_1')}
                <span className="font-bold text-white"> {t('industry.hero_suffix_2')}</span> {t('industry.hero_suffix_3')}
              </p>

              <div className="space-y-4">
                {loc.benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#0890F1] rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-lg font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Form */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 md:p-10" id="form">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-[#313131]">{t('industry.form_title')}</h2>
                <p className="text-gray-500 mt-1">{t('industry.form_subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-[#313131] mb-2">
                    {t('industry.form_business_name')} {loc.name} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0890F1] focus:border-[#0890F1] transition-all text-[#313131]"
                    placeholder={`Ej: ${config.name} Miraflores`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#313131] mb-2">
                    {t('industry.form_your_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0890F1] focus:border-[#0890F1] transition-all text-[#313131]"
                    placeholder="Ej: María García"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#313131] mb-2">
                      {t('industry.form_phone')} *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0890F1] focus:border-[#0890F1] transition-all text-[#313131]"
                      placeholder="999 999 999"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#313131] mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0890F1] focus:border-[#0890F1] transition-all text-[#313131]"
                      placeholder="correo@empresa.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#313131] mb-2">
                      {loc.formFields.volumeLabel}
                    </label>
                    <select
                      value={formData.volume}
                      onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0890F1] focus:border-[#0890F1] transition-all text-[#313131] bg-white"
                    >
                      <option value="">{t('industry.form_select')}</option>
                      {loc.formFields.volumeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#313131] mb-2">
                      {t('industry.form_frequency')}
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0890F1] focus:border-[#0890F1] transition-all text-[#313131] bg-white"
                    >
                      <option value="">{t('industry.form_select')}</option>
                      <option value="diaria">{t('industry.form_frequency_daily')}</option>
                      <option value="3x-semana">{t('industry.form_frequency_3x')}</option>
                      <option value="2x-semana">{t('industry.form_frequency_2x')}</option>
                      <option value="semanal">{t('industry.form_frequency_weekly')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#313131] mb-3">
                    {t('industry.form_current_provider')}
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="currentProvider"
                        value="no"
                        checked={formData.currentProvider === 'no'}
                        onChange={(e) => setFormData({ ...formData, currentProvider: e.target.value })}
                        className="w-5 h-5 text-[#0890F1] border-2 border-gray-300 focus:ring-[#0890F1]"
                      />
                      <span className="text-[#313131] font-medium">{t('industry.form_no_internal')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="currentProvider"
                        value="si"
                        checked={formData.currentProvider === 'si'}
                        onChange={(e) => setFormData({ ...formData, currentProvider: e.target.value })}
                        className="w-5 h-5 text-[#0890F1] border-2 border-gray-300 focus:ring-[#0890F1]"
                      />
                      <span className="text-[#313131] font-medium">{t('industry.form_yes_have')}</span>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 px-5 py-4 rounded-2xl text-sm font-medium">
                    {t('industry.form_error')}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#0890F1] hover:bg-[#0770C5] text-white font-bold py-5 px-8 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl text-lg"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('industry.form_sending')}
                    </span>
                  ) : (
                    t('industry.form_submit')
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  {t('industry.form_disclaimer')}
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-[#313131] py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {loc.stats.map((stat, i) => (
              <div key={i}>
                <p className="text-3xl md:text-4xl font-bold text-[#0890F1]">{stat.value}</p>
                <p className="text-white/80 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery Section */}
      <div className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#313131] mb-4">
            {t('industry.gallery_title')}
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
            {t('industry.gallery_desc_prefix')} {loc.namePlural.toLowerCase()}.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {config.galleryImages.map((img, i) => (
              <div key={i} className="relative h-64 rounded-2xl overflow-hidden group">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundImage: `url('${img}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-3xl shadow-lg p-8 md:p-12 relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#0890F1] rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
              </svg>
            </div>

            <div className="text-center pt-6">
              <p className="text-xl md:text-2xl text-[#313131] leading-relaxed mb-8 italic">
                &ldquo;{loc.testimonial.quote}&rdquo;
              </p>

              <div className="flex items-center justify-center gap-4">
                <div
                  className="w-16 h-16 rounded-full bg-cover bg-center border-4 border-[#0890F1]"
                  style={{ backgroundImage: `url('${config.testimonial.image}')` }}
                />
                <div className="text-left">
                  <p className="font-bold text-[#313131]">{loc.testimonial.name}</p>
                  <p className="text-gray-500 text-sm">{loc.testimonial.role}</p>
                  <p className="text-[#0890F1] text-sm font-medium">{loc.testimonial.company}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Case Study Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#313131] mb-4">
            {t('industry.case_study_title')} {config.caseStudy.savings}
          </h2>
          <p className="text-center text-gray-500 mb-12">{loc.caseStudy.location}</p>

          <div className="bg-white rounded-3xl shadow-lg p-8 md:p-12 border-2 border-gray-100">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="p-6">
                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('industry.case_study_before')}</p>
                <p className="text-2xl md:text-3xl font-bold text-[#313131]">{loc.caseStudy.before}</p>
              </div>

              <div className="p-6 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-[#0890F1] rounded-full flex items-center justify-center mb-3">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-[#0890F1]">-{config.caseStudy.savings}</p>
              </div>

              <div className="p-6">
                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('industry.case_study_after')}</p>
                <p className="text-2xl md:text-3xl font-bold text-[#20B038]">{loc.caseStudy.after}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Process Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#313131] mb-4">
            {t('industry.process_title')}
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
            {t('industry.process_desc')}
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-[#0890F1] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-bold">
                1
              </div>
              <h3 className="text-xl font-bold text-[#313131] mb-3">{t('industry.process_step1_title')}</h3>
              <p className="text-gray-600">{t('industry.process_step1_desc')}</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-[#0890F1] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-bold">
                2
              </div>
              <h3 className="text-xl font-bold text-[#313131] mb-3">{t('industry.process_step2_title')}</h3>
              <p className="text-gray-600">{t('industry.process_step2_desc')}</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-[#0890F1] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-bold">
                3
              </div>
              <h3 className="text-xl font-bold text-[#313131] mb-3">{t('industry.process_step3_title')}</h3>
              <p className="text-gray-600">{t('industry.process_step3_desc')}</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={scrollToForm}
              className="inline-block bg-[#0890F1] hover:bg-[#0770C5] text-white font-bold py-5 px-12 rounded-full transition-all shadow-lg hover:shadow-xl text-lg"
            >
              {t('industry.process_cta')}
            </button>
          </div>
        </div>
      </div>

      {/* Pain Points Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#313131] mb-4">
            {t('industry.pain_title')}
          </h2>
          <p className="text-center text-gray-500 mb-12">
            {t('industry.pain_desc_prefix')} {loc.namePlural.toLowerCase()}
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {loc.painPoints.map((pain, i) => (
              <div key={i} className="flex items-start gap-5 p-6 bg-white rounded-2xl border-2 border-gray-100 hover:border-[#0890F1] transition-all">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-[#313131] font-semibold text-lg">{pain}</p>
                  <p className="text-[#0890F1] text-sm mt-2 font-medium">{t('industry.pain_solution')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#313131] mb-12">
            {t('industry.faq_title')}
          </h2>

          <div className="space-y-4">
            {loc.faq.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border-2 border-gray-100">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-[#313131] text-lg pr-4">{item.question}</span>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${openFaq === i ? 'bg-[#0890F1] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <svg
                      className={`w-5 h-5 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="bg-[#313131] py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t('industry.final_cta_title')}
          </h2>
          <p className="text-xl text-white/80 mb-10">
            {t('industry.final_cta_desc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={scrollToForm}
              className="inline-block bg-[#0890F1] hover:bg-[#0770C5] text-white font-bold py-5 px-12 rounded-full transition-all shadow-lg hover:shadow-xl text-lg"
            >
              {t('industry.final_cta_button')}
            </button>
            <a
              href="https://wa.me/51928113653"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 bg-[#20B038] hover:bg-[#1a9c2f] text-white font-bold py-5 px-12 rounded-full transition-all shadow-lg"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {t('industry.final_cta_whatsapp')}
            </a>
          </div>
          <p className="mt-6 text-white/60 text-sm">
            {t('industry.final_cta_disclaimer')}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black py-10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-white font-bold text-lg mb-2">GetLavado</p>
          <p className="text-gray-400">Lima, Perú | +51 928 113 653 | info@getlavado.com</p>
        </div>
      </div>
    </div>
  );
}

export default function IndustryLanding({ params }: { params: Promise<{ industria: string }> }) {
  const { industria } = use(params);
  const config = getIndustryBySlug(industria);

  if (!config) {
    notFound();
  }

  return (
    <I18nProvider>
      <LandingContent config={config} />
    </I18nProvider>
  );
}
