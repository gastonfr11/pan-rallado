# backend/main.py
import googlemaps
import os
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from scorer import score_negocios, convertir_negocio
from database import init_db, obtener_visitados_set
from router import optimizar_ruta
from notifier import enviar_roadmap_whatsapp

logger = logging.getLogger(__name__)

load_dotenv(override=True)
init_db()

gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))

# Barrios dentro del departamento de Montevideo
BARRIOS_MONTEVIDEO = [
    "Todo Montevideo",
    "Pocitos", "Punta Carretas", "Parque Rodó", "Palermo", "Cordón",
    "Centro", "Aguada", "Prado", "Buceo", "Malvín", "Carrasco",
    "Ciudad Vieja", "Sayago", "Tres Cruces", "La Blanqueada",
    "Unión", "Cerrito", "Zona Industrial Norte", "Zona Franca",
    "Parque Industrial", "Piedras Blancas", "Flor de Maroñas",
    "Bella Italia", "Camino Maldonado", "Ituzaingó", "Las Canteras",
    "Malvín Norte",
]

# Coordenadas centro + radio en metros por barrio
# Revisadas y corregidas contra OpenStreetMap y datos del INE
BARRIOS = {
    "Todo Montevideo":      {"lat": -34.9011, "lng": -56.1645, "radio": 15000},

    # --- Zona costera este ---
    "Pocitos":              {"lat": -34.9059, "lng": -56.1507, "radio": 1200},
    "Punta Carretas":       {"lat": -34.9180, "lng": -56.1503, "radio": 1000},
    "Buceo":                {"lat": -34.8980, "lng": -56.1350, "radio": 1200},
    "Malvín":               {"lat": -34.8900, "lng": -56.1150, "radio": 1400},
    "Malvín Norte":         {"lat": -34.8750, "lng": -56.1300, "radio": 1400},
    "Carrasco":             {"lat": -34.8720, "lng": -56.0650, "radio": 2000},

    # --- Zona central ---
    "Parque Rodó":          {"lat": -34.9087, "lng": -56.1650, "radio": 900},
    "Palermo":              {"lat": -34.9020, "lng": -56.1620, "radio": 900},
    "Cordón":               {"lat": -34.9010, "lng": -56.1720, "radio": 1000},
    "Centro":               {"lat": -34.9060, "lng": -56.1880, "radio": 1100},
    "Aguada":               {"lat": -34.8960, "lng": -56.1830, "radio": 900},
    "Tres Cruces":          {"lat": -34.8960, "lng": -56.1650, "radio": 900},
    "La Blanqueada":        {"lat": -34.8900, "lng": -56.1750, "radio": 1000},
    "Ciudad Vieja":         {"lat": -34.9050, "lng": -56.2100, "radio": 900},

    # --- Zona norte/noroeste ---
    # Prado: el barrio real está más al norte, coord anterior era demasiado al sur
    "Prado":                {"lat": -34.8620, "lng": -56.2050, "radio": 1400},
    # Sayago: estaba bien en latitud pero un poco desplazado al este
    "Sayago":               {"lat": -34.8800, "lng": -56.2300, "radio": 1400},
    "Cerrito":              {"lat": -34.8600, "lng": -56.1900, "radio": 1200},
    "Unión":                {"lat": -34.8750, "lng": -56.1500, "radio": 1400},
    "Zona Industrial Norte":{"lat": -34.8400, "lng": -56.2000, "radio": 2500},
    "Zona Franca":          {"lat": -34.8300, "lng": -56.1500, "radio": 2500},
    "Parque Industrial":    {"lat": -34.8200, "lng": -56.1800, "radio": 2500},

    # --- Zona este / Maroñas ---
    # Flor de Maroñas: estaba desplazado, el barrio está más al norte
    "Flor de Maroñas":      {"lat": -34.8480, "lng": -56.0980, "radio": 1400},
    # Bella Italia: lindante con Flor de Maroñas, corregido
    "Bella Italia":         {"lat": -34.8500, "lng": -56.1100, "radio": 1600},
    # Camino Maldonado: la zona está más al este
    "Camino Maldonado":     {"lat": -34.8600, "lng": -56.0700, "radio": 1800},
    # Ituzaingó: al este de Bella Italia
    "Ituzaingó":            {"lat": -34.8750, "lng": -56.0600, "radio": 1600},
    # Las Canteras: zona más al este
    "Las Canteras":         {"lat": -34.8600, "lng": -56.0450, "radio": 1600},
    # Piedras Blancas: entre Maroñas y Camino Maldonado
    "Piedras Blancas":      {"lat": -34.8400, "lng": -56.0950, "radio": 1600},

    # --- Zona metropolitana / Canelones ---
    "Ciudad del Plata":     {"lat": -34.7833, "lng": -56.3833, "radio": 3000},
    "Libertad":             {"lat": -34.6333, "lng": -56.6167, "radio": 2500},
    "Puntas de Valdez":     {"lat": -34.7500, "lng": -56.3000, "radio": 1800},
    "Rafael Peraza":        {"lat": -34.8167, "lng": -56.0833, "radio": 1800},
    "Scavino":              {"lat": -34.8000, "lng": -56.0500, "radio": 1800},
    "San José de Mayo":     {"lat": -34.3333, "lng": -56.7167, "radio": 3000},
    "Santa Lucía":          {"lat": -34.4500, "lng": -56.4000, "radio": 2500},
    "Canelones":            {"lat": -34.5167, "lng": -56.2833, "radio": 2500},
    "Aguas Corrientes":     {"lat": -34.4833, "lng": -55.9833, "radio": 2000},
    "San Ramón":            {"lat": -34.2833, "lng": -55.9667, "radio": 2000},
    "San Bautista":         {"lat": -34.4000, "lng": -56.1167, "radio": 2000},
    "Santa Rosa":           {"lat": -34.3500, "lng": -56.5667, "radio": 2000},
    "San Jacinto":          {"lat": -34.5500, "lng": -55.9500, "radio": 2000},
    "Tala":                 {"lat": -34.3500, "lng": -55.7667, "radio": 2000},
    "Sauce":                {"lat": -34.6333, "lng": -56.0667, "radio": 2000},
    "Villa San José":       {"lat": -34.3500, "lng": -56.7000, "radio": 2000},
    "Toledo":               {"lat": -34.6833, "lng": -56.0833, "radio": 2000},
    "Joaquín Suárez":       {"lat": -34.6167, "lng": -55.9833, "radio": 2000},
    "Barros Blancos":       {"lat": -34.7167, "lng": -56.0000, "radio": 2000},
    "Pando":                {"lat": -34.7167, "lng": -55.9500, "radio": 2500},
    "Empalme Olmos":        {"lat": -34.6833, "lng": -55.9167, "radio": 2000},
    "Neptunia":             {"lat": -34.8333, "lng": -55.9500, "radio": 2000},
    "Ciudad de la Costa":   {"lat": -34.8333, "lng": -56.0167, "radio": 3500},
    "Villa El Tato":        {"lat": -34.8167, "lng": -56.0333, "radio": 1800},
    "Paso Carrasco":        {"lat": -34.8500, "lng": -56.0333, "radio": 1800},
    "Shangrilá":            {"lat": -34.8167, "lng": -55.9833, "radio": 1800},
    "Lagomar":              {"lat": -34.8000, "lng": -55.9667, "radio": 1800},
    "El Bosque":            {"lat": -34.7833, "lng": -55.9500, "radio": 1800},
    "Nicolich":             {"lat": -34.8000, "lng": -56.0167, "radio": 1800},
    "Villa Aeroparque":     {"lat": -34.8167, "lng": -56.0000, "radio": 1800},
    "El Pinar":             {"lat": -34.7833, "lng": -55.9333, "radio": 1800},
    "Salinas":              {"lat": -34.7667, "lng": -55.9000, "radio": 2000},
    "Marindia":             {"lat": -34.7500, "lng": -55.8667, "radio": 2000},
}

