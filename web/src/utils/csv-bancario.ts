/** CSV con comillas dobles, comas o punto y coma; sin ejecutar fórmulas. */
export function leerCsvBancario(texto: string) {
  if (texto.length > 1024 * 1024) throw new Error('El CSV no debe superar 1 MiB');
  const delimitador = texto.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [],
    campo = '',
    comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (comillas && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else comillas = !comillas;
    } else if (!comillas && (c === delimitador || c === '\n')) {
      fila.push(campo.trim());
      campo = '';
      if (c === '\n') {
        if (fila.some(Boolean)) filas.push(fila);
        fila = [];
      }
    } else if (c !== '\r') campo += c;
  }
  if (comillas) throw new Error('Hay comillas sin cerrar');
  fila.push(campo.trim());
  if (fila.some(Boolean)) filas.push(fila);
  const cabecera = filas.shift()?.map((c) => c.replace(/^\uFEFF/, '').toLowerCase());
  if (cabecera?.join(',') !== 'folio,referencia,fecha,monto')
    throw new Error('Usa las columnas folio,referencia,fecha,monto en ese orden');
  if (!filas.length || filas.length > 500) throw new Error('Importa entre 1 y 500 movimientos');
  return filas.map((f, i) => {
    if (f.length !== 4 || !/^\d+(\.\d{1,2})?$/.test(f[3]))
      throw new Error('Monto o columnas inválidos en la fila ' + (i + 2));
    return { folio: f[0], referencia: f[1], fecha: f[2], monto: Number(f[3]) };
  });
}
