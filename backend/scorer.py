# backend/scorer.py
import anthropic
from dotenv import load_dotenv
import json

load_dotenv(override=True)

client = anthropic.Anthropic()

PROMPT_CHICO = """
Sos un asistente comercial de una distribuidora de pan rallado en Uruguay.
Tu tarea es analizar la siguiente lista de negocios y seleccionar los 10 mejores candidatos para ofrecerles pan rallado.

Criterios de selección:
- Prioridad ALTA: rotiserías, carnicerías, pollerías, avícolas, casas de empanadas, pizzerías, parrilladas, sandwicherías, kioscos con comidas, milanesería
- Prioridad MEDIA: restaurantes, viandas, panaderías, confiterías, supermercados
- Prioridad BAJA: cafeterías, heladerías u otros negocios que difícilmente usen pan rallado en volumen

Tené en cuenta que hoy hasta un kiosco que vende milanesas al pan es un cliente potencial.
"""

PROMPT_GRANDE = """
Sos un asistente comercial de una distribuidora de pan rallado en Uruguay que busca clientes industriales y de alto volumen.
Tu tarea es analizar la siguiente lista de empresas y seleccionar los 10 mejores candidatos para ofrecerles pan rallado en cantidad.

Criterios de selección:
- Prioridad ALTA: frigoríficos, plantas procesadoras de alimentos, distribuidoras de alimentos, industrias alimentarias
- Prioridad ALTA: empresas de catering, servicios de viandas para empresas, comedores industriales
- Prioridad MEDIA: grandes restaurantes, cadenas de comida, hoteles con cocina
- Prioridad BAJA: empresas que no tienen relación con procesamiento o preparación de alimentos

Para cada seleccionado, la razón debe mencionar el volumen potencial estimado y por qué encaja como cliente industrial.
"""

def score_negocios(negocios: list, modo: str = "chico") -> list:
    lista_texto = ""
    for i, n in enumerate(negocios):
        lista_texto += f"{i+1}. NOMBRE: {n['name']} | DIRECCIÓN: {n.get('formatted_address', 'Sin dirección')} | Rating: {n.get('rating', 'N/A')}\n"

    prompt_base = PROMPT_GRANDE if modo == "grande" else PROMPT_CHICO

    prompt = f"""
{prompt_base}

Lista de negocios:
{lista_texto}

Respondé ÚNICAMENTE con un JSON válido con este formato, sin bloques de código, sin texto adicional, sin markdown:
{{
  "seleccionados": [
    {{
      "numero": 1,
      "razon": "explicá específicamente por qué este negocio es buen candidato"
    }}
  ]
}}

El campo "numero" debe ser el número que aparece al inicio de cada línea de la lista.
Seleccioná exactamente 10 negocios. Si hay menos de 10, seleccioná todos los que haya.
"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    contenido = response.content[0].text.strip()

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
            negocio = negocios[indice]
            seleccionados.append({
                "nombre": negocio["name"],
                "direccion": negocio.get("formatted_address", "Sin dirección"),
                "razon": item["razon"],
                "tipo": negocio.get("types", ["negocio"])[0].replace("_", " "),
                "rating": negocio.get("rating", None),
                "lat": negocio["geometry"]["location"]["lat"],
                "lng": negocio["geometry"]["location"]["lng"],
            })

    return seleccionados