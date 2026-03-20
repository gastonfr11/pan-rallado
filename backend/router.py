import googlemaps
import logging
import os
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))

def optimizar_ruta(negocios: list, origen: str = "Tomás Gomensoro 3027, Montevideo, Uruguay") -> list:
    if len(negocios) <= 1:
        return negocios, None, None

    destinos = [n['direccion'] for n in negocios]

    try:
        resultado = gmaps.directions(
            origin=origen,
            destination=origen,
            waypoints=destinos,
            optimize_waypoints=True,
            mode="driving",
            language="es"
        )
    except Exception as e:
        logger.error("Error al optimizar ruta: %s", type(e).__name__)
        return negocios, None, None

    if not resultado:
        logger.warning("No se pudo optimizar la ruta, se mantiene el orden original")
        return negocios, None, None

    orden_optimizado = resultado[0]["waypoint_order"]

    if len(orden_optimizado) != len(negocios):
        logger.warning("Orden inesperado (%d vs %d), se mantiene orden original", len(orden_optimizado), len(negocios))
        return negocios, None, None

    negocios_ordenados = [negocios[i] for i in orden_optimizado]

    legs = resultado[0]["legs"]
    distancia_total = sum(leg["distance"]["value"] for leg in legs) / 1000
    tiempo_total = sum(leg["duration"]["value"] for leg in legs) // 60

    logger.info("Ruta optimizada: %.1f km, %d minutos", distancia_total, tiempo_total)

    return negocios_ordenados, distancia_total, tiempo_total
