# backend/scorer.py
import anthropic
import logging
from dotenv import load_dotenv
import json

load_dotenv(override=True)

logger = logging.getLogger(__name__)
client = anthropic.Anthropic()

PROMPT_CHICO = """
Sos un experto comercial de una distribuidora de pan rallado en Uruguay (Montevideo).
Tu tarea es elegir los 10 mejores negocios para visitar y ofrecer pan rallado.

CRITERIOS DE SCORING (en orden de importancia):

1. TIPO DE NEGOCIO (el más importante)
   - Prioridad MUY ALTA: rotiserías, carnicerías, pollerías, avícolas, casas de empanadas, milaneserías, parrilladas
   - Prioridad ALTA: pizzerías, sandwicherías, kioscos con comida, casas de comida, viandas
   - Prioridad MEDIA: restaurantes, panaderías, confiterías, supermercados, almacenes
   - Prioridad BAJA: cafeterías, heladerías, bares sin cocina

2. POPULARIDAD Y CONFIABILIDAD
   - Preferí negocios con MUCHAS reseñas (más reseñas = negocio activo y con volumen)
   - Un negocio con 200 reseñas y rating 4.0 es mejor candidato que uno con 5 reseñas y rating 5.0
   - Rating mínimo recomendado: 3.5 (negocios con menos pueden tener problemas)

3. DATOS DISPONIBLES
   - Priorizá negocios que tengan dirección completa y datos verificables
   - Más datos = más fácil contactar y visitar

4. POTENCIAL DE VOLUMEN
   - Estimá cuánto pan rallado puede consumir según su tipo y popularidad
   - Un negocio muy concurrido consume más que uno con pocas visitas

En la razón mencioná: tipo de negocio, cantidad de reseñas, rating, y por qué tiene potencial de compra.
Sé específico y conciso (máximo 2 oraciones por razón).
"""

PROMPT_GRANDE = """
Sos un experto comercial de una distribuidora de pan rallado en Uruguay (Montevideo).
Tu tarea es elegir los 10 mejores clientes industriales o de alto volumen para ofrecer pan rallado.

CRITERIOS DE SCORING (en orden de importancia):

1. TIPO DE NEGOCIO (el más importante)
   - Prioridad MUY ALTA: frigoríficos, plantas procesadoras de alimentos, industrias alimentarias, distribuidoras de alimentos
   - Prioridad ALTA: catering industrial, comedores de empresas, servicios de viandas masivos, cocinas centrales
   - Prioridad MEDIA: cadenas de restaurantes, hoteles con cocina, supermercados grandes
   - Prioridad BAJA: negocios chicos o sin relación con procesamiento de alimentos en volumen

2. POPULARIDAD Y ESCALA
   - Más reseñas = operación más grande = mayor volumen potencial
   - Priorizá negocios con muchas reseñas sobre los que tienen pocas
   - Rating mínimo recomendado: 3.5

3. POTENCIAL DE VOLUMEN INDUSTRIAL
   - Estimá volumen semanal/mensual según el tipo y tamaño del negocio
   - Priorizá negocios que claramente procesan grandes cantidades de alimentos

En la razón mencioná: tipo de operación, escala estimada, cantidad de reseñas, y volumen potencial.
Sé específico y conciso (máximo 2 oraciones por razón).
"""

