"""
Pytest configuration: adds backend/ to path and stubs out modules that
require live credentials (main, googlemaps, anthropic) before any test
imports api.py or database.py.
"""
import sys
import os
from unittest.mock import MagicMock

# Make backend/ importable as a flat namespace (matches how api.py imports)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# main.py calls init_db() and googlemaps.Client() at module level — stub it
# so api.py can be imported without live credentials.
_mock_main = MagicMock()
_mock_main.BARRIOS = {
    "Pocitos": {"lat": -34.9059, "lng": -56.1507, "radio": 1000},
    "Centro":  {"lat": -34.9060, "lng": -56.1880, "radio": 1000},
}
sys.modules.setdefault("main", _mock_main)
