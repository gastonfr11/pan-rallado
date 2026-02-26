# backend/database.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

def get_conn():
    return psycopg2.connect(DATABASE_URL)

def init_db():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS negocios (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            direccion TEXT NOT NULL,
            barrio TEXT,
            tipo TEXT,
            fecha_primera_visita TIMESTAMP,
            fecha_ultima_visita TIMESTAMP,
            visitado BOOLEAN DEFAULT FALSE,
            resultado TEXT DEFAULT 'sin_respuesta',
            notas TEXT
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()

def registrar_negocio(nombre: str, direccion: str, barrio: str, tipo: str = None):
    """Registra un negocio como mostrado pero NO visitado todavía."""
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM negocios WHERE nombre = %s AND direccion = %s",
        (nombre, direccion)
    )
    existente = cursor.fetchone()

    ahora = datetime.now()

    if not existente:
        cursor.execute("""
            INSERT INTO negocios (nombre, direccion, barrio, tipo, fecha_primera_visita, fecha_ultima_visita, visitado)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE)
        """, (nombre, direccion, barrio, tipo, ahora, ahora))

    conn.commit()
    cursor.close()
    conn.close()

def marcar_visitado(nombre: str, direccion: str, resultado: str = "sin_respuesta", notas: str = ""):
    """Marca un negocio como visitado — solo se llama cuando el vendedor lo confirma."""
    conn = get_conn()
    cursor = conn.cursor()

    ahora = datetime.now()

    cursor.execute("""
        UPDATE negocios
        SET visitado = TRUE, fecha_ultima_visita = %s, resultado = %s, notas = %s
        WHERE nombre = %s AND direccion = %s
    """, (ahora, resultado, notas, nombre, direccion))

    conn.commit()
    cursor.close()
    conn.close()

def fue_visitado(nombre: str, direccion: str) -> bool:
    """Devuelve True solo si el vendedor marcó el negocio como visitado."""
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT visitado FROM negocios WHERE nombre = %s AND direccion = %s",
        (nombre, direccion)
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return False
    return row[0] is True

def obtener_historial(barrio: str = None) -> list:
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    if barrio:
        cursor.execute(
            "SELECT * FROM negocios WHERE barrio = %s ORDER BY fecha_ultima_visita DESC",
            (barrio,)
        )
    else:
        cursor.execute("SELECT * FROM negocios ORDER BY fecha_ultima_visita DESC")

    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(r) for r in rows]

def resetear_db():
    """Borra todos los registros de la base de datos."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM negocios")
    conn.commit()
    cursor.close()
    conn.close()