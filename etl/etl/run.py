"""CLI del ETL certweb -> Sistema Escolar. Por defecto corre en modo --dry-run (no escribe)."""
from __future__ import annotations

import argparse

from . import extract, load, transform
from .config import cargar_config

ENTIDADES = ["planteles", "usuarios", "docentes", "alumnos", "grupos"]

# Entidades sin pipeline completo todavía: su extract levanta NotImplementedError explícito.
EXTRACTORES_PENDIENTES = {
    "usuarios": extract.extract_usuarios,
    "docentes": extract.extract_docentes,
    "grupos": extract.extract_grupos,
}


def _ejecutar_planteles(legacy_conn, target_conn, dry_run: bool) -> dict[str, int]:
    filas = extract.extract_planteles(legacy_conn)
    planteles = transform.transform_planteles(filas)
    return load.upsert_planteles(target_conn, planteles, dry_run)


def _ejecutar_alumnos(legacy_conn, target_conn, dry_run: bool) -> dict[str, int]:
    filas = extract.extract_alumnos(legacy_conn)
    alumnos = transform.transform_alumnos(filas)
    return load.upsert_alumnos(target_conn, alumnos, dry_run)


# Orden de dependencias real: planteles -> usuarios -> docentes/alumnos -> ciclos -> materias -> grupos (ver README).
PIPELINES = {
    "planteles": _ejecutar_planteles,
    "alumnos": _ejecutar_alumnos,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL certweb -> Sistema Escolar")
    parser.add_argument("--entidad", choices=ENTIDADES, required=True)
    parser.add_argument(
        "--dry-run", dest="dry_run", action="store_true", default=True,
        help="Solo muestra el resumen de altas/actualizaciones/omitidos sin escribir (comportamiento por defecto).",
    )
    parser.add_argument(
        "--aplicar", dest="dry_run", action="store_false",
        help="Ejecuta las altas/actualizaciones reales en la base destino.",
    )
    args = parser.parse_args()

    if args.entidad in EXTRACTORES_PENDIENTES:
        try:
            EXTRACTORES_PENDIENTES[args.entidad](None)
        except NotImplementedError as exc:
            print(f"[{args.entidad}] {exc}")
        return

    config = cargar_config()
    legacy_conn = extract.conectar_legacy(config)
    target_conn = load.conectar_destino(config)
    try:
        resumen = PIPELINES[args.entidad](legacy_conn, target_conn, args.dry_run)
    finally:
        legacy_conn.close()
        target_conn.close()

    modo = "DRY-RUN (sin escribir)" if args.dry_run else "APLICADO"
    print(f"[{args.entidad}] modo={modo}")
    for clave, valor in resumen.items():
        print(f"  {clave}: {valor}")


if __name__ == "__main__":
    main()
