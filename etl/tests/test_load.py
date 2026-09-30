import unittest
from unittest.mock import patch

from etl.etl.load import upsert_alumnos, upsert_planteles


class CursorFalso:
    def __init__(self, resultados=(), lastrowid=1):
        self.resultados = iter(resultados)
        self.lastrowid = lastrowid
        self.llamadas = []

    def execute(self, sql, parametros=()):
        self.llamadas.append((sql, parametros))

    def fetchone(self):
        return next(self.resultados, None)


class ConexionFalsa:
    def __init__(self, cursor):
        self.cursor_falso = cursor
        self.commits = 0

    def cursor(self):
        return self.cursor_falso

    def commit(self):
        self.commits += 1


class CargaDestinoTests(unittest.TestCase):
    def test_upsert_planteles_conserva_marcadores_mysql(self):
        cursor = CursorFalso([None])
        conexion = ConexionFalsa(cursor)
        resumen = upsert_planteles(conexion, [{
            "legacy_id": 6, "clave": "S", "nombre": "Sur", "direccion": None,
            "municipio": None, "telefono": None,
        }], False, "mysql")

        self.assertEqual(resumen["altas"], 1)
        self.assertIn("legacy_id = %s", cursor.llamadas[0][0])
        self.assertIn("VALUES (%s, %s, %s, %s, %s, %s)", cursor.llamadas[1][0])

    def test_upsert_planteles_usa_marcadores_pyodbc(self):
        cursor = CursorFalso([None])
        conexion = ConexionFalsa(cursor)
        resumen = upsert_planteles(conexion, [{
            "legacy_id": 9, "clave": "N", "nombre": "Norte", "direccion": None,
            "municipio": None, "telefono": None,
        }], False, "sqlserver")

        self.assertEqual(resumen["altas"], 1)
        self.assertEqual(conexion.commits, 1)
        self.assertIn("legacy_id = ?", cursor.llamadas[0][0])
        self.assertIn("VALUES (?, ?, ?, ?, ?, ?)", cursor.llamadas[1][0])
        self.assertNotIn("%s", " ".join(sql for sql, _ in cursor.llamadas))

    def test_upsert_alumno_sqlserver_recupera_id_con_output_inserted(self):
        cursor = CursorFalso([(4,), None, (22,)])
        conexion = ConexionFalsa(cursor)
        alumno = {
            "legacy_id": 9, "plantel_legacy_id": 4, "matricula": "A9", "nombre": "Ana",
            "apellido_paterno": "Pérez", "apellido_materno": None, "email": "ana@example.mx",
            "telefono": None, "curp": None, "fecha_nacimiento": None, "tutor_nombre": None,
            "tutor_telefono": None, "direccion": None,
        }

        with patch("etl.etl.load._hash_password_temporal", return_value="hash-bcrypt"):
            resumen = upsert_alumnos(conexion, [alumno], False, "sqlserver")

        self.assertEqual(resumen["altas"], 1)
        self.assertIn("OUTPUT INSERTED.id", cursor.llamadas[2][0])
        self.assertIn("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", cursor.llamadas[3][0])
        self.assertEqual(cursor.llamadas[3][1][0:2], (22, 4))
        self.assertEqual(conexion.commits, 1)


if __name__ == "__main__":
    unittest.main()
