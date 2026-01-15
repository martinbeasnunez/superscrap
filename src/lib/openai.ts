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

  const prompt = `CONTEXTO: Eres un vendedor agresivo de lavandería industrial (GetLavado). Tu trabajo es encontrar CUALQUIER razón para que un negocio sea cliente potencial.

Negocio a analizar:
- Nombre: ${businessName}
- Tipo: ${businessType || 'No especificado'}
- Info: ${businessDescription || 'No disponible'}

REGLA DE ORO: Si el negocio tiene empleados, NECESITA lavar uniformes. Punto.

TIPOS DE TEXTILES:
- UNIFORMES: cualquier empresa con empleados (operarios, guardias, choferes, médicos, mozos, técnicos)
- ROPA DE CAMA: hoteles, hostales, clínicas, residencias
- TOALLAS: hoteles, spas, gimnasios, clubes con piscina
- MANTELES: restaurantes formales, eventos, hoteles

INDUSTRIAS QUE SIEMPRE NECESITAN UNIFORMES (confidence alto):
- Farmacéuticas/Laboratorios → operarios con batas, protocolos de higiene
- Fábricas/Plantas → operarios con overoles
- Empresas de seguridad → guardias uniformados
- Empresas de limpieza → personal uniformado
- Transporte/Logística → choferes uniformados
- Salud (clínicas, hospitales) → scrubs, batas médicas
- Alimentos/Restaurantes → uniformes de cocina y servicio
- Minería/Construcción → overoles, ropa de trabajo
- Retail/Supermercados → uniformes de empleados

INDICADORES DE EMPRESA GRANDE (= más volumen = mejor prospecto):
- SAC, SA, SRL, Corp, Group en el nombre
- Marcas conocidas (AC Farma, Gloria, Alicorp, etc.)
- "Laboratorios", "Industrias", "Corporación"
- Ubicación en zona industrial (Ate, Lurín, Callao)

SCORING:
- Empresa grande + industria que usa uniformes = 0.8-1.0
- Empresa mediana + industria que usa uniformes = 0.5-0.7
- Hotel/Clínica/Spa = 0.7-0.9
- Negocio pequeño o sin uniformes claros = 0.1-0.4

IMPORTANTE: Sé OPTIMISTA. Si hay CUALQUIER indicio de que podrían usar uniformes o textiles, dales el beneficio de la duda. Es mejor contactar de más que perder un cliente potencial.

Responde SOLO JSON (sin markdown):
{
  "detected_services": ["uniformes", "ropa de cama", "toallas", "manteles"],
  "confidence": 0.0-1.0,
  "evidence": "Por qué este negocio necesita lavandería"
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Eres un vendedor agresivo de lavandería industrial. Tu meta es encontrar CUALQUIER razón para que un negocio sea prospecto. Empresas grandes con empleados = SIEMPRE necesitan uniformes. Sé optimista. Respondes solo en JSON.',
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
