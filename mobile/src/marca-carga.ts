import type { Marca } from "./marca";

export function esMarcaValida(valor: unknown): valor is Marca {
  if (!valor || typeof valor !== "object") return false;
  const m = valor as Partial<Marca>;
  return (
    typeof m.nombreInstitucion === "string" &&
    m.nombreInstitucion.trim().length > 0 &&
    typeof m.nombreCorto === "string" &&
    m.nombreCorto.trim().length > 0 &&
    [m.colorPrimario, m.colorPrimarioOscuro, m.colorAcento].every(
      (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
    ) &&
    (m.logoUrl === null ||
      (typeof m.logoUrl === "string" &&
        /^\/uploads\/[a-z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(m.logoUrl))) &&
    typeof m.actualizadoEn === "string"
  );
}

type FuentesMarca = {
  leer: () => Promise<string | null>;
  eliminar: () => Promise<unknown>;
  guardar: (valor: string) => Promise<unknown>;
  consultar: () => Promise<unknown>;
};

/** La marca es opcional: un fallo del almacén o la red nunca impide abrir la app. */
export async function cargarMarca(
  fuentes: FuentesMarca,
  predeterminada: Marca,
  recibir: (marca: Marca) => void,
): Promise<Marca> {
  let marca = predeterminada;
  try {
    const cache = await fuentes.leer();
    if (cache) {
      try {
        const valor: unknown = JSON.parse(cache);
        if (!esMarcaValida(valor)) throw new Error("Marca inválida");
        marca = valor;
        recibir(marca);
      } catch {
        await fuentes.eliminar().catch(() => undefined);
      }
    }
  } catch {
    /* SecureStore puede no estar disponible; continuar con la marca pública. */
  }
  try {
    const valor = await fuentes.consultar();
    if (esMarcaValida(valor)) {
      marca = valor;
      recibir(marca);
      await fuentes.guardar(JSON.stringify(marca)).catch(() => undefined);
    }
  } catch {
    /* Conservar caché válida o marca predeterminada. */
  }
  return marca;
}
