"""Configuración de pytest: agrega ``src`` al path de importación."""

import sys
from pathlib import Path

_RAIZ = Path(__file__).resolve().parents[1]
_SRC = _RAIZ / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
