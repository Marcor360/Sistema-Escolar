import { plantillaInvitacion, plantillaRecuperacion } from './plantillas-correo';

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
