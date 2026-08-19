'use client';

import { useState, useEffect, useRef } from 'react';
import { KanbanBusiness, KanbanColumnId, DecisionMaker } from '@/app/api/kanban/route';
import { useI18n } from '@/lib/i18n';
import { COLUMN_CONFIG, getColumnConfig } from './KanbanColumn';
import { getRenderedEmailTemplate } from '@/lib/email-templates';
import { getWhatsAppPitchServer } from '@/lib/whatsapp-pitch';
import { isLikelyBotReply } from '@/lib/reply-classifier';

interface LeadDetailModalProps {
  business: KanbanBusiness | null;
  currentColumn: KanbanColumnId; // La columna actual donde está la card
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

// WhatsApp pitch — uses shared function from src/lib/whatsapp-pitch.ts
const getWhatsAppPitch = getWhatsAppPitchServer;

// Genera email pitch según etapa del pipeline y número de contactos
function getEmailPitch(businessName: string, businessType: string | null, salesStage?: string, contactCount?: number): { subject: string; body: string } {
  const typeLower = (businessType || '').toLowerCase();
  const stage = salesStage || 'nuevo';
  const contacts = contactCount || 0;

  // Detectar industria
  let industria = 'empresa';
  let textiles = 'textiles';

  if (typeLower.includes('hotel') || typeLower.includes('hostal')) {
    industria = 'hotel';
    textiles = 'sábanas, toallas y uniformes';
  } else if (typeLower.includes('clinic') || typeLower.includes('hospital') || typeLower.includes('médic') || typeLower.includes('salud') || typeLower.includes('estetica')) {
    industria = 'centro de salud';
    textiles = 'uniformes médicos, sábanas y batas';
  } else if (typeLower.includes('spa') || typeLower.includes('gym') || typeLower.includes('fitness') || typeLower.includes('gimnasio')) {
    industria = 'centro de bienestar';
    textiles = 'toallas y batas';
  } else if (typeLower.includes('restaurante') || typeLower.includes('comida') || typeLower.includes('cevich')) {
    industria = 'restaurante';
    textiles = 'manteles, servilletas y uniformes';
  } else if (typeLower.includes('seguridad') || typeLower.includes('vigilancia')) {
    industria = 'empresa de seguridad';
    textiles = 'uniformes de su personal';
  }

  // Si tiene 5+ contactos, usar email de cierre sin importar el stage
  if (contacts >= 5 && !['interesado', 'cotizado', 'cliente'].includes(stage)) {
    return {
      subject: `Último mensaje - Lavandería para ${businessName}`,
      body: `Hola equipo de *${businessName}* 👋

Les he escrito varias veces sobre nuestro servicio de lavandería industrial. Entiendo que están muy ocupados.

Solo quería preguntarles directamente:

*¿Les interesa recibir una cotización?*

• Si *sí* → Con gusto se las preparo
• Si *no* → No hay problema, los dejo tranquilos

Cualquier respuesta me ayuda. ¡Gracias por su tiempo! 🙏

---

Saludos,

*Alejandro Ramos*
Business Development Executive (B2B)
GetLavado - Lavandería Industrial 🧺
📞 +51 928 113 653`
    };
  }

  // Si tiene 3-4 contactos, email más directo
  if (contacts >= 3 && !['interesado', 'cotizado', 'cliente', 'seguimiento_3'].includes(stage)) {
    return {
      subject: `Re: Lavandería industrial - ${businessName}`,
      body: `Hola equipo de *${businessName}* 👋

Les he escrito un par de veces sobre lavandería industrial para ${textiles}. Quería hacer un último seguimiento.

*¿Les gustaría que les prepare una cotización sin compromiso?*

Si ya tienen proveedor y están contentos, me encantaría saberlo. Muchas ${industria}s nos eligen porque su proveedor anterior fallaba en algo.

¿Qué les parece?

---

Saludos,

*Alejandro Ramos*
Business Development Executive (B2B)
GetLavado - Lavandería Industrial 🧺
📞 +51 928 113 653`
    };
  }

  // SEGUIMIENTO 3 - Email final, amigable pero cerrando el tema
  if (stage === 'seguimiento_3') {
    return {
      subject: `Cerrando el tema - Lavandería para ${businessName}`,
      body: `Hola equipo de *${businessName}* 👋

Les había escrito hace unas semanas sobre nuestro servicio de lavandería industrial para ${textiles}.

Entiendo que están ocupados, así que quería cerrar el tema de mi lado:

*¿Les gustaría que les prepare una cotización sin compromiso?*

Si no es el momento, no hay problema. Solo respóndanme con un "no por ahora" y los dejo tranquilos.

Pero si tienen aunque sea un poco de curiosidad, con gusto les envío números. Muchas ${industria}s como ustedes han reducido costos hasta 40%.

Quedo atento a su respuesta 🙌

---

Saludos,

*Alejandro Ramos*
Business Development Executive (B2B)
GetLavado - Lavandería Industrial 🧺
📞 +51 928 113 653`
    };
  }

  // SEGUIMIENTO 2 - Email de seguimiento urgente
  if (stage === 'seguimiento_2') {
    return {
      subject: `Re: Lavandería industrial para ${businessName}`,
      body: `Hola equipo de *${businessName}* 👋

Les escribí hace unos días sobre lavandería industrial. ¿Tuvieron chance de revisar la propuesta?

Solo quería saber si:
• ¿Ya tienen proveedor y están contentos?
• ¿Les interesa cotizar pero no es el momento?
• ¿Prefieren que los llame para explicarles mejor?

Cualquier respuesta me ayuda a saber cómo proceder.

Si ya tienen proveedor, me encantaría saber si están satisfechos o si hay algo que podríamos mejorar. Muchos clientes nos eligen porque su proveedor anterior fallaba en entregas o calidad.

¡Gracias por su tiempo! 🙏

---

Saludos,

*Alejandro Ramos*
Business Development Executive (B2B)
GetLavado - Lavandería Industrial 🧺
📞 +51 928 113 653`
    };
  }

  // SEGUIMIENTO 1 / CONTACTADO - Email de seguimiento suave
  if (stage === 'seguimiento_1' || stage === 'contactado') {
    return {
      subject: `Seguimiento: Lavandería para ${businessName}`,
      body: `Hola equipo de *${businessName}* 👋

Les escribo para hacer seguimiento a mi mensaje anterior sobre lavandería industrial.

Sé que están ocupados, pero quería recordarles que ofrecemos:

• *Recojo y entrega* en su local (ustedes no mueven un dedo)
• *Capacidad industrial* para alto volumen de ${textiles}
• *Precios competitivos* - hasta 40% menos que hacerlo internamente

¿Tienen 5 minutos esta semana para una llamada rápida? Les explico cómo funciona y les paso cotización sin compromiso.

Si prefieren, pueden responder este correo con:
1. Volumen aproximado de ${textiles} que manejan
2. Frecuencia que necesitan (diaria, 2x semana, semanal)

¡Y les preparo los números!

---

Saludos,

*Alejandro Ramos*
Business Development Executive (B2B)
GetLavado - Lavandería Industrial 🧺
📞 +51 928 113 653`
    };
  }

  // INTERESADO - Email de push hacia cotización
  if (stage === 'interesado') {
    return {
      subject: `Tu cotización de lavandería - ${businessName}`,
      body: `Hola equipo de *${businessName}* 👋

¡Qué gusto que les interese nuestro servicio!

Para prepararles una cotización personalizada, necesito algunos datos:

*1. ¿Qué tipo de textiles manejan?*
   □ Toallas
   □ Sábanas
   □ Uniformes
   □ Manteles
   □ Otros: ________

*2. ¿Volumen aproximado semanal?*
   (Ej: 50 toallas, 20 juegos de sábanas, etc.)

*3. ¿Frecuencia de recojo que necesitan?*
   □ Diaria
   □ 2-3 veces por semana
   □ Semanal

Con esa info les preparo la cotización. 📋

También podemos coordinar una visita a nuestra planta para que vean cómo trabajamos. ¡+800 empresas ya confían en nosotros!

---

Saludos,

*Alejandro Ramos*
Business Development Executive (B2B)
GetLavado - Lavandería Industrial 🧺
📞 +51 928 113 653`
    };
  }

  // COTIZADO - Email de push hacia cierre
  if (stage === 'cotizado') {
    return {
      subject: `Re: Cotización lavandería - ${businessName}`,
      body: `Hola equipo de *${businessName}* 👋

Quería hacer seguimiento a la cotización que les enviamos.

*¿Tienen alguna duda o hay algo que podamos ajustar?*

Entiendo que tomar una decisión así lleva tiempo. Para que les sea más fácil, les recuerdo que ofrecemos:

• *Prueba sin compromiso* - Pueden probar 1 semana y si no les convence, no hay costo
• *Sin contratos largos* - Trabajamos mes a mes
• *Garantía de calidad* - Si algo no está perfecto, lo repetimos sin costo

¿Qué les parece si coordinamos una fecha para hacer la primera prueba?

Pueden elegir un día de bajo volumen para empezar tranquilos. 📅

---

Saludos,

*Alejandro Ramos*
Business Development Executive (B2B)
GetLavado - Lavandería Industrial 🧺
📞 +51 928 113 653`
    };
  }

  // NUEVO - Email de primer contacto (el original)
  const subjects = [
    `¿Están pagando de más por lavandería? (pregunta seria)`,
    `Propuesta para reducir 40% en costos de ${textiles}`,
    `Pregunta rápida sobre sus ${textiles}`,
    `¿10 min esta semana? Tengo algo que mostrarles`,
  ];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];

