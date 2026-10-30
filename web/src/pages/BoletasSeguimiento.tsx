import { SelectorBuscable } from '../components/SelectorBuscable';
import { nombreAtencion } from '../components/AtencionBoleta';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { Paginador } from '../components/Paginador';
import { RespuestaBoleta } from '../components/RespuestaBoleta';
interface Fila {
  id: number;
  inscripcionId: number;
  alumno: string;
  matricula: string;
  estado: string;
  fecha: string;
  vigente: boolean;
  grupo?: string;
  ciclo?: string;
  atencion?: string | null;
  responsable?: string | null;
}
export default function BoletasSeguimiento() {
  const [q, setQ] = useSearchParams(),
    [datos, setDatos] = useState<Fila[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState(''),
    [cargando, setCargando] = useState(false),
    [intento, setIntento] = useState(0);
  const [plantel, setPlantel] = useState(q.get('plantelId') ?? ''),
    [ciclo, setCiclo] = useState(q.get('cicloId') ?? ''),
    [grupo, setGrupo] = useState(q.get('grupoId') ?? ''),
    [buscar, setBuscar] = useState(q.get('buscar') ?? ''),
    [filtroAtencion, setFiltroAtencion] = useState(q.get('atencion') ?? '');
  const estado = q.get('estado') || '',
    pagina = Math.max(1, Number(q.get('pagina')) || 1),
    id = Number(q.get('inscripcionId'));
  const plantelAplicado = q.get('plantelId') ?? '',
    cicloAplicado = q.get('cicloId') ?? '',
    grupoAplicado = q.get('grupoId') ?? '',
    busquedaAplicada = q.get('buscar') ?? '',
    atencionAplicada = q.get('atencion') ?? '';
  useEffect(() => {
    setPlantel(plantelAplicado);
    setCiclo(cicloAplicado);
    setGrupo(grupoAplicado);
    setBuscar(busquedaAplicada);
    setFiltroAtencion(atencionAplicada);
  }, [plantelAplicado, cicloAplicado, grupoAplicado, busquedaAplicada, atencionAplicada]);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api
      .get('/boletas/seguimiento', {
        params: {
          pagina,
          porPagina: 10,
          ...Object.fromEntries([...q].filter(([k]) => ['buscar', 'grupoId', 'cicloId', 'atencion'].includes(k))),
          ...(estado ? { estado } : {}),
          ...(q.get('plantelId') ? { plantelId: q.get('plantelId') } : {}),
        },
      })
      .then((r) => {
        if (vigente) {
          setDatos(r.data.datos);
          setTotal(r.data.total);
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
  }, [estado, pagina, q, intento]);
  return (
    <>
      <h1>Boletas · seguimiento del alumno</h1>
      <p>
        Consulta aceptaciones, solicitudes de revisión y comentarios por materia. Una respuesta conserva la versión que
        se revisó; no modifica notas.
      </p>
      <div className="acciones-formulario">
        {[
          ['', 'Todas las boletas'],
          ['PENDIENTE_RESPUESTA', 'Pendientes de aceptación'],
          ['ACEPTADA', 'Boletas aceptadas'],
          ['REVISION', 'Boletas con comentarios'],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            className={estado === valor ? 'boton' : 'boton secundario'}
            onClick={() =>
              setQ((prev) => {
                const n = new URLSearchParams(prev);
                n.set('estado', valor);
                n.delete('pagina');
                n.delete('inscripcionId');
                return n;
              })
            }
          >
            {texto}
          </button>
        ))}
      </div>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setQ((prev) => {
            const n = new URLSearchParams(prev);
            for (const k of ['buscar', 'atencion']) {
              const v = String(f.get(k) ?? '').trim();
              if (v) n.set(k, v);
              else n.delete(k);
            }
            for (const [k, v] of [
              ['plantelId', plantel],
              ['cicloId', ciclo],
              ['grupoId', grupo],
            ])
              if (v) n.set(k, v);
              else n.delete(k);
            n.delete('pagina');
            n.delete('inscripcionId');
            return n;
          });
        }}
      >
        <div className="contexto-academico-grid">
          <div className="campo">
            <label htmlFor="boleta-buscar">Alumno o matrícula</label>
            <input
              type="search"
              id="boleta-buscar"
              name="buscar"
              maxLength={100}
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="boleta-atencion">Atención de revisiones</label>
            <select
              id="boleta-atencion"
              name="atencion"
              value={filtroAtencion}
              onChange={(e) => setFiltroAtencion(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_ATENCION">En atención</option>
              <option value="RESUELTA">Resuelta</option>
            </select>
          </div>
        </div>
        <details>
          <summary>Filtrar por plantel, ciclo y grupo</summary>
          <div className="contexto-academico-grid">
            <SelectorBuscable<{ id: number; nombre: string }>
              ruta="/boletas/filtros"
              filtros={{ tipo: 'plantel' }}
              valor={plantel}
              cambiar={(v) => {
                setPlantel(v);
                setGrupo('');
              }}
              etiqueta="Plantel"
              texto={(p) => p.nombre}
              requerido={false}
            />
            <SelectorBuscable<{ id: number; nombre: string }>
              ruta="/boletas/filtros"
              filtros={{ tipo: 'ciclo' }}
              valor={ciclo}
              cambiar={(v) => {
                setCiclo(v);
                setGrupo('');
              }}
              etiqueta="Ciclo"
              texto={(p) => p.nombre}
              requerido={false}
            />
            <SelectorBuscable<{ id: number; nombre: string }>
              ruta="/boletas/filtros"
              valor={grupo}
              cambiar={setGrupo}
              etiqueta="Grupo"
              texto={(p) => p.nombre}
              filtros={{ tipo: 'grupo', plantelId: plantel || undefined, cicloId: ciclo || undefined }}
              requerido={false}
            />
          </div>
        </details>
        <div className="acciones-formulario">
          <button type="submit" disabled={cargando}>
            Aplicar filtros
          </button>
          <button
            type="button"
            className="boton secundario"
            onClick={() => {
              setPlantel('');
              setCiclo('');
              setGrupo('');
              setBuscar('');
              setFiltroAtencion('');
              setQ({});
            }}
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            className="boton secundario"
            disabled={cargando}
            onClick={() => setIntento((v) => v + 1)}
          >
            Actualizar listado
          </button>
        </div>
      </form>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setIntento((v) => v + 1)}>Reintentar</button>
        </p>
      )}
      {cargando && <p role="status">Consultando boletas…</p>}
      <ul className="boletas-directorio">
        {datos.map((r) => (
          <li className="panel" key={r.id}>
            <h2>{r.alumno}</h2>
            <p>
              {r.matricula} ·{' '}
              {r.estado === 'ACEPTADA'
                ? 'Boleta aceptada'
                : r.estado === 'PENDIENTE_RESPUESTA'
                  ? 'Pendiente de aceptación'
                  : r.estado === 'REVISION'
                    ? 'Revisión con comentarios'
                    : 'Pendiente de publicación'}
            </p>
            <p>
              {r.grupo} {r.ciclo && '· ' + r.ciclo}
            </p>
            {r.atencion && (
              <p>
                Atención: {nombreAtencion(r.atencion)}
                {r.responsable && ' · ' + r.responsable}
              </p>
            )}
            <p>
              {r.estado === 'PENDIENTE_RESPUESTA'
                ? 'La familia debe revisar y responder a la boleta publicada.'
                : r.vigente
                  ? 'Respuesta de la versión vigente'
                  : 'Versión anterior: revisar nuevamente las calificaciones'}
            </p>
            <Link to={`?${new URLSearchParams({ ...Object.fromEntries(q), inscripcionId: String(r.inscripcionId) })}`}>
              Abrir boleta y comentarios
            </Link>
          </li>
        ))}
      </ul>
      {!cargando && !datos.length && !error && <p>No hay boletas en esta categoría dentro de tu alcance.</p>}
      <Paginador
        total={total}
        pagina={pagina}
        porPagina={10}
        deshabilitado={cargando}
        onCambio={(p) =>
          setQ((prev) => {
            const n = new URLSearchParams(prev);
            n.set('pagina', String(p));
            return n;
          })
        }
      />
      {id > 0 && <RespuestaBoleta key={`${id}-${intento}`} inscripcionId={id} />}
    </>
  );
}
