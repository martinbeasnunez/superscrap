import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import https from 'https';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'landings');

interface ImagePrompt {
  filename: string;
  prompt: string;
  size: '1792x1024' | '1024x1024' | '1024x1792';
}

const IMAGE_PROMPTS: ImagePrompt[] = [
  // HOTELES
  {
    filename: 'hoteles-hero.webp',
    prompt: 'Luxury boutique hotel room in Miraflores, Lima Peru. White crisp bedsheets, elegant headboard, warm lighting, Pacific Ocean view through window. Modern Peruvian interior design with subtle cultural touches. Professional hotel photography, wide angle.',
    size: '1792x1024',
  },
  {
    filename: 'hoteles-gallery-1.webp',
    prompt: 'Perfectly made hotel bed with pristine white sheets and fluffy pillows in a modern Lima Peru hotel room. Soft warm lighting, minimal elegant decor. Close-up photography showing textile quality.',
    size: '1024x1024',
  },
  {
    filename: 'hoteles-gallery-2.webp',
    prompt: 'Stack of perfectly folded white fluffy towels in a luxury hotel bathroom in Lima Peru. Marble counter, warm lighting, premium spa feeling. Product photography style.',
    size: '1024x1024',
  },
  {
    filename: 'hoteles-gallery-3.webp',
    prompt: 'Modern hotel lobby in Miraflores Lima Peru. Clean lines, contemporary Peruvian design, polished floors, reception desk with fresh flowers. Wide angle architectural photography.',
    size: '1024x1024',
  },

  // RESTAURANTES
  {
    filename: 'restaurantes-hero.webp',
    prompt: 'Upscale Peruvian restaurant in Barranco Lima. White tablecloths, elegant place settings, warm ambient lighting. Ceviche and pisco sour on table. Modern gastronomy scene. Wide angle professional food photography.',
    size: '1792x1024',
  },
  {
    filename: 'restaurantes-gallery-1.webp',
    prompt: 'Elegant restaurant table setting with crisp white tablecloth, folded linen napkins, wine glasses, and silverware. Upscale Lima Peru restaurant ambiance.',
    size: '1024x1024',
  },
  {
    filename: 'restaurantes-gallery-2.webp',
    prompt: 'Professional Latin American chef in pristine white uniform working in a modern restaurant kitchen in Lima Peru. Clean uniform, professional environment.',
    size: '1024x1024',
  },
  {
    filename: 'restaurantes-gallery-3.webp',
    prompt: 'Beautifully folded white linen napkins and polished cutlery on a restaurant table. Warm lighting, elegant setting in a Peruvian fine dining establishment.',
    size: '1024x1024',
  },

  // CLINICAS
  {
    filename: 'clinicas-hero.webp',
    prompt: 'Modern medical clinic interior in San Borja Lima Peru. Clean white walls, medical equipment, professional lighting. Latin American healthcare facility. Wide angle architecture photography.',
    size: '1792x1024',
  },
  {
    filename: 'clinicas-gallery-1.webp',
    prompt: 'Clean modern medical examination room with white sheets on the bed, medical equipment. Spotless clinical environment in Lima Peru.',
    size: '1024x1024',
  },
  {
    filename: 'clinicas-gallery-2.webp',
    prompt: 'Professional Latin American doctor in clean white coat with stethoscope, smiling in modern clinic in Lima Peru. Professional portrait.',
    size: '1024x1024',
  },
  {
    filename: 'clinicas-gallery-3.webp',
    prompt: 'Modern medical clinic waiting room in Lima Peru. Clean chairs, contemporary design, plants, natural lighting. Healthcare interior design.',
    size: '1024x1024',
  },

  // GIMNASIOS
  {
    filename: 'gimnasios-hero.webp',
    prompt: 'Modern boutique fitness gym in Miraflores Lima Peru. Clean equipment, towels neatly stacked, Latin American people exercising. Contemporary gym interior, wide angle.',
    size: '1792x1024',
  },
  {
    filename: 'gimnasios-gallery-1.webp',
    prompt: 'Latin American people working out in a modern gym in Lima Peru. Clean towels nearby, bright interior, fitness equipment.',
    size: '1024x1024',
  },
  {
    filename: 'gimnasios-gallery-2.webp',
    prompt: 'Stack of clean white gym towels neatly arranged on a shelf in a modern fitness center. Fresh, clean feeling. Product photography.',
    size: '1024x1024',
  },
  {
    filename: 'gimnasios-gallery-3.webp',
    prompt: 'Latin American woman doing fitness training in a modern gym in Lima Peru. Clean environment, white towel on equipment. Lifestyle photography.',
    size: '1024x1024',
  },

  // SPAS
  {
    filename: 'spas-hero.webp',
    prompt: 'Premium spa treatment room in San Isidro Lima Peru. White fluffy towels, candles, orchids, massage table with clean linens. Zen atmosphere, warm soft lighting. Wide angle.',
    size: '1792x1024',
  },
  {
    filename: 'spas-gallery-1.webp',
    prompt: 'Massage treatment in progress at a premium spa in Lima Peru. White towels, essential oils, professional therapist hands. Warm lighting, relaxing atmosphere.',
    size: '1024x1024',
  },
  {
    filename: 'spas-gallery-2.webp',
    prompt: 'Beautifully rolled and stacked white spa towels with orchid flowers and hot stones. Premium spa presentation, zen atmosphere.',
    size: '1024x1024',
  },
  {
    filename: 'spas-gallery-3.webp',
    prompt: 'Latin American woman receiving facial treatment at a luxury spa in Lima Peru. White towels, clean environment, professional treatment.',
    size: '1024x1024',
  },

  // EMPRESAS DE SEGURIDAD
  {
    filename: 'seguridad-hero.webp',
    prompt: 'Professional Latin American security guard in pristine clean uniform standing at modern building entrance in Lima Peru. Corporate security, professional appearance. Wide angle.',
    size: '1792x1024',
  },
  {
    filename: 'seguridad-gallery-1.webp',
    prompt: 'Latin American security professional in clean pressed uniform at corporate building lobby in Lima Peru. Professional portrait, authoritative stance.',
    size: '1024x1024',
  },
  {
    filename: 'seguridad-gallery-2.webp',
    prompt: 'Team of Latin American security professionals in matching clean uniforms standing together. Corporate team photo, professional setting in Lima Peru.',
    size: '1024x1024',
  },
  {
    filename: 'seguridad-gallery-3.webp',
    prompt: 'Close up of clean pressed security uniform with badge and insignia. Professional laundered appearance, crisp and well maintained.',
    size: '1024x1024',
  },

  // EDIFICIOS
  {
    filename: 'edificios-hero.webp',
    prompt: 'Modern residential high-rise building in San Isidro Lima Peru. Glass facade, contemporary architecture, blue sky with Lima cityscape. Wide angle architectural photography.',
    size: '1792x1024',
  },
  {
    filename: 'edificios-gallery-1.webp',
    prompt: 'Elegant modern building lobby in Lima Peru. Polished floors, reception desk, uniformed concierge staff. Contemporary architecture interior.',
    size: '1024x1024',
  },
  {
    filename: 'edificios-gallery-2.webp',
    prompt: 'Modern residential condominium building facade in Miraflores Lima Peru. Contemporary architecture, balconies, urban setting with palm trees.',
    size: '1024x1024',
  },
  {
    filename: 'edificios-gallery-3.webp',
    prompt: 'Corporate building reception area in Lima Peru. Modern design, clean uniformed receptionist, polished marble floor, fresh flowers.',
    size: '1024x1024',
  },
];

async function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function generateImage(prompt: ImagePrompt): Promise<string> {
  const filepath = path.join(OUTPUT_DIR, prompt.filename);

  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`  ⏭️  Already exists: ${prompt.filename}`);
    return filepath;
  }

  console.log(`  🎨 Generating: ${prompt.filename}...`);

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt.prompt,
    n: 1,
    size: prompt.size,
    quality: 'standard',
    response_format: 'url',
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) {
    throw new Error(`No URL returned for ${prompt.filename}`);
  }

  // Download as PNG first, the filename says .webp but DALL-E returns PNG
  const pngPath = filepath.replace('.webp', '.png');
  await downloadImage(imageUrl, pngPath);

  // Rename to final path (Next.js will serve it fine)
  fs.renameSync(pngPath, filepath);

  console.log(`  ✅ Saved: ${prompt.filename}`);
  return filepath;
}

async function main() {
  console.log('🚀 Generating landing images for Lima, Peru...\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let success = 0;
  let failed = 0;

  for (const prompt of IMAGE_PROMPTS) {
    try {
      await generateImage(prompt);
      success++;
      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Failed: ${prompt.filename}`, error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${success} generated, ${failed} failed out of ${IMAGE_PROMPTS.length} total`);
}

main().catch(console.error);
