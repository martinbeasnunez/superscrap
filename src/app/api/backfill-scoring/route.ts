import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculatePotentialScore } from '@/lib/scoring';

export async function POST() {
  try {
    // Fetch businesses that have service_analyses but no potential_score
    const { data: records, error } = await supabase
      .from('service_analyses')
      .select(`
        id,
        business_id,
        potential_score,
        businesses (
          name,
          address,
          rating,
          reviews_count,
          business_type
        )
      `)
      .is('potential_score', null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let updated = 0;
    for (const record of records || []) {
      const biz = record.businesses as any;
      if (!biz) continue;

      const result = calculatePotentialScore({
        name: biz.name,
        businessType: biz.business_type,
        rating: biz.rating,
        reviewsCount: biz.reviews_count,
        address: biz.address,
      });

      const { error: updateError } = await supabase
        .from('service_analyses')
        .update({
          potential_score: result.score,
          potential_tier: result.tier,
          estimated_revenue_min: result.revenue.min,
          estimated_revenue_max: result.revenue.max,
          potential_signals: result.signals,
        })
        .eq('id', record.id);

      if (!updateError) updated++;
    }

    return NextResponse.json({
      updated,
      total: records?.length || 0,
      message: `Scored ${updated} businesses`,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
