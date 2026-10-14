import { validarArchivo } from './validar-archivo';
describe('Política de archivos institucionales', () => {
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\nendobj\n%%EOF');
  it('acepta una firma PDF para documento y la rechaza para logo', () => {
    expect(validarArchivo(pdf, 'calendario.pdf', 'application/pdf', 'CALENDARIO')).toBe('application/pdf');
    expect(() => validarArchivo(pdf, 'logo.pdf', 'application/pdf', 'LOGO')).toThrow();
  });
  it('rechaza MIME falso, ejecutable renombrado, SVG y archivo vacío', () => {
    expect(() => validarArchivo(pdf, 'foto.png', 'image/png', 'FOTO')).toThrow();
    expect(() => validarArchivo(Buffer.from('MZcontenido'), 'foto.jpg', 'image/jpeg', 'FOTO')).toThrow();
    expect(() => validarArchivo(Buffer.from('<svg/>'), 'logo.svg', 'image/svg+xml', 'LOGO')).toThrow();
    expect(() => validarArchivo(Buffer.alloc(0), 'vacio.pdf', 'application/pdf', 'DOCUMENTO')).toThrow();
  });
});
