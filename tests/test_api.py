"""
Integration tests for backend/api.py endpoints.
Database functions and external services are mocked.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    """TestClient with database and anthropic mocked."""
    with patch("psycopg2.connect", return_value=MagicMock()), \
         patch("anthropic.Anthropic", return_value=MagicMock()):
        import api
        return TestClient(api.app)


# ── GET /barrios ─────────────────────────────────────────────────────────────

class TestGetBarrios:
    def test_returns_list_of_barrios(self, client):
        response = client.get("/barrios")
        assert response.status_code == 200
        data = response.json()
        assert "barrios" in data
        assert isinstance(data["barrios"], list)
        assert len(data["barrios"]) > 0

    def test_contains_known_barrios(self, client):
        response = client.get("/barrios")
        barrios = response.json()["barrios"]
        assert "Pocitos" in barrios
        assert "Centro" in barrios


# ── GET /historial ────────────────────────────────────────────────────────────

class TestGetHistorial:
    def test_returns_negocios_list(self, client):
        mock_data = [
            {"id": 1, "nombre": "Bar A", "visitado": True, "resultado": "cliente"},
            {"id": 2, "nombre": "Bar B", "visitado": False, "resultado": None},
        ]
        with patch("database.obtener_historial", return_value=mock_data):
            response = client.get("/historial")

        assert response.status_code == 200
        assert response.json()["negocios"] == mock_data

    def test_passes_barrio_filter(self, client):
        with patch("database.obtener_historial", return_value=[]) as mock_hist:
            client.get("/historial?barrio=Pocitos")

        mock_hist.assert_called_once_with("Pocitos")

    def test_no_filter_when_barrio_omitted(self, client):
        with patch("database.obtener_historial", return_value=[]) as mock_hist:
            client.get("/historial")

        mock_hist.assert_called_once_with(None)


# ── GET /visitas ─────────────────────────────────────────────────────────────

class TestGetVisitas:
    def test_returns_visitas_for_negocio(self, client):
        mock_visitas = [
            {"id": 1, "negocio_id": 5, "resultado": "cliente", "notas": "Compró", "fecha": "2026-03-01T10:00:00"},
            {"id": 2, "negocio_id": 5, "resultado": "interesado", "notas": None, "fecha": "2026-02-15T09:00:00"},
        ]
        with patch("database.obtener_visitas", return_value=mock_visitas):
            response = client.get("/visitas?negocio_id=5")

        assert response.status_code == 200
        data = response.json()
        assert "visitas" in data
        assert len(data["visitas"]) == 2

    def test_requires_negocio_id(self, client):
        response = client.get("/visitas")
        assert response.status_code == 422  # FastAPI validation error

    def test_negocio_id_must_be_integer(self, client):
        response = client.get("/visitas?negocio_id=abc")
        assert response.status_code == 422

    def test_returns_empty_list_when_no_visitas(self, client):
        with patch("database.obtener_visitas", return_value=[]):
            response = client.get("/visitas?negocio_id=999")

        assert response.status_code == 200
        assert response.json()["visitas"] == []

    def test_passes_correct_id_to_db(self, client):
        with patch("database.obtener_visitas", return_value=[]) as mock_fn:
            client.get("/visitas?negocio_id=42")

        mock_fn.assert_called_once_with(42)


# ── POST /marcar-visitado ────────────────────────────────────────────────────

class TestMarcarVisitado:
    def test_marks_negocio_as_visited(self, client):
        with patch("database.marcar_visitado") as mock_fn:
            response = client.post("/marcar-visitado", json={
                "nombre": "Pizzería Roma",
                "direccion": "Rivera 1234",
                "resultado": "cliente",
                "notas": "Compró 5kg",
            })

        assert response.status_code == 200
        assert response.json() == {"ok": True}
        mock_fn.assert_called_once()

    def test_requires_nombre_and_direccion(self, client):
        response = client.post("/marcar-visitado", json={"nombre": "X"})
        assert response.status_code == 422

    def test_empty_string_fields_become_none(self, client):
        """Validator converts '' → None for optional string fields."""
        with patch("database.marcar_visitado") as mock_fn:
            client.post("/marcar-visitado", json={
                "nombre": "Bar",
                "direccion": "Calle 1",
                "telefono": "",
                "email": "",
            })

        call_kwargs = mock_fn.call_args
        assert call_kwargs.args[4] is None   # telefono
        assert call_kwargs.args[5] is None   # email

    def test_default_resultado_is_visitado(self, client):
        with patch("database.marcar_visitado") as mock_fn:
            client.post("/marcar-visitado", json={
                "nombre": "Bar",
                "direccion": "Calle 1",
            })

        # resultado defaults to "visitado"
        assert mock_fn.call_args.args[2] == "visitado"


# ── POST /desmarcar-visitado ─────────────────────────────────────────────────

class TestDesmarcarVisitado:
    def test_unmarks_negocio(self, client):
        with patch("database.desmarcar_visitado") as mock_fn:
            response = client.post("/desmarcar-visitado", json={
                "nombre": "Bar",
                "direccion": "Calle 1",
            })

        assert response.status_code == 200
        assert response.json() == {"ok": True}
        mock_fn.assert_called_once_with("Bar", "Calle 1")

    def test_requires_nombre_and_direccion(self, client):
        response = client.post("/desmarcar-visitado", json={})
        assert response.status_code == 422
