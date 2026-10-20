import { WhatsAppClient, buildTemplatePayload } from '@kapso/whatsapp-cloud-api';

export interface KapsoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function getClient() {
  const apiKey = process.env.KAPSO_API_KEY;
  if (!apiKey) {
    throw new Error('KAPSO_API_KEY is not set');
  }
  return new WhatsAppClient({
    baseUrl: 'https://api.kapso.ai/meta/whatsapp',
    kapsoApiKey: apiKey,
  });
}

function normalizePhoneForKapso(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  // Add Peru country code if not present
  if (cleaned.length === 9 && cleaned.startsWith('9')) {
    cleaned = `51${cleaned}`;
  }
  // If already has 51 prefix but no + sign, that's fine
  return cleaned;
}

export async function sendWhatsAppMessage(
  to: string,
  message: string,
): Promise<KapsoSendResult> {
  try {
    const client = getClient();
    const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;

    if (!phoneNumberId) {
      return { success: false, error: 'KAPSO_PHONE_NUMBER_ID is not set' };
    }

    const normalizedTo = normalizePhoneForKapso(to);

    const result = await client.messages.sendText({
      phoneNumberId,
      to: normalizedTo,
      body: message,
    });

    return {
      success: true,
      messageId: result?.messages?.[0]?.id || 'sent',
    };
  } catch (error) {
    console.error('Kapso send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Template name by stage (v3 — permission-based, peruvian tone)
function getTemplateName(stage: string): string {
  switch (stage) {
    case 'seguimiento_1': return 'getlavado_v3_dato';        // pide kg/mes para calificar
    case 'seguimiento_2': return 'getlavado_v3_oferta';      // S/100 crédito gratis (rompe silencio)
    case 'seguimiento_3': return 'getlavado_v3_cierre';      // cierre respetuoso
    default:              return 'getlavado_v3_apertura';    // primer contacto / contactado
  }
}

function extractDistrict(address: string | null): string {
  const districts = ['Miraflores', 'San Isidro', 'Surco', 'Barranco', 'San Borja', 'La Molina', 'San Miguel', 'Jesús María', 'Lince', 'Magdalena', 'Lima'];
  const addr = address || '';
  return districts.find(d => addr.toLowerCase().includes(d.toLowerCase())) || 'Lima';
}

// Get the parameter values for each template
// All v3 templates use just {{1}} = business name
function getTemplateParams(stage: string, businessName: string, address: string | null): string[] {
  void stage; void address; // reserved for future multi-param templates
  return [businessName];
}

// Send using approved template (works outside 24h window)
export async function sendWhatsAppTemplate(
  to: string,
  businessName: string,
  stage?: string,
  address?: string | null,
): Promise<KapsoSendResult> {
  try {
    const client = getClient();
    const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;

    if (!phoneNumberId) {
      return { success: false, error: 'KAPSO_PHONE_NUMBER_ID is not set' };
    }

    const normalizedTo = normalizePhoneForKapso(to);
    const stg = stage || '';
    const templateName = getTemplateName(stg);
    // Sanitize: Meta rejects params with certain special chars
    const sanitize = (p: string) => p.replace(/[""''🧪📋🏨💪✨🏥🍽️👋📞📊🤝]/g, '').trim().substring(0, 100);
    const params = getTemplateParams(stg, businessName, address || null).map(sanitize);

    // Use direct API call instead of SDK (SDK formats template incorrectly)
    const apiKey = process.env.KAPSO_API_KEY!;
    const res = await fetch(`https://api.kapso.ai/meta/whatsapp/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es' },
          components: [
            {
              type: 'body',
              parameters: params.map(text => ({ type: 'text', text })),
            },
          ],
        },
      }),
    });
    const result = await res.json();

    if (result?.error) {
      return { success: false, error: result.error.message || JSON.stringify(result.error) };
    }

    return {
      success: true,
      messageId: result?.messages?.[0]?.id || 'sent',
    };
  } catch (error) {
    console.error('Kapso template send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Plantillas aprobadas por Meta (cache 5 min). Sin lista fiable devuelve vacío: mejor no enviar que repetir.
const WABA_ID = process.env.KAPSO_WABA_ID || '866732406416377';
let approvedCache: { at: number; names: Set<string> } | null = null;
export async function getApprovedTemplateNames(): Promise<Set<string>> {
  if (approvedCache && Date.now() - approvedCache.at < 5 * 60_000) return approvedCache.names;
  try {
    const res = await fetch(`https://api.kapso.ai/meta/whatsapp/v21.0/${WABA_ID}/message_templates?limit=100&fields=name,status`, {
      headers: { 'X-API-Key': process.env.KAPSO_API_KEY! },
    });
    const json = await res.json();
    const names = new Set<string>((json?.data || []).filter((t: { status: string }) => t.status === 'APPROVED').map((t: { name: string }) => t.name));
    approvedCache = { at: Date.now(), names };
    return names;
  } catch {
    return new Set();
  }
}

// Envío de una plantilla por nombre con parámetros de texto (funciona fuera de la ventana de 24h).
export async function sendWhatsAppNamedTemplate(to: string, templateName: string, params: string[]): Promise<KapsoSendResult> {
  try {
    const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;
    if (!phoneNumberId) return { success: false, error: 'KAPSO_PHONE_NUMBER_ID is not set' };
    const sanitize = (p: string) => p.replace(/[""''🧪📋🏨💪✨🏥🍽️👋📞📊🤝]/g, '').trim().substring(0, 100);
    const res = await fetch(`https://api.kapso.ai/meta/whatsapp/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'X-API-Key': process.env.KAPSO_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhoneForKapso(to),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es' },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: sanitize(text) })) }],
        },
      }),
    });
    const result = await res.json();
    if (result?.error) return { success: false, error: result.error.message || JSON.stringify(result.error) };
    return { success: true, messageId: result?.messages?.[0]?.id || 'sent' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Calidad del número de ORBIT según Meta: GREEN / YELLOW / RED / UNKNOWN (o null si no se pudo leer).
export async function getNumberQuality(): Promise<{ rating: string; limit: string | null } | null> {
  try {
    const id = process.env.KAPSO_PHONE_NUMBER_ID;
    const res = await fetch('https://api.kapso.ai/platform/v1/whatsapp/phone_numbers', {
      headers: { 'X-API-Key': process.env.KAPSO_API_KEY! },
    });
    const json = await res.json();
    const n = (json?.data || []).find((x: { phone_number_id?: string; id?: string }) => x.phone_number_id === id || x.id === id);
    if (!n) return null;
    return { rating: String(n.quality_rating || 'UNKNOWN').toUpperCase(), limit: n.whatsapp_business_manager_messaging_limit || null };
  } catch {
    return null;
  }
}

// El bot se pausa si Meta marca la calidad en amarillo o rojo (señal de bloqueos/reportes).
export function isQualityDegraded(rating: string | undefined | null): boolean {
  return rating === 'YELLOW' || rating === 'RED';
}
