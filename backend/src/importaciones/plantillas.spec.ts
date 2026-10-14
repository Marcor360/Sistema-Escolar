import * as ExcelJS from 'exceljs';
import { TIPOS_IMPORTACION } from './importaciones.dto';
import { CABECERAS } from './importaciones.service';
import { leerArchivo } from './lectura';
import { crearPlantillaImportacion } from './plantillas';

for (const tipo of TIPOS_IMPORTACION) {
  it(`genera plantilla ${tipo} con cabeceras originales, guía y columnas legibles`, async () => {
    const archivo = await crearPlantillaImportacion(tipo).xlsx.writeBuffer();
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(archivo as never);
    const datos = libro.worksheets[0];
    expect(datos.name).toBe(tipo);
    expect(datos.getRow(1).values.slice(1)).toEqual(CABECERAS[tipo]);
    expect(datos.rowCount).toBe(1);
    expect(datos.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(datos.autoFilter).toBeTruthy();
    const guia = libro.getWorksheet('Instrucciones');
    expect(guia?.getCell('A6').value).toBe('Campo técnico');
    expect(guia?.getCell('B6').value).toBe('Requerido');
    expect(guia?.rowCount).toBe(6 + CABECERAS[tipo].length);
  });
}

it('preserva ceros de matrícula, CURP y teléfonos al completar e importar XLSX', async () => {
  const libro = crearPlantillaImportacion('ALUMNOS');
  const datos = libro.worksheets[0];
  datos.addRow([
    'alumno@example.invalid', 'Ana', 'Prueba', '', '000123', 1,
    'AAAA010101MDFRRR09', '2001-01-01', '0012345678', 'Tutora', '0001002000', '',
  ]);
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
  });
});
