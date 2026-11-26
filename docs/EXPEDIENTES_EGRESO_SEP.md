# Expedientes de egreso y firma electrónica

Desde **Control escolar → Expedientes de egreso**, busca la matrícula exacta. El alcance incluye todos los planteles del historial. Finanzas captura su declaración de saldo liquidado y adjunta la hoja firmada en PDF. Administración registra el servicio social con su hoja firmada y declara la conclusión académica. Una nueva versión conserva las anteriores. La expedición vuelve a comprobar las calificaciones publicadas, las liberaciones y los pagos confirmados.

Administración y Dirección expiden constancia, relación de asignaturas, historial y boleta de egreso en XML institucional. El certificado total emplea MEC y el título emplea MET. Solo Dirección puede preparar y expedir un título. Cada emisión permite descargar el historial que existía al expedirla. Las boletas periódicas aceptadas por el alumno siguen disponibles en PDF con el diseño de Administración.

## Trámite y firma

1. Comprueba el régimen del RVOE del **programa y plantel**. Para estudios con RVOE federal, la DGAIR publica el trámite de incorporación al Módulo Electrónico de Certificación y la operación de titulación electrónica. Para RVOE estatal, confirma el canal y los catálogos de la autoridad que lo otorgó. [Incorporación MEC](https://dgair.sep.gob.mx/dreoe/mec/incorporacion_mec) · [Operación MET](https://dgair.sep.gob.mx/dreoe/met/operacion_met)
2. La institución registra sus planes, asignaturas y responsables ante la autoridad correspondiente. El estándar de título electrónico fija el orden de la cadena original y la firma con el certificado del responsable. Los ejemplos aportados contienen un título 1.0 y un certificado 3.0. [Estándar publicado en el DOF](https://sidof.segob.gob.mx/notas/docFuente/5519300)
3. En el portal registra el nombramiento y la huella SHA-256 del certificado público DER. El operador de la instalación vincula el perfil autorizado al usuario, plantel, plan y registro de firmante. Una baja o fin de vigencia bloquea la firma aunque siga existiendo el perfil.
4. Selecciona el plan en **Expedir documento**. Descarga la cadena TXT y fírmala localmente con la e.firma del responsable autorizado. Conserva exactamente los bytes UTF-8 descargados. Con OpenSSL y una llave RSA en formato PEM cifrado, la siguiente operación solicita la contraseña en el equipo del firmante.

   ```sh
   openssl dgst -sha256 -sign responsable.pem -out firma.bin cadena.txt
   openssl base64 -A -in firma.bin -out sello.txt
   ```

5. Pega el contenido de sello.txt y expide el XML. El servidor reconstruye la cadena, comprueba firma, perfil y vigencia, y valida el XML con el XSD instalado. La presentación, el número de registro y el acuse se tramitan por el canal MET/MEC autorizado. La aceptación efectiva se comprueba con el acuse de la autoridad.

## Configuración de la instalación

- Aplica la migración incremental `migracion_egreso_documentos.sql` del motor correspondiente. El directorio de archivo histórico necesita almacenamiento persistente privado, respaldo y acceso de lectura/escritura para la cuenta del backend.
- Instala Python 3 con lxml y los esquemas y dependencias locales del paquete oficial aplicable. Define `EGRESOS_PYTHON` con el ejecutable y `EGRESOS_XSD_TITULO` y `EGRESOS_XSD_DEC` con rutas absolutas. El validador trabaja sin acceso a red. [Especificación técnica MEC 3.0](https://dgair.sep.gob.mx/storage/recursos/DREOE/EspecificacionTecnica_3.0.pdf.zip)
- `EGRESOS_PERFILES_SEP_JSON` es una lista de perfiles. Cada uno lleva enteros `plantelId`, `carreraPlanId`, `usuarioId`, `firmanteId`, el certificado **público** PEM en `certificado` y `decimalesPromedio` del plan. Las claves SEP son cadenas para conservar sus ceros iniciales.
- `firma` contiene CURP, nombres, apellidos, idCargo, cargo y la abreviatura opcional del título conforme al estándar. `institucion` contiene cveInstitucion y nombreInstitucion. `carrera` contiene cveCarrera, nombreCarrera, idAutorizacionReconocimiento, autorizacionReconocimiento y numeroRvoe cuando corresponde. Usa exactamente los nombres XML de los atributos, por ejemplo `curp`, `nombre`, `primerApellido`, `segundoApellido` y `abrTitulo`.
- `mec` agrupa los atributos autorizados de `Dec`, `ServicioFirmante`, `Ipes`, `Rvoe`, `Carrera` y `Expedicion`, más `Ciclos` que relaciona la clave escolar con el ciclo oficial. `asignaturas` es el listado ordenado del plan con `clave` interna, `idAsignatura`, `idTipoAsignatura` y `creditos`. La implementación de certificado total cubre el formato del ejemplo con un resultado numérico acreditado por asignatura. Las equivalencias u observaciones que precisen otra representación requieren conciliación.
- Registra un perfil únicamente tras verificar la autorización y el estado del certificado ante la autoridad competente. Los ZIP de ejemplo y las llaves privadas quedan fuera del repositorio.

## Conservación y consulta

Al finalizar el expediente se bloquean las modificaciones y se cuentan cinco años calendario. El archivador existente procesa vencimientos diariamente con `EGRESOS_ARCHIVO_AUTOMATICO=true` y `EGRESOS_ARCHIVE_DIR` configurado. Los egresos legados conservan su calendario previo. Tras el vencimiento, la consulta histórica se hace por matrícula. La descarga completa incluye la evidencia firmada, los XML, sus instantáneas, las boletas oficiales y los movimientos académicos y financieros. El archivo comprimido se contrasta con la huella SHA-256 guardada. Los archivos legados conservan el contenido de la versión con la que se generaron.
