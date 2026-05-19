import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type LostReason =
  | 'precio' | 'lavado_interno' | 'tiene_proveedor' | 'mal_timing'
  | 'no_interesado' | 'no_contesta' | 'no_decisor' | 'otro';

interface AnalyzeResponse {
  // null = no rejection signal detected (don't show banner)
  reason: LostReason | null;
  confidence: number; // 0-1
  snippet: string;    // verbatim fragment from the note that triggered the classification
}

const SYSTEM_PROMPT = `Eres un analista de notas de ventas B2B de lavandería industrial en Perú. Tu tarea: leer una nota que el vendedor escribió sobre un lead y detectar si la nota contiene una señal CLARA de rechazo o pérdida del lead.

Categorías de pérdida posibles (devolvé exactamente uno de estos slugs, o null):
- "precio" → el cliente dijo que es caro, fuera de presupuesto, no le cierra el número
- "lavado_interno" → tienen su propia lavandería interna, lavan ellos mismos
- "tiene_proveedor" → ya trabajan con otro proveedor, están conformes con el que tienen
- "mal_timing" → no es el momento, después, más adelante, en X meses
- "no_interesado" → dijeron explícitamente que no les interesa el servicio
- "no_contesta" → no contesta, no respondió, ghosted, sin respuesta tras múltiples intentos
- "no_decisor" → la persona con la que se habló no decide, hay que hablar con otra persona / dueño / gerencia
- "otro" → claramente perdido pero por una razón distinta a las anteriores

REGLAS:
1. Solo devolvé un slug si la señal es EXPLÍCITA y CONFIDENT. Frases como "le voy a llamar el lunes" NO son señal de pérdida.
2. Si la nota es ambigua, neutra o positiva → reason: null, confidence: 0.
3. confidence debe reflejar qué tan claro fue el rechazo. ≥ 0.7 = bandera al usuario. < 0.7 = no mostrar.
4. snippet: copiá textualmente la frase de la nota que disparó la clasificación (máx 80 chars). Si reason es null, snippet: "".
5. Solo respondé JSON puro, sin markdown, sin backticks.

EJEMPLOS:

Input: "Lo llamé, no contestó. Le dejé wsp."
Output: {"reason": null, "confidence": 0.3, "snippet": ""}
(razón: un solo intento no equivale a "no_contesta")

Input: "Por el momento está bien con su proveedor, cualquier duda me avisa"
Output: {"reason": "tiene_proveedor", "confidence": 0.9, "snippet": "está bien con su proveedor"}

Input: "Dijo que el precio le parece alto, no le entra en presupuesto"
Output: {"reason": "precio", "confidence": 0.95, "snippet": "precio le parece alto, no le entra en presupuesto"}

Input: "Llamé 3 veces, le escribí 2 wsps. Nunca contestó. Lo dejo."
Output: {"reason": "no_contesta", "confidence": 0.9, "snippet": "Llamé 3 veces... Nunca contestó"}

Input: "Tienen su propia lavadora industrial in-house"
Output: {"reason": "lavado_interno", "confidence": 0.95, "snippet": "su propia lavadora industrial in-house"}

Input: "Dice que recién en septiembre cuando se acabe el contrato actual"
Output: {"reason": "mal_timing", "confidence": 0.85, "snippet": "recién en septiembre"}

Input: "La recepcionista no tiene la decisión, hay que hablar con el gerente Juan"
Output: {"reason": "no_decisor", "confidence": 0.9, "snippet": "no tiene la decisión... hay que hablar con el gerente"}

Input: "Pidió cotización por 50 habitaciones, le mandé el PDF"
Output: {"reason": null, "confidence": 0, "snippet": ""}
(razón: señal POSITIVA, no de pérdida)`;

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    const text = typeof content === 'string' ? content.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'Nota vacía' }, { status: 400 });
    }
    // Cheap heuristic: very short notes (under 20 chars) almost never carry signal
    if (text.length < 20) {
      return NextResponse.json<AnalyzeResponse>({
        reason: null, confidence: 0, snippet: '',
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 120,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: AnalyzeResponse;
    try {
      const obj = JSON.parse(cleaned);
      const validReasons: LostReason[] = [
        'precio', 'lavado_interno', 'tiene_proveedor', 'mal_timing',
        'no_interesado', 'no_contesta', 'no_decisor', 'otro',
      ];
      const reason = validReasons.includes(obj.reason) ? obj.reason : null;
      parsed = {
        reason,
        confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0,
        snippet: typeof obj.snippet === 'string' ? obj.snippet.slice(0, 200) : '',
      };
    } catch {
      console.error('Failed to parse analyze response:', raw);
      parsed = { reason: null, confidence: 0, snippet: '' };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Note analyze error:', error);
    return NextResponse.json<AnalyzeResponse>(
      { reason: null, confidence: 0, snippet: '' },
      { status: 200 } // Fail-open: never block note saving on analyzer errors
    );
  }
}
