import sqlite3
from datetime import datetime

DB_PATH = "visitas.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS negocios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            direccion TEXT NOT NULL,
            barrio TEXT,
            tipo TEXT,
            fecha_primera_visita TEXT,
            fecha_ultima_visita TEXT,
            resultado TEXT,  -- interesado, no_interesado, cliente, sin_respuesta
            notas TEXT
        )
    """)
    conn.commit()
    conn.close()

def registrar_visita(nombre: str, direccion: str, barrio: str, resultado: str = "sin_respuesta", notas: str = ""):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Verificar si el negocio ya existe
    cursor.execute("SELECT id, fecha_primera_visita FROM negocios WHERE nombre = ? AND direccion = ?", (nombre, direccion))
    existente = cursor.fetchone()
    
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    if existente:
        cursor.execute("""
            UPDATE negocios SET fecha_ultima_visita = ?, resultado = ?, notas = ?
            WHERE id = ?
        """, (ahora, resultado, notas, existente[0]))
    else:
        cursor.execute("""
            INSERT INTO negocios (nombre, direccion, barrio, fecha_primera_visita, fecha_ultima_visita, resultado, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (nombre, direccion, barrio, ahora, ahora, resultado, notas))
    
    conn.commit()
    conn.close()

def fue_visitado_recientemente(nombre: str, direccion: str, dias: int = 30) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT fecha_ultima_visita FROM negocios WHERE nombre = ? AND direccion = ?", (nombre, direccion))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return False
    
    ultima = datetime.strptime(row[0], "%Y-%m-%d %H:%M")
    diferencia = (datetime.now() - ultima).days
    return diferencia < dias

def obtener_historial(barrio: str = None) -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if barrio:
        cursor.execute("SELECT * FROM negocios WHERE barrio = ? ORDER BY fecha_ultima_visita DESC", (barrio,))
    else:
        cursor.execute("SELECT * FROM negocios ORDER BY fecha_ultima_visita DESC")
    
    rows = cursor.fetchall()
    conn.close()
    return rows