import axios, { type AxiosResponse } from 'axios';
import { expect, it } from 'vitest';
import { crearControlLectura } from './lectura-vigente';
function escenario() {
  const pendientes: { resolver: (dato: AxiosResponse) => void; rechazar: (error: Error) => void }[] = [];
  const api = axios.create({ adapter: () => new Promise((resolver, rechazar) => pendientes.push({ resolver, rechazar })) });
  const control = crearControlLectura();
  const estado = { datos: 'Sin entregar', error: '', finales: 0 };
  const cargar = () => control.cargar(() => api.get('/tareas'), (r) => { estado.datos = r.data; }, (e) => { estado.error = (e as Error).message; }, () => { estado.finales++; });
  const respuesta = (data: string) => ({ data, status: 200, statusText: 'OK', headers: {}, config: {} } as AxiosResponse);
  return { pendientes, control, estado, cargar, respuesta };
}
it('una consulta anterior no borra la entrega actualizada cuando llega después', async () => {
  const e = escenario(); const anterior = e.cargar(), actual = e.cargar();
  await Promise.resolve(); await Promise.resolve();
  e.pendientes[1].resolver(e.respuesta('ENTREGADA')); await actual;
  e.pendientes[0].resolver(e.respuesta('Sin entregar')); await anterior;
  expect(e.estado).toEqual({ datos: 'ENTREGADA', error: '', finales: 1 });
});
it('un fallo anterior no publica error ni termina la carga de la consulta actual', async () => {
  const e = escenario(); const anterior = e.cargar(), actual = e.cargar();
  await Promise.resolve(); await Promise.resolve();
  e.pendientes[0].rechazar(new Error('Timeout antiguo')); await anterior;
  expect(e.estado.error).toBe(''); expect(e.estado.finales).toBe(0);
  e.pendientes[1].resolver(e.respuesta('CALIFICADA')); await actual; expect(e.estado.datos).toBe('CALIFICADA');
});
it('salir de la pantalla invalida la consulta pendiente', async () => {
  const e = escenario(); const promesa = e.cargar(); await Promise.resolve(); await Promise.resolve();
  e.control.invalidar(); e.pendientes[0].resolver(e.respuesta('Datos posteriores al cierre')); await promesa;
  expect(e.estado).toEqual({ datos: 'Sin entregar', error: '', finales: 0 });
});
