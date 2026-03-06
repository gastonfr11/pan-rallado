# backend/api.py
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from typing import Optional, List
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import json
import random
import anthropic
import main

app = FastAPI(title="Pan Rallado API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

anthropic_client = anthropic.Anthropic()

# ── MODELS ────────────────────────────────────────────

class RoadmapRequest(BaseModel):
    barrio: str
    enviar_whatsapp: bool = False
    modo: str = "chico"

class Mensaje(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    mensajes: List[Mensaje]
    negocio: Optional[dict] = None

class MarcarVisitadoRequest(BaseModel):
    nombre: str
    direccion: str
    resultado: str = "visitado"
    notas: str = ""
    telefono: Optional[str] = None
    email: Optional[str] = None
    horario: Optional[str] = None
    tipo_negocio: Optional[str] = None
    nivel_operativo: Optional[str] = None
    tiene_rotiseria: bool = False
    tiene_produccion_propia: bool = False

    @field_validator('telefono', 'email', 'horario', 'tipo_negocio', 'nivel_operativo', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == '':
            return None
        return v

class DesmarcarVisitadoRequest(BaseModel):
    nombre: str
    direccion: str

class GenerarMensajeWppRequest(BaseModel):
    negocio: dict
    tipo: str  # presentacion, seguimiento, oferta, recordatorio

# ── TOOLS DEFINITION ──────────────────────────────────

TOOLS = [
    {
        "name": "marcar_visitado",
        "description": "Marca el negocio activo como visitado, cliente, interesado o no interesado. Usá esta herramienta cuando el vendedor diga cosas como 'marcalo como cliente', 'fue una visita exitosa', 'no les interesa', 'agregá que estaban interesados'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "resultado": {
                    "type": "string",
                    "enum": ["visitado", "interesado", "cliente", "no_interesado"],
                    "description": "Estado de la visita"
                },
                "notas": {
                    "type": "string",
                    "description": "Notas opcionales sobre la visita"
                }
            },
            "required": ["resultado"]
        }
    },
    {
        "name": "agregar_nota",
        "description": "Agrega o actualiza las notas del negocio activo sin cambiar el estado. Usá cuando el vendedor quiera registrar información como 'anotá que el dueño se llama Juan', 'guardá que abren a las 9'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "notas": {
                    "type": "string",
                    "description": "Texto de la nota a guardar"
                }
            },
            "required": ["notas"]
        }
    },
    {
        "name": "buscar_negocios",
        "description": "Genera un roadmap de negocios para un barrio de Montevideo. Usá cuando el vendedor pregunte por negocios en un barrio o pida buscar clientes en una zona.",
        "input_schema": {
            "type": "object",
            "properties": {
                "barrio": {
                    "type": "string",
                    "description": "Nombre del barrio de Montevideo"
                },
                "modo": {
                    "type": "string",
                    "enum": ["chico", "grande"],
                    "description": "chico para negocios minoristas, grande para clientes industriales"
                }
            },
            "required": ["barrio"]
        }
    },
    {
        "name": "enviar_whatsapp",
        "description": "Genera y abre WhatsApp con un mensaje personalizado para el negocio activo. Usá cuando el vendedor diga 'mandále un WhatsApp', 'enviá un mensaje de seguimiento', 'mandá una oferta', etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "tipo": {
                    "type": "string",
                    "enum": ["presentacion", "seguimiento", "oferta", "recordatorio"],
                    "description": "Tipo de mensaje a generar"
                }
            },
            "required": ["tipo"]
        }
    }
]

# ── ENDPOINTS ─────────────────────────────────────────

@app.get("/")
def root():
    return FileResponse(os.path.join(static_path, "index.html"))

@app.get("/barrios")
def get_barrios():
    return {"barrios": list(main.BARRIOS.keys())}

@app.post("/generar-roadmap")
def generar_roadmap(req: RoadmapRequest):
    return main.generar_roadmap(barrio=req.barrio, enviar_whatsapp=req.enviar_whatsapp, modo=req.modo)

@app.post("/generar-mensaje-wpp")
def generar_mensaje_wpp(req: GenerarMensajeWppRequest):
    n = req.negocio
    tipos = {
        "presentacion": "Escribí un mensaje de presentación comercial. Es el primer contacto, presentate como vendedor de una distribuidora de pan rallado y mencioná brevemente los productos.",
        "seguimiento": "Escribí un mensaje de seguimiento post-visita. Ya los visitaste, querés saber si tomaron una decisión o si tienen alguna consulta.",
        "oferta": "Escribí un mensaje con una oferta o promoción. Podés mencionar descuentos por volumen o condiciones especiales.",
        "recordatorio": "Escribí un mensaje recordatorio de pedido. Son clientes que ya compraron y querés que repitan el pedido."
    }
    instruccion = tipos.get(req.tipo, tipos["presentacion"])

    prompt = f"""Negocio: {n.get('nombre')}
Tipo: {n.get('tipo_negocio') or n.get('tipo', 'negocio')}
Dirección: {n.get('direccion', '').split(',')[0]}
Notas: {n.get('notas') or 'Sin notas'}

{instruccion}

Reglas:
- Máximo 3 líneas
- Tono amigable y profesional, como habla un vendedor uruguayo
- Sin emojis excesivos (máximo 1-2)
- Sin saludos genéricos tipo "Estimado cliente"
- Solo el texto del mensaje, sin explicaciones"""

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"mensaje": response.content[0].text.strip()}

