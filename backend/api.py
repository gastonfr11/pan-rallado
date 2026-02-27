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
        Si te piden un mensaje de WhatsApp: máximo 3 líneas, tono uruguayo, sin emojis excesivos."""
    else:
        system_prompt = """Sos un asistente comercial de una distribuidora de pan rallado en Uruguay.
Respondé siempre de forma breve y directa. Máximo 3 oraciones. Sin introducciones ni cierres. Solo lo esencial."""

    respuesta = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": m.role, "content": m.content} for m in req.mensajes]
    )
    return {"respuesta": respuesta.content[0].text}

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
    
class DesmarcarVisitadoRequest(BaseModel):
    nombre: str
    direccion: str

@app.post("/desmarcar-visitado")
def desmarcar_visitado_endpoint(req: DesmarcarVisitadoRequest):
    from database import desmarcar_visitado as db_desmarcar
    db_desmarcar(req.nombre, req.direccion)
    return {"ok": True}