# Departamentos que NO son Montevideo — usados para filtrar resultados espurios
OTROS_DEPARTAMENTOS = [
    "Canelones", "San José", "Colonia", "Maldonado",
    "Rocha", "Flores", "Florida", "Lavalleja", "Soriano",
]

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

def buscar_negocios(barrio: str, modo: str = "chico", vendedor_id: int = None) -> list:
    categorias = CATEGORIAS_GRANDE if modo == "grande" else CATEGORIAS_CHICO

    visitados = obtener_visitados_set(vendedor_id=vendedor_id)

    if barrio == "Todo Montevideo":
        info = {"lat": -34.9011, "lng": -56.1645, "radio": 15000}
        queries = [
            (f"{c} en Montevideo", (info["lat"], info["lng"]), info["radio"])
            for c in categorias
        ]
        en_barrio_fn = lambda lugar: True
    else:
        info = BARRIOS.get(barrio)
        if not info:
            return []
        sufijo = ", Montevideo" if barrio in BARRIOS_MONTEVIDEO else ", Uruguay"
        queries = [
            (f"{c} en {barrio}{sufijo}", (info["lat"], info["lng"]), info["radio"])
            for c in categorias
        ]
        en_barrio_fn = lambda lugar: esta_en_barrio(lugar, info)

    def _fetch(args):
        query, location, radius = args
        resp = gmaps.places(query=query, location=location, radius=radius, language="es")
        lugares = list(resp.get("results", []))
        next_token = resp.get("next_page_token")
        if next_token:
            ultimo_error = None
            for delay in [2, 4, 8]:
                time.sleep(delay)
                try:
                    resp2 = gmaps.places(page_token=next_token, language="es")
                    lugares.extend(resp2.get("results", []))
                    ultimo_error = None
                    break
                except Exception as e:
                    if "INVALID_REQUEST" in str(e):
                        ultimo_error = e
                        logger.warning(f"page_token no listo aún, reintentando en {delay}s... ('{query}')")
                    else:
                        logger.warning(f"Paginación falló para '{query}': {e}")
                        break
            if ultimo_error:
                logger.warning(f"Paginación agotó reintentos para '{query}': {ultimo_error}")
        logger.info(f"Query '{query}': {len(lugares)} resultados de Google")
        return lugares

    with ThreadPoolExecutor(max_workers=len(queries)) as executor:
        resultados = list(executor.map(_fetch, queries))

    todos = []
    vistos = set()
    rechazados_geo = 0
    rechazados_dept = 0
    for lugares in resultados:
        for lugar in lugares:
            nombre = lugar["name"]
            direccion = lugar.get("formatted_address", "")
            if nombre not in vistos and es_direccion_valida(lugar):
                if not en_barrio_fn(lugar):
                    rechazados_geo += 1
                    continue
                if barrio in BARRIOS_MONTEVIDEO and not es_de_region_correcta(lugar):
                    rechazados_dept += 1
                    continue
                if (nombre, direccion) not in visitados:
                    vistos.add(nombre)
                    lugar["_modo"] = modo
                    todos.append(lugar)

    logger.info(
        f"Barrio '{barrio}': {len(todos)} candidatos "
        f"(rechazados por geo: {rechazados_geo}, por departamento: {rechazados_dept})"
    )

    # Nearby Search fallback cuando el pool es bajo
    if barrio != "Todo Montevideo" and len(todos) < 15:
        logger.info(f"Pool bajo ({len(todos)}), activando Nearby Search fallback...")
        tipos_nearby = ["restaurant", "food"]
        for tipo in tipos_nearby:
            try:
                resp_nb = gmaps.places_nearby(
                    location=(info["lat"], info["lng"]),
                    radius=info["radio"],
                    type=tipo,
                    language="es"
                )
                for lugar in resp_nb.get("results", []):
                    nombre = lugar["name"]
                    direccion = lugar.get("formatted_address", "")
                    if nombre not in vistos and es_direccion_valida(lugar) and esta_en_barrio(lugar, info):
                        if (nombre, direccion) not in visitados:
                            vistos.add(nombre)
                            lugar["_modo"] = modo
                            todos.append(lugar)
            except Exception as e:
                logger.warning(f"Nearby Search fallback ({tipo}) falló: {e}")
        logger.info(f"Pool tras Nearby Search: {len(todos)} candidatos")

    return todos

