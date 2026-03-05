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
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visitas (
            id SERIAL PRIMARY KEY,
            negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
            fecha TIMESTAMP NOT NULL,
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

def marcar_visitado(nombre: str, direccion: str, resultado: str = "visitado", notas: str = "",
                    telefono: str = None, email: str = None, horario: str = None,
                    tipo_negocio: str = None, nivel_operativo: str = None,
                    tiene_rotiseria: bool = False, tiene_produccion_propia: bool = False):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        ahora = datetime.now()

        # Construir update dinámico — solo pisa campos que vienen con valor
        fields = ["visitado = TRUE", "fecha_ultima_visita = %s", "resultado = %s"]
        values = [ahora, resultado]

        if notas:
            fields.append("notas = %s"); values.append(notas)
        if telefono is not None:
            fields.append("telefono = %s"); values.append(telefono)
        if email is not None:
            fields.append("email = %s"); values.append(email)
        if horario is not None:
            fields.append("horario = %s"); values.append(horario)
        if tipo_negocio is not None:
            fields.append("tipo_negocio = %s"); values.append(tipo_negocio)
        if nivel_operativo is not None:
            fields.append("nivel_operativo = %s"); values.append(nivel_operativo)
        if tiene_rotiseria:
            fields.append("tiene_rotiseria = %s"); values.append(tiene_rotiseria)
        if tiene_produccion_propia:
            fields.append("tiene_produccion_propia = %s"); values.append(tiene_produccion_propia)

        values.extend([nombre, direccion])
        cursor.execute(f"""
            UPDATE negocios SET {', '.join(fields)}
            WHERE nombre = %s AND direccion = %s
        """, values)

        # Guardar la visita en el historial
        cursor.execute("SELECT id FROM negocios WHERE nombre = %s AND direccion = %s", (nombre, direccion))
        row = cursor.fetchone()
        if row:
            cursor.execute(
                "INSERT INTO visitas (negocio_id, fecha, notas) VALUES (%s, %s, %s)",
                (row[0], ahora, notas or None)
            )

        conn.commit()
    finally:
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

def obtener_historial_zona(barrios: list) -> list:
    """Devuelve negocios cuyo barrio esté dentro de la lista dada (ej: todos los de Montevideo)."""
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "SELECT * FROM negocios WHERE barrio = ANY(%s) ORDER BY fecha_ultima_visita DESC",
        (barrios,)
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(r) for r in rows]

def obtener_visitas(negocio_id: int) -> list:
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "SELECT * FROM visitas WHERE negocio_id = %s ORDER BY fecha DESC",
        (negocio_id,)
    )
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

def desmarcar_visitado(nombre: str, direccion: str):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE negocios
        SET visitado = FALSE,
            resultado = NULL,
            fecha_ultima_visita = NULL,
            notas = NULL,
            telefono = NULL,
            email = NULL,
            horario = NULL,
            tipo_negocio = NULL,
            nivel_operativo = NULL,
            tiene_rotiseria = FALSE,
            tiene_produccion_propia = FALSE
        WHERE nombre = %s AND direccion = %s
    """, (nombre, direccion))
    conn.commit()
    cursor.close()
    conn.close()