@app.post("/chat")
def chat(req: ChatRequest):
    if req.negocio:
        system_prompt = f"""Sos un asistente comercial de una distribuidora de pan rallado en Uruguay.
Negocio actual:
- Nombre: {req.negocio.get('nombre')}
- Dirección: {req.negocio.get('direccion')}
- Tipo: {req.negocio.get('tipo')}
- Por qué fue seleccionado: {req.negocio.get('razon')}
- Teléfono: {req.negocio.get('telefono') or 'No disponible'}
- Horario: {req.negocio.get('horario') or 'No disponible'}
- Email: {req.negocio.get('email') or 'No disponible'}
- Tipo de negocio: {req.negocio.get('tipo_negocio') or 'No disponible'}
- Nivel operativo: {req.negocio.get('nivel_operativo') or 'No disponible'}
- Notas de visita: {req.negocio.get('notas') or 'Sin notas'}

Respondé siempre de forma breve y directa. Máximo 3 oraciones. Sin introducciones ni cierres. Solo lo esencial.
Cuando el vendedor quiera registrar una visita, agregar notas, buscar negocios o enviar WhatsApp, usá las herramientas disponibles."""
    else:
        system_prompt = """Sos un asistente comercial de una distribuidora de pan rallado en Uruguay.
Respondé siempre de forma breve y directa. Máximo 3 oraciones. Sin introducciones ni cierres. Solo lo esencial.
Cuando el vendedor quiera buscar negocios en un barrio, usá la herramienta buscar_negocios."""

    tools = TOOLS if req.negocio else [TOOLS[2]]

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        tools=tools,
        messages=[{"role": m.role, "content": m.content} for m in req.mensajes]
    )

    tool_use_block = next((b for b in response.content if b.type == "tool_use"), None)

    if tool_use_block:
        tool_name = tool_use_block.name
        tool_input = tool_use_block.input

        if tool_name == "marcar_visitado" and req.negocio:
            from database import marcar_visitado as db_marcar
            db_marcar(
                nombre=req.negocio.get('nombre'),
                direccion=req.negocio.get('direccion'),
                resultado=tool_input.get('resultado', 'visitado'),
                notas=tool_input.get('notas', ''),
                telefono=req.negocio.get('telefono'),
                horario=req.negocio.get('horario'),
                email=req.negocio.get('email'),
                tipo_negocio=req.negocio.get('tipo_negocio') or req.negocio.get('tipo'),
                nivel_operativo=req.negocio.get('nivel_operativo'),
            )
            return {
                "respuesta": _confirmar_accion(tool_name, tool_input, req.negocio),
                "tool_ejecutada": tool_name,
                "tool_input": tool_input
            }

        elif tool_name == "agregar_nota" and req.negocio:
            from database import marcar_visitado as db_marcar
            db_marcar(
                nombre=req.negocio.get('nombre'),
                direccion=req.negocio.get('direccion'),
                resultado=req.negocio.get('resultado', 'visitado'),
                notas=tool_input.get('notas', '')
            )
            return {
                "respuesta": f"✅ Nota guardada: \"{tool_input.get('notas')}\"",
                "tool_ejecutada": tool_name,
                "tool_input": tool_input
            }

        elif tool_name == "buscar_negocios":
            barrio = tool_input.get('barrio')
            modo = tool_input.get('modo', 'chico')
            barrios_disponibles = list(main.BARRIOS.keys())
            barrio_match = next((b for b in barrios_disponibles if b.lower() == barrio.lower()), None)
            if not barrio_match:
                return {"respuesta": f"No encontré el barrio \"{barrio}\". Los barrios disponibles son: {', '.join(barrios_disponibles[:10])}..."}
            return {
                "respuesta": f"🔍 Buscando negocios en {barrio_match}...",
                "tool_ejecutada": tool_name,
                "tool_input": {"barrio": barrio_match, "modo": modo}
            }

        elif tool_name == "enviar_whatsapp" and req.negocio:
            telefono = req.negocio.get('telefono')
            if not telefono:
                return {"respuesta": "❌ Este negocio no tiene teléfono guardado."}
            return {
                "respuesta": f"📲 Generando mensaje de WhatsApp...",
                "tool_ejecutada": tool_name,
                "tool_input": {
                    "tipo": tool_input.get('tipo', 'presentacion'),
                    "negocio": req.negocio
                }
            }

    texto = next((b.text for b in response.content if hasattr(b, 'text')), '')
    return {"respuesta": texto}


