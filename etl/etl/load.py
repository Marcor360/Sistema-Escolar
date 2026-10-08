"""Upsert idempotente por legacy_id contra la base destino. Nunca hace DELETE."""
from __future__ import annotations

import secrets
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
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
    import bcrypt

    password_aleatoria = secrets.token_urlsafe(24)
    return bcrypt.hashpw(password_aleatoria.encode(), bcrypt.gensalt()).decode()


def _marcador(engine: str) -> str:
    if engine not in ("mysql", "sqlserver"):
        raise ValueError("engine debe ser 'mysql' o 'sqlserver'")
    return "?" if engine == "sqlserver" else "%s"


def _buscar_id_por_legacy(cursor, tabla: str, legacy_id: int, engine: str = "mysql") -> int | None:
    cursor.execute(f"SELECT id FROM {tabla} WHERE legacy_id = {_marcador(engine)}", (legacy_id,))
    fila = cursor.fetchone()
    return fila[0] if fila else None


def upsert_planteles(
    conn, planteles: list[dict[str, Any]], dry_run: bool, engine: str = "mysql",
) -> dict[str, int]:
    marcador = _marcador(engine)
    resumen = {"altas": 0, "actualizaciones": 0, "omitidos": 0}
    cursor = conn.cursor()
    try:
        for plantel in planteles:
            id_existente = _buscar_id_por_legacy(cursor, "planteles", plantel["legacy_id"], engine)
            if id_existente:
                resumen["actualizaciones"] += 1
                if not dry_run:
                    cursor.execute(
                        f"UPDATE planteles SET clave={marcador}, nombre={marcador}, direccion={marcador}, "
                        f"municipio={marcador}, telefono={marcador} WHERE id={marcador}",
                        (plantel["clave"], plantel["nombre"], plantel["direccion"], plantel["municipio"],
                         plantel["telefono"], id_existente),
                    )
            else:
                resumen["altas"] += 1
                if not dry_run:
                    cursor.execute(
                        f"INSERT INTO planteles (clave, nombre, direccion, municipio, telefono, legacy_id) "
                        f"VALUES ({', '.join([marcador] * 6)})",
                        (plantel["clave"], plantel["nombre"], plantel["direccion"], plantel["municipio"],
                         plantel["telefono"], plantel["legacy_id"]),
                    )
        if not dry_run:
            conn.commit()
        return resumen
    except Exception:
        if not dry_run:
            conn.rollback()
        raise
    finally:
        cursor.close()


def upsert_alumnos(
    conn, alumnos: list[dict[str, Any]], dry_run: bool, engine: str = "mysql",
) -> dict[str, int]:
    marcador = _marcador(engine)
    resumen = {"altas": 0, "actualizaciones": 0, "omitidos": 0, "passwords_generadas": 0}
    cursor = conn.cursor()
    try:
        rol_alumno_id = None
        if alumnos and not dry_run:
            cursor.execute(f"SELECT id FROM roles WHERE clave = {marcador}", ("ALUMNO",))
            rol = cursor.fetchone()
            if not rol:
                raise RuntimeError("Falta el rol ALUMNO en el destino; configura el catálogo antes de importar")
            rol_alumno_id = rol[0]
        for alumno in alumnos:
            plantel_id = _buscar_id_por_legacy(cursor, "planteles", alumno["plantel_legacy_id"], engine)
            if not plantel_id:
                resumen["omitidos"] += 1
                continue

            id_existente = _buscar_id_por_legacy(cursor, "alumnos", alumno["legacy_id"], engine)
            if id_existente:
                resumen["actualizaciones"] += 1
                if not dry_run:
                    cursor.execute(
                        f"UPDATE alumnos SET matricula={marcador}, curp={marcador}, fecha_nacimiento={marcador}, "
                        f"tutor_nombre={marcador}, tutor_telefono={marcador}, direccion={marcador} "
                        f"WHERE id={marcador}",
                        (alumno["matricula"], alumno["curp"], alumno["fecha_nacimiento"], alumno["tutor_nombre"],
                         alumno["tutor_telefono"], alumno["direccion"], id_existente),
                    )
                continue

            resumen["altas"] += 1
            resumen["passwords_generadas"] += 1
            if dry_run:
                continue

            # El alumno nuevo requiere primero su usuario (hash bcrypt de contraseña aleatoria: nunca se migran hashes legacy).
            columnas_usuario = (
                "email, password_hash, nombre, apellido_paterno, apellido_materno, telefono, legacy_id"
            )
            valores_usuario = (
                alumno["email"], _hash_password_temporal(), alumno["nombre"], alumno["apellido_paterno"],
                alumno["apellido_materno"], alumno["telefono"], alumno["legacy_id"],
            )
            if engine == "sqlserver":
                cursor.execute(
                    f"INSERT INTO usuarios ({columnas_usuario}) OUTPUT INSERTED.id "
                    f"VALUES ({', '.join([marcador] * len(valores_usuario))})",
                    valores_usuario,
                )
                fila_usuario = cursor.fetchone()
                if not fila_usuario:
                    raise RuntimeError("SQL Server no devolvió el id del usuario insertado")
                usuario_id = fila_usuario[0]
            else:
                cursor.execute(
                    f"INSERT INTO usuarios ({columnas_usuario}) VALUES "
                    f"({', '.join([marcador] * len(valores_usuario))})",
                    valores_usuario,
                )
                usuario_id = cursor.lastrowid
            cursor.execute(
                f"INSERT INTO alumnos (usuario_id, plantel_id, matricula, curp, fecha_nacimiento, tutor_nombre, "
                f"tutor_telefono, direccion, legacy_id) VALUES ({', '.join([marcador] * 9)})",
                (usuario_id, plantel_id, alumno["matricula"], alumno["curp"], alumno["fecha_nacimiento"],
                 alumno["tutor_nombre"], alumno["tutor_telefono"], alumno["direccion"], alumno["legacy_id"]),
            )
            cursor.execute(
                f"INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ({marcador}, {marcador})",
                (usuario_id, rol_alumno_id),
            )
        if not dry_run:
            conn.commit()
        return resumen
    except Exception:
        if not dry_run:
            conn.rollback()
        raise
    finally:
        cursor.close()
