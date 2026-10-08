/** Solo la última consulta de la pantalla puede publicar datos, error o fin de carga. */
export function crearControlLectura() {
  let vigente = 0;
  return {
    invalidar() { vigente++; },
    async cargar<T>(solicitud: () => Promise<T>, aplicar: (dato: T) => void, fallar: (error: unknown) => void, terminar: () => void) {
      const id = ++vigente;
      try { const resultado = await solicitud(); if (id === vigente) aplicar(resultado); }
      catch (error) { if (id === vigente) fallar(error); }
      finally { if (id === vigente) terminar(); }
    },
  };
}
