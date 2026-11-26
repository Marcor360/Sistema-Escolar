export const ANCHO_MAXIMO_PORTAL = 1600;

/** Medidas en puntos de React Native; la letra ampliada prioriza una columna. */
export function calcularDisenoAlumno(ancho: number, escalaFuente = 1) {
  const viewport = Number.isFinite(ancho) && ancho > 0 ? ancho : 320;
  const escala =
    Number.isFinite(escalaFuente) && escalaFuente > 0 ? escalaFuente : 1;
  const anchoContenido = Math.min(viewport, ANCHO_MAXIMO_PORTAL);
  const lateral = viewport < 360 ? 16 : viewport < 900 ? 20 : viewport < 1440 ? 32 : 48;
  const interior = Math.max(0, anchoContenido - lateral * 2);
  const columnas = escala > 1.3 ? 1 : interior >= 1000 ? 3 : interior >= 640 ? 2 : 1;
  return {
    anchoContenido,
    amplio: interior >= 1050 && escala <= 1.3,
    lateral,
    columnas,
    anchoAcceso: Math.floor(
      Math.max(0, (interior - (columnas - 1) * 16) / columnas),
    ),
    compacto: viewport < 360,
  };
}
