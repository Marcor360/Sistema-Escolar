import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leerMigracion = (motor: 'mysql' | 'sqlserver') =>
  readFileSync(resolve(__dirname, '../../../database', motor, 'migracion_conceptos_finanzas_institucionales.sql'), 'utf8');

type Fila = { clave: string; nombre: string; tipo: string };

function extraerFilasMysql(sql: string): Fila[] {
  return [...sql.matchAll(/(?:SELECT |UNION ALL SELECT )'(\d{3})'(?: AS clave)?, '([^']+)'(?: AS nombre)?, '(INSCRIPCION|COLEGIATURA|OTRO)'(?: AS tipo)?/g)]
    .map(([, clave, nombre, tipo]) => ({ clave, nombre, tipo }));
}

function extraerFilasSqlServer(sql: string): Fila[] {
  return [...sql.matchAll(/\(N'(\d{3})', N'([^']+)', N'(INSCRIPCION|COLEGIATURA|OTRO)'\)/g)]
    .map(([, clave, nombre, tipo]) => ({ clave, nombre, tipo }));
}

describe('catálogo institucional de conceptos financieros', () => {
  it('mantiene las 37 claves consecutivas y exactamente los mismos datos en ambos motores', () => {
    const mysql = extraerFilasMysql(leerMigracion('mysql'));
    const sqlserver = extraerFilasSqlServer(leerMigracion('sqlserver'));
    expect(mysql).toHaveLength(37);
    expect(mysql.map(({ clave }) => clave)).toEqual(Array.from({ length: 37 }, (_, i) => String(i + 1).padStart(3, '0')));
    expect(sqlserver).toEqual(mysql);
    expect(mysql.find(({ clave }) => clave === '024')?.nombre).toBe('CREDENCIAL ESTUDIANTIL CREDENCIAL');
    expect(mysql.find(({ clave }) => clave === '005')?.tipo).toBe('COLEGIATURA');
    expect(mysql.find(({ clave }) => clave === '037')?.nombre).toBe('BAJA DEFINITIVA');
  });

  it('omite claves existentes sin cambiar montos, tipos ni estado; no genera cargos ni tarifas', () => {
    for (const motor of ['mysql', 'sqlserver'] as const) {
      const sql = leerMigracion(motor);
      expect(sql).toContain('WHERE NOT EXISTS');
      expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i);
      expect(sql).toMatch(/INSERT INTO conceptos_pago/);
      expect(sql).toMatch(/0\.00/);
    }
  });
});
