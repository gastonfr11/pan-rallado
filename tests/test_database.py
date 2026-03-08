"""
Unit tests for backend/database.py.
All psycopg2 connections are mocked — no real DB required.
"""
import pytest
from unittest.mock import MagicMock, patch, call, ANY
from datetime import datetime


def _make_db():
    """Return (mock_conn, mock_cursor) wired together."""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    return conn, cursor


# ── registrar_negocio ────────────────────────────────────────────────────────

class TestRegistrarNegocio:
    def test_inserts_new_negocio(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = None  # not yet in DB

        with patch("psycopg2.connect", return_value=conn):
            database.registrar_negocio("Pizzería Roma", "Rivera 1234", "Pocitos", "pizzeria")

        sqls = [c.args[0] for c in cursor.execute.call_args_list]
        assert any("SELECT" in s for s in sqls)
        assert any("INSERT" in s for s in sqls)
        conn.commit.assert_called_once()
        cursor.close.assert_called_once()
        conn.close.assert_called_once()

    def test_skips_existing_negocio(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = (42,)  # already exists

        with patch("psycopg2.connect", return_value=conn):
            database.registrar_negocio("Pizzería Roma", "Rivera 1234", "Pocitos")

        sqls = [c.args[0] for c in cursor.execute.call_args_list]
        assert not any("INSERT" in s for s in sqls)
        conn.commit.assert_called_once()


# ── marcar_visitado ──────────────────────────────────────────────────────────

class TestMarcarVisitado:
    def test_updates_negocios_and_inserts_visita(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = (7,)  # negocio id

        with patch("psycopg2.connect", return_value=conn):
            database.marcar_visitado("Bar El Sol", "Colonia 800", resultado="cliente", notas="Interesado")

        sqls = [c.args[0] for c in cursor.execute.call_args_list]
        assert any("UPDATE negocios" in s for s in sqls)
        assert any("INSERT INTO visitas" in s for s in sqls)
        conn.commit.assert_called_once()

    def test_always_closes_connection_on_success(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = (1,)

        with patch("psycopg2.connect", return_value=conn):
            database.marcar_visitado("X", "Y")

        cursor.close.assert_called_once()
        conn.close.assert_called_once()

    def test_closes_connection_on_exception(self):
        """try/finally guarantees connection cleanup even if INSERT fails."""
        import database
        conn, cursor = _make_db()
        # Make the second execute (INSERT visitas) raise
        cursor.execute.side_effect = [None, None, Exception("DB error")]

        with patch("psycopg2.connect", return_value=conn):
            with pytest.raises(Exception, match="DB error"):
                database.marcar_visitado("X", "Y")

        cursor.close.assert_called_once()
        conn.close.assert_called_once()

    def test_sets_visitado_true_and_resultado(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = (3,)

        with patch("psycopg2.connect", return_value=conn):
            database.marcar_visitado("Bar", "Calle 1", resultado="interesado")

        update_call = next(
            c for c in cursor.execute.call_args_list
            if "UPDATE negocios" in c.args[0]
        )
        values = update_call.args[1]
        assert "interesado" in values

    def test_skips_insert_when_negocio_not_found(self):
        """If the negocio row is missing (edge case), no INSERT into visitas."""
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = None  # negocio not found

        with patch("psycopg2.connect", return_value=conn):
            database.marcar_visitado("Ghost", "Nowhere 0")

        sqls = [c.args[0] for c in cursor.execute.call_args_list]
        assert not any("INSERT INTO visitas" in s for s in sqls)

    def test_optional_fields_included_when_provided(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = (5,)

        with patch("psycopg2.connect", return_value=conn):
            database.marcar_visitado(
                "Super X", "18 de Julio 500",
                telefono="099123456",
                email="super@x.com",
                tipo_negocio="supermercado",
                nivel_operativo="mediano",
            )

        update_call = next(
            c for c in cursor.execute.call_args_list
            if "UPDATE negocios" in c.args[0]
        )
        assert "telefono = %s" in update_call.args[0]
        assert "email = %s" in update_call.args[0]
        assert "tipo_negocio = %s" in update_call.args[0]

    def test_notas_stored_as_none_when_empty(self):
        """Empty notas string → None in visitas (not empty string)."""
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = (1,)

        with patch("psycopg2.connect", return_value=conn):
            database.marcar_visitado("Bar", "Calle 1", notas="")

        insert_call = next(
            c for c in cursor.execute.call_args_list
            if "INSERT INTO visitas" in c.args[0]
        )
        values = insert_call.args[1]
        # values: (negocio_id, fecha, notas)
        assert values[2] is None


# ── fue_visitado ─────────────────────────────────────────────────────────────

class TestFueVisitado:
    def test_returns_true_when_visitado(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = (True,)

        with patch("psycopg2.connect", return_value=conn):
            result = database.fue_visitado("Bar", "Calle 1")

        assert result is True

    def test_returns_false_when_not_visitado(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = (False,)

        with patch("psycopg2.connect", return_value=conn):
            result = database.fue_visitado("Bar", "Calle 1")

        assert result is False

    def test_returns_false_when_negocio_missing(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchone.return_value = None

        with patch("psycopg2.connect", return_value=conn):
            result = database.fue_visitado("Inexistente", "Nowhere")

        assert result is False


# ── obtener_historial ────────────────────────────────────────────────────────

class TestObtenerHistorial:
    def test_returns_all_negocios_without_filter(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = [
            {"id": 1, "nombre": "Bar A", "barrio": "Pocitos"},
            {"id": 2, "nombre": "Bar B", "barrio": "Centro"},
        ]

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_historial()

        assert len(result) == 2
        sqls = [c.args[0] for c in cursor.execute.call_args_list]
        assert any("ORDER BY fecha_ultima_visita DESC" in s for s in sqls)
        assert not any("WHERE barrio" in s for s in sqls)

    def test_filters_by_barrio(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = [{"id": 1, "nombre": "Bar A", "barrio": "Pocitos"}]

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_historial(barrio="Pocitos")

        sqls = [c.args[0] for c in cursor.execute.call_args_list]
        assert any("WHERE barrio" in s for s in sqls)
        assert len(result) == 1

    def test_returns_empty_list_when_no_data(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = []

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_historial()

        assert result == []


# ── obtener_visitas ──────────────────────────────────────────────────────────

class TestObtenerVisitas:
    def test_returns_visitas_for_negocio(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = [
            {"id": 1, "negocio_id": 5, "fecha": datetime(2026, 3, 1), "notas": "Compró 5kg"},
            {"id": 2, "negocio_id": 5, "fecha": datetime(2026, 2, 15), "notas": None},
        ]

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_visitas(5)

        assert len(result) == 2
        assert result[0]["notas"] == "Compró 5kg"
        assert result[1]["notas"] is None

    def test_filters_by_negocio_id(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = []

        with patch("psycopg2.connect", return_value=conn):
            database.obtener_visitas(99)

        exec_call = cursor.execute.call_args
        assert exec_call.args[1] == (99,)

    def test_ordered_by_fecha_desc(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = []

        with patch("psycopg2.connect", return_value=conn):
            database.obtener_visitas(1)

        sql = cursor.execute.call_args.args[0]
        assert "ORDER BY fecha DESC" in sql

    def test_returns_empty_list_for_negocio_without_visitas(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = []

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_visitas(1)

        assert result == []


# ── obtener_barrios_recientes ─────────────────────────────────────────────────

class TestObtenerBarriosRecientes:
    def test_queries_only_visited_negocios_with_barrio(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = []

        with patch("psycopg2.connect", return_value=conn):
            database.obtener_barrios_recientes()

        sql = cursor.execute.call_args.args[0]
        assert "visitado = TRUE" in sql
        assert "barrio IS NOT NULL" in sql

    def test_returns_barrios_sorted_by_date_desc(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = [
            ("Pocitos",  datetime(2026, 3, 5)),
            ("Centro",   datetime(2026, 2, 15)),
            ("Buceo",    datetime(2026, 1, 10)),
        ]

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_barrios_recientes(n=5)

        assert result[0] == "Pocitos"
        assert result[1] == "Centro"
        assert result[2] == "Buceo"

    def test_limits_result_to_n(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = [
            ("Pocitos", datetime(2026, 3, 5)),
            ("Centro",  datetime(2026, 3, 4)),
            ("Buceo",   datetime(2026, 3, 3)),
            ("Malvín",  datetime(2026, 3, 2)),
            ("Cordón",  datetime(2026, 3, 1)),
            ("Prado",   datetime(2026, 2, 28)),
        ]

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_barrios_recientes(n=3)

        assert len(result) == 3
        assert result == ["Pocitos", "Centro", "Buceo"]

    def test_returns_empty_list_when_no_visits(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = []

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_barrios_recientes()

        assert result == []

    def test_returns_only_barrio_name_strings(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = [("Pocitos", datetime(2026, 3, 1))]

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_barrios_recientes()

        assert result == ["Pocitos"]
        assert all(isinstance(b, str) for b in result)

    def test_default_n_is_5(self):
        import database
        conn, cursor = _make_db()
        cursor.fetchall.return_value = [
            (f"Barrio{i}", datetime(2026, 3, i + 1)) for i in range(8)
        ]

        with patch("psycopg2.connect", return_value=conn):
            result = database.obtener_barrios_recientes()

        assert len(result) == 5


# ── desmarcar_visitado ───────────────────────────────────────────────────────

class TestDesmarcarVisitado:
    def test_resets_all_fields(self):
        import database
        conn, cursor = _make_db()

        with patch("psycopg2.connect", return_value=conn):
            database.desmarcar_visitado("Bar", "Calle 1")

        sql = cursor.execute.call_args.args[0]
        assert "visitado = FALSE" in sql
        assert "resultado = NULL" in sql
        assert "notas = NULL" in sql
        conn.commit.assert_called_once()
