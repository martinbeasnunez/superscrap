import OpenAI from 'openai';
import { OpenAIAnalysisResponse } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function analyzeBusinessServices(
  businessName: string,
  businessDescription: string | null,
  businessType: string | null,
  requiredServices: string[]
): Promise<OpenAIAnalysisResponse> {
  const servicesListText = requiredServices.join(', ');

  const prompt = `CONTEXTO: Eres un analista de prospección B2B para una empresa de lavandería industrial (GetLavado/Laundryheap).
Tu trabajo es identificar si un negocio UTILIZA o NECESITA ciertos items textiles en sus operaciones, NO si los vende.

OBJETIVO: Determinar si este negocio es un cliente potencial de lavandería industrial.

Items/servicios textiles buscados: ${servicesListText}

Negocio a analizar:
- Nombre: ${businessName}
- Tipo: ${businessType || 'No especificado'}
- Descripción/Contenido web: ${businessDescription || 'No disponible'}

INTERPRETACIÓN CORRECTA DE LOS ITEMS:
- "ropa de cama" = el negocio tiene habitaciones, bungalows, hospedaje, alojamiento donde usa sábanas, edredones, almohadas
- "toallas" = el negocio tiene duchas, vestuarios, piscina, spa donde provee toallas a sus clientes/socios
- "manteles" = el negocio tiene restaurante, comedor, eventos donde usa manteles en las mesas
- "uniformes" = el negocio tiene empleados que usan uniformes que necesitan lavarse
- "sauna/spa/masajes" = el negocio ofrece estos servicios y por tanto usa toallas, batas, sábanas de camilla

EJEMPLOS DE DETECCIÓN CORRECTA:
- Club con hospedaje/bungalows → TIENE "ropa de cama" (usa sábanas en las habitaciones)
- Club con piscina/vestuarios → TIENE "toallas" (provee toallas a socios)
- Hotel → TIENE "ropa de cama" y "toallas"
- Gimnasio con duchas → PUEDE TENER "toallas"
- Restaurante → TIENE "manteles"
- Spa → TIENE "toallas", "ropa de cama" (camillas)

EJEMPLOS PARA EMPRESAS INDUSTRIALES (Directorio Industrial):
- Empresa de seguridad/vigilancia → TIENE "uniformes" (guardias usan uniformes que necesitan lavarse)
- Fábrica de confecciones/textiles → TIENE "uniformes" (operarios usan uniformes)
- Empresa de limpieza → TIENE "uniformes" (personal de limpieza usa uniformes)
- Constructora → TIENE "uniformes" (obreros usan uniformes/overoles)
- Empresa de transporte/logística → TIENE "uniformes" (choferes, repartidores)
- Restaurante industrial/catering → TIENE "uniformes" y "manteles"
- Clínica/laboratorio → TIENE "uniformes" (batas, scrubs médicos)
- Empresa de fumigación/control de plagas → TIENE "uniformes" (técnicos usan uniformes)
- Taller mecánico → TIENE "uniformes" (mecánicos usan overoles)
- Cualquier empresa con personal de campo → probablemente TIENE "uniformes"

INSTRUCCIONES:
1. Analiza si el negocio UTILIZA estos items textiles en sus operaciones
2. Busca indicios de: hospedaje, habitaciones, bungalows, piscina, vestuarios, duchas, restaurante, spa
3. Si el contenido web menciona hospedaje, alojamiento, bungalows, habitaciones → tiene "ropa de cama"
4. Si tiene piscina, gimnasio, spa, vestuarios → probablemente tiene "toallas"
5. NO incluyas servicios de gimnasios LOW-COST como "Smart Fit" - estos NO proveen toallas

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "detected_services": ["items textiles que el negocio USA o NECESITA"],
  "confidence": 0.0-1.0,
  "evidence": "Breve explicación de por qué el negocio necesitaría lavandería para estos items"
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Eres un analista de prospección B2B para una empresa de lavandería industrial. Tu trabajo es identificar negocios que USAN textiles (ropa de cama, toallas, manteles, uniformes) y por tanto son clientes potenciales. Respondes solo en JSON puro sin markdown.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  try {
    // Limpiar respuesta de posibles backticks de markdown
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedResponse);
    return {
      detected_services: parsed.detected_services || [],
      confidence: parsed.confidence || 0,
      evidence: parsed.evidence || '',
    };
  } catch {
    console.error('Error parsing OpenAI response:', responseText);
    return {
      detected_services: [],
      confidence: 0,
      evidence: 'Error al analizar',
    };
  }
}
