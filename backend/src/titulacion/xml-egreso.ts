import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { X509Certificate, verify } from 'crypto';
import { HistorialEgreso, materiaCursada } from './historial-egreso';
import { EgresoAlumno } from '../entities';

type Atributos = Record<string, string>;
type Catalogo = Record<string, Atributos>;
export const camposTitulo = {
  FirmaResponsable: 'curp idCargo cargo abrTitulo?',
  Institucion: 'cveInstitucion nombreInstitucion',
  Carrera:
    'cveCarrera nombreCarrera fechaInicio? fechaTerminacion idAutorizacionReconocimiento autorizacionReconocimiento numeroRvoe?',
  Profesionista: 'curp nombre primerApellido segundoApellido? correoElectronico',
  Expedicion:
    'fechaExpedicion idModalidadTitulacion modalidadTitulacion fechaExamenProfesional? fechaExencionExamenProfesional? cumplioServicioSocial idFundamentoLegalServicioSocial fundamentoLegalServicioSocial idEntidadFederativa entidadFederativa',
  Antecedente:
    'institucionProcedencia idTipoEstudioAntecedente tipoEstudioAntecedente idEntidadFederativa entidadFederativa fechaInicio? fechaTerminacion noCedula?',
};
export const escaparXml = (v: string | number) =>
  String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function nodo(nombre: string, attrs: Atributos, hijos = '') {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => ` ${k}="${escaparXml(v)}"`)
    .join('');
  return hijos ? `<${nombre}${a}>${hijos}</${nombre}>` : `<${nombre}${a}/>`;
}
function valores(nombre: string, lista: string, datos: Atributos) {
  const attrs: Atributos = {};
  for (const campo of lista.split(' ')) {
    const k = campo.replace('?', ''),
      v = datos[k] ?? '';
    if (
      typeof v !== 'string' ||
      (!campo.endsWith('?') && !v.trim()) ||
      Array.from(v).some((c) => c === '|' || c.charCodeAt(0) < 32) ||
      v.length > 500
    )
      throw new BadRequestException('Revisa el campo ' + nombre + '.' + k);
    attrs[k] = v.trim();
  }
  return attrs;
}
export interface PerfilSep {
  firmanteId: number;
  plantelId: number;
  carreraPlanId: number;
  usuarioId: number;
  certificado: string;
  firma: Atributos;
  institucion: Atributos;
  carrera: Atributos;
  decimalesPromedio: number;
  mec: Catalogo;
  asignaturas: { clave: string; idAsignatura: string; idTipoAsignatura: string; creditos: string }[];
}
export function perfilSep(plantelId: number, carreraPlanId: number, usuarioId: number): PerfilSep {
  const perfiles: PerfilSep[] = JSON.parse(process.env.EGRESOS_PERFILES_SEP_JSON || '[]');
  const perfil = perfiles.find(
    (p) => p.plantelId === plantelId && p.carreraPlanId === carreraPlanId && p.usuarioId === usuarioId,
  );
  if (!perfil || !Number.isInteger(perfil.firmanteId) || !perfil.mec?.Carrera || !perfil.firma)
    throw new ForbiddenException(
      'Falta registrar el catálogo autorizado y el certificado público de este firmante para el plantel y plan',
    );
  return perfil;
}
export function documentoSep(
  tipo: string,
  e: EgresoAlumno,
  h: HistorialEgreso,
  p: PerfilSep,
  folio: string,
  datos: Catalogo,
  sello = '',
) {
  const cert = new X509Certificate(p.certificado);
  if (
    Date.parse(cert.validFrom) > Date.now() ||
    Date.parse(cert.validTo) < Date.now() ||
    cert.publicKey.asymmetricKeyType !== 'rsa'
  )
    throw new ConflictException('El certificado público del firmante debe ser RSA y estar vigente');
  if (!/^\d{20}$/.test(Buffer.from(cert.serialNumber, 'hex').toString('ascii')))
    throw new ConflictException('El número de certificado del firmante no tiene el formato esperado');
  const firma = {
    ...(sello ? { sello } : {}),
    certificadoResponsable: cert.raw.toString('base64'),
    noCertificadoResponsable: Buffer.from(cert.serialNumber, 'hex').toString('ascii'),
  };
  const u = e.alumno.usuario,
    persona = {
      curp: e.curp,
      nombre: [u.nombre, u.segundoNombre].filter(Boolean).join(' '),
      primerApellido: u.apellidoPaterno,
      segundoApellido: u.apellidoMaterno || '',
    };
  const cadena: string[] = [];
  const grupo = (n: string, campos: string, a: Atributos, extras: Atributos = {}) => {
    const attrs = valores(n, campos, a);
    cadena.push(...Object.values(attrs));
    return nodo(n, { ...attrs, ...extras });
  };
  const m = p.mec;
  const defs = p.asignaturas;
  if (
    !defs?.length ||
    new Set(defs.map((d) => d.idAsignatura)).size !== defs.length ||
    new Set(defs.map((d) => d.clave)).size !== defs.length
  )
    throw new ConflictException('Revisa el catálogo autorizado de asignaturas');
  const filas = defs.map((d) => {
    const intentos = h.materias.filter(
      (f) =>
        f.carreraPlanId === p.carreraPlanId &&
        f.materia === d.clave &&
        f.publicada &&
        materiaCursada(f) &&
        f.resultado !== null &&
        f.escala === Number(m.Carrera.calificacionMaxima) &&
        f.resultado >= Number(m.Carrera.calificacionMinimaAprobatoria),
    );
    if (intentos.length !== 1)
      throw new ConflictException(
        'Falta conciliar la asignatura ' + d.clave + ' con un único resultado acreditado',
      );
    const f = intentos[0],
      ciclo = m.Ciclos?.[f.ciclo];
    if (!ciclo || !Number.isFinite(Number(d.creditos)) || Number(d.creditos) < 0)
      throw new ConflictException('Revisa ciclo y créditos de ' + d.clave);
    return {
      idAsignatura: d.idAsignatura,
      ciclo,
      calificacion: String(f.resultado),
      idTipoAsignatura: d.idTipoAsignatura,
      creditos: d.creditos,
    };
  });

  let xml: string;
  if (tipo === 'TITULO') {
    cadena.push('1.0', folio);
    const f = grupo('FirmaResponsable', camposTitulo.FirmaResponsable, p.firma, {
      ...valores('Firmante', 'nombre primerApellido segundoApellido?', p.firma),
      ...firma,
    });
    const cuerpo =
      nodo('FirmaResponsables', {}, f) +
      grupo('Institucion', camposTitulo.Institucion, p.institucion) +
      grupo('Carrera', camposTitulo.Carrera, { ...datos.Carrera, ...p.carrera }) +
      grupo('Profesionista', camposTitulo.Profesionista, { ...persona, correoElectronico: u.email || '' }) +
      grupo('Expedicion', camposTitulo.Expedicion, { ...datos.Expedicion, cumplioServicioSocial: '1' }) +
      grupo('Antecedente', camposTitulo.Antecedente, datos.Antecedente || {});
    xml = nodo(
      'TituloElectronico',
      { xmlns: 'https://www.siged.sep.gob.mx/titulos/', version: '1.0', folioControl: folio },
      cuerpo,
    );
  } else {
    // Certificación total MEC 3.0: el orden y los créditos provienen del plan autorizado.
    cadena.push('3.0', m.Dec.tipoCertificado);
    let cuerpo =
      grupo('ServicioFirmante', 'idEntidad', m.ServicioFirmante) +
      grupo('Ipes', 'idNombreInstitucion idCampus idEntidadFederativa', m.Ipes) +
      grupo(
        'Responsable',
        'curp idCargo',
        p.firma,
        valores('Responsable', 'nombre primerApellido segundoApellido?', p.firma),
      ) +
      grupo('Rvoe', 'numero fechaExpedicion', m.Rvoe) +
      grupo(
        'Carrera',
        'idCarrera idTipoPeriodo clavePlan idNivelEstudios calificacionMinima calificacionMaxima calificacionMinimaAprobatoria',
        m.Carrera,
      ) +
      grupo('Alumno', 'numeroControl curp nombre primerApellido segundoApellido? idGenero fechaNacimiento', {
        ...persona,
        numeroControl: e.alumno.matricula,
        idGenero: datos.Alumno?.idGenero,
        fechaNacimiento: e.alumno.fechaNacimiento ? e.alumno.fechaNacimiento + 'T00:00:00' : '',
      }) +
      grupo('Expedicion', 'idTipoCertificacion fecha idLugarExpedicion', {
        ...m.Expedicion,
        fecha: datos.Expedicion?.fecha ? datos.Expedicion.fecha + 'T00:00:00' : '',
      });
    const creditos = String(filas.reduce((s, f) => s + Math.round(Number(f.creditos) * 100), 0) / 100);
    if (!Number.isInteger(p.decimalesPromedio) || p.decimalesPromedio < 0 || p.decimalesPromedio > 8)
      throw new ConflictException('Configura la precisión del promedio del plan');
    const promedio = (filas.reduce((s, f) => s + Number(f.calificacion), 0) / filas.length).toFixed(
      p.decimalesPromedio,
    );
    const resumen = valores(
      'Asignaturas',
      'total asignadas promedio totalCreditos creditosObtenidos numeroCiclos',
      {
        total: String(filas.length),
        asignadas: String(filas.length),
        promedio,
        totalCreditos: creditos,
        creditosObtenidos: creditos,
        numeroCiclos: String(new Set(filas.map((f) => f.ciclo)).size),
      },
    );
    cadena.push(...Object.values(resumen));
    cuerpo += nodo(
      'Asignaturas',
      resumen,
      filas
        .map((f) => grupo('Asignatura', 'idAsignatura ciclo calificacion idTipoAsignatura creditos', f))
        .join(''),
    );
    xml = nodo(
      'Dec',
      {
        xmlns: 'https://www.siged.sep.gob.mx/certificados/',
        version: '3.0',
        tipoCertificado: m.Dec.tipoCertificado,
        folioControl: folio,
        ...firma,
      },
      cuerpo,
    );
  }
  const original = '||' + cadena.join('|') + '||';
  if (sello && !verify('RSA-SHA256', Buffer.from(original), cert.publicKey, Buffer.from(sello, 'base64')))
    throw new BadRequestException('El sello no corresponde a la cadena y al certificado autorizado');
  return { cadena: original, xml: '<?xml version="1.0" encoding="UTF-8"?>' + xml };
}
