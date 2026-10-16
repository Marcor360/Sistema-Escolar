import { plantillaInvitacion, plantillaRecuperacion } from './plantillas-correo';

describe('Plantillas institucionales de correo', () => {
  it('incluye contenido accesible y código de activación de un solo uso', () => {
    const html = plantillaInvitacion('a'.repeat(64));
    expect(html).toContain('lang="es"');
    expect(html).toContain('IUA');
    expect(html).toContain('a'.repeat(64));
    expect(html).toContain('1 hora');
  });
  it('escapa códigos y evita inyección HTML', () => {
    const html = plantillaRecuperacion('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Olvidé mi contraseña');
  });
});
