import { describe, expect, it } from 'vitest';
import { claveRecorrido, construirRecorrido, recorridosPorArea } from './recorrido-por-rol';

const rutas = [
  { destino: '/', roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO'] },
  { destino: '/maestro', roles: ['MAESTRO'] },
  { destino: '/finanzas', roles: ['FINANZAS'] },
  { destino: '/configuracion', roles: ['SUPERADMIN'] },
];
const grupos = [
  { titulo: 'Inicio y seguimiento', rutas: ['/'] },
  { titulo: 'Docencia', rutas: ['/maestro'] },
  { titulo: 'Finanzas e informes', rutas: ['/finanzas'] },
  { titulo: 'Administración', rutas: ['/configuracion'] },
];
describe('recorrido según permisos de navegación', () => {
  it('no anuncia finanzas ni configuración a un docente', () => {
    expect(construirRecorrido(grupos, rutas, ['MAESTRO']).map(p => p.destino)).toEqual(['/', '/maestro']);
  });
  it('incluye lo visible al superadministrador y suma varios roles', () => {
    expect(construirRecorrido(grupos, rutas, ['SUPERADMIN'])).toHaveLength(4);
    expect(construirRecorrido(grupos, rutas, ['FINANZAS', 'MAESTRO']).map(p => p.destino)).toEqual(['/', '/maestro', '/finanzas']);
  });
  it('distingue cuentas y normaliza la lista de roles', () => {
    expect(claveRecorrido(1, ['MAESTRO', 'FINANZAS'])).toBe(claveRecorrido(1, ['FINANZAS', 'MAESTRO']));
    expect(claveRecorrido(2, ['MAESTRO'])).not.toBe(claveRecorrido(1, ['MAESTRO']));
  });
});

it('profundiza por herramienta sin anunciar áreas ajenas y acumula roles mixtos',()=>{const secciones=[{destino:'/seguimiento',roles:['FINANZAS','MAESTRO','ADMINISTRATIVO']},{destino:'/finanzas',roles:['FINANZAS']},{destino:'/maestro',roles:['MAESTRO']},{destino:'/asistencias',roles:['MAESTRO','ADMINISTRATIVO']},{destino:'/analitica',roles:['FINANZAS','MAESTRO','ADMINISTRATIVO']}];const fin=recorridosPorArea(secciones,['FINANZAS']);expect(fin.map(a=>a.id)).toContain('finanzas');expect(fin.map(a=>a.id)).not.toContain('docencia');expect(fin.find(a=>a.id==='finanzas')!.pasos.length).toBeGreaterThan(5);const mixto=recorridosPorArea(secciones,['MAESTRO','FINANZAS']);expect(mixto.map(a=>a.id)).toEqual(expect.arrayContaining(['finanzas','docencia']));expect(mixto.flatMap(a=>a.pasos).every(p=>p.comprobar)).toBe(true);});
