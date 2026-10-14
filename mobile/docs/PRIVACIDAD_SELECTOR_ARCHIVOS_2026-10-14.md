# Privacidad del selector de entregas

Este PR impide que la aplicación pase al backend URI remotas o nombres que contengan rutas/control y rechaza tamaños no válidos antes del envío. Los archivos solo se seleccionan desde el diálogo nativo (`file://` o `content://`) y no se guardan en AsyncStorage, SecureStore ni caché académica.

**Límite pendiente:** Expo DocumentPicker usa `copyToCacheDirectory: true` para obtener una copia legible durante la subida. Este PR **no elimina físicamente** esa copia nativa. Para hacerlo de forma segura se necesita instalar una versión compatible de `expo-file-system`, mantener lockfile y realizar QA Android/iOS con URIs `content://`, permisos y errores de red. No se añadió una dependencia sin esas verificaciones. Al no tener acceso a dispositivos físicos, no se certifica la limpieza automática del directorio temporal.

## Revisión de #52–56

Se corrigen escapes de expresiones regulares que impedían compilar o confundían letras con caracteres de control. La URI proporcionada se valida estructuralmente: file local sin host remoto o content con proveedor/ruta, sin credenciales, fragmentos ni controles literales/codificados. Se conservan nombres Unicode y espacios normales. El validador admite no recibir URI cuando solo se comprueba metadato; el envío real recibe el asset completo del selector nativo.

Las regresiones backend de #52–55 se integran junto con la validación móvil mediante #56 sobre main. Reutilizan fixtures sintéticos y no alteran contratos, datos institucionales ni pagos reales. Se conserva la corrección de precisión de actividad de #51. La limpieza física de copias del selector sigue pendiente y no se acredita por estas pruebas.
