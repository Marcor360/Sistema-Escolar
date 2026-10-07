/* Carga de consultas autorizadas, sin capturas ni pagos y sin imprimir tokens o cuerpos. */
const { performance } = require('node:perf_hooks');
const base = process.env.PERF_API_URL;
const token = process.env.PERF_ACCESS_TOKEN;
const rutas = (process.env.PERF_PATHS || '/health/ready').split(',');
const concurrencia = Number(process.env.PERF_CONCURRENCY || 2);
const cantidad = Number(process.env.PERF_REQUESTS || 20);
if (!base || !Number.isInteger(concurrencia) || concurrencia < 1 || concurrencia > 20 ||
    !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10000 ||
    rutas.some((r) => !r.startsWith('/') || r.startsWith('//') || r.includes('?') || r.includes('..'))) {
  throw new Error('Define PERF_API_URL y rutas de consulta; concurrencia 1-20, solicitudes 1-10000.');
}
const destino = new URL(base);
if (!['http:', 'https:'].includes(destino.protocol) || destino.username || destino.password) throw new Error('URL inválida');
let siguiente = 0;
const tiempos = [];
const estados = {};
(async () => {
  const inicio = performance.now();
  await Promise.all(Array.from({ length: concurrencia }, async () => {
    while (siguiente < cantidad) {
      const indice = siguiente++;
      const desde = performance.now();
      let estado;
      try {
        const respuesta = await fetch(base.replace(/\/$/, '') + rutas[indice % rutas.length], {
          headers: { 'x-portal': process.env.PERF_PORTAL || 'WEB', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: AbortSignal.timeout(20000), redirect: 'error',
        });
        estado = String(respuesta.status);
        await respuesta.arrayBuffer();
      } catch { estado = 'red'; }
      estados[estado] = (estados[estado] || 0) + 1;
      tiempos.push(performance.now() - desde);
    }
  }));
  tiempos.sort((a, b) => a - b);
  const percentil = (p) => Math.round(tiempos[Math.ceil(p * tiempos.length) - 1]);
  console.log(JSON.stringify({ solicitudes: cantidad, concurrencia, duracionMs: Math.round(performance.now() - inicio),
    p50Ms: percentil(.50), p95Ms: percentil(.95), p99Ms: percentil(.99), estados }, null, 2));
  if (Object.keys(estados).some((e) => !/^2\d\d$/.test(e))) process.exitCode = 1;
})();
