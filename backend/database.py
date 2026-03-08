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

    # Tabla de usuarios
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nombre TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'vendedor',
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Tabla de negocios
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

    # Migración: agregar vendedor_id a negocios si no existe
    cursor.execute("""
        ALTER TABLE negocios ADD COLUMN IF NOT EXISTS vendedor_id INTEGER REFERENCES usuarios(id)
    """)

    conn.commit()

    # Crear admin por defecto si no existe ninguno
    admin_email = os.getenv("ADMIN_EMAIL", "admin@panrallado.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin1234")
    admin_nombre = os.getenv("ADMIN_NOMBRE", "Administrador")

    cursor.execute("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1")
    admin = cursor.fetchone()

    if not admin:
        from auth import hash_password
        cursor.execute(
            "INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (%s, %s, %s, 'admin') RETURNING id",
            (admin_email, hash_password(admin_password), admin_nombre)
        )
        admin_id = cursor.fetchone()[0]
        conn.commit()

        # Asignar negocios existentes sin vendedor al admin por defecto
        cursor.execute(
            "UPDATE negocios SET vendedor_id = %s WHERE vendedor_id IS NULL",
            (admin_id,)
        )
        conn.commit()
    else:
        admin_id = admin[0]
        # Asignar negocios que aún no tienen vendedor
        cursor.execute(
            "UPDATE negocios SET vendedor_id = %s WHERE vendedor_id IS NULL",
            (admin_id,)
        )
        conn.commit()

    cursor.close()
    conn.close()


# ── USUARIOS ───────────────────────────────────────────

def crear_usuario(email: str, password_hash: str, nombre: str, rol: str = "vendedor") -> int:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (%s, %s, %s, %s) RETURNING id",
        (email, password_hash, nombre, rol)
    )
    user_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return user_id


def obtener_usuario_por_email(email: str) -> dict | None:
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM usuarios WHERE email = %s AND activo = TRUE", (email,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return dict(row) if row else None


def obtener_todos_usuarios() -> list:
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id, email, nombre, rol, activo, created_at FROM usuarios ORDER BY created_at")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(r) for r in rows]


def eliminar_usuario(user_id: int):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM usuarios WHERE id = %s", (user_id,))
    conn.commit()
    cursor.close()
    conn.close()


def obtener_stats_por_vendedor() -> list:
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT u.id, u.nombre, u.email,
               COUNT(n.id) FILTER (WHERE n.visitado = TRUE) AS visitados,
               COUNT(n.id) FILTER (WHERE n.resultado = 'cliente') AS clientes,
               COUNT(n.id) FILTER (WHERE n.resultado = 'interesado') AS interesados,
               COUNT(n.id) FILTER (WHERE n.resultado = 'no_interesado') AS no_interesados,
               ROUND(
                 COUNT(n.id) FILTER (WHERE n.resultado = 'cliente')::numeric /
                 NULLIF(COUNT(n.id) FILTER (WHERE n.visitado = TRUE), 0) * 100, 1
               ) AS tasa_conversion,
               MAX(n.fecha_ultima_visita) AS ultima_actividad,
               COUNT(DISTINCT n.barrio) FILTER (WHERE n.visitado = TRUE) AS barrios_visitados
        FROM usuarios u
        LEFT JOIN negocios n ON n.vendedor_id = u.id
        WHERE u.activo = TRUE AND u.rol = 'vendedor'
        GROUP BY u.id, u.nombre, u.email
        ORDER BY visitados DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(r) for r in rows]


