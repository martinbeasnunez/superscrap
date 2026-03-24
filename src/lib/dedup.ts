import { supabase } from '@/lib/supabase';

export interface DedupResult {
  isDuplicate: boolean;
  existingId?: string;
  matchType?: 'external_id' | 'phone' | 'name_address';
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '');
  // Remove country code prefix (51 for Peru)
  if (digits.length > 9 && digits.startsWith('51')) {
    return digits.slice(2);
  }
  // Keep last 9 digits (standard Peru mobile/landline)
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export async function findExistingBusiness(
  externalId: string | null | undefined,
  phone: string | null | undefined,
  name: string,
  address: string | null | undefined,
): Promise<DedupResult> {
  // 1. Check by external_id (highest confidence, skip synthetic PA IDs)
  if (externalId && !externalId.startsWith('pa-')) {
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('external_id', externalId)
      .limit(1);

    if (data && data.length > 0) {
      return { isDuplicate: true, existingId: data[0].id, matchType: 'external_id' };
    }
  }

  // 2. Check by normalized phone
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone && normalizedPhone.length >= 7) {
    const { data } = await supabase
      .from('businesses')
      .select('id, phone')
      .not('phone', 'is', null);

    if (data) {
      const match = data.find(b => normalizePhone(b.phone) === normalizedPhone);
      if (match) {
        return { isDuplicate: true, existingId: match.id, matchType: 'phone' };
      }
    }
  }

  // 3. Check by name + address (fuzzy)
  if (name && address) {
    const nameLower = name.toLowerCase().trim();
    const { data } = await supabase
      .from('businesses')
      .select('id, name, address')
      .ilike('name', nameLower);

    if (data && data.length > 0) {
      const addressLower = address.toLowerCase().trim();
      const match = data.find(b =>
        b.address && b.address.toLowerCase().trim() === addressLower
      );
      if (match) {
        return { isDuplicate: true, existingId: match.id, matchType: 'name_address' };
      }
    }
  }

  return { isDuplicate: false };
}