  const body = `Hola equipo de *${businessName}* 👋

Les escribo porque aparecieron en nuestra lista de empresas que podrían estar *pagando de más* por su lavandería.

Como ${industria}, sabemos que ${textiles} son críticos. Pero... ¿cuánto les está costando mantenerlos impecables? 🤔

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
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffSecs < 60) return 'ahora';
  if (diffMins < 2) return 'hace 1 min';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours === 1) return 'hace 1 hora';
  if (diffHours < 24) return `hace ${diffHours} horas`;
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 14) return 'hace 1 semana';
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semanas`;
  return `hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`;
}

function getActionIcon(action: string, isBotReply = false): string {
  switch (action) {
    case 'whatsapp': return '✋';                 // Manual — Alejandro
    case 'auto_whatsapp': return '🤖';            // Automated — Sistema
    case 'whatsapp_reply': return isBotReply ? '🤖' : '💬';
    case 'email': return '📧';
    case 'call': return '📞';
    case 'ai_call': return '🤖';
    case 'stage_change': return '📋';
    case 'note': return '📝';
    default: return '📝';
  }
}

function getActionLabel(action: string, isBotReply = false): string {
  switch (action) {
    case 'whatsapp': return 'Alejandro envió WhatsApp';
    case 'auto_whatsapp': return 'Sistema envió WhatsApp';
    case 'whatsapp_reply': return isBotReply ? 'Bot del cliente respondió' : 'Cliente respondió';
    case 'email': return 'Email';
    case 'call': return 'Llamada';
    case 'ai_call': return 'Llamada IA';
    case 'stage_change': return 'Cambio de etapa';
    case 'note': return 'Nota';
    default: return action;
  }
}

