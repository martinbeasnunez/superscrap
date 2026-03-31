import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

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
