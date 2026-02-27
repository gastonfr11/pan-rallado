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
Si te piden un mensaje de WhatsApp: máximo 3 líneas, tono uruguayo, sin emojis excesivos.
Cuando el vendedor quiera registrar una visita o agregar notas, usá las herramientas disponibles."""
    else:
        system_prompt = """Sos un asistente comercial de una distribuidora de pan rallado en Uruguay.
Respondé siempre de forma breve y directa. Máximo 3 oraciones. Sin introducciones ni cierres. Solo lo esencial.
Cuando el vendedor quiera buscar negocios en un barrio, usá la herramienta buscar_negocios."""

    # Usar tools solo si hay negocio activo (marcar/notas) o siempre (buscar)
    tools = TOOLS if req.negocio else [TOOLS[2]]  # sin negocio solo buscar_negocios

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        tools=tools,
        messages=[{"role": m.role, "content": m.content} for m in req.mensajes]
    )

    # Verificar si el modelo quiere usar una herramienta
    tool_use_block = next((b for b in response.content if b.type == "tool_use"), None)

    if tool_use_block:
        tool_name = tool_use_block.name
        tool_input = tool_use_block.input

        # Ejecutar la herramienta
        if tool_name == "marcar_visitado" and req.negocio:
            from database import marcar_visitado as db_marcar
            db_marcar(
                nombre=req.negocio.get('nombre'),
                direccion=req.negocio.get('direccion'),
                resultado=tool_input.get('resultado', 'visitado'),
                notas=tool_input.get('notas', '')
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
            # Verificar que el barrio existe
            barrios_disponibles = list(main.BARRIOS.keys())
            barrio_match = next((b for b in barrios_disponibles if b.lower() == barrio.lower()), None)
            if not barrio_match:
                return {"respuesta": f"No encontré el barrio \"{barrio}\". Los barrios disponibles son: {', '.join(barrios_disponibles[:10])}..."}
            return {
                "respuesta": f"🔍 Buscando negocios en {barrio_match}...",
                "tool_ejecutada": tool_name,
                "tool_input": {"barrio": barrio_match, "modo": modo}
            }

    # Respuesta de texto normal
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
    from database import obtener_historial
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

@app.post("/desmarcar-visitado")
def desmarcar_visitado_endpoint(req: DesmarcarVisitadoRequest):
    from database import desmarcar_visitado as db_desmarcar
    db_desmarcar(req.nombre, req.direccion)
    return {"ok": True}