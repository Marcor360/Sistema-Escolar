# Privacidad del selector de entregas

Este PR impide que la aplicación pase al backend URI remotas o nombres que contengan rutas/control y rechaza tamaños no válidos antes del envío. Los archivos solo se seleccionan desde el diálogo nativo (`file://` o `content://`) y no se guardan en AsyncStorage, SecureStore ni caché académica.

**Límite pendiente:** Expo DocumentPicker usa `copyToCacheDirectory: true` para obtener una copia legible durante la subida. Este PR **no elimina físicamente** esa copia nativa. Para hacerlo de forma segura se necesita instalar una versión compatible de `expo-file-system`, mantener lockfile y realizar QA Android/iOS con URIs `content://`, permisos y errores de red. No se añadió una dependencia sin esas verificaciones. Al no tener acceso a dispositivos físicos, no se certifica la limpieza automática del directorio temporal.
