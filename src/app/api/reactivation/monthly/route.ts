import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/reactivation/monthly — marcador por mes (más reciente primero).
export async function GET() {
  const { data, error } = await supabase
    .from('reactivation_monthly')
    .select('*')
    .order('month', { ascending: false });
  if (error) {
    console.error('reactivation monthly GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ months: data ?? [] });
}