def tiene_negocios(barrio: str, modo: str = "chico", minimo: int = 5) -> bool:
    info = BARRIOS.get(barrio)
    if not info:
        return False
    categorias = CATEGORIAS_GRANDE if modo == "grande" else CATEGORIAS_CHICO
    sufijo = ", Montevideo" if barrio in BARRIOS_MONTEVIDEO else ", Uruguay"
    resultado = gmaps.places(
        query=f"{categorias[0]} en {barrio}{sufijo}",
        location=(info["lat"], info["lng"]),
        radius=info["radio"],
        language="es"
    )
    validos = [
        l for l in resultado.get("results", [])
        if es_direccion_valida(l) and esta_en_barrio(l, info)
    ]
    return len(validos) >= minimo

def buscar_por_nombre(nombre: str, barrio: str = "Todo Montevideo", vendedor_id: int = None) -> list:
    visitados = obtener_visitados_set(vendedor_id=vendedor_id)

    if barrio == "Todo Montevideo":
        info = {"lat": -34.9011, "lng": -56.1645, "radio": 15000}
        query = f"{nombre} en Montevideo"
        en_barrio_fn = lambda lugar: True
    else:
        info = BARRIOS.get(barrio)
        if not info:
            return []
        sufijo = ", Montevideo" if barrio in BARRIOS_MONTEVIDEO else ", Uruguay"
        query = f"{nombre} en {barrio}{sufijo}"
        en_barrio_fn = lambda lugar: esta_en_barrio(lugar, info)

    resultado = gmaps.places(
        query=query,
        location=(info["lat"], info["lng"]),
        radius=info["radio"],
        language="es"
    )

    negocios = []
    vistos = set()
    for lugar in resultado.get("results", []):
        nombre_lugar = lugar["name"]
        direccion = lugar.get("formatted_address", "")
        if nombre_lugar not in vistos and es_direccion_valida(lugar) and en_barrio_fn(lugar):
            vistos.add(nombre_lugar)
            geo = lugar.get("geometry", {}).get("location", {})
            tipos = lugar.get("types", [])
            tipo = tipos[0].replace("_", " ") if tipos else "negocio"
            negocios.append({
                "nombre": nombre_lugar,
                "direccion": direccion,
                "lat": geo.get("lat"),
                "lng": geo.get("lng"),
                "tipo": tipo,
                "ya_visitado": (nombre_lugar, direccion) in visitados,
                "razon": "",
            })

    return negocios

def generar_roadmap(barrio: str, enviar_whatsapp: bool = False, modo: str = "chico", vendedor_id: int = None) -> dict:
    negocios = buscar_negocios(barrio, modo=modo, vendedor_id=vendedor_id)
    if not negocios:
        return {"error": "No se encontraron negocios", "barrio": barrio}

    if len(negocios) <= 10:
        logger.info(f"Pool reducido ({len(negocios)} candidatos), saltando scorer")
        seleccionados = [convertir_negocio(n) for n in negocios]
    else:
        seleccionados = score_negocios(negocios, modo=modo)

    distancia_km = None
    tiempo_min = None

    if len(seleccionados) >= 2:
        seleccionados, distancia_km, tiempo_min = optimizar_ruta(seleccionados)

    for n in seleccionados:
        n["barrio"] = barrio

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
        return distancia_km(lat, lng, info["lat"], info["lng"]) <= (info["radio"] / 1000)
    except (KeyError, TypeError):
        return False

def es_de_region_correcta(lugar: dict) -> bool:
    """Rechaza resultados cuya dirección menciona claramente otro departamento."""
    direccion = lugar.get("formatted_address", "")
    for dept in OTROS_DEPARTAMENTOS:
        if dept in direccion:
            return False
    return True