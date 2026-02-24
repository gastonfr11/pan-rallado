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

@app.get("/")
def root():
    index_path = os.path.join(static_path, "index.html")
    return FileResponse(index_path)

@app.get("/barrios")
def get_barrios():
    return {"barrios": main.BARRIOS}

@app.post("/generar-roadmap")
def generar_roadmap(req: RoadmapRequest):
    resultado = main.generar_roadmap(
        barrio=req.barrio,
        enviar_whatsapp=req.enviar_whatsapp
    )
    return resultado