# backend/main.py
import googlemaps
import os
from dotenv import load_dotenv
from scorer import score_negocios
from database import init_db, fue_visitado_recientemente, registrar_visita
from router import optimizar_ruta
from notifier import enviar_roadmap_whatsapp

load_dotenv(override=True)
init_db()

gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))

# Coordenadas centro + radio en metros por barrio
BARRIOS = {
    "Pocitos":              {"lat": -34.9059, "lng": -56.1507, "radio": 1000},
    "Punta Carretas":       {"lat": -34.9180, "lng": -56.1503, "radio": 900},
    "Parque Rodó":          {"lat": -34.9087, "lng": -56.1650, "radio": 800},
    "Palermo":              {"lat": -34.9020, "lng": -56.1620, "radio": 800},
    "Cordón":               {"lat": -34.9010, "lng": -56.1720, "radio": 900},
    "Centro":               {"lat": -34.9060, "lng": -56.1880, "radio": 1000},
    "Aguada":               {"lat": -34.8960, "lng": -56.1830, "radio": 800},
    "Prado":                {"lat": -34.8780, "lng": -56.1920, "radio": 1200},
    "Buceo":                {"lat": -34.8980, "lng": -56.1350, "radio": 1000},
    "Malvín":               {"lat": -34.8900, "lng": -56.1150, "radio": 1200},
    "Carrasco":             {"lat": -34.8720, "lng": -56.0650, "radio": 1500},
    "Montevideo Viejo":     {"lat": -34.9050, "lng": -56.2100, "radio": 800},
    "Sayago":               {"lat": -34.8750, "lng": -56.2200, "radio": 1200},
    "Tres Cruces":          {"lat": -34.8960, "lng": -56.1650, "radio": 800},
    "La Blanqueada":        {"lat": -34.8900, "lng": -56.1750, "radio": 900},
    "Unión":                {"lat": -34.8750, "lng": -56.1500, "radio": 1200},
    "Cerrito":              {"lat": -34.8650, "lng": -56.1800, "radio": 1000},
    "Zona Industrial Norte":{"lat": -34.8400, "lng": -56.2000, "radio": 2000},
    "Zona Franca":          {"lat": -34.8300, "lng": -56.1500, "radio": 2000},
    "Parque Industrial":    {"lat": -34.8200, "lng": -56.1800, "radio": 2000},
}

CATEGORIAS_CHICO = [
    "pizzerías",
    "rotiserías",
    "carnicerías",
    "pollerías",
    "avícola",
    "restaurantes",
    "parrilladas",
    "empanadas",
    "milanesas",
    "kiosco comidas",
    "sandwichería",
    "viandas",
    "panaderías",
    "confiterías",
    "supermercados",
]

CATEGORIAS_GRANDE = [
    "empresa catering",
    "servicio de viandas empresas",
    "frigorífico",
    "procesadora de alimentos",
    "distribuidora de alimentos",
    "industria alimentaria",
    "planta de producción alimentos",
]

def es_direccion_valida(lugar: dict) -> bool:
    direccion = lugar.get("formatted_address", "")
    return "+" not in direccion.split(",")[0]

def buscar_negocios(barrio: str, modo: str = "chico") -> list:
    info = BARRIOS.get(barrio)
    if not info:
        return []

    categorias = CATEGORIAS_GRANDE if modo == "grande" else CATEGORIAS_CHICO
    todos = []
    vistos = set()

    for categoria in categorias:
        resultado = gmaps.places(
            query=f"{categoria} en {barrio}, Montevideo",
            location=(info["lat"], info["lng"]),
            radius=info["radio"],
            language="es"
        )
        for lugar in resultado["results"]:
            if lugar["name"] not in vistos and es_direccion_valida(lugar) and esta_en_barrio(lugar, info):
                if not fue_visitado_recientemente(lugar["name"], lugar.get("formatted_address", "")):
                    vistos.add(lugar["name"])
                    lugar["_modo"] = modo
                    todos.append(lugar)

    return todos

def generar_roadmap(barrio: str, enviar_whatsapp: bool = False, modo: str = "chico") -> dict:
    negocios = buscar_negocios(barrio, modo=modo)
    if not negocios:
        return {"error": "No se encontraron negocios", "barrio": barrio}

    seleccionados = score_negocios(negocios, modo=modo)

    distancia_km = None
    tiempo_min = None

    if len(seleccionados) >= 2:
        seleccionados, distancia_km, tiempo_min = optimizar_ruta(seleccionados)

    for n in seleccionados:
        registrar_visita(n["nombre"], n["direccion"], barrio)

    if enviar_whatsapp:
        enviar_roadmap_whatsapp(barrio, seleccionados, distancia_km, tiempo_min)

    return {
        "barrio": barrio,
        "modo": modo,
        "total_encontrados": len(negocios),
        "seleccionados": seleccionados,
        "distancia_km": distancia_km,
        "tiempo_min": tiempo_min
    }

if __name__ == "__main__":
    barrio = "Pocitos"
    print(f"Buscando negocios en {barrio}...")
    resultado = generar_roadmap(barrio, enviar_whatsapp=True, modo="chico")
    print(f"\n🗓️  TOP 10 negocios para visitar en {barrio}:\n")
    for i, n in enumerate(resultado["seleccionados"], 1):
        print(f"{i}. {n['nombre']}")
        print(f"   📍 {n['direccion']}")
        print(f"   💡 {n['razon']}")
        print()

import math

def distancia_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def esta_en_barrio(lugar: dict, info: dict) -> bool:
    try:
        lat = lugar["geometry"]["location"]["lat"]
        lng = lugar["geometry"]["location"]["lng"]
        return distancia_km(lat, lng, info["lat"], info["lng"]) <= (info["radio"] / 1000) * 1.2
    except:
        return True