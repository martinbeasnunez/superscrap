import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('businesses')
    .select('sales_stage');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const counts: Record<string, number> = {};
  data?.forEach(b => {
    const stage = b.sales_stage || 'null/nuevo';
    counts[stage] = (counts[stage] || 0) + 1;
  });

  console.log('📊 Conteo por sales_stage en DB:');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([stage, count]) => {
    console.log(`   ${stage}: ${count}`);
  });

  console.log('\n📈 Total leads:', data?.length);
}

check();
