# Consulta, captura e importación de notas — #105

El panel separa consultar evaluaciones, capturar/corregir e importar. Consultar muestra notas en lectura y el historial autorizado. Capturar abre el formulario a pantalla completa, sin el directorio, importación ni historial secundario. Importar abre el flujo de plantilla, previsualización y confirmación por separado.

Desde una clase seleccionada se puede pasar a captura o importación conservando la clase y el parcial. Salir con cambios exige confirmación. Cambiar de clase/parcial también exige confirmación cuando existen notas sin guardar o un archivo de importación pendiente; al cancelar se conserva el borrador y la identidad de la evaluación. La confirmación efectiva de captura/importación permite volver sin anunciar una pérdida inexistente.

La selección paginada compartida añade una confirmación opcional antes de aplicar un cambio; los consumidores existentes conservan el comportamiento síncrono. La API continúa siendo la autoridad de permisos, revisión, escala, cierre y auditoría.

Esta entrega no cambia P1–P3, Final, promedio, reglas de corrección ni formatos oficiales pendientes de #102. No requiere migración ni amplía permisos. Pruebas con router real y recorrido API/DB/navegador cubren consulta, captura, corrección, cierre/reapertura, importación y boleta.
