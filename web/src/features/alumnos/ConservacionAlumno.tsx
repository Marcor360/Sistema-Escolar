import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../../api/client';
import { useConfirmacion } from '../../components/useConfirmacion';
import type { EgresoAlumno } from './tipos';

interface Revision {
  eliminacionHabilitada: false;
  egresoConciliado: boolean;
  ciclos: { cicloId: number; nombre: string; estado: string; adjuntos: number }[];
  bloqueos: string[];
  aviso: string;
}
interface Props {
  alumnoId: number;
  egresoLegado: boolean;
  ciclos: { id: number; nombre: string }[];
  alConciliar: (egreso: EgresoAlumno) => void;
}
export function ConservacionAlumno({ alumnoId, egresoLegado, ciclos, alConciliar }: Props) {
  const [revision, setRevision] = useState<Revision | null>(null);
  const [cicloId, setCiclo] = useState(''),
    [curp, setCurp] = useState('');
  const [fecha, setFecha] = useState(''),
    [referencia, setReferencia] = useState('');
  const [ocupado, setOcupado] = useState(false),
    [error, setError] = useState('');
  const enCurso = useRef(false),
    activa = useRef(true);
  useEffect(() => {
    activa.current = true;
    return () => {
      activa.current = false;
    };
  }, []);
  const confirmacion = useConfirmacion();
  const revisar = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.get<Revision>(`/alumnos/${alumnoId}/conservacion-adjuntos`);
      if (activa.current) setRevision(data);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  };
  const conciliar = async (e: FormEvent) => {
    e.preventDefault();
    if (enCurso.current || !cicloId || !fecha || !curp.trim() || referencia.trim().length < 5) return;
    enCurso.current = true;
    setOcupado(true);
    setError('');
    try {
      if (
        !(await confirmacion.solicitar(
          `¿Registrar el egreso documentado en el ciclo ${ciclos.find((c) => c.id === Number(cicloId))?.nombre}, fecha ${fecha}? Verifica la CURP y el documento de origen. No se cambiarán inscripciones ni calificaciones.`,
        ))
      )
        return;
      const { data } = await api.post<EgresoAlumno>(`/alumnos/${alumnoId}/egreso/conciliacion`, {
        cicloId: Number(cicloId),
        curp: curp.trim().toUpperCase(),
        fechaEgreso: fecha,
        referenciaDocumental: referencia.trim(),
        confirmado: true,
      });
      if (activa.current) {
        alConciliar(data);
        setRevision(null);
      }
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  };
  return (
    <section aria-label="Conservación y conciliación académica">
      {confirmacion.elemento}
      <h3>Conservación del expediente</h3>
      <p>
        Los adjuntos y registros académicos se conservan. La revisión no elimina archivos ni autoriza su borrado. Un
        comprimido académico no sustituye una base SQL completa ni un respaldo restaurado.
      </p>
      <button type="button" disabled={ocupado} onClick={() => void revisar()}>
        Revisar conservación de adjuntos
      </button>
      {ocupado && <p role="status">Consultando o verificando datos…</p>}
      {error && <p role="alert">{error}</p>}
      {revision && (
        <div>
          <p role="status">
            Eliminación automática deshabilitada. Cierre, conservación y recuperación requieren validación
            institucional. PAUSA no está disponible.
          </p>
          {!revision.egresoConciliado && <p>El egreso anterior necesita conciliación documental.</p>}
          <ul>
            {revision.ciclos.map((c) => (
              <li key={c.cicloId}>
                {c.nombre}: {c.adjuntos} adjuntos · {c.estado}
              </li>
            ))}
          </ul>
          {!revision.ciclos.length && <p>Sin adjuntos referenciados en entregas.</p>}
        </div>
      )}
      {egresoLegado && (
        <form onSubmit={conciliar}>
          <fieldset disabled={ocupado}>
            <legend>Conciliar egreso anterior</legend>
            <p>
              Transcribe datos verificados del documento de egreso. No se asignan fechas automáticamente. Los ciclos
              mostrados corresponden a esta página del historial; cambia de página si necesitas otro.
            </p>
            <label>
              Ciclo documentado
              <select required value={cicloId} onChange={(e) => setCiclo(e.target.value)}>
                <option value="">Selecciona…</option>
                {ciclos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              CURP verificada
              <input
                required
                maxLength={18}
                value={curp}
                onChange={(e) => setCurp(e.target.value)}
                autoCapitalize="characters"
              />
            </label>
            <label>
              Fecha documentada de egreso
              <input required type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <p>
              La fecha se conserva como día documental, sin asignarle una hora. Si falta evidencia, deja el egreso sin
              conciliar.
            </p>
            <label>
              Referencia del documento de origen
              <input
                required
                minLength={5}
                maxLength={200}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </label>
            <button disabled={!cicloId || !fecha || !curp.trim() || referencia.trim().length < 5}>
              Verificar y conciliar egreso
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