def obtener_negocios_por_vendedor(vendedor_id: int) -> list:
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT id, nombre, direccion, barrio, resultado, tipo_negocio,
               fecha_primera_visita, fecha_ultima_visita, notas
        FROM negocios
        WHERE vendedor_id = %s AND visitado = TRUE
        ORDER BY fecha_ultima_visita DESC NULLS LAST
    """, (vendedor_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(r) for r in rows]


# ── NEGOCIOS ───────────────────────────────────────────

def registrar_negocio(nombre: str, direccion: str, barrio: str, tipo: str = None, vendedor_id: int = None):
    """Registra un negocio como mostrado pero NO visitado todavía."""
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM negocios WHERE nombre = %s AND direccion = %s AND vendedor_id IS NOT DISTINCT FROM %s",
        (nombre, direccion, vendedor_id)
    )
    existente = cursor.fetchone()

    ahora = datetime.now()

    if not existente:
        cursor.execute("""
            INSERT INTO negocios (nombre, direccion, barrio, tipo, fecha_primera_visita, fecha_ultima_visita, visitado, vendedor_id)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE, %s)
        """, (nombre, direccion, barrio, tipo, ahora, ahora, vendedor_id))

    conn.commit()
    cursor.close()
    conn.close()


def marcar_visitado(nombre: str, direccion: str, resultado: str = "visitado", notas: str = "",
                    telefono: str = None, email: str = None, horario: str = None,
                    tipo_negocio: str = None, nivel_operativo: str = None,
                    tiene_rotiseria: bool = False, tiene_produccion_propia: bool = False,
                    vendedor_id: int = None):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        ahora = datetime.now()

        fields = ["visitado = TRUE", "fecha_ultima_visita = %s", "resultado = %s"]
        values = [ahora, resultado]

        if notas:
            fields.append("notas = %s")
            values.append(notas)
        if telefono is not None:
            fields.append("telefono = %s")
            values.append(telefono)
        if email is not None:
            fields.append("email = %s")
            values.append(email)
        if horario is not None:
            fields.append("horario = %s")
            values.append(horario)
        if tipo_negocio is not None:
            fields.append("tipo_negocio = %s")
            values.append(tipo_negocio)
        if nivel_operativo is not None:
            fields.append("nivel_operativo = %s")
            values.append(nivel_operativo)
        if tiene_rotiseria:
            fields.append("tiene_rotiseria = %s")
            values.append(tiene_rotiseria)
        if tiene_produccion_propia:
            fields.append("tiene_produccion_propia = %s")
            values.append(tiene_produccion_propia)

        if vendedor_id is not None:
            values.extend([nombre, direccion, vendedor_id])
            cursor.execute(f"""
                UPDATE negocios SET {', '.join(fields)}
                WHERE nombre = %s AND direccion = %s AND vendedor_id = %s
            """, values)
        else:
            values.extend([nombre, direccion])
            cursor.execute(f"""
                UPDATE negocios SET {', '.join(fields)}
                WHERE nombre = %s AND direccion = %s
            """, values)

        cursor.execute(
            "SELECT id FROM negocios WHERE nombre = %s AND direccion = %s AND vendedor_id IS NOT DISTINCT FROM %s",
            (nombre, direccion, vendedor_id)
        )
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


def fue_visitado(nombre: str, direccion: str, vendedor_id: int = None) -> bool:
    conn = get_conn()
    cursor = conn.cursor()

    if vendedor_id is not None:
        cursor.execute(
            "SELECT visitado FROM negocios WHERE nombre = %s AND direccion = %s AND vendedor_id = %s",
            (nombre, direccion, vendedor_id)
        )
    else:
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


def obtener_historial(barrio: str = None, vendedor_id: int = None) -> list:
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    if barrio and vendedor_id is not None:
        cursor.execute(
            "SELECT * FROM negocios WHERE barrio = %s AND vendedor_id = %s ORDER BY fecha_ultima_visita DESC",
            (barrio, vendedor_id)
        )
    elif barrio:
        cursor.execute(
            "SELECT * FROM negocios WHERE barrio = %s ORDER BY fecha_ultima_visita DESC",
            (barrio,)
        )
    elif vendedor_id is not None:
        cursor.execute(
            "SELECT * FROM negocios WHERE vendedor_id = %s ORDER BY fecha_ultima_visita DESC",
            (vendedor_id,)
        )
    else:
        cursor.execute("SELECT * FROM negocios ORDER BY fecha_ultima_visita DESC")

    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(r) for r in rows]


def obtener_visitados_set(vendedor_id: int = None) -> set:
    """Devuelve un set de (nombre, direccion) de todos los negocios ya visitados — una sola query."""
    conn = get_conn()
    cursor = conn.cursor()

    if vendedor_id is not None:
        cursor.execute(
            "SELECT nombre, direccion FROM negocios WHERE visitado = TRUE AND vendedor_id = %s",
            (vendedor_id,)
        )
    else:
        cursor.execute("SELECT nombre, direccion FROM negocios WHERE visitado = TRUE")

    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {(r[0], r[1]) for r in rows}


def obtener_historial_zona(barrios: list, vendedor_id: int = None) -> list:
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    if vendedor_id is not None:
        cursor.execute(
            "SELECT * FROM negocios WHERE barrio = ANY(%s) AND vendedor_id = %s ORDER BY fecha_ultima_visita DESC",
            (barrios, vendedor_id)
        )
    else:
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


def obtener_barrios_recientes(n: int = 5, vendedor_id: int = None) -> list:
    """Devuelve los últimos N barrios distintos donde se visitaron negocios."""
    conn = get_conn()
    cursor = conn.cursor()

    if vendedor_id is not None:
        cursor.execute("""
            SELECT DISTINCT ON (barrio) barrio, fecha_ultima_visita
            FROM negocios
            WHERE visitado = TRUE AND barrio IS NOT NULL AND vendedor_id = %s
            ORDER BY barrio, fecha_ultima_visita DESC
        """, (vendedor_id,))
    else:
        cursor.execute("""
            SELECT DISTINCT ON (barrio) barrio, fecha_ultima_visita
            FROM negocios
            WHERE visitado = TRUE AND barrio IS NOT NULL
            ORDER BY barrio, fecha_ultima_visita DESC
        """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    rows_sorted = sorted(rows, key=lambda r: r[1] or datetime.min, reverse=True)
    return [r[0] for r in rows_sorted[:n]]


def resetear_db():
    """Borra todos los registros de negocios."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM negocios")
    conn.commit()
    cursor.close()
    conn.close()


def desmarcar_visitado(nombre: str, direccion: str, vendedor_id: int = None):
    conn = get_conn()
    cursor = conn.cursor()

    if vendedor_id is not None:
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
            WHERE nombre = %s AND direccion = %s AND vendedor_id = %s
        """, (nombre, direccion, vendedor_id))
    else:
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
