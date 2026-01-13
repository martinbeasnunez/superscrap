import OpenAI from 'openai';
import { OpenAIAnalysisResponse } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function analyzeBusinessServices(
  businessName: string,
  businessDescription: string | null,
  businessType: string | null,
  _requiredServices?: string[] // Ya no se usa, detectamos automáticamente
): Promise<OpenAIAnalysisResponse> {
  // Ignoramos requiredServices - ahora detectamos automáticamente
  void _requiredServices;

  const prompt = `CONTEXTO: Eres un analista de prospección B2B para una empresa de lavandería industrial (GetLavado/Laundryheap).
Tu trabajo es IDENTIFICAR AUTOMÁTICAMENTE si un negocio necesita servicios de lavandería industrial.

OBJETIVO: Determinar si este negocio es un cliente potencial de lavandería industrial analizando su descripción.

Negocio a analizar:
- Nombre: ${businessName}
- Tipo de búsqueda: ${businessType || 'No especificado'}
- Descripción/Contenido web: ${businessDescription || 'No disponible'}

TIPOS DE TEXTILES QUE BUSCA NUESTRA LAVANDERÍA:
1. ROPA DE CAMA: sábanas, edredones, almohadas, cobertores, fundas
2. TOALLAS: toallas de baño, de piscina, de gimnasio, batas
3. MANTELES: manteles, servilletas de tela, individuales
4. UNIFORMES: uniformes de trabajo, overoles, batas médicas, scrubs, delantales

DETECTA NECESIDADES DE LAVANDERÍA SI EL NEGOCIO:
- Tiene hospedaje/habitaciones → necesita ROPA DE CAMA y TOALLAS
- Tiene restaurante formal → necesita MANTELES
- Tiene spa/sauna/piscina → necesita TOALLAS
- Tiene empleados uniformados → necesita lavado de UNIFORMES
- Es hotel/hostal/airbnb → necesita ROPA DE CAMA y TOALLAS
- Es clínica/hospital → necesita UNIFORMES (batas, scrubs)
- Es empresa de seguridad → necesita UNIFORMES (guardias)
- Es empresa de limpieza → necesita UNIFORMES
- Es fábrica/industria → necesita UNIFORMES (operarios)
- Es empresa de transporte → necesita UNIFORMES (choferes)
- Es gimnasio premium → necesita TOALLAS
- Es club deportivo/country club → necesita TOALLAS y posiblemente ROPA DE CAMA

EJEMPLOS DE DETECCIÓN:
- "Hotel Miraflores" → ["ropa de cama", "toallas"] - hoteles usan ambos
- "Seguridad Orus SAC" → ["uniformes"] - guardias usan uniformes
- "Restaurante La Rosa" → ["manteles", "uniformes"] - manteles en mesas, uniformes de mozos
- "Spa Zen" → ["toallas"] - spas proveen toallas
- "Country Club Los Incas" → ["toallas", "ropa de cama"] - piscina y hospedaje
- "Clínica San Pablo" → ["uniformes", "ropa de cama"] - scrubs médicos y camas
- "Smart Fit" → [] - gimnasios low-cost NO proveen toallas

IMPORTANTE - ESCALA DEL NEGOCIO (afecta el confidence):
Para lavandería industrial necesitamos VOLUMEN. Evalúa el tamaño probable:
- ALTA confianza (0.7-1.0): Empresas grandes (SAC, SA, SRL, Corp, cadenas, hospitales, hoteles, fábricas)
- MEDIA confianza (0.4-0.6): Empresas medianas (restaurante individual, clínica pequeña)
- BAJA confianza (0.1-0.3): Negocios pequeños/familiares, o NO necesitan lavandería

Indicadores de ESCALA:
- SAC, SA, SRL, Corp, Group = empresa formal grande
- "cadena", "sucursales", "nacional" = múltiples locales
- "artesanal", "familiar", "independiente" = pequeño

INSTRUCCIONES:
1. Lee y analiza el nombre y descripción del negocio
2. IDENTIFICA qué tipo de negocio es
3. DEDUCE qué textiles necesitaría lavar basándote en su operación
4. Si no hay indicios claros de necesidad de lavandería → detected_services vacío, confidence bajo

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "detected_services": ["textiles que el negocio PROBABLEMENTE necesita lavar"],
  "confidence": 0.0-1.0,
  "evidence": "Explicación de por qué este negocio necesitaría lavandería industrial"
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