export default function LeadDetailModal({ business, currentColumn, onClose, onStageChange, onActionRegistered }: LeadDetailModalProps) {
  const { t } = useI18n();
  const columnConfigI18n = getColumnConfig(t);

  const [contactHistory, setContactHistory] = useState<ContactHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showStageMenu, setShowStageMenu] = useState(false);
  const [emailModal, setEmailModal] = useState<EmailModal | null>(null);
  const [aiCallStatus, setAiCallStatus] = useState<'idle' | 'calling' | 'success' | 'error'>('idle');
  const [aiCallResult, setAiCallResult] = useState<{summary?: string; outcome?: string} | null>(null);

  // Audio player state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Notes (timestamped entries — each save creates a new contact_history row)
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Próxima acción — texto libre curado por el humano (estilo Partnerships)
  const [nextAction, setNextAction] = useState<string>('');
  const [nextActionSaving, setNextActionSaving] = useState(false);

  const saveNextAction = async () => {
    if (!business) return;
    setNextActionSaving(true);
    try {
      await fetch(`/api/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_action: nextAction.trim() }),
      });
      onActionRegistered();
    } catch (err) {
      console.error('Error saving next_action:', err);
    } finally {
      setNextActionSaving(false);
    }
  };

  // AI suggestion after saving a note (analyzer detected likely rejection)
  type LossSuggestion = {
    reason: 'precio' | 'lavado_interno' | 'tiene_proveedor' | 'mal_timing'
          | 'no_interesado' | 'no_contesta' | 'no_decisor' | 'otro';
    confidence: number;
    snippet: string;
  } | null;
  const [lossSuggestion, setLossSuggestion] = useState<LossSuggestion>(null);
  const [lossSuggestionApplying, setLossSuggestionApplying] = useState(false);

  // Delete confirmation state — two-step to prevent accidental deletion
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteLead = async () => {
    if (!business) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(false);
        onActionRegistered(); // refresh kanban
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Error: ${data.error || 'No se pudo eliminar'}`);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error de conexión');
    } finally {
      setDeleting(false);
    }
  };

  // AI reply suggestion state (Level 2 of auto-reply system)
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestError, setAiSuggestError] = useState<string | null>(null);
  // Re-sync when switching between leads
  useEffect(() => {
    setNewNoteText('');
    setLossSuggestion(null);
    setNextAction(business?.next_action ?? '');
  }, [business?.id]);

  const addNote = async () => {
    if (!business) return;
    const text = newNoteText.trim();
    if (!text) return;
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        setNewNoteText('');
        await fetchContactHistory();
        onActionRegistered();

        // Only analyze if lead isn't already lost (saves a roundtrip)
        const isAlreadyLost = business.sales_stage === 'perdido' || currentColumn === 'perdido';
        if (!isAlreadyLost) {
          try {
            const aRes = await fetch('/api/notes/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: text }),
            });
            if (aRes.ok) {
              const data = await aRes.json();
              if (data.reason && data.confidence >= 0.7) {
                setLossSuggestion({ reason: data.reason, confidence: data.confidence, snippet: data.snippet || '' });
              }
            }
          } catch (err) {
            console.error('Note analyzer error:', err); // non-blocking
          }
        }
      }
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setNotesSaving(false);
    }
  };

  const applyLossSuggestion = async () => {
    if (!business || !lossSuggestion) return;
    setLossSuggestionApplying(true);
    try {
      await fetch(`/api/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_stage: 'perdido',
          previous_stage: business.sales_stage || currentColumn,
          lost_reason: lossSuggestion.reason,
        }),
      });
      setLossSuggestion(null);
      onActionRegistered();
    } catch (err) {
      console.error('Error applying loss suggestion:', err);
    } finally {
      setLossSuggestionApplying(false);
    }
  };

  // USAR currentColumn (la columna donde está la card) como fuente de verdad
  // Esto garantiza que el pitch siempre refleje la posición visual de la card
  const currentStage = currentColumn;

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
        const savedUser = localStorage.getItem('orbit_user');
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
      const isFirstContact = currentActions.length === 0;
      const newActions = currentActions.includes(action) ? currentActions : [...currentActions, action];

      // Regla simple: Si está en "nuevo" y es primer contacto → mover a "contactado"
      // El resto de movimientos (interesado, perdido, etc.) solo los hace la IA
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
    // Usar currentStage que ya está calculado (incluye el fallback a 'nuevo')
    const pitch = getWhatsAppPitch(business.name, business.business_type, currentStage, business.contactCount);
    console.log('[WhatsApp] business.sales_stage:', business.sales_stage, '| currentStage:', currentStage, '| pitch type:',
      currentStage === 'seguimiento_1' || currentStage === 'seguimiento_2' || currentStage === 'contactado' ? 'FOLLOW-UP' :
      currentStage === 'interesado' ? 'PUSH-QUOTE' :
      currentStage === 'cotizado' ? 'PUSH-CLOSE' : 'FIRST-CONTACT'
    );
    const url = `https://wa.me/${getWhatsAppNumber(business.phone)}?text=${encodeURIComponent(pitch)}`;
    window.open(url, '_blank');
    registerAction('whatsapp');
  };

  const handleCallClick = () => {
    if (!business?.phone) return;
    window.open(`tel:${business.phone}`, '_self');
    registerAction('call');
  };

  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);

  const handleEmailClick = (email?: string) => {
    if (!business) return;
    const pitch = getRenderedEmailTemplate(
      business.name,
      business.business_type,
      currentStage,
      business.contactCount || 0,
      business.last_email_template_id,
    );
    setCurrentTemplateId(pitch.id);
    const targetEmail = email || (business.decision_makers?.find(dm => dm.email)?.email) || '';
    setEmailModal({ to: targetEmail, subject: pitch.subject, body: pitch.body });
    registerAction('email');
    // Track which template was used
    fetch(`/api/businesses/${business.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_email_template_id: pitch.id }),
    }).catch(() => {});
  };

  const handleRegenerateEmail = () => {
    if (!business || !emailModal) return;
    const pitch = getRenderedEmailTemplate(
      business.name,
      business.business_type,
      currentStage,
      business.contactCount || 0,
      currentTemplateId,
    );
    setCurrentTemplateId(pitch.id);
    setEmailModal({ ...emailModal, subject: pitch.subject, body: pitch.body });
    // Track new template
    fetch(`/api/businesses/${business.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_email_template_id: pitch.id }),
    }).catch(() => {});
  };

  const handleStageChange = (newStage: KanbanColumnId) => {
    if (!business) return;
    onStageChange(business.id, newStage);
    setShowStageMenu(false);
  };

  const handleAICall = async () => {
    if (!business?.phone) return;
    setAiCallStatus('calling');
    setAiCallResult(null);

    // Buscar si hay resumen de llamada IA anterior
    const lastAICall = contactHistory.find(h => h.notes?.startsWith('🤖'));
    const lastAICallSummary = lastAICall?.notes || null;

    // IMPORTANTE: Usar currentStage (posición visual de la card) como fuente de verdad
    // Esto garantiza que el pitch refleje la columna donde está la card, no el valor en DB
    console.log('[AI Call] Using currentStage for pitch:', currentStage, '| (DB sales_stage:', business.sales_stage, ')');

    try {
      const res = await fetch('/api/ai-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          phoneNumber: business.phone,
          businessName: business.name,
          businessType: business.business_type,
          // CORREGIDO: Usar currentStage (columna visual) en vez de business.sales_stage (DB)
          salesStage: currentStage,
          contactCount: business.contactCount,
          lastAICallSummary,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAiCallStatus('success');
        // Registrar como acción de contacto
        await fetchContactHistory();
        onActionRegistered();

        // Esperar y consultar resultado después de que termine la llamada
        // Consultar cada 30 segundos por 5 minutos max
        const conversationId = data.conversation_id;
        if (conversationId) {
          pollForResult(conversationId);
        }
      } else {
        console.error('AI Call error:', data);
        setAiCallStatus('error');
        setTimeout(() => setAiCallStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('AI Call error:', err);
      setAiCallStatus('error');
      setTimeout(() => setAiCallStatus('idle'), 3000);
    }
  };

  // Reproducir audio de llamada IA
  const handlePlayAudio = (conversationId: string) => {
    // Si ya está reproduciéndose este audio, pausar
    if (playingAudioId === conversationId && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    // Si hay otro audio reproduciéndose, detenerlo
    if (audioRef.current) {
      audioRef.current.pause();
    }

    setAudioLoading(conversationId);

    // Crear nuevo elemento de audio
    const audio = new Audio(`/api/ai-call/audio?conversationId=${conversationId}`);
    audioRef.current = audio;

    audio.oncanplaythrough = () => {
      setAudioLoading(null);
      audio.play();
      setPlayingAudioId(conversationId);
    };

    audio.onended = () => {
      setPlayingAudioId(null);
    };

    audio.onerror = () => {
      setAudioLoading(null);
      setPlayingAudioId(null);
      alert(t('lead.audio_error'));
    };

    audio.load();
  };

  // Consultar resultado de la llamada periódicamente
  const pollForResult = async (conversationId: string) => {
    let attempts = 0;
    const maxAttempts = 20; // 10 minutos (30s x 20)

    const checkResult = async () => {
      attempts++;
      console.log(`[AI Call] Polling attempt ${attempts} for conversation ${conversationId}`);

      try {
        const res = await fetch(`/api/ai-call/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            businessId: business?.id,
          }),
        });

        const result = await res.json();
        console.log('[AI Call] Poll result:', result);

        if (res.ok && result.success) {
          // La llamada terminó exitosamente
          console.log('[AI Call] Call completed! Outcome:', result.outcome);
          setAiCallResult({
            summary: result.summary,
            outcome: result.outcome,
          });
          // Refrescar historial y datos
          await fetchContactHistory();
          if (result.salesStageUpdated) {
            onActionRegistered();
          }
          return; // Parar polling
        }

        // Si la API dice que aún está en progreso, continuar polling
        if (result.message === 'Conversación aún en progreso') {
          console.log('[AI Call] Conversation still in progress...');
        }

        // Si hubo error 404, la conversación aún está en progreso
        // Continuar polling si no ha terminado
        if (attempts < maxAttempts) {
          const delay = attempts < 4 ? 15000 : 30000; // Más rápido al inicio
          console.log(`[AI Call] Will retry in ${delay/1000}s`);
          setTimeout(checkResult, delay);
        } else {
          console.log('[AI Call] Max attempts reached, stopping poll');
        }
      } catch (err) {
        console.error('[AI Call] Error polling result:', err);
        if (attempts < maxAttempts) {
          setTimeout(checkResult, 30000);
        }
      }
    };

    // Primera consulta después de 15 segundos (las llamadas pueden ser cortas)
    setTimeout(checkResult, 15000);
  };

  if (!business) return null;

  const showWhatsApp = isPeruvianMobile(business.phone);
  const currentConfig = columnConfigI18n[currentStage];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await fetch(`/api/businesses/${business.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_focus: !business.is_focus }),
                  });
                  onActionRegistered();
                }}
                title={business.is_focus ? t('card.unfocus') : t('card.focus')}
                className={`text-xl leading-none transition-transform hover:scale-110 ${
                  business.is_focus ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                }`}
              >
                {business.is_focus ? '⭐' : '☆'}
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{business.name}</h2>
            </div>
            {business.business_type && (
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{business.business_type}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 sm:ml-4 p-1.5 sm:p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 overflow-y-auto max-h-[calc(95vh-160px)] sm:max-h-[calc(90vh-180px)]">
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
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('lead.stage')}</label>
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
                  {Object.values(columnConfigI18n).map((config) => (
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

          {/* Próxima acción — texto libre curado por el humano (el bot no la toca) */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">
              → Próxima acción
            </label>
            <div className="flex items-center gap-2">
              <input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); saveNextAction(); }
                }}
                placeholder="ej. mandar propuesta, llamar jueves…"
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none bg-white"
              />
              <button
                onClick={saveNextAction}
                disabled={nextActionSaving || nextAction.trim() === (business.next_action ?? '')}
                className="text-xs px-2.5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex-shrink-0"
              >
                {nextActionSaving ? '⏳' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Orca/Delfin Scoring */}
          {business.potential_tier && business.potential_tier !== 'unknown' && (
            <div className={`mb-4 p-3 rounded-lg border-2 ${
              business.potential_tier === 'orca'
                ? 'bg-blue-50 border-blue-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-base">
                  {business.potential_tier === 'orca' ? '🐋 ORCA' : '🐬 DELFIN'}
                </span>
                <span className="text-xs font-medium text-gray-500">
                  Score: {business.potential_score}/100
                </span>
              </div>
              {business.estimated_revenue_min != null && business.estimated_revenue_max != null && (
                <p className={`text-sm font-medium ${
                  business.potential_tier === 'orca' ? 'text-blue-700' : 'text-emerald-700'
                }`}>
                  Revenue estimado: S/{business.estimated_revenue_min.toLocaleString()} - S/{business.estimated_revenue_max.toLocaleString()}/mes
                </p>
              )}
            </div>
          )}

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

          {/* Decision Makers / Contactos - ELEVATED (v2) */}
          {(!business.decision_makers || business.decision_makers.length === 0) && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
              <p className="text-sm font-bold text-red-700">{t('lead.no_dm_warning')}</p>
              <p className="text-xs text-red-500 mt-1">{t('lead.no_dm_hint')}</p>
            </div>
          )}

          {business.decision_makers && business.decision_makers.length > 0 && (
            <div className={`mb-4 border-l-4 ${business.decision_makers.length > 0 ? 'border-green-400' : 'border-red-400'} pl-3`}>
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2 block">
                {t('biz.contacts')} ({business.decision_makers.length})
              </label>
              <div className="space-y-2">
                {business.decision_makers.map((dm, idx) => {
                  const isMobile = dm.phone ? isPeruvianMobile(dm.phone) : false;
                  const isPrimary = idx === (business.primary_dm_index ?? 0);
                  return (
                    <div key={idx} className={`flex items-center justify-between rounded-lg p-2 sm:p-3 ${isPrimary ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Primary contact star */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newIdx = idx;
                            fetch(`/api/businesses/${business.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ primary_dm_index: newIdx }),
                            }).then(() => onActionRegistered()).catch(() => {});
                          }}
                          className={`flex-shrink-0 text-lg ${isPrimary ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                          title={t('lead.set_primary')}
                        >
                          {isPrimary ? '★' : '☆'}
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                            {dm.fullName || (dm.email ? dm.email.split('@')[0] : dm.phone || 'Contacto')}
                            {isPrimary && <span className="ml-1 text-[10px] text-green-600 font-normal">({t('lead.primary_contact')})</span>}
                          </p>
                          {dm.position && (
                            <p className="text-[10px] sm:text-xs text-gray-500 truncate">{dm.position}</p>
                          )}
                          {dm.email && (
                            <p className="text-[10px] sm:text-xs text-blue-600 truncate">{dm.email}</p>
                          )}
                          {dm.phone && (
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              {isMobile ? '📱' : '☎️'} {dm.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 ml-1 sm:ml-2 flex-shrink-0">
                        {dm.linkedin && (
                          <a
                            href={dm.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="LinkedIn"
                          >
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                          </a>
                        )}
                        {dm.email && (
                          <button
                            onClick={() => handleEmailClick(dm.email!)}
                            className="p-1 sm:p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Ver pitch de email"
                          >
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        {dm.phone && isMobile && (
                          <a
                            href={`https://wa.me/${getWhatsAppNumber(dm.phone)}?text=${encodeURIComponent(getWhatsAppPitch(business.name, business.business_type, currentStage, business.contactCount))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 sm:p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}
                        {dm.phone && (
                          <a
                            href={`tel:${dm.phone}`}
                            className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                            title={`Llamar: ${dm.phone}`}
                          >
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Descripcion */}
          {business.description && (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">{t('lead.description')}</label>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{business.description}</p>
            </div>
          )}

          {/* Acciones rápidas */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">{t('lead.actions')}</label>
            <div className="grid grid-cols-3 gap-2">
              {showWhatsApp && (
                <button
                  onClick={handleWhatsAppClick}
                  disabled={actionLoading === 'whatsapp'}
                  className="px-2 sm:px-4 py-2 sm:py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-1 sm:gap-2 font-medium disabled:opacity-50 text-sm sm:text-base"
                >
                  {actionLoading === 'whatsapp' ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>📱 <span className="hidden sm:inline">WhatsApp</span><span className="sm:hidden">WA</span></>
                  )}
                </button>
              )}
              {business.phone && (
                <button
                  onClick={handleCallClick}
                  disabled={actionLoading === 'call'}
                  className="px-2 sm:px-4 py-2 sm:py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1 sm:gap-2 font-medium disabled:opacity-50 text-sm sm:text-base"
                >
                  {actionLoading === 'call' ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>📞 <span className="hidden sm:inline">{t('biz.call')}</span></>
                  )}
                </button>
              )}
              <button
                onClick={() => handleEmailClick()}
                disabled={actionLoading === 'email'}
                className="px-2 sm:px-4 py-2 sm:py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-1 sm:gap-2 font-medium disabled:opacity-50 text-sm sm:text-base"
              >
                {actionLoading === 'email' ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>📧 <span className="hidden sm:inline">Email</span></>
                )}
              </button>
            </div>

            {/* Kapso send + auto follow-up */}
            {showWhatsApp && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={async () => {
                    if (!business?.phone || actionLoading === 'kapso') return;
                    setActionLoading('kapso');
                    try {
                      const pitch = getWhatsAppPitch(business.name, business.business_type, currentStage, business.contactCount);
                      const res = await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          businessId: business.id,
                          phone: business.phone,
                          message: pitch,
                        }),
                      });
                      if (res.ok) {
                        alert('✅ WhatsApp enviado por Kapso');
                        onActionRegistered();
                        await fetchContactHistory();
                      } else {
                        const data = await res.json().catch(() => ({}));
                        alert(`❌ Error enviando WhatsApp: ${data.error || 'Error desconocido'}`);
                      }
                    } catch (err) {
                      console.error('Kapso send error:', err);
                      alert('❌ Error de conexión con Kapso');
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  disabled={actionLoading === 'kapso'}
                  className="flex-1 px-3 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1 font-medium disabled:opacity-50"
                >
                  {actionLoading === 'kapso' ? <span className="animate-spin">⏳</span> : <>{t('lead.send_kapso')}</>}
                </button>
                {(() => {
                  const isManual = business.source === 'manual';
                  const toggle = async () => {
                    const nextManual = !isManual;
                    await fetch(`/api/businesses/${business.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        source: nextManual ? 'manual' : 'auto',
                        auto_followup_enabled: !nextManual,
                      }),
                    });
                    onActionRegistered();
                  };
                  return (
                    <button
                      onClick={toggle}
                      title={isManual ? t('lead.mode_manual_desc') : t('lead.mode_auto_desc')}
                      className={`px-3 py-2 text-sm rounded-lg transition-all flex items-center gap-1.5 font-medium border ${
                        isManual
                          ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                          : 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'
                      }`}
                    >
                      <span className="text-base leading-none">{isManual ? '✋' : '🤖'}</span>
                      <span>{isManual ? t('lead.mode_manual') : t('lead.mode_auto')}</span>
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Channel selector — only for manual leads */}
            {business.source === 'manual' && (
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-600 mb-1.5">{t('lead.channel')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    'comercial', 'google_seo', 'google_sem', 'laundryheap',
                    'getlavado_b2c', 'getlavado_b2b', 'referido',
                    'linkedin', 'eventos', 'otro',
                  ] as const).map((c) => {
                    const active = business.lead_channel === c;
                    return (
                      <button
                        key={c}
                        onClick={async () => {
                          if (active) return;
                          await fetch(`/api/businesses/${business.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lead_channel: c }),
                          });
                          onActionRegistered();
                        }}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-300'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {t(`manual.channel_${c}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI-Suggested Reply (Level 2) — only show if customer has replied */}
            {showWhatsApp && business.has_human_reply && (
              <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                    ✨ Borrador IA
                  </span>
                  <button
                    onClick={async () => {
                      setAiSuggestLoading(true);
                      setAiSuggestError(null);
                      try {
                        const res = await fetch('/api/whatsapp/suggest-reply', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ businessId: business.id }),
                        });
                        const data = await res.json();
                        if (res.ok && data.suggestion) {
                          setAiSuggestion(data.suggestion);
                        } else {
                          setAiSuggestError(data.error || 'Error generando borrador');
                        }
                      } catch (err) {
                        setAiSuggestError('Error de conexión');
                      } finally {
                        setAiSuggestLoading(false);
                      }
                    }}
                    disabled={aiSuggestLoading}
                    className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {aiSuggestLoading ? '⏳ Pensando…' : aiSuggestion ? '🔄 Regenerar' : '✨ Sugerir respuesta'}
                  </button>
                </div>

                {aiSuggestError && (
                  <p className="text-xs text-red-600 mb-2">⚠️ {aiSuggestError}</p>
                )}

                {aiSuggestion && (
                  <>
                    <textarea
                      value={aiSuggestion}
                      onChange={(e) => setAiSuggestion(e.target.value)}
                      rows={5}
                      className="w-full p-2 text-sm border border-purple-200 rounded resize-y bg-white focus:outline-none focus:border-purple-400"
                      placeholder="Edita el borrador antes de enviar…"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={async () => {
                          if (!business?.phone || !aiSuggestion.trim()) return;
                          setActionLoading('ai-send');
                          try {
                            const res = await fetch('/api/whatsapp/send', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                businessId: business.id,
                                phone: business.phone,
                                message: aiSuggestion.trim(),
                              }),
                            });
                            if (res.ok) {
                              setAiSuggestion('');
                              alert('✅ Respuesta enviada por Kapso');
                              onActionRegistered();
                              await fetchContactHistory();
                            } else {
                              const data = await res.json().catch(() => ({}));
                              alert(`❌ Error: ${data.error || 'Error enviando'}`);
                            }
                          } finally {
                            setActionLoading(null);
                          }
                        }}
                        disabled={actionLoading === 'ai-send' || !aiSuggestion.trim()}
                        className="flex-1 px-3 py-1.5 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 font-medium"
                      >
                        {actionLoading === 'ai-send' ? '⏳ Enviando…' : '📤 Enviar borrador'}
                      </button>
                      <button
                        onClick={() => setAiSuggestion('')}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Boton de Llamada con IA - OCULTO TEMPORALMENTE */}
          </div>

          {/* Notas del lead — feed cronológico (cada guardado = nueva nota) */}
          {(() => {
            const pastNotes = contactHistory
              .filter(h => h.action_type === 'note')
              .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
            const formatDate = (iso: string) => {
              try {
                const d = new Date(iso);
                const now = new Date();
                const sameDay = d.toDateString() === now.toDateString();
                const opts: Intl.DateTimeFormatOptions = sameDay
                  ? { hour: '2-digit', minute: '2-digit' }
                  : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
                return d.toLocaleString('es-PE', opts);
              } catch { return ''; }
            };
            return (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <span>📝 {t('lead.notes_title')}</span>
                    {pastNotes.length > 0 && (
                      <span className="text-[10px] normal-case text-gray-400">{pastNotes.length}</span>
                    )}
                  </label>
                </div>
                {/* AI suggestion: detected likely rejection in the just-saved note */}
                {lossSuggestion && (
                  <div className="mb-3 p-3 rounded-lg border-2 border-amber-300 bg-amber-50 animate-pulse-once">
                    <div className="flex items-start gap-2">
                      <span className="text-xl leading-none mt-0.5">💡</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-amber-900">
                          {t('lead.ai_loss_suggestion')}{' '}
                          <span className="font-bold">{t(`lead.lost_reason_${lossSuggestion.reason}`)}</span>
                        </div>
                        {lossSuggestion.snippet && (
                          <div className="text-[11px] text-amber-700 italic mt-0.5 line-clamp-2">
                            "{lossSuggestion.snippet}"
                          </div>
                        )}
                        <div className="text-[10px] text-amber-600 mt-1">
                          {t('lead.ai_loss_confidence')}: {Math.round(lossSuggestion.confidence * 100)}%
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={applyLossSuggestion}
                            disabled={lossSuggestionApplying}
                            className="px-3 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {lossSuggestionApplying ? '⏳' : `💀 ${t('lead.ai_loss_mark')}`}
                          </button>
                          <button
                            onClick={() => setLossSuggestion(null)}
                            disabled={lossSuggestionApplying}
                            className="px-3 py-1 rounded-md text-xs font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                          >
                            {t('lead.ai_loss_ignore')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Past notes feed */}
                {pastNotes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic mb-2">{t('lead.notes_empty')}</p>
                ) : (
                  <div className="space-y-1.5 mb-3 max-h-56 overflow-y-auto pr-1">
                    {pastNotes.map(n => (
                      <div
                        key={n.id}
                        className="rounded-lg border border-yellow-200 bg-yellow-50/60 px-3 py-2"
                      >
                        <div className="text-[10px] text-gray-500 mb-0.5">
                          {formatDate(n.created_at)}
                        </div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                          {n.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add new note */}
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      addNote();
                    }
                  }}
                  placeholder={t('lead.notes_add_placeholder')}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y bg-white"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-400">{t('lead.notes_save_shortcut')}</span>
                  <button
                    onClick={addNote}
                    disabled={notesSaving || !newNoteText.trim()}
                    className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {notesSaving ? t('lead.notes_saving') : t('lead.notes_save')}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Razón de pérdida — solo si el lead está en perdido */}
          {currentColumn === 'perdido' && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50/60">
              <div className="text-xs font-medium text-red-700 uppercase tracking-wide mb-2">
                💀 {t('lead.lost_reason_title')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  'precio', 'lavado_interno', 'tiene_proveedor', 'mal_timing',
                  'no_interesado', 'no_contesta', 'no_decisor', 'otro',
                ] as const).map(r => {
                  const active = business.lost_reason === r;
                  return (
                    <button
                      key={r}
                      onClick={async () => {
                        if (active) return;
                        await fetch(`/api/businesses/${business.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ lost_reason: r }),
                        });
                        onActionRegistered();
                      }}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-red-200 text-red-900 border-red-400 ring-1 ring-red-300'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-red-100'
                      }`}
                    >
                      {t(`lead.lost_reason_${r}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historial de contactos */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              {t('lead.history')} ({contactHistory.length})
            </label>
            {loadingHistory ? (
              <div className="text-center py-4 text-gray-400">{t('common.loading')}</div>
            ) : contactHistory.length === 0 ? (
              <div className="text-center py-6 bg-[#FFF8E7] rounded-lg border border-[#FFD06D]">
                <span className="text-2xl mb-2 block">📋</span>
                <p className="text-[#7C622A] font-medium">{t('lead.no_contacts')}</p>
                <p className="text-[#B8923F] text-xs mt-1">{t('lead.make_first_contact')}</p>
              </div>
            ) : (
              <>
                {/* Tip de seguimiento si solo hay 1 contacto */}
                {contactHistory.length === 1 && (
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                    💡 <strong>Tip:</strong> {t('lead.tip_single_contact')}
                  </div>
                )}
                {contactHistory.length >= 2 && contactHistory.length < 5 && (
                  <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                    ✅ <strong>{t('lead.tip_good_work')}</strong> {contactHistory.length} {t('lead.contact_plural')}.
                  </div>
                )}
                {contactHistory.length >= 5 && (
                  <div className="mb-2 p-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                    🏆 <strong>{t('lead.tip_excellent')}</strong> {contactHistory.length} {t('lead.contact_plural')}.
                  </div>
                )}

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {contactHistory.map((h, idx) => {
                    const isAICall = h.notes?.startsWith('🤖');
                    const isStageChange = h.action_type === 'stage_change';
                    const isWhatsApp = h.action_type === 'whatsapp' || h.action_type === 'auto_whatsapp';
                    const isManualSend = h.action_type === 'whatsapp';
                    const isAutoSend = h.action_type === 'auto_whatsapp';
                    const isReply = h.action_type === 'whatsapp_reply';
                    const isBotReply = isReply && isLikelyBotReply(h.notes);
                    const isHumanReply = isReply && !isBotReply;
                    // Extraer conversation_id de las notas para reproducir audio
                    const convIdMatch = h.notes?.match(/conv_[a-z0-9]+/);
                    const conversationId = convIdMatch ? convIdMatch[0] : null;
                    const isPlaying = playingAudioId === conversationId;
                    const isLoading = audioLoading === conversationId;

                    return (
                      <div key={h.id} className={`text-sm rounded-lg px-3 py-2 ${
                        isAICall
                          ? 'bg-purple-50 border border-purple-200'
                          : isHumanReply
                            ? 'bg-green-50 border border-green-300'
                            : isBotReply
                              ? 'bg-gray-50 border border-gray-200'
                              : isStageChange
                                ? 'bg-blue-50 border border-blue-200'
                                : isManualSend
                                  ? 'bg-orange-50 border border-orange-200'
                                  : isAutoSend
                                    ? 'bg-purple-50/40 border border-purple-200/60'
                                    : 'bg-gray-50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs font-medium">#{contactHistory.length - idx}</span>
                          <span>{isAICall ? '🤖' : getActionIcon(h.action_type, isBotReply)}</span>
                          <span className={
                            isHumanReply ? 'text-green-700 font-semibold'
                            : isBotReply ? 'text-gray-500'
                            : isManualSend ? 'text-orange-700 font-semibold'
                            : isAutoSend ? 'text-purple-700'
                            : 'text-gray-700'
                          }>
                            {isAICall ? 'Llamada IA' : getActionLabel(h.action_type, isBotReply)}
                          </span>
                          <span className="text-gray-400 text-xs ml-auto">{formatTimeAgo(h.created_at)}</span>
                          {/* Botón de play para llamadas IA */}
                          {isAICall && conversationId && (
                            <button
                              onClick={() => handlePlayAudio(conversationId)}
                              disabled={isLoading}
                              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                isPlaying
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-purple-600 text-white hover:bg-purple-700'
                              } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                              title={isPlaying ? 'Pausar' : 'Escuchar llamada'}
                            >
                              {isLoading ? (
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : isPlaying ? (
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="6" y="4" width="4" height="16" />
                                  <rect x="14" y="4" width="4" height="16" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                        {h.notes && isAICall && (
                          <div className="mt-2 text-xs text-gray-600 whitespace-pre-line border-t border-purple-200 pt-2">
                            {h.notes.split('\n').slice(2).join('\n')}
                          </div>
                        )}
                        {h.notes && h.action_type === 'stage_change' && (
                          <div className="mt-1 text-xs text-blue-600">
                            {h.notes.replace('📋 ', '')}
                          </div>
                        )}
                        {h.notes && isWhatsApp && (
                          <div className="mt-2 text-xs text-gray-600 whitespace-pre-line border-t border-gray-200 pt-2 max-h-24 overflow-y-auto">
                            {h.notes}
                          </div>
                        )}
                        {h.notes && isHumanReply && (
                          <div className="mt-2 text-xs text-green-800 whitespace-pre-line border-t border-green-200 pt-2 font-medium">
                            {h.notes}
                          </div>
                        )}
                        {h.notes && isBotReply && (
                          <div className="mt-2 text-xs text-gray-500 whitespace-pre-line border-t border-gray-200 pt-2 italic">
                            {h.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-[#FFF8E7] border-[#FFD06D]'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {business.daysSinceContact >= 5 ? '🔥' : business.daysSinceContact >= 3 ? '⏰' : '⚠️'}
                </span>
                <div>
                  <p className={`font-bold text-sm ${
                    business.daysSinceContact >= 5 ? 'text-red-800' : business.daysSinceContact >= 3 ? 'text-blue-800' : 'text-[#7C622A]'
                  }`}>
                    {business.daysSinceContact >= 5
                      ? t('lead.urgent_days') + ' ' + business.daysSinceContact + ' ' + t('lead.days')
                      : business.daysSinceContact >= 3
                        ? t('lead.needs_followup_days') + ' (' + business.daysSinceContact + ' ' + t('lead.days') + ')'
                        : t('lead.days_passed') + ' ' + business.daysSinceContact + ' ' + t('lead.days')
                    }
                  </p>
                  <p className={`text-xs ${
                    business.daysSinceContact >= 5 ? 'text-red-600' : business.daysSinceContact >= 3 ? 'text-blue-600' : 'text-[#B8923F]'
                  }`}>
                    {business.daysSinceContact >= 5
                      ? t('lead.interest_cools')
                      : t('lead.message_keeps_interest')
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ⚠️ Danger zone — eliminar lead (CASCADE limpia notas + historial) */}
          {!deleteConfirm ? (
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setDeleteConfirm(true)}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1"
                title={t('lead.delete_button_hint')}
              >
                🗑️ {t('lead.delete_button')}
              </button>
            </div>
          ) : (
            <div className="mt-6 p-3 rounded-lg border-2 border-red-300 bg-red-50">
              <div className="text-sm font-bold text-red-900 mb-1">
                ⚠️ {t('lead.delete_confirm_title').replace('{name}', business.name)}
              </div>
              <div className="text-xs text-red-700 mb-3">
                {t('lead.delete_confirm_warn')}{' '}
                <strong>
                  {contactHistory.filter(h => h.action_type === 'note').length}
                </strong> {t('lead.delete_notes_label')}
                {' · '}
                <strong>
                  {contactHistory.filter(h => h.action_type !== 'note' && h.action_type !== 'stage_change').length}
                </strong> {t('lead.delete_contacts_label')}
                {' · '}
                <strong>
                  {contactHistory.filter(h => h.action_type === 'stage_change').length}
                </strong> {t('lead.delete_stage_label')}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={deleteLead}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? '⏳ ' + t('lead.delete_deleting') : '🗑️ ' + t('lead.delete_confirm_yes')}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('lead.delete_cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center safe-area-bottom">
          <span className="text-xs text-gray-500">
            {business.contactCount} {business.contactCount === 1 ? t('lead.contact_singular') : t('lead.contact_plural')}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors text-sm"
          >
            {t('biz.close')}
          </button>
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[60] sm:p-4" onClick={() => setEmailModal(null)}>
          <div
            className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl sm:max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">{t('biz.email_pitch')}</h3>
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
                  <p className="text-xs text-gray-500 uppercase flex-1">{t('biz.to')}</p>
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
                  <p className="text-xs text-gray-500 uppercase flex-1">{t('biz.subject')}</p>
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
                  <p className="text-xs text-gray-500 uppercase flex-1">{t('biz.body')}</p>
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
            <div className="p-4 border-t border-gray-200 flex gap-2 justify-between">
              <button
                onClick={handleRegenerateEmail}
                className="px-4 py-2 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('lead.regenerate')}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${t('biz.to')} ${emailModal.to}\n${t('biz.subject')} ${emailModal.subject}\n\n${emailModal.body}`);
                    alert(t('lead.copied'));
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('biz.copy_all')}
                </button>
                <button
                  onClick={() => setEmailModal(null)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                >
                  {t('biz.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
