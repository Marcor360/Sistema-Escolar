"""Lecturas de la base legacy (certweb, SQL Server). Solo SELECT: este módulo nunca escribe."""
from __future__ import annotations

from typing import Any

import pymssql

from .config import Config


def conectar_legacy(config: Config):
    return pymssql.connect(
        server=config.legacy_host,
        port=str(config.legacy_port),
        database=config.legacy_db,
        user=config.legacy_user,
        password=config.legacy_password,
    )


# Nombres de tabla/columna de referencia; ajustar al esquema real de certweb antes de usar en producción.

def extract_planteles(conn) -> list[dict[str, Any]]:
    cursor = conn.cursor(as_dict=True)
    cursor.execute("""
        SELECT id, clave, nombre, direccion, municipio, telefono
        FROM planteles
    """)
    return cursor.fetchall()


def extract_alumnos(conn) -> list[dict[str, Any]]:
    cursor = conn.cursor(as_dict=True)
    cursor.execute("""
        SELECT id, plantel_id, matricula, nombre, apellido_paterno, apellido_materno, email,
               curp, fecha_nacimiento, tutor_nombre, tutor_telefono, direccion, telefono
        FROM alumnos
    """)
    return cursor.fetchall()


def extract_usuarios(conn) -> list[dict[str, Any]]:
    raise NotImplementedError("extract_usuarios: pendiente de mapear contra el esquema real de certweb")


def extract_docentes(conn) -> list[dict[str, Any]]:
    raise NotImplementedError("extract_docentes: pendiente de mapear contra el esquema real de certweb")


def extract_grupos(conn) -> list[dict[str, Any]]:
    raise NotImplementedError("extract_grupos: pendiente de mapear contra el esquema real de certweb")
