from twilio.rest import Client
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv(override=True)

def enviar_roadmap_whatsapp(barrio: str, negocios: list, distancia: float = None, tiempo: int = None):
    client = Client(
        os.getenv("TWILIO_ACCOUNT_SID"),
        os.getenv("TWILIO_AUTH_TOKEN")
    )

    fecha = datetime.now().strftime("%d/%m/%Y")
    
    mensaje = f"🗓️ *Roadmap {fecha} - {barrio}*\n"
    if distancia and tiempo:
        mensaje += f"🗺️ {distancia:.1f} km | ⏱️ {tiempo} min\n"
    mensaje += "─────────────────────\n\n"

    for i, n in enumerate(negocios, 1):
        # Acortamos la dirección eliminando el código postal y país
        direccion = n['direccion'].split(',')[0]
        mensaje += f"*{i}. {n['nombre']}*\n"
        mensaje += f"📍 {direccion}\n\n"

    mensaje += "¡Buenas ventas! 💪"

    client.messages.create(
        body=mensaje,
        from_=os.getenv("TWILIO_WHATSAPP_FROM"),
        to=os.getenv("TWILIO_WHATSAPP_TO")
    )

    print("✅ Roadmap enviado por WhatsApp")