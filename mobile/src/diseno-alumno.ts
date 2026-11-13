/** Medidas en puntos de React Native; la letra ampliada prioriza una columna. */
export function calcularDisenoAlumno(ancho: number, escalaFuente = 1) {
  const viewport = Number.isFinite(ancho) && ancho > 0 ? ancho : 320;
  const escala =
    Number.isFinite(escalaFuente) && escalaFuente > 0 ? escalaFuente : 1;
  const anchoContenido = Math.min(viewport, 1200);
  const lateral = viewport < 360 ? 16 : viewport < 900 ? 20 : 36;
  const interior = Math.max(0, anchoContenido - lateral * 2);
  const columnas = escala > 1.3 ? 1 : interior >= 1000 ? 3 : interior >= 640 ? 2 : 1;
  return {
    anchoContenido,
    lateral,
    columnas,
    anchoAcceso: Math.floor(
      Math.max(0, (interior - (columnas - 1) * 16) / columnas),
    ),
    compacto: viewport < 360,
  };
}
