from twilio.rest import Client
from dotenv import load_dotenv
import logging
import os
from datetime import datetime

load_dotenv(override=True)

logger = logging.getLogger(__name__)

def enviar_roadmap_whatsapp(barrio: str, negocios: list, distancia: float = None, tiempo: int = None):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_WHATSAPP_FROM")
    to_number = os.getenv("TWILIO_WHATSAPP_TO")

    if not all([account_sid, auth_token, from_number, to_number]):
        logger.warning("Variables de Twilio no configuradas, se omite el envío de WhatsApp")
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
        logger.info("Roadmap enviado por WhatsApp para barrio %s", barrio)
    except Exception as e:
        logger.error("Error al enviar WhatsApp: %s", type(e).__name__)
