import * as ExcelJS from 'exceljs';
import { TIPOS_IMPORTACION } from './importaciones.dto';
import { CABECERAS } from './importaciones.service';
import { leerArchivo } from './lectura';
import { crearPlantillaImportacion, COLUMNAS_PLANTILLA } from './plantillas';

for (const tipo of TIPOS_IMPORTACION) {
  it(`genera plantilla ${tipo} con cabeceras originales, guía y columnas legibles`, async () => {
    const archivo = await crearPlantillaImportacion(tipo).xlsx.writeBuffer();
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(archivo as never);
    const datos = libro.worksheets[0];
    expect(datos.name).toBe(tipo);
    expect(COLUMNAS_PLANTILLA[tipo].map((_, indice) => datos.getRow(1).getCell(indice + 1).value)).toEqual(COLUMNAS_PLANTILLA[tipo]);
    expect(datos.rowCount).toBe(1);
    expect(datos.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(datos.autoFilter).toBeTruthy();
    const guia = libro.getWorksheet('Instrucciones');
    const filaGuia = tipo === 'ALUMNOS' ? 8 : 6;
    expect(guia?.getCell(`A${filaGuia}`).value).toBe('Campo técnico');
    expect(guia?.getCell(`B${filaGuia}`).value).toBe('Requerido');
    expect(guia?.rowCount).toBe(filaGuia + COLUMNAS_PLANTILLA[tipo].length);
  });
}

it('preserva ceros de matrícula, CURP y teléfonos al completar e importar XLSX', async () => {
  const libro = crearPlantillaImportacion('ALUMNOS');
  const datos = libro.worksheets[0];
  const ejemplo: Record<string, string | number> = {
    correoInstitucional: 'alumno@iua.edu.mx', correoPersonal: 'alumno.personal@example.invalid',
    correoProveedor: 'Microsoft 365', nombre: 'Ana', apellidoPaterno: 'Prueba',
    matricula: '000123', plantelId: 1, curp: 'AAAA010101MDFRRR09',
    fechaNacimiento: '2001-01-01', telefono: '0012345678', tutorNombre: 'Tutora', tutorTelefono: '0001002000',
  };
  datos.addRow(COLUMNAS_PLANTILLA.ALUMNOS.map((campo) => ejemplo[campo] ?? ''));
  const archivo = Buffer.from(await libro.xlsx.writeBuffer());
  const leidas = await leerArchivo(archivo, 'alumnos.xlsx');
  expect(leidas).toHaveLength(1);
  expect(leidas[0]).toMatchObject({
    matricula: '000123',
    curp: 'AAAA010101MDFRRR09',
    telefono: '0012345678',
    tutorTelefono: '0001002000',
    plantelId: '1',
    fechaNacimiento: '2001-01-01',
    correoInstitucional: 'alumno@iua.edu.mx',
    correoPersonal: 'alumno.personal@example.invalid', correoProveedor: 'Microsoft 365',
  });
});

it('la plantilla descargada de alumnos explica activación tanto en la nota como en la guía', async () => {
  const buffer = await crearPlantillaImportacion('ALUMNOS').xlsx.writeBuffer();
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as never);
  const indice = COLUMNAS_PLANTILLA.ALUMNOS.indexOf('matricula') + 1;
  const nota = JSON.stringify(libro.getWorksheet('ALUMNOS')!.getRow(1).getCell(indice).note);
  const guia = libro.getWorksheet('Instrucciones')!;
  const fila = guia.getRows(9, guia.rowCount)!.find(r => r.getCell(1).value === 'matricula')!;
  for (const texto of [nota, String(fila.getCell(3).value)]) {
    expect(texto).toContain('No es una contraseña');
    expect(texto).toContain('código privado de activación');
    expect(texto).not.toContain('contraseña temporal inicial');
  }
});

it('alumnos: plantilla descargable con correos separados, selector desplegable y default explicado', async () => {
  const libro = crearPlantillaImportacion('ALUMNOS');
  const hoja = libro.getWorksheet('ALUMNOS')!;
  expect(COLUMNAS_PLANTILLA.ALUMNOS).toContain('correoInstitucional');
  expect(COLUMNAS_PLANTILLA.ALUMNOS).toContain('correoPersonal');
  expect(COLUMNAS_PLANTILLA.ALUMNOS).toContain('correoProveedor');
  expect(COLUMNAS_PLANTILLA.ALUMNOS).not.toContain('email');
  expect(CABECERAS.ALUMNOS).toContain('email'); // Compatibilidad CSV previo.
  const columna = hoja.getColumn(COLUMNAS_PLANTILLA.ALUMNOS.indexOf('correoProveedor') + 1).letter;
  const validaciones = (hoja as unknown as { dataValidations: { find: (rango: string) => {
    type: string; formulae: string[];
  } | undefined } }).dataValidations;
  const lista = validaciones.find(`${columna}2:${columna}501`);
  expect(lista?.type).toBe('list');
  expect(lista?.formulae).toEqual(['"Microsoft 365,GoDaddy"']);
  expect(hoja.rowCount).toBe(1); // La validación no debe crear 500 filas fantasma.
  expect(String(libro.getWorksheet('Instrucciones')!.getCell('A6').value)).toContain('Correo institucional');
});
