import { validateHeaderValue } from 'http';
import { contentDisposition } from './content-disposition';
describe('Nombres de descarga HTTP', () => {
  it('acepta nombres Unicode sin romper el encabezado y conserva el original codificado', () => {
    const header = contentDisposition('tarea-数学-📝.pdf','inline');
    expect(() => validateHeaderValue('Content-Disposition',header)).not.toThrow();
    expect(decodeURIComponent(header.split("filename*=UTF-8''")[1])).toBe('tarea-数学-📝.pdf');
  });
  it('neutraliza controles, rutas y comillas sin permitir inyección de encabezados', () => {
    const header = contentDisposition('../informe"\r\nX-Prueba: sí.pdf','attachment');
    expect(() => validateHeaderValue('Content-Disposition',header)).not.toThrow();
    expect(header).not.toMatch(/[\r\n]/); expect(header).toContain('filename=".._informe_');
  });
  it('acepta Unicode incompleto y nombres vacíos sin lanzar URIError', () => {
    expect(() => contentDisposition('\ud800.pdf','inline')).not.toThrow();
    expect(contentDisposition('','inline')).toContain('filename="archivo"');
  });
});
