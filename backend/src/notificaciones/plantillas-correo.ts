/** Plantillas transaccionales compatibles con correo, sin recursos externos. */
export interface MarcaCorreo {
  nombreInstitucion: string;
  nombreCorto: string;
  colorPrimario: string;
  colorAcento: string;
}
const BASE: MarcaCorreo = {
  nombreInstitucion: 'Instituto Universitario de América',
  nombreCorto: 'IUA',
  colorPrimario: '#14343B',
  colorAcento: '#C79A3C',
};
const escapar = (valor: string): string =>
  valor.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const colorSeguro = (color: string, reemplazo: string) =>
  /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : reemplazo;
const textoContraste = (color: string): string => {
  const c = [1, 3, 5].map((i) => {
    const n = Number.parseInt(color.slice(i, i + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  const l = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  return 1.05 / (l + 0.05) >= 4.5 ? '#FFFFFF' : '#000000';
};
const marco = (titulo: string, subtitulo: string, contenido: string, marca: MarcaCorreo): string => {
  const primario = colorSeguro(marca.colorPrimario, BASE.colorPrimario),
    acento = colorSeguro(marca.colorAcento, BASE.colorAcento);
  const contraste = textoContraste(primario),
    nombre = escapar(marca.nombreInstitucion || BASE.nombreInstitucion),
    corto = escapar(marca.nombreCorto || BASE.nombreCorto);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f3f5f2;font-family:Arial,Helvetica,sans-serif;color:#152a25">
<p style="display:none;max-height:0;overflow:hidden;opacity:0">${escapar(subtitulo)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse">
<tr><td style="background:${primario};border-top:6px solid ${acento};border-radius:16px 16px 0 0;padding:30px 32px;color:${contraste}">
<p style="margin:0 0 18px;font-weight:bold;font-size:14px;letter-spacing:2px;color:${contraste}">${corto} · PLATAFORMA ESCOLAR</p>
<h1 style="font-size:27px;line-height:1.25;margin:0;color:${contraste}">${titulo}</h1>
<p style="font-size:15px;line-height:1.6;margin:10px 0 0;color:${contraste}">${subtitulo}</p></td></tr>
<tr><td style="padding:32px;background:#fff;border:1px solid #dbe3dd;border-top:0">${contenido}
<p style="color:#5e7169;font-size:13px;line-height:1.6;margin-top:26px">Por seguridad, no compartas tus códigos ni contraseñas. Utiliza los canales oficiales de tu institución para solicitar ayuda.</p></td></tr>
<tr><td style="padding:18px 24px;background:#e9eee9;border-radius:0 0 16px 16px;text-align:center;font-size:12px;line-height:1.5;color:#4a6055">${nombre} · Mensaje automático de la Plataforma Escolar</td></tr>
</table></body></html>`;
};
const codigo = (valor: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;border-collapse:collapse"><tr><td style="background:#f0f5f1;border:1px solid #d3e0d5;border-radius:12px;text-align:center;padding:18px 12px;word-break:break-all"><strong style="font-size:19px;line-height:1.5;font-family:monospace;color:#15392d;letter-spacing:2px">${escapar(valor)}</strong></td></tr></table>`;
const parrafo = (texto: string) => `<p style="font-size:16px;line-height:1.7;margin:0 0 16px;overflow-wrap:anywhere;word-break:break-word">${texto}</p>`;
const pasos = (elementos: string[]) =>
  `<ol style="padding-left:24px;font-size:16px;line-height:1.7">${elementos.map((p) => `<li style="margin-bottom:12px">${p}</li>`).join('')}</ol>`;
export function plantillaInvitacion(token: string, marca: MarcaCorreo = BASE): string {
  return marco(
    'Activa tu cuenta escolar',
    'Tu primer acceso: copia el código y crea tu contraseña.',
    parrafo(
      'Tu institución creó una cuenta para ti. Para comenzar, necesitas activar el acceso; tu matrícula no es tu contraseña.',
    ) +
      parrafo('<strong>Tu código de activación</strong> · 64 caracteres') +
      codigo(token) +
      parrafo(
        '<strong>Vence en 1 hora desde la solicitud y solo se puede usar una vez.</strong> Solicitarlo otra vez durante su vigencia no amplía el plazo.',
      ) +
      pasos([
        'Si eres alumno, abre la app del alumno o el portal institucional. Si eres personal, abre el portal web.',
        'Selecciona <strong>Activar mi cuenta por primera vez</strong> e ingresa el correo donde recibiste este mensaje.',
        'Copia el código completo de este mensaje, sin espacios, y crea una contraseña personal de al menos 8 caracteres.',
      ]) +
      parrafo(
        '¿Ya activaste tu cuenta? Usa <strong>Entrar</strong>. Si olvidaste tu contraseña, elige <strong>¿Olvidaste tu contraseña?</strong>; el código de activación no sirve para recuperarla.',
      ) +
      parrafo(
        'Si el código venció, solicita otro desde la pantalla de activación. Revisa también Correo no deseado. Si no reconoces esta invitación o no puedes abrir tu correo, contacta a Control escolar.',
      ),
    marca,
  );
}
export function plantillaRecuperacion(token: string, marca: MarcaCorreo = BASE): string {
  return marco(
    'Recupera tu contraseña',
    'Código de recuperación: vence en 1 hora y se usa una sola vez.',
    parrafo(
      'Recibimos una solicitud para recuperar el acceso a tu cuenta. <strong>Tu contraseña todavía no ha cambiado.</strong>',
    ) +
      parrafo('<strong>Tu código de recuperación</strong> · 32 caracteres') +
      codigo(token) +
      parrafo(
        '<strong>Vence en 1 hora desde la solicitud y solo se puede usar una vez.</strong> Si venció o ya lo utilizaste, vuelve a solicitar la recuperación; solicitarlo otra vez mientras siga vigente no amplía su plazo.',
      ) +
      pasos([
        'Regresa a la app del alumno o al portal institucional donde seleccionaste <strong>¿Olvidaste tu contraseña?</strong> (Olvidé mi contraseña).',
        'En la pantalla de recuperación, pega el código completo de este mensaje, sin espacios. No lo pegues en Activar cuenta.',
        'Escribe una contraseña nueva de al menos 8 caracteres y confirma el cambio. Después vuelve a iniciar sesión.',
      ]) +
      parrafo(
        '¿No hiciste esta solicitud? Ignora este mensaje: tu contraseña actual seguirá siendo la misma. No compartas este código ni respondas con tu contraseña.',
      ) +
      parrafo(
        'Si no puedes entrar a tu correo institucional, solicita apoyo a Control escolar. Si esta es tu primera entrada, usa Activar mi cuenta por primera vez.',
      ),
    marca,
  );
}
export function plantillaApoyoAcceso(cuenta: string, marca: MarcaCorreo = BASE): string {
  return marco(
    'Solicitud de apoyo de acceso',
    'Aviso para Control escolar; no confirma un cambio de contraseña.',
    parrafo('Se solicitó recuperar el acceso de una cuenta vinculada con uno de tus planteles.') +
      parrafo(`Cuenta solicitante: <strong>${escapar(cuenta)}</strong>`) +
      pasos([
        'Ingresa al portal y consulta Usuarios dentro de tu alcance autorizado.',
        'Si la persona solicita ayuda, verifica su identidad antes de realizar cambios.',
        'Orienta a la persona para que complete la recuperación desde su correo. Si no tiene acceso, sigue el procedimiento institucional de apoyo.',
      ]) +
      parrafo(
        'Este aviso no incluye el código de recuperación y no requiere que cambies una contraseña de forma automática. La solicitud no demuestra que el titular haya perdido el acceso.',
      ),
    marca,
  );
}
