import { useConfirmacion } from '../components/useConfirmacion';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { CONTEXTO_VACIO, ContextoAcademicoSelector } from '../components/ContextoAcademicoSelector';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { useAuth } from '../auth/AuthContext';
import { pesos } from '../utils/formato';

interface Alumno {
  id: number;
  matricula: string;
  usuario: { nombre: string; apellidoPaterno: string; apellidoMaterno: string | null };
}
interface Trayectoria {
  academico?: {
    sinMaterias: boolean;
    pendientes: {
      grupoMateriaId: number;
      materia: string;
      calificacion: number | null;
      publicada: boolean;
      participacionId?: number;
      intento?: number;
    }[];
  };
  recursamientos?: { id: number; grupoMateriaId: number; intento: number }[];
  alumno: { id: number; matricula: string; nombre: string; plantelId: number };
  origen: {
    inscripcionId: number;
    grupo: string;
    cicloId: number;
    nivelId: number;
    carreraId: number;
    periodoAcademicoId: number;
    periodo: string;
    tipo: string;
    numero: number;
    turno: 'MATUTINO' | 'VESPERTINO';
    fechaFin: string;
  };
  advertencia: string;
}
interface Ciclo {
  id: number;
  nombre: string;
  clave: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
}
interface Concepto {
  id: number;
  nombre: string;
  tipo: string;
  montoBase: number;
  activo: boolean;
}
interface Cotizacion {
  cotizacion: string;
  total: number;
  conceptos: { conceptoId: number; nombre: string; monto: number; descuento?: number }[];
}
interface Autorizacion extends Cotizacion {
  destino: { periodo: string; tipo: string; numero: number; ciclo: string; grupoId: number | null };
  id: number;
  financieroId: number;
  venceAt: string;
}
interface Resultado {
  id: number;
  estado: string;
  total: number;
  origenInscripcionId: number;
  periodoAcademicoId: number;
  grupoId: number | null;
  conceptos: { nombre: string; monto: number; descuento?: number }[];
}

