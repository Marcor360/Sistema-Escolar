"""Upsert idempotente por legacy_id contra la base destino. Nunca hace DELETE."""
from __future__ import annotations

import secrets
from typing import Any

import bcrypt

from .config import Config


def conectar_destino(config: Config):
    if config.target_engine == "mysql":
        import mysql.connector

        return mysql.connector.connect(
            host=config.target_host, port=config.target_port, database=config.target_db,
            user=config.target_user, password=config.target_password,
        )
    import pyodbc

    return pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.target_host},{config.target_port};"
        f"DATABASE={config.target_db};UID={config.target_user};PWD={config.target_password}"
    )


def _hash_password_temporal() -> str:
    """Contraseña aleatoria + hash bcrypt; el usuario migrado la recupera con 'olvidé mi contraseña'."""
    password_aleatoria = secrets.token_urlsafe(24)
    return bcrypt.hashpw(password_aleatoria.encode(), bcrypt.gensalt()).decode()


def _buscar_id_por_legacy(cursor, tabla: str, legacy_id: int) -> int | None:
    cursor.execute(f"SELECT id FROM {tabla} WHERE legacy_id = %s", (legacy_id,))
    fila = cursor.fetchone()
    return fila[0] if fila else None


def upsert_planteles(conn, planteles: list[dict[str, Any]], dry_run: bool) -> dict[str, int]:
    resumen = {"altas": 0, "actualizaciones": 0, "omitidos": 0}
    cursor = conn.cursor()
    for plantel in planteles:
        id_existente = _buscar_id_por_legacy(cursor, "planteles", plantel["legacy_id"])
        if id_existente:
            resumen["actualizaciones"] += 1
            if not dry_run:
                cursor.execute(
                    "UPDATE planteles SET clave=%s, nombre=%s, direccion=%s, municipio=%s, telefono=%s "
                    "WHERE id=%s",
                    (plantel["clave"], plantel["nombre"], plantel["direccion"], plantel["municipio"],
                     plantel["telefono"], id_existente),
                )
        else:
            resumen["altas"] += 1
            if not dry_run:
                cursor.execute(
                    "INSERT INTO planteles (clave, nombre, direccion, municipio, telefono, legacy_id) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (plantel["clave"], plantel["nombre"], plantel["direccion"], plantel["municipio"],
                     plantel["telefono"], plantel["legacy_id"]),
                )
    if not dry_run:
        conn.commit()
    return resumen


def upsert_alumnos(conn, alumnos: list[dict[str, Any]], dry_run: bool) -> dict[str, int]:
    resumen = {"altas": 0, "actualizaciones": 0, "omitidos": 0, "passwords_generadas": 0}
    cursor = conn.cursor()
    for alumno in alumnos:
        plantel_id = _buscar_id_por_legacy(cursor, "planteles", alumno["plantel_legacy_id"])
        if not plantel_id:
            resumen["omitidos"] += 1
            continue

        id_existente = _buscar_id_por_legacy(cursor, "alumnos", alumno["legacy_id"])
        if id_existente:
            resumen["actualizaciones"] += 1
            if not dry_run:
                cursor.execute(
                    "UPDATE alumnos SET matricula=%s, curp=%s, fecha_nacimiento=%s, tutor_nombre=%s, "
                    "tutor_telefono=%s, direccion=%s WHERE id=%s",
                    (alumno["matricula"], alumno["curp"], alumno["fecha_nacimiento"], alumno["tutor_nombre"],
                     alumno["tutor_telefono"], alumno["direccion"], id_existente),
                )
            continue

        resumen["altas"] += 1
        resumen["passwords_generadas"] += 1
        if dry_run:
            continue

        # El alumno nuevo requiere primero su usuario (hash bcrypt de contraseña aleatoria: nunca se migran hashes legacy).
        cursor.execute(
            "INSERT INTO usuarios (email, password_hash, nombre, apellido_paterno, apellido_materno, telefono, "
            "legacy_id) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (alumno["email"], _hash_password_temporal(), alumno["nombre"], alumno["apellido_paterno"],
             alumno["apellido_materno"], alumno["telefono"], alumno["legacy_id"]),
        )
        usuario_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO alumnos (usuario_id, plantel_id, matricula, curp, fecha_nacimiento, tutor_nombre, "
            "tutor_telefono, direccion, legacy_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (usuario_id, plantel_id, alumno["matricula"], alumno["curp"], alumno["fecha_nacimiento"],
             alumno["tutor_nombre"], alumno["tutor_telefono"], alumno["direccion"], alumno["legacy_id"]),
        )
    if not dry_run:
        conn.commit()
    return resumen
