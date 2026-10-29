import { ConfirmacionApertura } from '../features/cartera/ConfirmacionApertura';
import { CalendarioApertura, type CuotaApertura as Cuota } from '../features/cartera/CalendarioApertura';
import { ResumenCartera, type ResumenFinancieroCartera } from '../components/ResumenCartera';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { ContextoAcademicoSelector, CONTEXTO_VACIO } from '../components/ContextoAcademicoSelector';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { useSalidaPendiente } from '../components/useSalidaPendiente';
import { useAuth } from '../auth/AuthContext';
import { estadoApertura, montoMXN } from './cartera-presentacion';

type Modo = 'NUEVO' | 'EXISTENTE';
interface Concepto {
  id: number;
  clave: string;
  nombre: string;
  montoBase: number;
  tipo: string;
  activo: boolean;
}
interface Cotizacion {
  cotizacion: string;
  total: number;
  conceptos: { conceptoId: number; nombre: string; periodo: string; fechaVencimiento: string; monto: number }[];
}
interface Resultado {
  id: number;
  alumnoId: number;
  estado: string;
  grupoId: number | null;
  total: number;
}
const cuotaVacia = (): Cuota => ({ conceptoId: '', periodo: '', fechaVencimiento: '', monto: '' });
const identidadVacia = {
  matricula: '',
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  curp: '',
  correoPersonal: '',
  telefono: '',
  fechaNacimiento: '',
  tutorNombre: '',
  tutorTelefono: '',
  direccion: '',
};
export default function AperturaIntegral() {
  const [query] = useSearchParams(),
    navigate = useNavigate(),
    { tieneRol } = useAuth();
  const resumenRef = useRef<HTMLHeadingElement>(null),
    resultadoRef = useRef<HTMLHeadingElement>(null);
  const [historial, setHistorial] = useState<ResumenFinancieroCartera | null>(null);
  const [modo, setModo] = useState<Modo>(query.get('modo') === 'existente' ? 'EXISTENTE' : 'NUEVO');
  const [identidad, setIdentidad] = useState(identidadVacia),
    [contexto, setContexto] = useState(CONTEXTO_VACIO);
  const [f, setF] = useState({
    plantelId: '',
    cicloId: '',
    alumnoId: '',
    turno: 'MATUTINO',
    grupoId: '',
    asignacion: 'PAUSA',
    total: '',
  });
  const [cuotas, setCuotas] = useState<Cuota[]>([cuotaVacia()]);
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]),
    [ciclos, setCiclos] = useState<
      { id: number; clave: string; nombre?: string; estado: string; fechaInicio: string; fechaFin: string }[]
    >([]),
    [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [cargando, setCargando] = useState(true),
    [intento, setIntento] = useState(0),
    [error, setError] = useState(''),
    [ocupada, setOcupada] = useState(false);
  const [cotizacion, setCotizacion] = useState<(Cotizacion & { clave: string }) | null>(null),
    [resultado, setResultado] = useState<Resultado | null>(null);
  const ocupado = useRef(false),
    guardado = useRef(false),
    idempotencia = useRef(crypto.randomUUID()),
    titulo = useRef<HTMLHeadingElement>(null);
  const sucio = !!(
    f.plantelId ||
    f.cicloId ||
    f.total ||
    Object.values(identidad).some(Boolean) ||
    cuotas.some((c) => Object.values(c).some(Boolean))
  );
  const salida = useSalidaPendiente(sucio, ocupado, guardado);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    Promise.all([api.get('/planteles/mios'), api.get('/academico/ciclos'), api.get('/finanzas/conceptos')])
      .then(([p, c, k]) => {
        if (vigente) {
          setPlanteles(p.data);
          setCiclos(c.data);
          setConceptos(k.data);
        }
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [intento]);
  useEffect(() => {
    setHistorial(null);
    if (modo !== 'EXISTENTE' || !f.alumnoId) return;
    let vigente = true;
    api
      .get<ResumenFinancieroCartera>(`/cartera/alumnos/${f.alumnoId}/resumen`)
      .then((r) => {
        if (vigente) setHistorial(r.data);
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [modo, f.alumnoId]);
  useEffect(() => {
    if (cotizacion) resumenRef.current?.focus();
  }, [cotizacion]);
  useEffect(() => {
    if (resultado) resultadoRef.current?.focus();
  }, [resultado]);
  const payload = {
    plantelId: Number(f.plantelId),
    cicloId: Number(f.cicloId),
    nivelId: Number(contexto.nivelId),
    carreraId: Number(contexto.carreraId),
    periodoAcademicoId: Number(contexto.periodoAcademicoId),
    turno: f.turno,
    asignacion: f.asignacion,
    ...(f.asignacion === 'GRUPO' ? { grupoId: Number(f.grupoId) } : {}),
    total: Number(f.total),
    cuotas: cuotas.map((c) => ({ ...c, conceptoId: Number(c.conceptoId), monto: Number(c.monto) })),
    ...(modo === 'EXISTENTE'
      ? { alumnoId: Number(f.alumnoId) }
      : { nuevoAlumno: Object.fromEntries(Object.entries(identidad).filter(([, v]) => v !== '')) }),
  };
  const clave = JSON.stringify(payload),
    vigente = cotizacion?.clave === clave,
    ciclo = ciclos.find((c) => String(c.id) === f.cicloId);
  const suma = cuotas.reduce((n, c) => n + Math.round(Number(c.monto || 0) * 100), 0),
    coincide = suma === Math.round(Number(f.total) * 100) && suma > 0;
  const modificarCuota = (i: number, cambio: Partial<Cuota>) =>
    setCuotas((cs) => cs.map((c, j) => (j === i ? { ...c, ...cambio } : c)));
  const previsualizar = async (e: FormEvent) => {
    e.preventDefault();
    if (ocupado.current) return;
    ocupado.current = true;
    setOcupada(true);
    setError('');
    try {
      const r = await api.post<Cotizacion>('/cartera/integral/previsualizar', payload);
      idempotencia.current = crypto.randomUUID();
      setCotizacion({ ...r.data, clave });
    } catch (e) {
      setError(mensajeDeError(e));
      setCotizacion(null);
    } finally {
      ocupado.current = false;
      setOcupada(false);
    }
  };
  const confirmar = async () => {
    if (ocupado.current || !vigente || !cotizacion) return;
    ocupado.current = true;
    setOcupada(true);
    setError('');
    try {
      const r = await api.post<Resultado>('/cartera/integral/confirmar', {
        ...payload,
        cotizacion: cotizacion.cotizacion,
        idempotencia: idempotencia.current,
        confirmado: true,
      });
      guardado.current = true;
      setResultado(r.data);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      ocupado.current = false;
      setOcupada(false);
    }
  };
  const tarifas = conceptos.filter(
    (c) => c.activo && !['BECA', 'DESCUENTO', 'RECARGO'].includes(c.tipo) && c.montoBase > 0,
  );
  return (
    <main className="contenido edicion-enfocada apertura-integral">
      {salida}
      <h1 ref={titulo} tabIndex={-1}>
        Abrir cartera ordinaria
      </h1>
      <button disabled={ocupada} onClick={() => navigate('/apertura-cartera?vista=consulta')}>
        Volver a aperturas
      </button>
      {cargando && <p role="status">Cargando opciones…</p>}
      {error && <p role="alert">{error}</p>}
      {!cargando && (!planteles.length || !ciclos.length || !tarifas.length) && (
        <p>
          No hay opciones suficientes. Revisa catálogos y tarifas.
          <button onClick={() => setIntento((v) => v + 1)}>Reintentar</button>
        </p>
      )}
      {resultado ? (
        <section role="status" className="cartera-resultado">
          <h2 ref={resultadoRef} tabIndex={-1}>
            {estadoApertura(resultado.estado).titulo}
          </h2>
          <p>
            Apertura #{resultado.id} · Alumno #{resultado.alumnoId}. {estadoApertura(resultado.estado).descripcion}
          </p>
          <p>Total contratado: {montoMXN(resultado.total)}</p>
          {modo === 'NUEVO' && (
            <p>
              Alumno registrado sin correo institucional. Control Escolar podrá asignarlo desde Usuarios para solicitar
              su activación.
            </p>
          )}
          <Link to="/apertura-cartera?vista=consulta">Consultar aperturas</Link>
        </section>
      ) : (
        !cargando && (
          <form className="panel formulario-cartera" onSubmit={previsualizar}>
            <fieldset disabled={ocupada}>
              <legend>Alumno y cartera</legend>
              <div className="cartera-cabecera-grid">
                <div className="campo">
                  <label htmlFor="apertura-modo">Tipo de apertura</label>
                  <select
                    id="apertura-modo"
                    value={modo}
                    onChange={(e) => {
                      setModo(e.target.value as Modo);
                      setCotizacion(null);
                    }}
                  >
                    <option value="NUEVO">Crear alumno y cartera</option>
                    <option value="EXISTENTE">Asignar cartera a alumno existente</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="cartera-plantel">Plantel</label>
                  <select
                    id="cartera-plantel"
                    required
                    value={f.plantelId}
                    onChange={(e) => {
                      setF({ ...f, plantelId: e.target.value, alumnoId: '', grupoId: '' });
                      setContexto(CONTEXTO_VACIO);
                    }}
                  >
                    <option value="">Selecciona…</option>
                    {planteles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {modo === 'EXISTENTE' && (
                <>
                  <p>Solo se muestran alumnos activos que todavía no tienen una cartera asignada.</p>
                  {f.plantelId && (
                    <SelectorBuscable<{
                      id: number;
                      matricula: string;
                      usuario: { nombre: string; apellidoPaterno: string };
                    }>
                      ruta="/cartera/alumnos-elegibles"
                      etiqueta="Alumno sin cartera"
                      valor={f.alumnoId}
                      filtros={{ plantelId: f.plantelId }}
                      cambiar={(alumnoId) => setF({ ...f, alumnoId })}
                      texto={(a) => `${a.matricula} · ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`}
                    />
                  )}
                </>
              )}
              {modo === 'NUEVO' && (
                <fieldset>
                  <legend>Datos del alumno nuevo</legend>
                  <p>
                    Se creará el expediente junto con la cartera. El correo institucional y la invitación de acceso se
                    gestionan después desde Usuarios.
                  </p>
                  <div className="rejilla-formulario cartera-identidad">
                    {(
                      [
                        ['matricula', 'Matrícula', true, 20],
                        ['nombre', 'Nombre', true, 80],
                        ['apellidoPaterno', 'Primer apellido', true, 80],
                        ['apellidoMaterno', 'Segundo apellido', false, 80],
                        ['curp', 'CURP', true, 18],
                        ['correoPersonal', 'Correo personal (contacto opcional)', false, 120],
                        ['telefono', 'Teléfono', false, 20],
                        ['fechaNacimiento', 'Fecha de nacimiento', false, 10],
                        ['tutorNombre', 'Nombre del tutor', false, 120],
                        ['tutorTelefono', 'Teléfono del tutor', false, 20],
                        ['direccion', 'Dirección', false, 200],
                      ] as const
                    ).map(([campo, etiqueta, requerido, max]) => (
                      <div className="campo" key={campo}>
                        <label htmlFor={`nuevo-${campo}`}>
                          {etiqueta}
                          {requerido ? ' *' : ''}
                        </label>
                        <input
                          id={`nuevo-${campo}`}
                          required={requerido}
                          maxLength={max}
                          type={campo === 'correoPersonal' ? 'email' : campo === 'fechaNacimiento' ? 'date' : 'text'}
                          pattern={campo === 'curp' ? '[A-ZÑ&]{4}[0-9]{6}[HM][A-ZÑ]{5}[A-Z0-9][0-9]' : undefined}
                          value={identidad[campo]}
                          onChange={(e) =>
                            setIdentidad({
                              ...identidad,
                              [campo]: ['curp', 'matricula'].includes(campo)
                                ? e.target.value.toUpperCase()
                                : e.target.value,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}
              {modo === 'EXISTENTE' && historial && <ResumenCartera datos={historial} />}
              <div className="cartera-contexto-base">
                {' '}
                <div className="campo">
                  <label htmlFor="cartera-ciclo">Ciclo</label>
                  <select
                    id="cartera-ciclo"
                    required
                    value={f.cicloId}
                    onChange={(e) => {
                      setF({ ...f, cicloId: e.target.value, grupoId: '' });
                      setContexto(CONTEXTO_VACIO);
                    }}
                  >
                    <option value="">Selecciona…</option>
                    {ciclos
                      .filter((c) => ['ACTIVO', 'PREPARACION'].includes(c.estado))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.clave}
                        </option>
                      ))}
                  </select>
                </div>
                {ciclo && (
                  <p aria-label="Vigencia del ciclo">
                    {ciclo.nombre || ciclo.clave} · {ciclo.fechaInicio} — {ciclo.fechaFin}. Las cuotas deben
                    corresponder a la ventana del periodo académico.
                  </p>
                )}
                <ContextoAcademicoSelector
                  plantelId={f.plantelId}
                  cicloId={f.cicloId}
                  valor={contexto}
                  cambiar={(c) => {
                    setContexto(c);
                    setF({ ...f, grupoId: '' });
                  }}
                />
                <div className="campo">
                  <label htmlFor="cartera-turno">Turno</label>
                  <select
                    id="cartera-turno"
                    value={f.turno}
                    onChange={(e) => setF({ ...f, turno: e.target.value, grupoId: '' })}
                  >
                    <option value="MATUTINO">Matutino</option>
                    <option value="VESPERTINO">Vespertino</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="cartera-asignacion">Asignación de grupo</label>
                  <select
                    id="cartera-asignacion"
                    value={f.asignacion}
                    onChange={(e) => setF({ ...f, asignacion: e.target.value, grupoId: '' })}
                  >
                    <option value="PAUSA">Sin grupo: pausa / baja temporal sin cobros</option>
                    <option value="GRUPO">Seleccionar grupo compatible</option>
                    <option value="AUTOMATICA">Buscar grupo automáticamente</option>
                  </select>
                </div>
                {f.asignacion === 'GRUPO' && contexto.periodoAcademicoId && (
                  <SelectorBuscable<{ id: number; nombre: string }>
                    ruta="/academico/grupos"
                    etiqueta="Grupo regular compatible"
                    valor={f.grupoId}
                    cambiar={(grupoId) => setF({ ...f, grupoId })}
                    filtros={{ plantelId: f.plantelId, cicloId: f.cicloId, ...contexto, turno: f.turno }}
                    texto={(g) => g.nombre}
                  />
                )}
                <p>
                  Sin asignación efectiva, la cartera queda en pausa sin cargos y no participa en agrupaciones
                  automáticas. Podrás reanudarla desde la consulta de aperturas.
                </p>
              </div>{' '}
              <CalendarioApertura total={f.total} cambiarTotal={total => setF({ ...f, total })}
                puedeAjustar={tieneRol('FINANZAS', 'SUPERADMIN')} cuotas={cuotas} tarifas={tarifas}
                modificarCuota={modificarCuota} agregar={() => setCuotas(cs => [...cs, cuotaVacia()])}
                quitar={i => setCuotas(cs => cs.filter((_, j) => i !== j))} suma={suma} coincide={coincide} />
              <button
                className={vigente ? 'boton secundario' : 'boton'}
                disabled={ocupada || !coincide || !f.plantelId || (modo === 'EXISTENTE' && !f.alumnoId)}
              >
                Previsualizar apertura
              </button>
              {cotizacion && vigente && (
                <ConfirmacionApertura tituloRef={resumenRef} nuevo={modo === 'NUEVO'} pausa={f.asignacion === 'PAUSA'} ocupada={ocupada} cotizacion={cotizacion} confirmar={() => void confirmar()} />
              )}
            </fieldset>
          </form>
        )
      )}
    </main>
  );
}
