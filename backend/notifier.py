from twilio.rest import Client
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv(override=True)

def enviar_roadmap_whatsapp(barrio: str, negocios: list, distancia: float = None, tiempo: int = None):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_WHATSAPP_FROM")
    to_number = os.getenv("TWILIO_WHATSAPP_TO")

    if not all([account_sid, auth_token, from_number, to_number]):
        print("⚠️ Variables de Twilio no configuradas")
        return

    client = Client(account_sid, auth_token)

    fecha = datetime.now().strftime("%d/%m/%Y")

    mensaje = f"🗓️ *Roadmap {fecha} - {barrio}*\n"
    if distancia and tiempo:
        mensaje += f"🗺️ {distancia:.1f} km | ⏱️ {tiempo} min\n"
    mensaje += "─────────────────────\n\n"

    for i, n in enumerate(negocios, 1):
        direccion = n['direccion'].split(',')[0]
        mensaje += f"*{i}. {n['nombre']}*\n"
        mensaje += f"📍 {direccion}\n\n"

    mensaje += "¡Buenas ventas! 💪"

    try:
        client.messages.create(
            body=mensaje,
            from_=from_number,
            to=to_number
        )
        print("✅ Roadmap enviado por WhatsApp")
    except Exception as e:
        print(f"❌ Error al enviar WhatsApp: {e}")