def inferir_tipo(types: list) -> str:
    TIPOS = {
        "restaurant": "Restaurante",
        "food": "Comida",
        "bakery": "Panadería",
        "cafe": "Cafetería",
        "bar": "Bar",
        "meal_takeaway": "Comida para llevar",
        "meal_delivery": "Delivery",
        "supermarket": "Supermercado",
        "grocery_or_supermarket": "Almacén",
        "convenience_store": "Kiosco",
        "butcher_shop": "Carnicería",
        "pizza_restaurant": "Pizzería",
        "sandwich_shop": "Sandwichería",
        "fast_food_restaurant": "Comida rápida",
        "chicken_restaurant": "Pollería",
        "steak_house": "Parrillada",
        "italian_restaurant": "Restaurante italiano",
        "spanish_restaurant": "Restaurante español",
        "american_restaurant": "Restaurante americano",
        "catering": "Catering",
        "food_manufacturer": "Industria alimentaria",
        "storage": "Depósito",
        "wholesaler": "Mayorista",
        "distributor": "Distribuidora",
    }

    # Excluir tipos genéricos
    IGNORAR = {"establishment", "point_of_interest", "food", "store", "premise", "locality"}

    for t in types:
        if t in IGNORAR:
            continue
        if t in TIPOS:
            return TIPOS[t]
        # Si no está mapeado pero no es genérico, formatearlo
        if t not in IGNORAR:
            return t.replace("_", " ").capitalize()

    return "Negocio"

def convertir_negocio(negocio: dict, razon: str = "Candidato directo por pool reducido") -> dict:
    return {
        "nombre": negocio["name"],
        "direccion": negocio.get("formatted_address", "Sin dirección"),
        "razon": razon,
        "tipo": inferir_tipo(negocio.get("types", [])),
        "rating": negocio.get("rating", None),
        "reseñas": negocio.get("user_ratings_total", 0),
        "lat": negocio["geometry"]["location"]["lat"],
        "lng": negocio["geometry"]["location"]["lng"],
    }

def score_negocios(negocios: list, modo: str = "chico") -> list:
    lista_texto = ""
    for i, n in enumerate(negocios):
        rating = n.get('rating', 'Sin rating')
        reseñas = n.get('user_ratings_total', 0)
        tipos = ', '.join(n.get('types', [])[:3]).replace('_', ' ')
        lista_texto += (
            f"{i+1}. NOMBRE: {n['name']} | "
            f"DIRECCIÓN: {n.get('formatted_address', 'Sin dirección')} | "
            f"RATING: {rating} | "
            f"RESEÑAS: {reseñas} | "
            f"TIPOS: {tipos}\n"
        )

    prompt_base = PROMPT_GRANDE if modo == "grande" else PROMPT_CHICO

    prompt = f"""
{prompt_base}

Lista de negocios a evaluar:
{lista_texto}

Respondé ÚNICAMENTE con un JSON válido con este formato, sin bloques de código, sin texto adicional:
{{
  "seleccionados": [
    {{
      "numero": 1,
      "razon": "razón específica de por qué este negocio es buen candidato"
    }}
  ]
}}

El campo "numero" debe ser el número que aparece al inicio de cada línea.
Seleccioná exactamente 10 negocios ordenados de mayor a menor potencial. Si hay menos de 10, seleccioná todos.
"""

    def _llamar():
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()

    def _parsear(contenido):
        if contenido.startswith("```"):
            contenido = contenido.split("```")[1]
            if contenido.startswith("json"):
                contenido = contenido[4:]
        contenido = contenido.strip()
        resultado = json.loads(contenido)
        seleccionados = []
        for item in resultado["seleccionados"]:
            indice = item["numero"] - 1
            if 0 <= indice < len(negocios):
                seleccionados.append(convertir_negocio(negocios[indice], item["razon"]))
            else:
                logger.warning(f"Scorer: número inválido {item['numero']} (rango válido: 1-{len(negocios)})")
        return seleccionados

    seleccionados = _parsear(_llamar())

    if len(seleccionados) < 10 and len(negocios) >= 10:
        logger.warning(f"Scorer devolvió {len(seleccionados)}/10, reintentando...")
        try:
            seleccionados_retry = _parsear(_llamar())
            if len(seleccionados_retry) > len(seleccionados):
                seleccionados = seleccionados_retry
                logger.info(f"Reintento exitoso: {len(seleccionados)} negocios")
            else:
                logger.warning(f"Reintento no mejoró el resultado ({len(seleccionados_retry)} negocios)")
        except Exception as e:
            logger.warning(f"Reintento del scorer falló: {e}")

    logger.info(f"Scorer: {len(seleccionados)} seleccionados de {len(negocios)} candidatos")
    return seleccionados
