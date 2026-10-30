# Caza diaria de orcas — instrucciones de la rutina

Rutina de cada mañana (lun–vie, antes del Parte de Orcas). Objetivo único: **cerrar orcas**
(cuentas B2B con potencial ≥ S/2,500/mes). Partnerships y reactivación NO entran aquí.

Resultado: hasta 10 leads listos para empezar a trabajar hoy, visibles en ORBIT →
Pipeline → "Today's hunt", donde cada uno recibe una decisión: lo toma un humano o lo
trabaja el bot.

`ORBIT = https://superscrap.vercel.app`

## Reglas duras

- **La cuota manda.** `capacidad.quota` de la foto es el máximo de hoy (10 menos lo que quedó
  sin decidir o tomado sin tocar). Si es 0, no caces: reporta la cola pendiente y termina.
- **Calidad sobre cantidad.** Si solo 6 valen la pena, se entregan 6. Nunca rellenar.
- **Solo Lima Metropolitana** (hay cobertura). Nada de provincias.
- **Solo cuentas con canal directo a quien decide.** Martín solo aprueba sí/no y ORBIT ejecuta
  el contacto por WhatsApp desde su número; por eso cada lead debe tener un **celular** del
  negocio, del dueño o del administrador. Si lo único que hay es una central telefónica o un
  fijo de recepción, NO se propone (nadie que decida contesta ahí). Esto deja fuera, por ahora,
  a los hoteles de cadena y a casi todo el inventario de rescate: no los propongas salvo que
  encuentres un celular directo de un decisor.
- **No proponer cuentas con negociación o licitación abierta** (p. ej. Casa Andina).
- **Nunca enviar mensajes.** Esta rutina solo propone. Excepción: en modo vacaciones de Martín
  (hasta el 2026-11-08, `HUNT_AUTO_APPROVE_UNTIL` en `src/lib/hunt.ts`) el servidor aprueba solo los
  leads NUEVOS con celular y ruta `bot`, y el primer WhatsApp sale solo (la respuesta de `save` trae
  `autoAprobados`). Por eso, esos días, sé más estricto: nadie los revisa antes de que salgan.
- El servidor vuelve a aplicar cuota, anti-duplicado y corte de orca: lo que no pase vuelve en
  `omitidos`.

## Paso 1 — Foto del día (determinístico)

`GET {ORBIT}/api/hunt/snapshot`

Devuelve: `capacidad`, `porRubro` y `porDistrito` (leads, contactados, respondieron, calientes,
clientes, perdidos y motivos), `busquedasHechas` (rubro × zona ya quemados), `apuestasAnteriores`
(cómo rindió cada apuesta de cazas pasadas), `corridasRecientes` e `inventarioSinTrabajar`
(orcas que ya están en ORBIT sin un solo mensaje registrado).

## Paso 2 — Estratega

Lee la foto y elige **2 o 3 apuestas** (rubro × zona) para hoy. Para cada una, una frase de
por qué. Criterio:

- Dónde hay señal real: rubros/distritos con clientes, calientes o buena tasa de respuesta.
  Los motivos de pérdida importan: "lavado_interno" y "tiene_proveedor" repetidos en un rubro
  = cambiar el ángulo o evitarlo.
