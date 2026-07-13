"""Normalización de los datos legacy antes de cargarlos al esquema nuevo."""
from __future__ import annotations

import re
from typing import Any


def _limpiar_texto(valor: str | None) -> str | None:
    limpio = (valor or "").strip()
    return limpio or None


def _limpiar_telefono(telefono: str | None) -> str | None:
    if not telefono:
        return None
    digitos = re.sub(r"\D", "", telefono)
    return digitos or None


def _limpiar_email(email: str | None) -> str | None:
    limpio = (email or "").strip().lower()
    return limpio or None


def transform_planteles(filas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "legacy_id": fila["id"],
            "clave": fila["clave"].strip(),
            "nombre": fila["nombre"].strip(),
            "direccion": _limpiar_texto(fila.get("direccion")),
            "municipio": _limpiar_texto(fila.get("municipio")),
            "telefono": _limpiar_telefono(fila.get("telefono")),
        }
        for fila in filas
    ]


def transform_alumnos(filas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "legacy_id": fila["id"],
            "plantel_legacy_id": fila["plantel_id"],
            "matricula": fila["matricula"].strip(),
            "nombre": fila["nombre"].strip(),
            "apellido_paterno": fila["apellido_paterno"].strip(),
            "apellido_materno": _limpiar_texto(fila.get("apellido_materno")),
            "email": _limpiar_email(fila.get("email")),
            "curp": (fila.get("curp") or "").strip().upper() or None,
            "fecha_nacimiento": fila.get("fecha_nacimiento"),
            "tutor_nombre": _limpiar_texto(fila.get("tutor_nombre")),
            "tutor_telefono": _limpiar_telefono(fila.get("tutor_telefono")),
            "direccion": _limpiar_texto(fila.get("direccion")),
            "telefono": _limpiar_telefono(fila.get("telefono")),
        }
        for fila in filas
    ]


def transform_usuarios(filas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    raise NotImplementedError("transform_usuarios: pendiente")


def transform_docentes(filas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    raise NotImplementedError("transform_docentes: pendiente")


def transform_grupos(filas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    raise NotImplementedError("transform_grupos: pendiente")
