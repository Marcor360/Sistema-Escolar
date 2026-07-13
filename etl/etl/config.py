"""Carga y valida las variables de entorno del ETL certweb -> Sistema Escolar."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

_REQUERIDAS = (
    "LEGACY_DB_HOST", "LEGACY_DB_PORT", "LEGACY_DB_NAME", "LEGACY_DB_USER", "LEGACY_DB_PASSWORD",
    "TARGET_DB_ENGINE", "TARGET_DB_HOST", "TARGET_DB_PORT", "TARGET_DB_NAME", "TARGET_DB_USER", "TARGET_DB_PASSWORD",
)


@dataclass(frozen=True)
class Config:
    legacy_host: str
    legacy_port: int
    legacy_db: str
    legacy_user: str
    legacy_password: str
    target_engine: str  # mysql | sqlserver
    target_host: str
    target_port: int
    target_db: str
    target_user: str
    target_password: str


def cargar_config() -> Config:
    faltantes = [nombre for nombre in _REQUERIDAS if not os.getenv(nombre)]
    if faltantes:
        raise RuntimeError(f"Faltan variables de entorno requeridas: {', '.join(faltantes)}")

    engine = os.environ["TARGET_DB_ENGINE"].strip().lower()
    if engine not in ("mysql", "sqlserver"):
        raise RuntimeError("TARGET_DB_ENGINE debe ser 'mysql' o 'sqlserver'")

    return Config(
        legacy_host=os.environ["LEGACY_DB_HOST"],
        legacy_port=int(os.environ["LEGACY_DB_PORT"]),
        legacy_db=os.environ["LEGACY_DB_NAME"],
        legacy_user=os.environ["LEGACY_DB_USER"],
        legacy_password=os.environ["LEGACY_DB_PASSWORD"],
        target_engine=engine,
        target_host=os.environ["TARGET_DB_HOST"],
        target_port=int(os.environ["TARGET_DB_PORT"]),
        target_db=os.environ["TARGET_DB_NAME"],
        target_user=os.environ["TARGET_DB_USER"],
        target_password=os.environ["TARGET_DB_PASSWORD"],
    )
