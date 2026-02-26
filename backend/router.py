import googlemaps
import os
from dotenv import load_dotenv

load_dotenv(override=True)

gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))

def optimizar_ruta(negocios: list, origen: str = "Tomás Gomensoro 3027, Montevideo, Uruguay") -> list:
    if len(negocios) <= 1:
        return negocios

    destinos = [n['direccion'] for n in negocios]

    try:
        resultado = gmaps.directions(
            origin=origen,
            destination=origen,  # vuelve al origen, así todos son waypoints
            waypoints=destinos,
            optimize_waypoints=True,
            mode="driving",
            language="es"
        )
    except Exception as e:
        print(f"Error al optimizar ruta: {e}")
        return negocios

    if not resultado:
        print("No se pudo optimizar la ruta, se mantiene el orden original")
        return negocios

    orden_optimizado = resultado[0]["waypoint_order"]

    if len(orden_optimizado) != len(negocios):
        print(f"   ⚠️ Orden inesperado ({len(orden_optimizado)} vs {len(negocios)}), se mantiene orden original")
        return negocios, None, None

    negocios_ordenados = [negocios[i] for i in orden_optimizado]

    legs = resultado[0]["legs"]
    distancia_total = sum(leg["distance"]["value"] for leg in legs) / 1000
    tiempo_total = sum(leg["duration"]["value"] for leg in legs) // 60

    print(f"   🗺️  Distancia total: {distancia_total:.1f} km")
    print(f"   ⏱️  Tiempo estimado de viaje: {tiempo_total} minutos\n")

    return negocios_ordenados, distancia_total, tiempo_total