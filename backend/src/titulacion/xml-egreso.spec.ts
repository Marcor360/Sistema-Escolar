import { documentoSep, PerfilSep } from './xml-egreso';
import { HistorialEgreso } from './historial-egreso';
import { EgresoAlumno } from '../entities';
import { stub } from '../test-utils/stub';

// Certificado público y firma de una identidad sintética. La llave no se conserva.
const certificado = `-----BEGIN CERTIFICATE-----
MIICvDCCAaSgAwIBAgIUMDAxMTIyMzM0NDU1NjY3Nzg4OTkwDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNUUEgc2ludMOpdGljYTAeFw0yMDAxMDEwMDAwMDBaFw00
MDAxMDEwMDAwMDBaMBgxFjAUBgNVBAMMDVFBIHNpbnTDqXRpY2EwggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQCleZLBLMoPJP01zh2HomJG/SYWZxWNv6/S
sQlYbGWGgEIfW8Hr4uCriG60iT33EjkrKRNJR0hZ5PkP9e8b6a1A+k5m94nnL+Mf
JfSeZTcNcI6Zr49ZVZOMrymCWqdCGORolaPi6iIzgwC9IAD2cnMfy/v2XC3Yq9hJ
CVbkGz3wX1ll7Q6ehiaXXxUlKzwTwBWpnsGltvbUQM3D/A9RqTxdEWogrA9G49Uh
OoTqpv9XLL13aFHncFj2A43Iy8DlUvaWCG8/4OEztxkQDJbLHX8idCeuGk64B/UY
bszGO6jy5wAgXBgFZ5CCJWs7puX83MfxjN/8Tx0EJMpdmdaEmN97AgMBAAEwDQYJ
KoZIhvcNAQELBQADggEBAGrgtFLXOlXEyOE/5inaTQRT7/hC3WBbLIlFeAF5qcCy
yZH8VbKhYU+x//a54+BxNvMXwfbRwK5q91wgezOl2GaI9BL7MkETlvFMv7340BX7
q6i4mPKHf1bP2rlueiGBanf+pwLv68xj5k1yWnA0n55ct1jet+ZojQExNmm4p5wC
O+e/O2Q7Z3wisHYE6yXNl/D0iNmAUsNLHgoCgyOjoWg6P/KCQo+bHniYXQTIat4f
D4n+WUvFqnadkNc8PKUbp05MYJxAR0D0U58Hy6OXdLRwyRrmmdMpUIDdVTtHLKNd
Wz9sn+4d2luonY+43nSzsDikJx10YaIluj57CS8C4+Y=
-----END CERTIFICATE-----`;
const sello =
  'ClD6Gsk5jYI8lN3BHsteO2waIumT7iDMG3ZFuScz1jGCBOiF2THLzhfIg5avHkwZC3Xep3DPrPOFuRwvtMH+s2Md9ZoMcmcLgHocKytCWh/YQtajiN/shmtc48Uz8TcDymmepZVrq2bpNY1e8oBRdf7FIEOwB4xQkyYbU7cf9Y1uMercbuByrVI3PqKo3oeWvEhy42bweeKJcIiFS/OMM2qXgs7yKTkF7QmgOrJt9rLTEk04MSDJOgXMdJpF40zUYJ9SikPXqcFa//4aHKt5y1zqEiInhnCVAWL32p7f9K91hX23x3/vriSgbQiANI5IGNuq3gk8psIpIHvbPX2RcQ==';
const cadena =
  '||3.0|5|1|2|3|4|FIRMANTE|1|RVOE|2020-01-01T00:00:00|5|1|PLAN|3|0|10|6|QA|CURP|Ana|Prueba||2|2000-01-01T00:00:00|1|2026-01-01T00:00:00|4|1|1|9.00|5|5|1|7|2025|9|1|5||';
const perfil: PerfilSep = {
  plantelId: 1,
  carreraPlanId: 2,
  usuarioId: 3,
  firmanteId: 4,
  certificado,
  firma: { curp: 'FIRMANTE', nombre: 'Prueba', primerApellido: 'QA', idCargo: '1' },
  institucion: {},
  carrera: {},
  decimalesPromedio: 2,
  mec: {
    Dec: { tipoCertificado: '5' },
    ServicioFirmante: { idEntidad: '1' },
    Ipes: { idNombreInstitucion: '2', idCampus: '3', idEntidadFederativa: '4' },
    Rvoe: { numero: 'RVOE', fechaExpedicion: '2020-01-01T00:00:00' },
    Carrera: {
      idCarrera: '5',
      idTipoPeriodo: '1',
      clavePlan: 'PLAN',
      idNivelEstudios: '3',
      calificacionMinima: '0',
      calificacionMaxima: '10',
      calificacionMinimaAprobatoria: '6',
    },
    Expedicion: { idTipoCertificacion: '1', idLugarExpedicion: '4' },
    Ciclos: { Q: '2025' },
  },
  asignaturas: [{ clave: 'MAT', idAsignatura: '7', idTipoAsignatura: '1', creditos: '5' }],
};
const egreso = stub<EgresoAlumno>({
  curp: 'CURP',
  alumno: {
    matricula: 'QA',
    fechaNacimiento: '2000-01-01',
    usuario: { nombre: 'Ana', apellidoPaterno: 'Prueba' },
  },
});
const materia = {
  claseId: 1,
  materia: 'MAT',
  nombre: 'Matemáticas',
  creditos: 5,
  carreraPlanId: 2,
  ciclo: 'Q',
  grupo: 'A',
  intento: 0,
  estado: 'HISTORICA',
  resultado: 9,
  escala: 10,
  publicada: true,
  notas: [],
};
const generar = (h: HistorialEgreso, sello = '') =>
  documentoSep(
    'CERTIFICADO',
    egreso,
    h,
    perfil,
    'QA-FOLIO',
    { Alumno: { idGenero: '2' }, Expedicion: { fecha: '2026-01-01' } },
    sello,
  );
beforeAll(() => jest.useFakeTimers({ now: new Date('2026-01-01') }));
afterAll(() => jest.useRealTimers());
it('reconstruye los campos MEC en orden, conserva los opcionales y verifica la firma RSA-SHA256', () => {
  const d = generar({ inscripciones: [], materias: [materia] }, sello);
  expect(d.cadena).toBe(cadena);
  expect(d.xml).toContain('noCertificadoResponsable="00112233445566778899"');
  expect(d.xml).toContain('sello="' + sello + '"');
});
it('una corrección de calificación invalida la firma anterior', () => {
  expect(() => generar({ inscripciones: [], materias: [{ ...materia, resultado: 8 }] }, sello)).toThrow(
    'El sello',
  );
});
it('un certificado total requiere acreditar cada asignatura del catálogo', () => {
  expect(() => generar({ inscripciones: [], materias: [{ ...materia, resultado: 5 }] })).toThrow('acreditado');
});

it('reconoce la nota definitiva publicada de una inscripción legada cerrada por egreso', () => {
  expect(generar({ inscripciones: [], materias: [{ ...materia, estado: 'BAJA' }] }, sello).cadena).toBe(cadena);
});
