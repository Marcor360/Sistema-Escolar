import { useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { GraficaIndicador, PuntoIndicador } from './GraficaIndicador';
interface Bloque {
  porPlantel: PuntoIndicador[];
  porCarrera: PuntoIndicador[];
  porMes: PuntoIndicador[];
  base: string;
}
interface Resultado {
  financiero?: Bloque;
  inscripciones?: Bloque;
  desde: string;
  hasta: string;
}
export function ComparativasInstitucionales({ cicloId, plantelId }: { cicloId: string; plantelId: string }) {
  const [datos, setDatos] = useState<Resultado | null>(null),
    [error, setError] = useState(''),
    [cargando, setCargando] = useState(false),
    [revision, setRevision] = useState(0),
    [desde, setDesde] = useState(''),
    [hasta, setHasta] = useState(''),
    [filtro, setFiltro] = useState({ desde: '', hasta: '' });
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setDatos(null);
    setError('');
    api
      .get<Resultado>('/analitica/comparativas', {
        params: {
          cicloId: cicloId || undefined,
          plantelId: plantelId || undefined,
          desde: filtro.desde || undefined,
          hasta: filtro.hasta || undefined,
        },
      })
      .then((r) => {
        if (vigente) setDatos(r.data);
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
  }, [cicloId, plantelId, filtro, revision]);
  return (
    <section aria-label="Comparativas institucionales">
      <h2>Ingresos y demanda escolar</h2>
      <form
        className="fila panel"
        onSubmit={(e) => {
          e.preventDefault();
          setFiltro({ desde, hasta });
        }}
      >
        <label>
          Desde (comparativas)
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta (comparativas)
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button disabled={cargando}>Aplicar intervalo a las gráficas</button>
        <button type="button" disabled={cargando} onClick={() => setRevision((r) => r + 1)}>
          Actualizar comparativas
        </button>
      </form>
      {cargando && <p role="status">Cargando comparativas…</p>}
      {error && <p role="alert">No se pudieron consultar las gráficas: {error}</p>}
      {datos && (
        <>
          <p>
            Intervalo consultado: {datos.desde} — {datos.hasta}. Cada gráfica tiene su propia presentación y tabla.
          </p>
          {datos.financiero && (
            <>
              <p>{datos.financiero.base}</p>
              <GraficaIndicador
                titulo="Ingresos por plantel"
                detalle="Cobros confirmados aplicados a cargos del ciclo, por plantel de origen."
                datos={datos.financiero.porPlantel}
                moneda
              />
              <GraficaIndicador
                titulo="Ingresos por carrera"
                detalle="Carrera de la programación; los cobros sin vínculo identificable se mantienen separados."
                datos={datos.financiero.porCarrera}
                moneda
              />
              <GraficaIndicador
                titulo="Evolución mensual de ingresos"
                detalle="Cobros por fecha de pago en el intervalo seleccionado."
                datos={datos.financiero.porMes}
                moneda
                temporal
              />
            </>
          )}
          {datos.inscripciones && (
            <>
              <p>{datos.inscripciones.base}</p>
              <GraficaIndicador
                titulo="Alumnos inscritos por plantel"
                detalle="Alumnos distintos en cada plantel. No representa ingresos."
                datos={datos.inscripciones.porPlantel}
              />
              <GraficaIndicador
                titulo="Alumnos inscritos por carrera"
                detalle="Demanda por carrera; una persona puede aparecer en más de una carrera."
                datos={datos.inscripciones.porCarrera}
              />
              <GraficaIndicador
                titulo="Evolución mensual de inscripciones"
                detalle="Primera inscripción del alumno en el ciclo dentro del alcance autorizado; no equivale necesariamente a nuevo ingreso a la institución."
                datos={datos.inscripciones.porMes}
                temporal
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
