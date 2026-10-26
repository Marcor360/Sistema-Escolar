import { dispositivoSesion } from './dispositivo-sesion';
it('clasifica sin conservar el agente bruto ni confiar en él para autorizar', () => {
  expect(dispositivoSesion('Mozilla Windows Chrome/120 Edg/120', 'WEB')).toBe('Edge · Windows');
  expect(dispositivoSesion('okhttp/4', 'MOVIL')).toBe('App alumno · Android');
  expect(dispositivoSesion('<script>dato privado</script>', 'WEB')).toBe(
    'Navegador no identificado · Sistema no identificado',
  );
});
