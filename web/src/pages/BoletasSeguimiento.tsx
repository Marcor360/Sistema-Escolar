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
}
export default function BoletasSeguimiento() {
  const [q, setQ] = useSearchParams(),
    [datos, setDatos] = useState<Fila[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState(''),
    [cargando, setCargando] = useState(false),
    [intento, setIntento] = useState(0);
  const estado = q.get('estado') || '',
    pagina = Math.max(1, Number(q.get('pagina')) || 1),
    id = Number(q.get('inscripcionId'));
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api
      .get('/boletas/seguimiento', {
        params: {
          pagina,
          porPagina: 10,
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
          ['', 'Todas las respuestas'],
          ['ACEPTADA', 'Boletas aceptadas'],
          ['REVISION', 'Boletas con comentarios'],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            className={estado === valor ? 'boton' : 'boton secundario'}
            onClick={() => setQ({ estado: valor })}
          >
            {texto}
          </button>
        ))}
      </div>
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
              {r.matricula} · {r.estado === 'ACEPTADA' ? 'Boleta aceptada' : 'Revisión con comentarios'}
            </p>
            <p>
              {r.vigente
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
      {id > 0 && <RespuestaBoleta key={id} inscripcionId={id} />}
    </>
  );
}
