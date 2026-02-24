from groq import Groq
from dotenv import load_dotenv
import json

load_dotenv(override=True)

client = Groq()

def score_negocios(negocios: list) -> list:

    lista_texto = ""
    for i, n in enumerate(negocios):
        lista_texto += f"{i+1}. NOMBRE: {n['name']} | DIRECCIÓN: {n.get('formatted_address', 'Sin dirección')} | Rating: {n.get('rating', 'N/A')}\n"

    prompt = f"""
Sos un asistente comercial de una distribuidora de pan rallado en Uruguay.
Tu tarea es analizar la siguiente lista de negocios y seleccionar los 10 mejores candidatos para ofrecerles pan rallado.

Criterios de selección:
- Prioridad ALTA: rotiserías, carnicerías, casas de empanadas, pizzerías, restaurantes
- Prioridad MEDIA: panaderías, confiterías, supermercados
- Prioridad BAJA: cafeterías, heladerías u otros negocios que difícilmente usen pan rallado

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
Seleccioná exactamente 10 negocios.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )

    contenido = response.choices[0].message.content
    contenido = contenido.strip()
    if contenido.startswith("```"):
        contenido = contenido.split("```")[1]
        if contenido.startswith("json"):
            contenido = contenido[4:]
    contenido = contenido.strip()

    resultado = json.loads(contenido)

    # Convertimos los números a negocios reales
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