export default function ReinscribirAlumnoPage() {
  const navigate = useNavigate(),
    confirmacion = useConfirmacion();
  const { tieneRol } = useAuth();
  const puedeAjustar = tieneRol('FINANZAS', 'SUPERADMIN'),
    puedeConfirmar = tieneRol('ADMINISTRATIVO', 'SUPERADMIN');
  const [autorizaciones, setAutorizaciones] = useState<Autorizacion[]>([]),
    [autorizacion, setAutorizacion] = useState<Autorizacion | null>(null);
  const [condicional, setCondicional] = useState(false),
    [documento, setDocumento] = useState('');
  const [cuotas, setCuotas] = useState<
    { periodo: string; fechaVencimiento: string; monto: string; descuento: string }[]
  >([]);
  const [historial, setHistorial] = useState<Resultado[]>([]),
    [motivoAnular, setMotivoAnular] = useState('');
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [cargando, setCargando] = useState(true),
    [ocupado, setOcupado] = useState(false),
    [error, setError] = useState('');
  const [plantel, setPlantel] = useState(''),
    [alumnoId, setAlumnoId] = useState('');
  const [trayectoria, setTrayectoria] = useState<Trayectoria | null>(null);
  const [cicloId, setCicloId] = useState(''),
    [contexto, setContexto] = useState(CONTEXTO_VACIO);
  const [turno, setTurno] = useState<'MATUTINO' | 'VESPERTINO'>('MATUTINO'),
    [grupoId, setGrupoId] = useState('');
  const [conceptoIds, setConceptoIds] = useState<number[]>([]);
  const [periodo, setPeriodo] = useState(''),
    [vencimiento, setVencimiento] = useState(''),
    [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState(''),
    [motivoAjuste, setMotivoAjuste] = useState('');
  const [cotizacion, setCotizacion] = useState<(Cotizacion & { firma: string }) | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const intento = useRef(crypto.randomUUID());

  useEffect(() => {
    let activa = true;
    setCargando(true);
    Promise.all([
      api.get<{ id: number; nombre: string }[]>('/planteles/mios'),
      api.get<Ciclo[]>('/academico/ciclos'),
      api.get<Concepto[]>('/finanzas/conceptos'),
    ])
      .then(([p, c, k]) => {
        if (activa) {
          setPlanteles(p.data);
          setCiclos(c.data);
          setConceptos(k.data);
        }
      })
      .catch((e) => {
        if (activa) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (activa) setCargando(false);
      });
    return () => {
      activa = false;
    };
  }, []);

  useEffect(() => {
    if (!alumnoId) {
      setTrayectoria(null);
      return;
    }
    let activa = true;
    setTrayectoria(null);
    setCotizacion(null);
    setAutorizaciones([]);
    setAutorizacion(null);
    setError('');
    Promise.all([
      api.get<Trayectoria>(`/cartera/reinscripciones/alumnos/${alumnoId}`),
      api.get<Autorizacion[]>(`/cartera/reinscripciones/autorizaciones/${alumnoId}`),
    ])
      .then(([{ data }, autorizadas]) => {
        if (!activa) return;
        setAutorizaciones(autorizadas.data);
        setTrayectoria(data);
        setPlantel(String(data.alumno.plantelId));
        setTurno(data.origen.turno);
        setContexto({
          nivelId: String(data.origen.nivelId),
          carreraId: String(data.origen.carreraId),
          periodoAcademicoId: '',
        });
      })
      .catch((e) => {
        if (activa) setError(mensajeDeError(e));
      });
    return () => {
      activa = false;
    };
  }, [alumnoId]);

  const ajuste = conceptos.find((c) => c.tipo === 'COLEGIATURA' && conceptoIds.includes(c.id));
  const cambios =
    ajuste && monto !== '' && Number(monto) !== ajuste.montoBase
      ? [{ conceptoId: ajuste.id, monto: Number(monto), motivo: motivoAjuste }]
      : [];
  const payload = {
    alumnoId: Number(alumnoId),
    plantelId: Number(plantel),
    cicloId: Number(cicloId),
    nivelId: Number(contexto.nivelId),
    carreraId: Number(contexto.carreraId),
    periodoAcademicoId: Number(contexto.periodoAcademicoId),
    turno,
    ...(grupoId ? { grupoId: Number(grupoId) } : {}),
    conceptoIds,
    condicion: condicional ? 'CONDICIONAL' : 'ORDINARIA',
    documentoRef: documento.trim() || undefined,
    ...(cuotas.length && ajuste
      ? {
          parcialidades: [
            ...conceptos
              .filter((c) => conceptoIds.includes(c.id) && c.id !== ajuste.id)
              .map((c) => ({
                conceptoId: c.id,
                periodo,
                fechaVencimiento: vencimiento,
                monto: c.montoBase,
                descuento: 0,
              })),
            ...cuotas.map((q) => ({
              conceptoId: ajuste.id,
              periodo: q.periodo,
              fechaVencimiento: q.fechaVencimiento,
              monto: Number(q.monto),
              descuento: Number(q.descuento || 0),
            })),
          ],
        }
      : {}),
    periodo,
    fechaVencimiento: vencimiento,
    origenInscripcionId: trayectoria?.origen.inscripcionId ?? 0,
    ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
    ...(cambios.length ? { ajustes: cambios } : {}),
  };
  const firma = JSON.stringify(payload);
  const cotizacionValida = cotizacion?.firma === firma;
  const previsualizar = async (e: FormEvent) => {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setCotizacion(null);
    try {
      const { data } = await api.post<Cotizacion>('/cartera/reinscripciones/previsualizar', payload);
      intento.current = crypto.randomUUID();
      setCotizacion({ ...data, firma });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const confirmar = async () => {
    if (ocupado || !autorizacion || !puedeConfirmar) return;
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.post<Resultado>('/cartera/reinscripciones/confirmar', {
        autorizacionId: autorizacion.id,
        cotizacion: autorizacion.cotizacion,
        idempotencia: intento.current,
        confirmado: true,
      });
      setResultado(data);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const autorizar = async () => {
    if (!cotizacionValida || !cotizacion || ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.post<Autorizacion & { autorizacionId: number }>(
        '/cartera/reinscripciones/autorizar-precio',
        { ...payload, cotizacion: cotizacion.cotizacion },
      );
      const a = { ...data, id: data.autorizacionId };
      setAutorizaciones((v) => [a, ...v]);
      setAutorizacion(a);
      intento.current = crypto.randomUUID();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const cargarHistorial = async () => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.get<{ datos: Resultado[] }>('/cartera/reinscripciones/historial', {
        params: { plantelId: plantel || undefined },
      });
      setHistorial(data.datos);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const anular = async (id: number) => {
    if (ocupado || motivoAnular.trim().length < 10) return;
    if (
      !(await confirmacion.solicitar(
        '¿Anular la solicitud pendiente? La inscripción anterior y su cartera se conservan.',
      ))
    )
      return;
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.post<Resultado>(`/cartera/reinscripciones/operaciones/${id}/anular`, {
        motivo: motivoAnular.trim(),
        confirmado: true,
      });
      setHistorial((h) => h.map((r) => (r.id === id ? data : r)));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const cicloElegido = ciclos.find((c) => String(c.id) === cicloId);
  const destinoValido =
    trayectoria &&
    cicloElegido &&
    (cicloElegido.id === trayectoria.origen.cicloId || cicloElegido.fechaInicio > trayectoria.origen.fechaFin);
  return (
    <main className="contenido edicion-enfocada">
      {confirmacion.elemento}
      <h1>Reinscribir alumno</h1>
      <p>
        Usa su expediente existente para iniciar el siguiente año, semestre o cuatrimestre según su plan. No se modifica
        su historial anterior.
      </p>
      <button type="button" disabled={ocupado} onClick={() => navigate(-1)}>
        Volver
      </button>
      {cargando && <p role="status">Cargando opciones…</p>}
      {error && <p role="alert">{error}</p>}
      {resultado ? (
        <section className="cartera-resultado" role="status">
          <h2>{resultado.estado === 'CONFIRMADA' ? 'Reinscripción registrada' : 'Solicitud de grupo pendiente'}</h2>
          <p>
            Operación #{resultado.id}.{' '}
            {resultado.grupoId
              ? `Grupo asignado #${resultado.grupoId}`
              : 'Aún no se ha asignado grupo; el periodo anterior sigue vigente y no se crean cargos hasta asignarlo.'}
          </p>
          <p>Total del nuevo periodo: {pesos(resultado.total)}</p>
          <p>Los cargos se reflejan en el estado de cuenta; reinscribir no registra pagos ni liquida adeudos previos.</p>
          <Link to={puedeAjustar ? '/finanzas?vista=cargos' : '/apertura-cartera?vista=consulta'}>
            Consultar movimientos
          </Link>
        </section>
      ) : (
        !cargando && (
          <form className="panel" onSubmit={previsualizar}>
            <fieldset disabled={ocupado}>
              <legend>1. Alumno y periodo actual</legend>
              <label htmlFor="reinscripcion-plantel">Plantel</label>
              <select
                id="reinscripcion-plantel"
                required
                value={plantel}
                onChange={(e) => {
                  setPlantel(e.target.value);
                  setAlumnoId('');
                  setTrayectoria(null);
                  setCotizacion(null);
                }}
              >
                <option value="">Selecciona…</option>
                {planteles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {plantel && (
                <SelectorBuscable<Alumno>
                  ruta="/alumnos"
                  filtros={{ plantelId: plantel }}
                  valor={alumnoId}
                  cambiar={setAlumnoId}
                  etiqueta="Alumno (matrícula o nombre completo)"
                  texto={(a) =>
                    `${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno} ${a.usuario.apellidoMaterno ?? ''}`.trim()
                  }
                />
              )}
              {trayectoria && (
                <section className="cartera-aviso" aria-label="Historial académico previo">
                  <h2>Periodo de origen</h2>
                  <p>
                    {trayectoria.alumno.nombre} · {trayectoria.alumno.matricula}
                  </p>
                  <p>
                    {trayectoria.origen.periodo} · {trayectoria.origen.tipo} {trayectoria.origen.numero} · Grupo{' '}
                    {trayectoria.origen.grupo}
                  </p>
                  <p>{trayectoria.advertencia}</p>
                  {trayectoria.academico && (
                    <>
                      <h3>Materias pendientes</h3>
                      {trayectoria.academico.sinMaterias && (
                        <p>Falta configurar las asignaturas del origen; no se inventan notas.</p>
                      )}
                      {!trayectoria.academico.pendientes.length && !trayectoria.academico.sinMaterias && (
                        <p>Resultados definitivos aprobatorios publicados.</p>
                      )}
                      <ul>
                        {trayectoria.academico.pendientes.map((m, i) => (
                          <li key={`${m.grupoMateriaId}-${i}`}>
                            {m.materia} · {m.calificacion === null ? 'Sin resultado consolidado' : m.calificacion}
                            {m.participacionId && (
                              <>
                                {' '}
                                · Intento {m.intento} ·{' '}
                                <Link to="/recursamientos">Consultar recursamiento #{m.participacionId}</Link>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              )}
            </fieldset>
            {trayectoria && (
              <fieldset disabled={ocupado}>
                <legend>2. Nuevo periodo académico</legend>
                <label htmlFor="reinscripcion-ciclo">Ciclo de destino</label>
                <select
                  id="reinscripcion-ciclo"
                  required
                  value={cicloId}
                  onChange={(e) => {
                    setCicloId(e.target.value);
                    setContexto({ ...contexto, periodoAcademicoId: '' });
                    setGrupoId('');
                  }}
                >
                  <option value="">Selecciona ciclo vigente o posterior…</option>
                  {ciclos
                    .filter(
                      (c) =>
                        ['ACTIVO', 'PREPARACION'].includes(c.estado) &&
                        (c.id === trayectoria.origen.cicloId || c.fechaInicio > trayectoria.origen.fechaFin),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre || c.clave}
                      </option>
                    ))}
                </select>
                {!destinoValido && (
                  <p className="texto-ayuda">
                    Selecciona el ciclo vigente o uno posterior; el destino usa las fechas reales configuradas en su
                    periodo académico.
                  </p>
                )}
                <ContextoAcademicoSelector
                  plantelId={plantel}
                  cicloId={cicloId}
                  valor={contexto}
                  cambiar={(v) => {
                    setContexto(v);
                    setGrupoId('');
                  }}
                  deshabilitado={!destinoValido}
                />
                <label htmlFor="reinscripcion-turno">Turno</label>
                <select
                  id="reinscripcion-turno"
                  value={turno}
                  onChange={(e) => {
                    setTurno(e.target.value as 'MATUTINO' | 'VESPERTINO');
                    setGrupoId('');
                  }}
                >
                  <option value="MATUTINO">Matutino</option>
                  <option value="VESPERTINO">Vespertino</option>
                </select>
                {contexto.periodoAcademicoId && (
                  <SelectorBuscable<{ id: number; nombre: string }>
                    ruta="/academico/grupos"
                    etiqueta="Grupo destino (opcional)"
                    valor={grupoId}
                    cambiar={setGrupoId}
                    requerido={false}
                    filtros={{ plantelId: plantel, cicloId, ...contexto, turno }}
                    texto={(g) => g.nombre}
                  />
                )}
                <label htmlFor="reinscripcion-motivo">
                  Motivo del movimiento (requerido en repetición, retroceso o salto)
                </label>
                <textarea
                  id="reinscripcion-motivo"
                  maxLength={500}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Describir la razón académica o administrativa si no es un avance ordinario"
                />
                <label>
                  <input type="checkbox" checked={condicional} onChange={(e) => setCondicional(e.target.checked)} />
                  Autorizar avance condicional con materias pendientes o evidencia incompleta (Control Escolar)
                </label>
                <label htmlFor="reinscripcion-documento">
                  Referencia documental de excepción (repetición, retroceso, salto o avance condicional)
                </label>
                <input
                  id="reinscripcion-documento"
                  minLength={5}
                  maxLength={200}
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                />
              </fieldset>
            )}
            {trayectoria && (
              <fieldset disabled={ocupado}>
                <legend>3. Cotización y cargos del nuevo periodo</legend>
                <p>
                  Los importes previos se conservan. Finanzas debe comprobar el total contractual del periodo; el
                  sistema no multiplica automáticamente una tarifa mensual. Las cuotas dividen ese total, no se añaden
                  encima. Control Escolar confirma únicamente precios autorizados.
                </p>
                {conceptos
                  .filter((c) => c.activo && c.montoBase > 0 && ['INSCRIPCION', 'COLEGIATURA'].includes(c.tipo))
                  .map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={conceptoIds.includes(c.id)}
                        onChange={(e) => {
                          setConceptoIds((ids) =>
                            e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id),
                          );
                          if (c.tipo === 'COLEGIATURA') {
                            setMonto('');
                            setMotivoAjuste('');
                            setCuotas([]);
                          }
                        }}
                      />
                      {c.nombre} — {pesos(c.montoBase)}
                    </label>
                  ))}
                {ajuste && puedeAjustar && (
                  <>
                    <label htmlFor="reinscripcion-monto">
                      Total de colegiatura del periodo (no se añade otra vez al dividirlo en cuotas)
                    </label>
                    <input
                      id="reinscripcion-monto"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={monto || String(ajuste.montoBase)}
                      onChange={(e) => setMonto(e.target.value)}
                    />
                    {cambios.length > 0 && (
                      <>
                        <label htmlFor="reinscripcion-ajuste-motivo">Justificación del cambio de tarifa</label>
                        <textarea
                          id="reinscripcion-ajuste-motivo"
                          required
                          minLength={10}
                          maxLength={250}
                          value={motivoAjuste}
                          onChange={(e) => setMotivoAjuste(e.target.value)}
                        />
                      </>
                    )}
                  </>
                )}
                {ajuste && puedeAjustar && (
                  <section>
                    <h2>Calendario y beca/descuento del periodo</h2>
                    <p>
                      Las cuotas deben sumar exactamente el total autorizado. El descuento de cada cuota se aplica una
                      sola vez.
                    </p>
                    {cuotas.map((q, i) => (
                      <fieldset key={i}>
                        <legend>Cuota {i + 1}</legend>
                        <label>
                          Mes de cuota {i + 1}
                          <input
                            type="month"
                            required
                            value={q.periodo}
                            onChange={(e) =>
                              setCuotas((v) => v.map((r, n) => (n === i ? { ...r, periodo: e.target.value } : r)))
                            }
                          />
                        </label>
                        <label>
                          Vencimiento de cuota {i + 1}
                          <input
                            type="date"
                            required
                            value={q.fechaVencimiento}
                            onChange={(e) =>
                              setCuotas((v) =>
                                v.map((r, n) => (n === i ? { ...r, fechaVencimiento: e.target.value } : r)),
                              )
                            }
                          />
                        </label>
                        <label>
                          Importe de cuota {i + 1}
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            value={q.monto}
                            onChange={(e) =>
                              setCuotas((v) => v.map((r, n) => (n === i ? { ...r, monto: e.target.value } : r)))
                            }
                          />
                        </label>
                        <label>
                          Beca/descuento de cuota {i + 1}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={q.descuento}
                            onChange={(e) =>
                              setCuotas((v) => v.map((r, n) => (n === i ? { ...r, descuento: e.target.value } : r)))
                            }
                          />
                        </label>
                        <button type="button" onClick={() => setCuotas((v) => v.filter((_, n) => n !== i))}>
                          Quitar cuota {i + 1}
                        </button>
                      </fieldset>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setCuotas((v) => [...v, { periodo, fechaVencimiento: vencimiento, monto: '', descuento: '0' }])
                      }
                    >
                      Añadir cuota
                    </button>
                  </section>
                )}
                <label htmlFor="reinscripcion-periodo">Mes de cobro</label>
                <input
                  type="month"
                  id="reinscripcion-periodo"
                  required
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                />
                <label htmlFor="reinscripcion-vencimiento">Fecha de vencimiento</label>
                <input
                  type="date"
                  id="reinscripcion-vencimiento"
                  required
                  value={vencimiento}
                  onChange={(e) => setVencimiento(e.target.value)}
                />
              </fieldset>
            )}
            {trayectoria && (
              <div className="cartera-resumen">
                <button
                  className="boton"
                  type="submit"
                  disabled={!destinoValido || !contexto.periodoAcademicoId || !conceptoIds.length || ocupado}
                >
                  Previsualizar reinscripción
                </button>
                {cotizacionValida && cotizacion && (
                  <div aria-live="polite">
                    <h2>Confirmar nuevo periodo</h2>
                    <p>
                      {trayectoria.origen.periodo} → periodo seleccionado ·{' '}
                      {cicloElegido?.nombre || cicloElegido?.clave}
                    </p>
                    {cotizacion.conceptos.map((c) => (
                      <p key={c.conceptoId}>
                        {c.nombre}: {pesos(c.monto)}
                      </p>
                    ))}
                    <p>
                      <strong>Total: {pesos(cotizacion.total)}</strong>
                    </p>
                    <p>
                      Confirmar crea una nueva solicitud y cargos solo si corresponde; no implica aprobación de materias
                      reprobadas ni pago registrado.
                    </p>
                    {puedeAjustar && (
                      <button className="boton" type="button" disabled={ocupado} onClick={() => void autorizar()}>
                        Autorizar precio y calendario como Finanzas
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        )
      )}
      {!resultado && alumnoId && (
        <section className="panel">
          <h2>4. Autorizaciones financieras vigentes</h2>
          <p>
            Control Escolar confirma una cotización ya autorizada por Finanzas. El contenido guardado en servidor se
            verifica nuevamente antes de asignar grupo y cargos.
          </p>
          <button
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              setError('');
              try {
                const { data } = await api.get<Autorizacion[]>(`/cartera/reinscripciones/autorizaciones/${alumnoId}`);
                setAutorizaciones(data);
              } catch (e) {
                setError(mensajeDeError(e));
              } finally {
                setOcupado(false);
              }
            }}
          >
            Actualizar autorizaciones
          </button>
          {!autorizaciones.length && <p>No hay autorizaciones vigentes para este alumno.</p>}
          {autorizaciones.map((a) => (
            <label key={a.id}>
              <input
                type="radio"
                name="autorizacion"
                checked={autorizacion?.id === a.id}
                disabled={ocupado}
                onChange={() => {
                  setAutorizacion(a);
                  intento.current = crypto.randomUUID();
                }}
              />
              Autorización #{a.id} · {pesos(a.total)} · Finanzas #{a.financieroId} · vence{' '}
              {new Date(a.venceAt).toLocaleString('es-MX')}
            </label>
          ))}
          {autorizacion && (
            <>
              <h3>Cotización autorizada #{autorizacion.id}</h3>
              <p>
                Destino autorizado: {autorizacion.destino.periodo} · {autorizacion.destino.tipo}{' '}
                {autorizacion.destino.numero} · {autorizacion.destino.ciclo} ·{' '}
                {autorizacion.destino.grupoId ? `Grupo #${autorizacion.destino.grupoId}` : 'Asignación automática'}. Se
                confirma esta autorización, conservando su total y calendario.
              </p>
              {autorizacion.conceptos.map((c, i) => (
                <p key={i}>
                  {c.nombre}: {pesos(c.monto)}
                  {c.descuento ? ` · descuento ${pesos(c.descuento)}` : ''}
                </p>
              ))}
              <p>Total {pesos(autorizacion.total)}. No incluye pagos registrados.</p>
              {puedeConfirmar && (
                <button disabled={ocupado} onClick={() => void confirmar()}>
                  Confirmar reinscripción y cargos
                </button>
              )}
            </>
          )}
        </section>
      )}
      <section className="panel">
        <h2>Historial de reinscripciones</h2>
        <button disabled={ocupado} onClick={() => void cargarHistorial()}>
          Consultar historial de reinscripciones
        </button>
        {puedeConfirmar && (
          <label>
            Motivo para anular una solicitud pendiente
            <input
              minLength={10}
              maxLength={300}
              value={motivoAnular}
              onChange={(e) => setMotivoAnular(e.target.value)}
            />
          </label>
        )}
        {historial.map((r) => (
          <article key={r.id}>
            <h3>
              Operación #{r.id} · {r.estado}
            </h3>
            <p>
              Origen #{r.origenInscripcionId} → periodo #{r.periodoAcademicoId} ·{' '}
              {r.grupoId ? `grupo #${r.grupoId}` : 'sin grupo asignado'} · {pesos(r.total)}
            </p>
            {puedeConfirmar && ['PENDIENTE', 'REQUIERE_REVISION'].includes(r.estado) && (
              <button disabled={ocupado || motivoAnular.trim().length < 10} onClick={() => void anular(r.id)}>
                Anular solicitud #{r.id}
              </button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
