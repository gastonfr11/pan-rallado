import googlemaps
import os
from dotenv import load_dotenv
from scorer import score_negocios

from database import init_db, fue_visitado_recientemente, registrar_visita

# Inicializar base de datos
init_db()

load_dotenv(override=True)

gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))

def es_direccion_valida(lugar: dict) -> bool:
    direccion = lugar.get("formatted_address", "")
    # Los plus codes tienen el formato XXXX+XXX
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

if __name__ == "__main__":
    barrio = "Pocitos"
    
    print(f"Buscando negocios en {barrio}...")
    negocios = buscar_negocios(barrio)
    print(f"Se encontraron {len(negocios)} negocios en total\n")
    
    print("Analizando con IA y seleccionando los mejores candidatos...")
    seleccionados = score_negocios(negocios)
    
    print(f"\n TOP 10 negocios para visitar en {barrio}:\n")
    for i, n in enumerate(seleccionados, 1):
        print(f"{i}. {n['nombre']}")
        print(f"   📍 {n['direccion']}")
        print(f"   💡 {n['razon']}")
        print()
        registrar_visita(n['nombre'], n['direccion'], barrio)

