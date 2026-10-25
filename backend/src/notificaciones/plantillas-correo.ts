/** Plantillas transaccionales compatibles con correo, sin recursos externos. */
export interface MarcaCorreo { nombreInstitucion: string; nombreCorto: string; colorPrimario: string; colorAcento: string }
const BASE: MarcaCorreo = { nombreInstitucion: 'Instituto Universitario de América', nombreCorto: 'IUA', colorPrimario: '#14343B', colorAcento: '#C79A3C' };
const escapar = (valor: string): string => valor.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const colorSeguro = (color: string, reemplazo: string) => /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : reemplazo;
const textoContraste = (color: string): string => {
  const c = [1, 3, 5].map((i) => { const n = Number.parseInt(color.slice(i, i+2),16)/255; return n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4; });
  const l = c[0]*.2126+c[1]*.7152+c[2]*.0722;
  return 1.05/(l+.05) >= 4.5 ? '#FFFFFF' : '#000000';
};
const marco = (titulo: string, subtitulo: string, contenido: string, marca: MarcaCorreo): string => {
  const primario = colorSeguro(marca.colorPrimario, BASE.colorPrimario), acento = colorSeguro(marca.colorAcento, BASE.colorAcento);
  const contraste = textoContraste(primario), nombre = escapar(marca.nombreInstitucion || BASE.nombreInstitucion), corto = escapar(marca.nombreCorto || BASE.nombreCorto);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f3f5f2;font-family:Arial,Helvetica,sans-serif;color:#152a25">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse">
<tr><td style="background:${primario};border-top:6px solid ${acento};border-radius:16px 16px 0 0;padding:30px 32px;color:${contraste}">
<p style="margin:0 0 18px;font-weight:bold;font-size:14px;letter-spacing:2px;color:${contraste}">${corto} · PLATAFORMA ESCOLAR</p>
<h1 style="font-size:27px;line-height:1.25;margin:0;color:${contraste}">${titulo}</h1>
<p style="font-size:15px;line-height:1.6;margin:10px 0 0;color:${contraste}">${subtitulo}</p></td></tr>
<tr><td style="padding:32px;background:#fff;border:1px solid #dbe3dd;border-top:0">${contenido}
<p style="color:#5e7169;font-size:13px;line-height:1.6;margin-top:26px">Por seguridad, no compartas tus códigos ni contraseñas. Si no solicitaste esta operación, ignora el mensaje y contacta a tu plantel.</p></td></tr>
<tr><td style="padding:18px 24px;background:#e9eee9;border-radius:0 0 16px 16px;text-align:center;font-size:12px;line-height:1.5;color:#4a6055">${nombre} · Mensaje automático de la Plataforma Escolar</td></tr>
</table></body></html>`;
};
const codigo = (valor: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;border-collapse:collapse"><tr><td style="background:#f0f5f1;border:1px solid #d3e0d5;border-radius:12px;text-align:center;padding:18px 12px;word-break:break-all"><strong style="font-size:19px;line-height:1.5;font-family:monospace;color:#15392d;letter-spacing:2px">${escapar(valor)}</strong></td></tr></table>`;
export function plantillaInvitacion(token: string, marca: MarcaCorreo = BASE): string {
  return marco('¡Bienvenido a tu plataforma escolar!', 'Tu cuenta institucional está lista para activarse.',
    '<p style="font-size:16px;line-height:1.6;margin:0">Recibiste una invitación para acceder a tu información escolar. Abre la aplicación del alumno o el portal institucional y selecciona <strong>Activar cuenta</strong>.</p>' + codigo(token) +
    '<p style="font-size:15px;line-height:1.6;margin:0">Introduce el código y establece tu contraseña personal. <strong>El código vence en 1 hora y solo puede utilizarse una vez.</strong></p>', marca);
}
export function plantillaRecuperacion(token: string, marca: MarcaCorreo = BASE): string {
  return marco('Recupera el acceso a tu cuenta', 'Solicitud de recuperación de contraseña.',
    '<p style="font-size:16px;line-height:1.6;margin:0">Recibimos una solicitud para cambiar la contraseña de tu cuenta escolar. En la opción <strong>Olvidé mi contraseña</strong>, escribe este código:</p>' + codigo(token) +
    '<p style="font-size:15px;line-height:1.6;margin:0">El código vence en <strong>1 hora</strong>. Si no fuiste tú, ignora este mensaje; tu contraseña actual no cambiará.</p>', marca);
}
