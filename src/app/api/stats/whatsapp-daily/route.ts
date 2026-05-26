import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Daily WhatsApp send/reply counts for the last N days (default 14).
// Used by the chart on /estadisticas so volume drops become visible.
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const days = Math.min(60, Math.max(1, parseInt(url.searchParams.get('days') || '14', 10)));

    // Window: today (Lima) inclusive going back `days` days
    const now = new Date();
    const peruOffsetMin = -5 * 60;
    const peruNow = new Date(now.getTime() + (peruOffsetMin - now.getTimezoneOffset()) * 60000);
    const peruToday = new Date(peruNow.getFullYear(), peruNow.getMonth(), peruNow.getDate());
    const startLocal = new Date(peruToday);
    startLocal.setDate(startLocal.getDate() - (days - 1));
    const startUTC = new Date(startLocal.getTime() - peruOffsetMin * 60000);

    // Pull only the rows we care about, paginated past the 1000-row PostgREST cap.
    type Row = { action_type: string; created_at: string };
    const rows: Row[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('contact_history')
        .select('action_type, created_at')
        .in('action_type', ['whatsapp', 'auto_whatsapp', 'whatsapp_reply'])
        .gte('created_at', startUTC.toISOString())
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error || !data) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Seed every day in the window so chart shows zeros (not gaps)
    const bucket: Record<string, { date: string; manual: number; auto: number; reply: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startLocal);
      d.setDate(startLocal.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      bucket[key] = { date: key, manual: 0, auto: 0, reply: 0 };
    }

    rows.forEach(r => {
      // Shift created_at to Lima local date for bucketing
      const created = new Date(r.created_at);
      const limaTime = new Date(created.getTime() + (peruOffsetMin - created.getTimezoneOffset()) * 60000);
      const key = new Date(limaTime.getFullYear(), limaTime.getMonth(), limaTime.getDate())
        .toISOString().slice(0, 10);
      const b = bucket[key];
      if (!b) return; // outside window guard
      if (r.action_type === 'whatsapp') b.manual += 1;
      else if (r.action_type === 'auto_whatsapp') b.auto += 1;
      else if (r.action_type === 'whatsapp_reply') b.reply += 1;
    });

    const series = Object.values(bucket).sort((a, b) => a.date.localeCompare(b.date));
    const totalManual = series.reduce((s, d) => s + d.manual, 0);
    const totalAuto = series.reduce((s, d) => s + d.auto, 0);
    const totalReply = series.reduce((s, d) => s + d.reply, 0);

    return NextResponse.json({
      days,
      series,
      totals: { manual: totalManual, auto: totalAuto, reply: totalReply },
    });
  } catch (err) {
    console.error('whatsapp-daily error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
