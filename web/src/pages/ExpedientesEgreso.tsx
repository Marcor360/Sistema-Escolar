import { FormEvent, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, mensajeDeError } from '../api/client';

type Documento = { id: number; tipo: string; detalle: string; fecha: string; sha256: string };
type Expediente = {
  planes: { id: number; nombre: string; version: string }[];
  matricula: string;
  nombre: string;
  cerrado: boolean;
  finalizadoEn: string | null;
  archivarDesde: string;
  documentos: Documento[];
};
const nombres: Record<string, string> = {
  NO_ADEUDO: 'Carta de no adeudo',
  SERVICIO_SOCIAL: 'Liberación de servicio social',
  CONCLUSION: 'Conclusión del plan de estudios',
  TITULO: 'Título electrónico MET',
  CERTIFICADO: 'Certificado total MEC',
  BOLETA: 'Boleta de egreso',
  ASIGNATURAS: 'Relación de asignaturas',
  CONSTANCIA: 'Constancia de egreso',
  HISTORIAL: 'Historial académico completo',
};
const camposTitulo = [
  ['Carrera', 'fechaInicio', 'Inicio de estudios', 'date'],
  ['Carrera', 'fechaTerminacion', 'Terminación de estudios', 'date'],
  ['Expedicion', 'fechaExpedicion', 'Fecha de expedición', 'date'],
  ['Expedicion', 'idModalidadTitulacion', 'Clave de modalidad', 'text'],
  ['Expedicion', 'modalidadTitulacion', 'Modalidad de titulación', 'text'],
  ['Expedicion', 'fechaExamenProfesional', 'Fecha de examen, si corresponde', 'date'],
  ['Expedicion', 'fechaExencionExamenProfesional', 'Fecha de exención, si corresponde', 'date'],
  ['Expedicion', 'idFundamentoLegalServicioSocial', 'Clave de fundamento de servicio social', 'text'],
  ['Expedicion', 'fundamentoLegalServicioSocial', 'Fundamento legal', 'text'],
  ['Expedicion', 'idEntidadFederativa', 'Clave de entidad de expedición', 'text'],
  ['Expedicion', 'entidadFederativa', 'Entidad de expedición', 'text'],
  ['Antecedente', 'institucionProcedencia', 'Institución de procedencia', 'text'],
  ['Antecedente', 'idTipoEstudioAntecedente', 'Clave del estudio antecedente', 'text'],
  ['Antecedente', 'tipoEstudioAntecedente', 'Estudio antecedente', 'text'],
  ['Antecedente', 'idEntidadFederativa', 'Clave de entidad del antecedente', 'text'],
  ['Antecedente', 'entidadFederativa', 'Entidad del antecedente', 'text'],
  ['Antecedente', 'fechaInicio', 'Inicio del antecedente, si se conoce', 'date'],
  ['Antecedente', 'fechaTerminacion', 'Terminación del antecedente', 'date'],
  ['Antecedente', 'noCedula', 'Cédula antecedente, si corresponde', 'text'],
];
function descargar(blob: Blob, nombre: string) {
  const a = document.createElement('a'),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ExpedientesEgreso() {
  const { sesion } = useAuth(),
    roles = sesion?.roles ?? [];
  const [liberacion, setLiberacion] = useState(roles.includes('FINANZAS') ? 'NO_ADEUDO' : 'SERVICIO_SOCIAL');
  const [matricula, mat] = useState(''),
    [exp, setExp] = useState<Expediente | null>(null);
  const [error, fallo] = useState(''),
    [ocupado, busy] = useState(false),
    bloqueo = useRef(false);
  const [tipo, setTipo] = useState('HISTORIAL'),
    [cadena, setCadena] = useState('');
  const evidencias = Object.keys(nombres)
    .slice(0, 3)
    .filter((t) => roles.includes(t === 'NO_ADEUDO' ? 'FINANZAS' : 'ADMINISTRATIVO'));
  const emite = roles.includes('ADMINISTRATIVO') || roles.includes('DIRECTOR'),
    sep = ['TITULO', 'CERTIFICADO'].includes(tipo);
  const ruta = (m: string) => '/expedientes-egreso/' + encodeURIComponent(m);
  const cargar = async (m: string) => setExp((await api.get<Expediente>(ruta(m))).data);
  const ejecutar = async (f: () => Promise<void>) => {
    if (bloqueo.current) return;
    bloqueo.current = true;
    busy(true);
    fallo('');
    try {
      await f();
    } catch (e) {
      fallo(mensajeDeError(e));
    } finally {
      bloqueo.current = false;
      busy(false);
    }
  };
  const evidencia = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!exp) return;
    const form = ev.currentTarget,
      datos = new FormData(form);
    void ejecutar(async () => {
      await api.post(ruta(exp.matricula) + '/evidencias', datos);
      form.reset();
      setCadena('');
      await cargar(exp.matricula);
    });
  };
  const emitir = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!exp) return;
    const datos = new FormData(ev.currentTarget),
      grupos: Record<string, Record<string, string>> = {};
    for (const [k, v] of datos.entries())
      if (k.includes('.')) {
        const [n, c] = k.split('.');
        (grupos[n] ??= {})[c] = String(v);
      }
    void ejecutar(async () => {
      const r = await api.post(ruta(exp.matricula) + '/documentos', {
        tipo,
        ...(sep
          ? {
              carreraPlanId: Number(datos.get('plan')),
              datos: grupos,
              ...(cadena ? { sello: datos.get('sello') } : {}),
            }
          : {}),
      });
      if (r.data.cadena) {
        setCadena(r.data.cadena);
        descargar(new Blob([r.data.cadena]), r.data.folio + '.txt');
      } else {
        setCadena('');
        await cargar(exp.matricula);
      }
    });
  };
  return (
    <main>
      <h1>Expediente de egreso</h1>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          setExp(null);
          setCadena('');
          void ejecutar(() => cargar(matricula.trim()));
        }}
      >
        <label>
          Matrícula exacta
          <input
            required
            maxLength={20}
            value={matricula}
            disabled={ocupado}
            onChange={(e) => {
              mat(e.target.value);
              setExp(null);
              setCadena('');
            }}
          />
        </label>
        <button className="boton" disabled={ocupado}>
          Consultar expediente
        </button>
      </form>
      {error && (
        <p role="alert" className="mensaje-error">
          {error}
        </p>
      )}
      {exp && (
        <div key={exp.matricula}>
          <h2>
            {exp.nombre} · {exp.matricula}
          </h2>
          <p>
            {exp.finalizadoEn && new Date(exp.archivarDesde) > new Date()
              ? 'Expediente finalizado · disponible para consulta'
              : exp.cerrado
                ? 'Expediente cerrado · consulta manual'
                : 'Expediente abierto'}
            {exp.archivarDesde && ' · Archivo desde ' + new Date(exp.archivarDesde).toLocaleDateString('es-MX')}
          </p>
          {!exp.cerrado && evidencias.length > 0 && (
            <form className="panel temario-form" onSubmit={evidencia}>
              <fieldset disabled={ocupado}>
                <legend>Registrar liberación</legend>
                <label>
                  Trámite
                  <select name="tipo" value={liberacion} onChange={(e) => setLiberacion(e.target.value)}>
                    {evidencias.map((t) => (
                      <option key={t} value={t}>
                        {nombres[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {liberacion === 'NO_ADEUDO'
                    ? 'Declaro que el alumno ha liquidado todos los pagos. Indica la referencia de la carta.'
                    : liberacion === 'CONCLUSION'
                      ? 'Declaro que el alumno acreditó el plan completo. Indica la referencia de validación.'
                      : 'Declaro que el alumno liberó el servicio social. Indica la referencia de la hoja firmada.'}
                  <textarea name="detalle" minLength={10} maxLength={600} required />
                </label>
                <label>
                  Hoja firmada en PDF (máximo 5 MB{liberacion === 'CONCLUSION' ? ', opcional' : ''})
                  <input
                    type="file"
                    name="archivo"
                    required={liberacion !== 'CONCLUSION'}
                    accept="application/pdf,.pdf"
                  />
                </label>
                <button className="boton">Registrar y guardar evidencia</button>
              </fieldset>
            </form>
          )}
          {!exp.cerrado && emite && (
            <form className="panel temario-form" onSubmit={emitir}>
              <fieldset disabled={ocupado}>
                <legend>Expedir documento</legend>
                <label>
                  Documento
                  <select
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value);
                      setCadena('');
                    }}
                  >
                    {Object.keys(nombres)
                      .slice(3)
                      .filter((t) => t !== 'TITULO' || roles.includes('DIRECTOR'))
                      .map((t) => (
                        <option key={t} value={t}>
                          {nombres[t]}
                        </option>
                      ))}
                  </select>
                </label>
                {sep && (
                  <div onChange={() => setCadena('')}>
                    <label>
                      Plan de estudios
                      <select required name="plan" defaultValue="">
                        <option value="">Selecciona el plan cursado</option>
                        {exp.planes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} · {p.version}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(tipo === 'TITULO'
                      ? camposTitulo
                      : [
                          ['Alumno', 'idGenero', 'Clave de género del catálogo', 'text'],
                          ['Expedicion', 'fecha', 'Fecha de expedición', 'date'],
                        ]
                    ).map(([n, c, l, t]) => (
                      <label key={n + c}>
                        {l}
                        <input name={n + '.' + c} type={t} />
                      </label>
                    ))}
                  </div>
                )}
                {cadena && (
                  <label>
                    Sello de la cadena original en Base64
                    <textarea name="sello" required />
                    <small>Firma el archivo TXT con tu certificado institucional autorizado.</small>
                  </label>
                )}
                <button className="boton">{sep && !cadena ? 'Preparar cadena para firma' : 'Expedir XML'}</button>
              </fieldset>
            </form>
          )}
          {emite && (
            <section className="panel">
              <button
                disabled={ocupado}
                onClick={() =>
                  void ejecutar(async () => {
                    const r = await api.get(ruta(exp.matricula) + '/archivo', { responseType: 'blob' });
                    descargar(r.data, 'expediente-' + exp.matricula + '.json.gz');
                  })
                }
              >
                Descargar expediente completo
              </button>
              {!exp.cerrado &&
                exp.documentos.some((d) => !['NO_ADEUDO', 'CONCLUSION', 'SERVICIO_SOCIAL'].includes(d.tipo)) && (
                  <button
                    disabled={ocupado}
                    onClick={() => {
                      if (
                        window.confirm(
                          '¿Finalizar este expediente? Quedará en consulta durante cinco años y después pasará al archivo histórico.',
                        )
                      )
                        void ejecutar(async () => {
                          await api.post(ruta(exp.matricula) + '/documentos', { tipo: 'FINALIZACION' });
                          await cargar(exp.matricula);
                        });
                    }}
                  >
                    Finalizar expediente
                  </button>
                )}
            </section>
          )}
          <section className="panel">
            <h2>Documentos del historial</h2>
            {!exp.documentos.length && <p>Sin documentos registrados.</p>}
            {exp.documentos.map((d) => (
              <article key={d.id}>
                <h3>{nombres[d.tipo]}</h3>
                <p>
                  {d.detalle} · {new Date(d.fecha).toLocaleDateString('es-MX')}
                </p>
                <button
                  disabled={ocupado}
                  onClick={() =>
                    void ejecutar(async () => {
                      const r = await api.get(ruta(exp.matricula) + '/documentos/' + d.id, {
                        responseType: 'blob',
                      });
                      descargar(r.data, d.tipo + '-' + d.id + (r.data.type.includes('pdf') ? '.pdf' : '.xml'));
                    })
                  }
                >
                  Descargar {nombres[d.tipo]}
                </button>
                {emite && !['NO_ADEUDO', 'SERVICIO_SOCIAL', 'CONCLUSION'].includes(d.tipo) && (
                  <button
                    disabled={ocupado}
                    onClick={() =>
                      void ejecutar(async () => {
                        const r = await api.get(ruta(exp.matricula) + '/documentos/' + d.id + '/historial', {
                          responseType: 'blob',
                        });
                        descargar(r.data, 'historial-' + d.id + '.json');
                      })
                    }
                  >
                    Historial al expedir
                  </button>
                )}
              </article>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