- No repetir lo quemado: si un rubro × zona ya se buscó y sus resultados son casi todos
  duplicados, variar el término ("apart hotel", "clínica de cirugía plástica", "centro de
  diálisis") o la zona.
- Aprender de `apuestasAnteriores`: repetir las que generaron respuesta o leads tomados;
  soltar las que terminaron en descartes (leer `motivosDescarte`).
- Estacionalidad y contexto (temporada alta hotelera, fiestas, verano en el sur, etc.).
- **Rescate solo con celular:** una cuenta de `inventarioSinTrabajar` entra únicamente si
  tiene celular (regla dura de canal directo). Ojo: "sin registro en ORBIT" no significa sin
  tocar; el trabajo de Martín por WhatsApp personal y LinkedIn no se ve. En el `why` de un
  rescate decirlo así: "sin registro en ORBIT".
- Preferir rubros donde el celular de Google Maps llega a quien decide: restaurantes de
  grupo, clínicas privadas, spas, gimnasios boutique, clubes, casas de reposo, catering.

## Paso 3 — Cazador (código existente)

Por cada apuesta de caza nueva:

`POST {ORBIT}/api/hunt/search` con `{ "rubro": "...", "zona": "...", "pages": 1 }`

Devuelve `stats` (found, duplicates, orcas, below_orca), `candidatos` (pasan el corte de orca,
con web scrapeada: correos, teléfonos, extracto) y `bajoCorte` (no llegan por el score
automático). Cada llamada gasta 1 crédito de SerpAPI por página: máximo 4 llamadas por día.

## Paso 4 — Calificador (escéptico)

De todos los candidatos, quedarse con los mejores hasta la cuota. Por cada uno, **intentar
tumbarlo antes de aprobarlo**:

- ¿Es un comprador real de lavandería B2B con volumen? Fuera: entidades públicas (hospitales
  municipales, MINSA, EsSalud: se compran por licitación, no por WhatsApp), veterinarias,
  consultorios chicos, negocios cerrados, sucursales duplicadas de una cuenta que ya existe.
- ¿El tamaño es creíble? Revisar la web y buscar en internet (habitaciones, sedes, camas,
  aforo). Si el score automático se queda corto y hay evidencia, se puede rescatar uno de
  `bajoCorte` con `revenue_override` (min, max, reason con el dato).
- ¿Quién decide? Buscar nombre y cargo (ama de llaves, gerente de operaciones, compras,
  administración). Si no aparece, decir el cargo a buscar.

Para cada lead aprobado escribir:

- `why`: 1–2 frases con la evidencia concreta (no "tiene buen potencial").
- `decision_maker`: nombre y cargo, o el cargo a buscar.
- `angle`: la jugada de entrada, en una frase.
- `draft_message`: primer mensaje listo para copiar, en español, natural y corto.
- `suggested_route`: `bot` (todas tienen celular; ORBIT las trabaja al aprobarlas). Usa
  `humano` solo si hay una razón concreta para que Martín escriba en persona, y dila en `why`.

Reglas del mensaje:

- Marca: **Laundryheap** (nunca GetLavado).
- **No dar precio en frío.** A quien lava internamente: ofrecer una recogida de prueba gratis
  o pedir cantidades; se cotiza después.
- Credenciales permitidas: 16 países, +400 mil clientes, "+5 plantas industriales en Lima".
  Nunca nombrar distritos de las plantas, ni decir "sin tercerizar", ni poner RUC.
- Abrir con una pregunta simple que se responda en una palabra. Sin estadísticas en la
  primera línea.

## Paso 5 — Guardar

`POST {ORBIT}/api/hunt/save`

```json
{
  "summary": "Lectura del estratega en 2-3 frases: qué se apostó hoy y por qué.",
  "theses": [
    { "rubro": "apart hotel", "zona": "San Isidro", "why": "...", "found": 20, "duplicates": 6, "below_orca": 4 }
  ],
  "leads": [
    {
      "thesis": 0,
      "place_id": "...", "name": "...", "type": "...", "address": "...", "phone": "...",
      "website": "...", "rating": 4.5, "reviews": 320, "description": "...",
      "thumbnail": "...", "coordinates": { "lat": -12.1, "lng": -77.0 },
      "emails": ["..."], "phones": ["..."],
      "why": "...", "decision_maker": "...", "angle": "...", "draft_message": "...",
      "suggested_route": "humano"
    },
    { "thesis": 1, "business_id": "uuid-de-un-rescate", "why": "...", "decision_maker": "...", "angle": "...", "draft_message": "...", "suggested_route": "humano" }
  ]
}
```

Los campos del negocio se copian tal cual del candidato que devolvió el cazador. Un rescate
solo lleva `business_id` + el brief. El orden de `leads` es el ranking (el mejor primero).

## Paso 6 — Reporte

Mensaje corto para Martín:

- Cuota de hoy y por qué (si bajó de 10, cuántos quedaron pendientes).
- Las apuestas del día, una línea cada una.
- Los leads guardados: nombre · potencial · ruta sugerida · por qué, en una línea.
- Los `omitidos` y su motivo, si hubo.
- Los `autoAprobados` (modo vacaciones): cuáles salieron solos y cuáles quedaron para el cron.
- Link: `{ORBIT}/seguimiento`
