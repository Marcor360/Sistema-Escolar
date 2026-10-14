import { createServer, Socket } from 'net';
import { ConfigService } from '@nestjs/config';
import { NotificacionesService } from './notificaciones.service';
/** Servidor SMTP de prueba en loopback: no envía a proveedores ni usa credenciales reales. */
it('staging entrega correo al simulador SMTP y sin SMTP declara simulado', async () => {
  let contenido = ''; const conexiones = new Set<Socket>();
  const servidor = createServer((socket) => {
    conexiones.add(socket); socket.on('close', () => conexiones.delete(socket)); socket.write('220 localhost SMTP test\r\n');
    let buffer = '', datos = false;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const pos = buffer.indexOf('\r\n'), linea = buffer.slice(0, pos); buffer = buffer.slice(pos + 2);
        if (datos) { if (linea === '.') { datos = false; socket.write('250 queued\r\n'); } else contenido += linea + '\n'; }
        else if (/^EHLO/.test(linea)) socket.write('250 localhost\r\n');
        else if (linea === 'DATA') { datos = true; socket.write('354 send data\r\n'); }
        else if (linea === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const port = (servidor.address() as { port: number }).port;
  try {
    const service = new NotificacionesService({} as never, {} as never, {} as never, {} as never, {} as never, new ConfigService({ APP_ENV: 'staging', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_FROM: 'prueba@example.invalid' }));
    expect(await service.enviarEmail('alumno@example.invalid', 'Recuperación simulada', '<p>Token de prueba</p>')).toEqual({ simulado: false });
    expect(contenido).toContain('Token de prueba'); expect(contenido).toContain('alumno@example.invalid');
    const sinSmtp = new NotificacionesService({} as never, {} as never, {} as never, {} as never, {} as never, new ConfigService({ APP_ENV: 'staging' }));
    expect(await sinSmtp.enviarEmail('alumno@example.invalid', 'Prueba', '<p>Sin envío</p>')).toEqual({ simulado: true });
  } finally { conexiones.forEach((socket) => socket.destroy()); await new Promise<void>((resolve) => servidor.close(() => resolve())); }
});
