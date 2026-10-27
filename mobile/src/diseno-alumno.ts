/** Medidas en puntos de React Native; la letra ampliada prioriza una columna. */
export function calcularDisenoAlumno(ancho: number, escalaFuente = 1) {
  const viewport = Number.isFinite(ancho) && ancho > 0 ? ancho : 320;
  const escala =
    Number.isFinite(escalaFuente) && escalaFuente > 0 ? escalaFuente : 1;
  const anchoContenido = Math.min(viewport, 900);
  const lateral = viewport < 360 ? 12 : 20;
  const interior = Math.max(0, anchoContenido - lateral * 2);
  const columnas = interior >= 640 && escala <= 1.3 ? 2 : 1;
  return {
    anchoContenido,
    lateral,
    columnas,
    anchoAcceso: Math.floor(
      Math.max(0, (interior - (columnas - 1) * 12) / columnas),
    ),
    compacto: viewport < 360,
  };
}
