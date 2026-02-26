# backend/api.py
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import main

app = FastAPI(title="Pan Rallado API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos
static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

class RoadmapRequest(BaseModel):
    barrio: str
    enviar_whatsapp: bool = False
    modo: str = "chico"  # "chico" o "grande"

@app.get("/")
def root():
    index_path = os.path.join(static_path, "index.html")
    return FileResponse(index_path)

@app.get("/barrios")
def get_barrios():
    return {"barrios": list(main.BARRIOS.keys())}

@app.post("/generar-roadmap")
def generar_roadmap(req: RoadmapRequest):
    resultado = main.generar_roadmap(
        barrio=req.barrio,
        enviar_whatsapp=req.enviar_whatsapp,
        modo=req.modo
    )
    return resultado

import anthropic
from typing import List

anthropic_client = anthropic.Anthropic()

class Mensaje(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    mensajes: List[Mensaje]
    negocio: dict

@app.post("/chat")
def chat(req: ChatRequest):
    system_prompt = f"""Sos un asistente comercial de una distribuidora de pan rallado en Uruguay.
Estás ayudando a un vendedor que está por visitar o acaba de visitar este negocio:

- Nombre: {req.negocio.get('nombre')}
- Dirección: {req.negocio.get('direccion')}
- Tipo: {req.negocio.get('tipo')}
- Por qué fue seleccionado: {req.negocio.get('razon')}

Tu rol es:
1. Responder preguntas sobre el negocio y cómo abordarlo
2. Generar mensajes de WhatsApp personalizados cuando te lo pidan

Cuando generes mensajes de WhatsApp:
- Escribilos en tono amigable y profesional, como habla un vendedor uruguayo
- Que sean cortos (máximo 4 líneas)
- Personalizados para este negocio específico
- Sin emojis excesivos

Tipos de mensajes que podés generar:
- Presentación comercial (primer contacto)
- Seguimiento post-visita
- Oferta o promoción
- Recordatorio de pedido"""

    respuesta = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": m.role, "content": m.content} for m in req.mensajes]
    )

    return {"respuesta": respuesta.content[0].text}

class MarcarVisitadoRequest(BaseModel):
    nombre: str
    direccion: str
    resultado: str = "sin_respuesta"
    notas: str = ""

@app.post("/marcar-visitado")
def marcar_visitado(req: MarcarVisitadoRequest):
    from database import marcar_visitado as db_marcar
    db_marcar(req.nombre, req.direccion, req.resultado, req.notas)
    return {"ok": True}

@app.post("/resetear-db")
def resetear_db():
    from database import resetear_db as db_reset
    db_reset()
    return {"ok": True}

@app.get("/migrar-tabla")
def migrar_tabla():
    from database import get_conn
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        ALTER TABLE negocios
        ADD COLUMN IF NOT EXISTS telefono TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS horario TEXT,
        ADD COLUMN IF NOT EXISTS tipo_negocio TEXT,
        ADD COLUMN IF NOT EXISTS nivel_operativo TEXT,
        ADD COLUMN IF NOT EXISTS tiene_rotiseria BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS tiene_produccion_propia BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS place_id TEXT
    """)
    conn.commit()
    cursor.close()
    conn.close()
    return {"ok": True, "mensaje": "Tabla migrada correctamente"}