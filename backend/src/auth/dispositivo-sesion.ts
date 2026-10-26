/** Etiqueta informativa; el agente es declarativo, nunca una señal de autorización. No se guarda el UA bruto. */
export function dispositivoSesion(agente: string | undefined, portal: string) {
  const ua = (agente ?? '').slice(0, 500).toLowerCase();
  const sistema = /android|okhttp/.test(ua)
    ? 'Android'
    : /iphone|ipad|cfnetwork|darwin/.test(ua)
      ? 'iOS'
      : /windows/.test(ua)
        ? 'Windows'
        : /macintosh|mac os/.test(ua)
          ? 'macOS'
          : /linux/.test(ua)
            ? 'Linux'
            : 'Sistema no identificado';
  const navegador = /edg\//.test(ua)
    ? 'Edge'
    : /firefox\//.test(ua)
      ? 'Firefox'
      : /chrome\//.test(ua)
        ? 'Chrome'
        : /safari\//.test(ua)
          ? 'Safari'
          : portal === 'MOVIL'
            ? 'App alumno'
            : 'Navegador no identificado';
  return navegador + ' · ' + sistema;
}
