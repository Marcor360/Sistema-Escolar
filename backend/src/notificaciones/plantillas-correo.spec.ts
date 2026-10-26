import { plantillaInvitacion, plantillaRecuperacion, plantillaApoyoAcceso } from './plantillas-correo';

describe('Plantillas institucionales de correo', () => {
  it('incluye contenido accesible y código de activación de un solo uso', () => {
    const html = plantillaInvitacion('a'.repeat(64));
    expect(html).toContain('lang="es"');
    expect(html).toContain('IUA');
    expect(html).toContain('a'.repeat(64));
    expect(html).toContain('1 hora');
  });
  it('refleja la marca vigente en activación y recuperación', () => {
    const marca = { nombreInstitucion: 'Instituto Prueba', nombreCorto: 'IP', colorPrimario: '#B91C1C', colorAcento: '#FACC15' };
    for (const html of [plantillaInvitacion('abc', marca), plantillaRecuperacion('abc', marca)]) {
      expect(html).toContain('background:#B91C1C');
      expect(html).toContain('border-top:6px solid #FACC15');
      expect(html).toContain('IP · PLATAFORMA ESCOLAR');
      expect(html).toContain('Instituto Prueba');
      expect(html).not.toContain('background:#183c33');
    }
  });
  it('evita inyección a través de marca y colores inválidos', () => {
    const html = plantillaInvitacion('abc', { nombreInstitucion: '<script>peligro</script>', nombreCorto: '<IUA>', colorPrimario: 'red;evil', colorAcento: '#000000' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('background:#14343B');
  });
  it('escapa códigos y evita inyección HTML', () => {
    const html = plantillaRecuperacion('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Olvidé mi contraseña');
  });
});

// #777777 no admite blanco AA y exige negro puro para mantener al menos 4.5:1.
it('mantiene contraste AA en colores primarios intermedios', () => {
  const html = plantillaInvitacion('abc', { nombreInstitucion: 'Prueba', nombreCorto: 'P', colorPrimario: '#777777', colorAcento: '#FFFFFF' });
  expect(html).toContain('padding:30px 32px;color:#000000');
});

it('distingue activación de recuperación y explica los pasos, caducidad y solicitud no reconocida', () => {
  const html=plantillaRecuperacion('a'.repeat(32));
  expect(html).toContain('32 caracteres');
  expect(html).toContain('solo se puede usar una vez');
  expect(html).toContain('Tu contraseña todavía no ha cambiado');
  expect(html).toContain('No lo pegues en Activar cuenta');
  expect(html).toContain('no amplía su plazo');
  expect(plantillaInvitacion('a'.repeat(64))).toContain('64 caracteres');
});

it('el aviso de apoyo escapa la cuenta y evita pedir cambios automáticos',()=>{const html=plantillaApoyoAcceso('<img src=x>');expect(html).toContain('&lt;img');expect(html).not.toContain('<img');expect(html).toContain('no requiere que cambies');expect(html).toContain('verifica su identidad');});
