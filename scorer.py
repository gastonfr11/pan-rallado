from groq import Groq
from dotenv import load_dotenv
import json

load_dotenv(override=True)

client = Groq()

def score_negocios(negocios: list) -> list:
    
    lista_texto = ""
    for i, n in enumerate(negocios):
        lista_texto += f"{i+1}. {n['name']} - {n.get('formatted_address', 'Sin dirección')} - Rating: {n.get('rating', 'N/A')}\n"

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
      "nombre": "nombre del negocio",
      "direccion": "dirección",
      "razon": "explicá específicamente por qué ESTE negocio en particular es buen candidato, considerando su nombre, tipo y ubicación"
    }}
  ]
}}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )

    contenido = response.choices[0].message.content
    
    # Limpiar posible markdown
    contenido = contenido.strip()
    if contenido.startswith("```"):
        contenido = contenido.split("```")[1]
        if contenido.startswith("json"):
            contenido = contenido[4:]
    contenido = contenido.strip()
    
    print("Respuesta del LLM:", contenido[:200])  # para debug
    
    resultado = json.loads(contenido)
    return resultado["seleccionados"]