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

// Template name by stage
function getTemplateName(stage: string): string {
  switch (stage) {
    case 'seguimiento_1': return 'getlavado_seg1';
    case 'seguimiento_2': return 'getlavado_seg2';
    case 'seguimiento_3': return 'getlavado_seg3';
    default: return 'getlavado_followup';
  }
}

// Get the right parameter value for each template
function getTemplateParam(stage: string, businessName: string, address: string | null): string {
  switch (stage) {
    case 'seguimiento_1': return 'lavanderia industrial';
    case 'seguimiento_2': {
      // Extract district from address
      const districts = ['Miraflores', 'San Isidro', 'Surco', 'Barranco', 'San Borja', 'La Molina', 'San Miguel', 'Jesús María', 'Lince', 'Magdalena', 'Lima'];
      const addr = address || '';
      const found = districts.find(d => addr.toLowerCase().includes(d.toLowerCase()));
      return found || 'Lima';
    }
    default: return businessName;
  }
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
    const rawParam = getTemplateParam(stg, businessName, address || null);
    const paramValue = rawParam.replace(/[""''🧪📋🏨💪✨🏥🍽️👋📞📊🤝]/g, '').trim().substring(0, 100);

    const template = buildTemplatePayload({
      name: templateName,
      language: 'es',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: paramValue },
          ],
        },
      ],
    });

    const result = await client.messages.sendTemplate({
      phoneNumberId,
      to: normalizedTo,
      template,
    });

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
