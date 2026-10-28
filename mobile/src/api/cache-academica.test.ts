import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configurarCacheAcademica,
  leerConCache,
  limpiarCacheAcademica,
  vaciarCacheAcademica,
} from "./cache-academica";
const offline = () => Promise.reject({ code: "ERR_NETWORK" });
afterEach(() => {
  configurarCacheAcademica(null);
  limpiarCacheAcademica();
  vi.useRealTimers();
});
describe("Caché académica de retención mínima", () => {
  it("solo ofrece una copia de cinco minutos ante fallo de red, nunca ante 401/403", async () => {
    vi.useFakeTimers();
    configurarCacheAcademica(1);
    await leerConCache("/notas", async () => ({ data: [92] }));
    expect((await leerConCache("/notas", offline)).offline).toBe(true);
    await expect(
      leerConCache("/notas", () =>
        Promise.reject({ code: "ERR_NETWORK", response: { status: 403 } }),
      ),
    ).rejects.toBeTruthy();
    vi.advanceTimersByTime(300001);
    await expect(leerConCache("/notas", offline)).rejects.toBeTruthy();
  });
  it("logout, otro alumno y renovación eliminan las copias", async () => {
    configurarCacheAcademica(1);
    await leerConCache("/notas", async () => ({ data: [92] }));
    configurarCacheAcademica(2);
    await expect(leerConCache("/notas", offline)).rejects.toBeTruthy();
    await leerConCache("/notas", async () => ({ data: [70] }));
    limpiarCacheAcademica();
    await expect(leerConCache("/notas", offline)).rejects.toBeTruthy();
    configurarCacheAcademica(null);
    await expect(leerConCache("/notas", offline)).rejects.toBeTruthy();
  });
  it("una respuesta tardía de otra identidad no entra a la nueva caché", async () => {
    configurarCacheAcademica(1);
    let resolver!: (r: { data: number[] }) => void;
    const p = leerConCache(
      "/notas",
      () =>
        new Promise<{ data: number[] }>((r) => {
          resolver = r;
        }),
    );
    configurarCacheAcademica(2);
    resolver({ data: [92] });
    await expect(p).rejects.toMatchObject({ code: "ERR_CANCELED" });
    await expect(leerConCache("/notas", offline)).rejects.toBeTruthy();
  });
  it("rechaza una solicitud antigua aunque termine con error de red", async () => {
    configurarCacheAcademica(1);
    let rechazar!: (e: unknown) => void;
    const consulta = leerConCache("/notas", () => new Promise<{ data: number[] }>((_, reject) => {
      rechazar = reject;
    }));
    configurarCacheAcademica(2);
    rechazar({ code: "ERR_NETWORK" });
    await expect(consulta).rejects.toMatchObject({ code: "ERR_CANCELED" });
  });
});
it("renovar el token borra copias pero conserva la lectura vigente de la misma identidad", async () => {
  configurarCacheAcademica(1);
  await leerConCache('/anterior', async () => ({data:[5]}));
  let resolver!: (r: {data:number[]}) => void;
  const consulta = leerConCache('/actual', () => new Promise<{data:number[]}>(r=>{resolver=r;}));
  vaciarCacheAcademica();
  await expect(leerConCache('/anterior', offline)).rejects.toBeTruthy();
  resolver({data:[8]});
  await expect(consulta).resolves.toMatchObject({data:[8],offline:false});
  await expect(leerConCache('/actual', offline)).resolves.toMatchObject({data:[8],offline:true});
});