def _confirmar_accion(tool_name: str, tool_input: dict, negocio: dict) -> str:
    nombre = negocio.get('nombre', 'el negocio')
    resultado = tool_input.get('resultado', 'visitado')
    notas = tool_input.get('notas', '')
    etiquetas = {
        'visitado': '✅ Visitado',
        'interesado': '🟡 Interesado',
        'cliente': '🟢 Cliente',
        'no_interesado': '🔴 No interesado'
    }
    msg = f"{etiquetas.get(resultado, '✅')} {nombre} marcado como {resultado.replace('_', ' ')}."
    if notas:
        msg += f" Nota: \"{notas}\""
    return msg


@app.get("/recomendar-barrio")
def recomendar_barrio(modo: str = "chico"):
    import random
    from database import obtener_barrios_recientes

    barrios_recientes = obtener_barrios_recientes(n=5)

    todos = [b for b in main.BARRIOS.keys() if b != "Todo Montevideo"]
    random.shuffle(todos)

    tipo_cliente = (
        "negocios chicos como pizzerías, rotiserías, carnicerías, pollerías, supermercados y panaderías"
        if modo == "chico"
        else "clientes industriales como frigoríficos, plantas procesadoras, distribuidoras de alimentos y empresas de catering"
    )

    recientes_texto = (
        f"Barrios visitados recientemente (preferentemente evitar repetir): {', '.join(barrios_recientes)}"
        if barrios_recientes
        else "No hay historial de visitas previas."
    )

    prompt = f"""Sos un experto en ventas para una distribuidora de pan rallado en Montevideo, Uruguay.
El vendedor busca nuevos clientes del tipo: {tipo_cliente}.

{recientes_texto}

Lista de barrios disponibles (en orden aleatorio):
{', '.join(todos)}

Analizando el tipo de actividad comercial y gastronómica de cada zona, recomendá UN SOLO barrio donde haya mayor concentración de este tipo de negocios y por lo tanto más potencial de venta de pan rallado.
Considerá la densidad comercial, el perfil gastronómico del barrio y la variedad de clientes potenciales.
Si hay barrios recientemente visitados, priorizá recomendar uno diferente para diversificar la zona de trabajo.

Respondé SOLO con un JSON válido con este formato exacto, sin markdown ni explicaciones adicionales:
{{"barrio": "nombre exacto del barrio de la lista", "razon": "explicación de 1-2 oraciones en español rioplatense explicando por qué ese barrio tiene potencial"}}"""

    response = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=250,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text.strip()
    try:
        resultado = json.loads(text)
        barrio = resultado.get("barrio", "")
        barrio_match = next((b for b in main.BARRIOS.keys() if b.lower() == barrio.lower()), None)
        if not barrio_match:
            barrio_match = todos[0] if todos else "Pocitos"
        return {
            "barrio_recomendado": barrio_match,
            "razon": resultado.get("razon", "")
        }
    except json.JSONDecodeError:
        barrio_match = todos[0] if todos else "Pocitos"
        return {"barrio_recomendado": barrio_match, "razon": "Zona con buen potencial comercial."}

@app.post("/marcar-visitado")
def marcar_visitado_endpoint(req: MarcarVisitadoRequest):
    from database import marcar_visitado as db_marcar
    db_marcar(
        req.nombre, req.direccion, req.resultado, req.notas,
        req.telefono, req.email, req.horario, req.tipo_negocio,
        req.nivel_operativo, req.tiene_rotiseria, req.tiene_produccion_propia
    )
    return {"ok": True}

@app.get("/historial")
def get_historial(barrio: str = None):
    from database import obtener_historial, obtener_historial_zona
    if barrio == "Todo Montevideo":
        return {"negocios": obtener_historial_zona(main.BARRIOS_MONTEVIDEO)}
    return {"negocios": obtener_historial(barrio)}

@app.post("/resetear-db")
def resetear_db():
    from database import resetear_db as db_reset
    db_reset()
    return {"ok": True}

@app.get("/place-details")
def place_details(nombre: str, direccion: str):
    import googlemaps
    gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))
    try:
        resultados = gmaps.find_place(
            input=f"{nombre} {direccion}",
            input_type="textquery",
            fields=["place_id", "name"]
        )
        if not resultados["candidates"]:
            return {"telefono": None, "horario": None}
        place_id = resultados["candidates"][0]["place_id"]
        detalles = gmaps.place(place_id=place_id, fields=["formatted_phone_number", "opening_hours"])
        result = detalles.get("result", {})
        horario = None
        if "opening_hours" in result:
            horario = " | ".join(result["opening_hours"].get("weekday_text", []))
        return {"telefono": result.get("formatted_phone_number"), "horario": horario}
    except Exception:
        return {"telefono": None, "horario": None}

@app.get("/visitas")
def get_visitas(negocio_id: int):
    from database import obtener_visitas
    return {"visitas": obtener_visitas(negocio_id)}

@app.post("/desmarcar-visitado")
def desmarcar_visitado_endpoint(req: DesmarcarVisitadoRequest):
    from database import desmarcar_visitado as db_desmarcar
    db_desmarcar(req.nombre, req.direccion)
    return {"ok": True}