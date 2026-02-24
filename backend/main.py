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

BARRIOS = [
    "Pocitos", "Punta Carretas", "Parque Rodó", "Palermo",
    "Cordón", "Centro", "Aguada", "Prado", "Buceo",
    "Malvín", "Carrasco", "Montevideo Viejo", "Sayago",
    "Tres Cruces", "La Blanqueada", "Unión", "Cerrito"
]

def es_direccion_valida(lugar: dict) -> bool:
    direccion = lugar.get("formatted_address", "")
    return "+" not in direccion.split(",")[0]

def buscar_negocios(barrio: str) -> list:
    categorias = [
        "panaderías", "rotiserías", "carnicerías",
        "pizzerías", "restaurantes", "supermercados"
    ]
    todos = []
    vistos = set()
    for categoria in categorias:
        resultado = gmaps.places(
            query=f"{categoria} en {barrio}, Montevideo",
            language="es"
        )
        for lugar in resultado["results"]:
            if lugar["name"] not in vistos and es_direccion_valida(lugar):
                if not fue_visitado_recientemente(lugar["name"], lugar.get("formatted_address", "")):
                    vistos.add(lugar["name"])
                    todos.append(lugar)
    return todos

def generar_roadmap(barrio: str, enviar_whatsapp: bool = False) -> dict:
    negocios = buscar_negocios(barrio)
    if not negocios:
        return {"error": "No se encontraron negocios", "barrio": barrio}

    seleccionados = score_negocios(negocios)

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
        "total_encontrados": len(negocios),
        "seleccionados": seleccionados,
        "distancia_km": distancia_km,
        "tiempo_min": tiempo_min
    }

if __name__ == "__main__":
    barrio = "Pocitos"
    print(f"Buscando negocios en {barrio}...")
    resultado = generar_roadmap(barrio, enviar_whatsapp=True)
    print(f"\n🗓️  TOP 10 negocios para visitar en {barrio}:\n")
    for i, n in enumerate(resultado["seleccionados"], 1):
        print(f"{i}. {n['nombre']}")
        print(f"   📍 {n['direccion']}")
        print(f"   💡 {n['razon']}")
        print()