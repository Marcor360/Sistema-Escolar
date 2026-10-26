import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { diaLocal } from '../utils/formato';
interface Clase {
  id: number;
  nombre: string;
}
interface Alumno {
  id: number;
  matricula: string;
  nombre: string;
  estado: string;
}
interface Registro {
  id: number;
  fecha: string;
  estado: string;
  matricula: string;
  nombre: string;
  apellido: string;
  grupo: string;
  materia: string;
}
export default function AsistenciasPage() {
  const { sesion } = useAuth(),
    alumno = sesion?.roles.includes('ALUMNO');
  const [clases, setClases] = useState<Clase[]>([]),
    [clase, setClase] = useState(''),
    [fecha, setFecha] = useState(diaLocal()),
    [desde, setDesde] = useState(diaLocal().slice(0, 7) + '-01'),
    [hasta, setHasta] = useState(diaLocal());
  const [lista, setLista] = useState<Alumno[]>([]),
    [revision, setRevision] = useState(''),
    [puede, setPuede] = useState(false),
    [historial, setHistorial] = useState<Registro[]>([]),
    [pagina, setPagina] = useState(1);
  const [cambios,setCambios]=useState<{id:number;datos:{id:number;anterior:string|null;nuevo:string;motivo:string;usuarioId:number;createdAt:string}[]}|null>(null);
  const [error, setError] = useState(''),
    [mensaje, setMensaje] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [motivo, setMotivo] = useState(''),
    [cambio, setCambio] = useState(0);
  useEffect(() => {
    if (alumno) return;
    let vigente = true;
    api
      .get<Clase[]>('/asistencias/clases')
      .then((r) => {
        if (vigente) setClases(r.data);
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [alumno]);
  useEffect(() => {
    setLista([]);
    setPuede(false);
    if (!clase) return;
    let vigente = true;
    api
      .get('/asistencias/lista', { params: { grupoMateriaId: clase, desde: fecha } })
      .then((r) => {
        if (vigente) {
          setLista(r.data.alumnos);
          setRevision(r.data.revision);
          setPuede(r.data.puedeCapturar);
        }
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [clase, fecha, cambio]);
  useEffect(() => {
    let vigente = true;
    setHistorial([]);
    api
      .get('/asistencias', { params: { desde, hasta, pagina, grupoMateriaId: clase || undefined } })
      .then((r) => {
        if (vigente) setHistorial(r.data.datos);
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [desde, hasta, pagina, clase, cambio]);
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (ocupado) return;
    setError('');
    setMensaje('');
    if (lista.some((a) => !a.estado)) {
      setError('Selecciona el estado de cada alumno; no se presume presencia ni falta.');
      return;
    }
    setOcupado(true);
    try {
      await api.post('/asistencias', {
        grupoMateriaId: Number(clase),
        fecha,
        revision,
        motivo,
        registros: lista.map((a) => ({ alumnoId: a.id, estado: a.estado })),
      });
      setMensaje('Asistencias guardadas');
      setCambio((v) => v + 1);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="panel">
      <h1>Asistencias</h1>
      <p>Solo el profesor asignado registra o corrige. La consulta no modifica calificaciones.</p>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      <button
        disabled={ocupado}
        onClick={() => {
          setError('');
          setCambio((v) => v + 1);
        }}
      >
        Actualizar / reintentar
      </button>
      {!alumno && (
        <>
          <label>
            Clase
            <select
              value={clase}
              disabled={ocupado}
              onChange={(e) => {
                setClase(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Selecciona una clase</option>
              {clases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha de captura
            <input
              type="date"
              value={fecha}
              max={diaLocal()}
              disabled={ocupado}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          {clase && (
            <form onSubmit={guardar}>
              <div className="tabla-contenedor">
                <table>
                  <caption>Lista de alumnos inscritos</caption>
                  <thead>
                    <tr>
                      <th>Matrícula</th>
                      <th>Alumno</th>
                      <th>Asistencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((a) => (
                      <tr key={a.id}>
                        <td>{a.matricula}</td>
                        <td>{a.nombre}</td>
                        <td>
                          <select
                            aria-label={'Asistencia de ' + a.nombre}
                            disabled={!puede || ocupado}
                            value={a.estado}
                            onChange={(e) =>
                              setLista((l) => l.map((x) => (x.id === a.id ? { ...x, estado: e.target.value } : x)))
                            }
                          >
                            <option value="">Sin registrar</option>
                            {['PRESENTE', 'FALTA', 'RETARDO', 'JUSTIFICADA'].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {puede && (
                <>
                  <label>
                    Motivo de captura o corrección
                    <input
                      required
                      minLength={3}
                      maxLength={250}
                      value={motivo}
                      disabled={ocupado}
                      onChange={(e) => setMotivo(e.target.value)}
                    />
                  </label>
                  <button disabled={ocupado || !lista.length}>Guardar asistencias</button>
                </>
              )}
              {!puede && <p>Consulta de solo lectura. La captura corresponde al profesor asignado.</p>}
            </form>
          )}
        </>
      )}
      <h2>{alumno ? 'Mis asistencias' : 'Consulta de asistencias'}</h2>
      <div className="fila">
        <label>
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPagina(1);
            }}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPagina(1);
            }}
          />
        </label>
      </div>
      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              {!alumno && <th>Alumno</th>}
              <th>Clase</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((r) => (
              <tr key={r.id}>
                <td>{r.fecha}</td>
                {!alumno && (
                  <td>
                    {r.matricula} · {r.nombre} {r.apellido}
                  </td>
                )}
                <td>
                  {r.grupo} · {r.materia}
                </td>
                <td>{r.estado}{!alumno&&<button type="button" onClick={()=>{void api.get('/asistencias/'+r.id+'/historial').then(res=>setCambios({id:r.id,datos:res.data})).catch(e=>setError(mensajeDeError(e)));}}>Ver cambios de {r.matricula}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cambios&&!alumno&&<section aria-label="Historial de correcciones de asistencia"><h3>Cambios del registro #{cambios.id}</h3><ul>{cambios.datos.map(c=><li key={c.id}>{new Date(c.createdAt).toLocaleString('es-MX')} · Usuario {c.usuarioId} · {c.anterior??'Sin registro'} → {c.nuevo}: {c.motivo}</li>)}</ul></section>}
      {!historial.length && <p>No hay registros en este intervalo.</p>}
      <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
        Anterior
      </button>
      <span> Página {pagina} </span>
      <button disabled={historial.length < 100} onClick={() => setPagina((p) => p + 1)}>
        Siguiente
      </button>
    </section>
  );
}
