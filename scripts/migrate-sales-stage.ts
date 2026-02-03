// Script de migración: Actualiza sales_stage basado en días sin contacto
// Ejecutar una sola vez para migrar leads antiguos que no tienen sales_stage
// npx tsx scripts/migrate-sales-stage.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('🚀 Iniciando migración de sales_stage...\n');

  // Obtener todos los businesses con contact_actions pero sin sales_stage válido
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name, sales_stage, contacted_at, contact_actions')
    .not('contacted_at', 'is', null);

  if (error) {
    console.error('Error fetching businesses:', error);
    return;
  }

  console.log(`📊 Total de leads con contacto: ${businesses?.length || 0}\n`);

  const now = new Date();
  let updates = {
    contactado: 0,
    seguimiento_1: 0,
    seguimiento_2: 0,
    skipped: 0,
  };

  for (const b of businesses || []) {
    // Si ya tiene un sales_stage válido (no null y no 'nuevo'), saltar
    const validStages = ['contactado', 'seguimiento_1', 'seguimiento_2', 'interesado', 'cotizado', 'cliente', 'perdido'];
    if (b.sales_stage && validStages.includes(b.sales_stage)) {
      updates.skipped++;
      continue;
    }

    // Calcular días desde contacto
    const contactDate = new Date(b.contacted_at);
    const daysSinceContact = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));

    // Determinar nuevo stage basado en días
    let newStage: string;
    if (daysSinceContact >= 6) {
      newStage = 'seguimiento_2';
    } else if (daysSinceContact >= 3) {
      newStage = 'seguimiento_1';
    } else {
      newStage = 'contactado';
    }

    // Actualizar en DB
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ sales_stage: newStage })
      .eq('id', b.id);

    if (updateError) {
      console.error(`❌ Error actualizando ${b.name}:`, updateError.message);
    } else {
      updates[newStage as keyof typeof updates]++;
      if (newStage === 'seguimiento_2') {
        console.log(`🔥 ${b.name} → seguimiento_2 (${daysSinceContact} días)`);
      } else if (newStage === 'seguimiento_1') {
        console.log(`⏰ ${b.name} → seguimiento_1 (${daysSinceContact} días)`);
      }
    }
  }

  console.log('\n✅ Migración completada!');
  console.log(`   - Contactado: ${updates.contactado}`);
  console.log(`   - Seguimiento 1: ${updates.seguimiento_1}`);
  console.log(`   - Seguimiento 2: ${updates.seguimiento_2}`);
  console.log(`   - Ya tenían stage válido (skipped): ${updates.skipped}`);
}

migrate().catch(console.error);
