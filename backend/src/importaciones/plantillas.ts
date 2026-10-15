import * as ExcelJS from 'exceljs';
import { TIPOS_IMPORTACION } from './importaciones.dto';
import { CABECERAS } from './importaciones.service';

export type TipoPlantilla = (typeof TIPOS_IMPORTACION)[number];

const OBLIGATORIOS: Record<TipoPlantilla, readonly string[]> = {
  ALUMNOS: ['email', 'nombre', 'apellidoPaterno', 'matricula', 'plantelId', 'curp'],
  DOCENTES: ['email', 'nombre', 'apellidoPaterno', 'numEmpleado', 'plantelIds'],
  PERSONAL: ['email', 'nombre', 'apellidoPaterno', 'roles', 'plantelIds'],
  INSCRIPCIONES: ['matricula', 'grupoId'],
};

const DESCRIPCIONES: Record<TipoPlantilla, Record<string, string>> = {
  ALUMNOS: {
    email: 'Correo único del alumno. Se usa para ingresar al sistema.',
    nombre: 'Nombre o nombres del alumno.',
    apellidoPaterno: 'Primer apellido del alumno.',
    apellidoMaterno: 'Segundo apellido, si corresponde.',
    matricula: 'Matrícula única, solo identificador; conserva ceros iniciales. No es una contraseña. El alumno solicita un código privado de activación por correo y establece su propia contraseña; sin correo operativo el acceso permanece pendiente.',
    plantelId: 'ID numérico de un plantel activo al que tienes acceso.',
    curp: 'CURP de 18 caracteres; conserva letras y números exactamente.',
    fechaNacimiento: 'Fecha como texto AAAA-MM-DD, por ejemplo 2026-01-30.',
    telefono: 'Teléfono como texto, para no perder ceros iniciales.',
    tutorNombre: 'Nombre completo de la persona tutora.',
    tutorTelefono: 'Teléfono de la persona tutora, como texto.',
    direccion: 'Dirección del alumno; dato opcional.',
  },
  DOCENTES: {
    email: 'Correo único de la persona docente.',
    nombre: 'Nombre o nombres.',
    apellidoPaterno: 'Primer apellido.',
    apellidoMaterno: 'Segundo apellido, si corresponde.',
    numEmpleado: 'Número de empleado único, tratado como texto.',
    plantelIds: 'IDs de planteles activos, separados por punto y coma: 1;2. Usa IDs reales.',
    cedulaProfesional: 'Cédula profesional como texto, si corresponde.',
    especialidad: 'Especialidad docente, si corresponde.',
    telefono: 'Teléfono como texto.',
  },
  PERSONAL: {
    email: 'Correo único de la persona.',
    nombre: 'Nombre o nombres.',
    apellidoPaterno: 'Primer apellido.',
    apellidoMaterno: 'Segundo apellido, si corresponde.',
    roles: 'ADMINISTRATIVO o FINANZAS; si son ambos, separados por punto y coma.',
    plantelIds: 'IDs de planteles activos, separados por punto y coma: 1;2. Usa IDs reales.',
    telefono: 'Teléfono como texto.',
  },
  INSCRIPCIONES: {
    matricula: 'Matrícula existente del alumno activo en el plantel del grupo.',
    grupoId: 'ID numérico de un grupo configurable del ciclo correspondiente.',
  },
};

const CAMPOS_TEXTO = new Set([
  'email', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'matricula', 'curp',
  'fechaNacimiento', 'telefono', 'tutorNombre', 'tutorTelefono', 'direccion',
  'numEmpleado', 'plantelIds', 'cedulaProfesional', 'especialidad', 'roles',
]);

export function crearPlantillaImportacion(tipo: TipoPlantilla): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  const columnas = CABECERAS[tipo];
  const hoja = libro.addWorksheet(tipo, { views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }] });
  hoja.addRow(columnas);
  hoja.autoFilter = { from: 'A1', to: hoja.getRow(1).getCell(columnas.length).address };
  hoja.getRow(1).height = 32;

  columnas.forEach((campo, posicion) => {
    const columna = hoja.getColumn(posicion + 1);
    columna.width = ['direccion', 'tutorNombre', 'especialidad'].includes(campo) ? 34 : Math.max(19, Math.min(28, campo.length + 8));
    if (CAMPOS_TEXTO.has(campo)) columna.numFmt = '@';
    const celda = hoja.getRow(1).getCell(posicion + 1);
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14343B' } };
    celda.alignment = { vertical: 'middle', wrapText: true };
    celda.note = `${OBLIGATORIOS[tipo].includes(campo) ? 'Obligatorio' : 'Opcional'}: ${DESCRIPCIONES[tipo][campo]}`;
  });

  const guia = libro.addWorksheet('Instrucciones', { views: [{ state: 'frozen', ySplit: 6 }] });
  guia.columns = [{ width: 26 }, { width: 16 }, { width: 90 }];
  guia.addRow(['GUÍA DE CARGA MASIVA']);
  guia.addRow(['1. Completa solo la hoja ' + tipo + '; no cambies los encabezados ni su orden.']);
  guia.addRow(['2. Usa identificadores reales del sistema. No incluyas contraseñas ni fórmulas.']);
  guia.addRow(['3. No añadas filas de ejemplo. Máximo 500 registros y 5 MB por archivo.']);
  guia.addRow(['4. Sube el XLSX o CSV, revisa la previsualización y confirma para aplicar.']);
  guia.addRow(['Campo técnico', 'Requerido', 'Cómo completarlo']);
  guia.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF14343B' } };
  guia.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guia.getRow(6).height = 25;
  guia.getRow(6).eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14343B' } };
    celda.alignment = { vertical: 'middle', wrapText: true };
  });
  columnas.forEach((campo) => guia.addRow([
    campo,
    OBLIGATORIOS[tipo].includes(campo) ? 'Sí' : 'No',
    DESCRIPCIONES[tipo][campo],
  ]));
  guia.getColumn(3).alignment = { vertical: 'middle', wrapText: true };
  return libro;
}
