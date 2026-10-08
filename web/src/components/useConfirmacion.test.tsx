import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useConfirmacion } from './useConfirmacion';
it('requiere confirmación, cancela con Escape, restaura foco y evita dos decisiones pendientes', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open',''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const ejecutar = vi.fn();
  function Prueba() { const c = useConfirmacion(); return <>{c.elemento}<button onClick={async () => { if (await c.solicitar({ titulo: 'Cerrar periodo', descripcion: '10 inscritos, 0 faltantes', riesgo: 'alto' })) ejecutar(); }}>Cerrar</button></>; }
  render(<Prueba />); const iniciar = screen.getByRole('button',{ name: 'Cerrar' }); iniciar.focus(); fireEvent.click(iniciar);
  expect(ejecutar).not.toHaveBeenCalled(); expect(screen.getByRole('dialog').textContent).toContain('0 faltantes'); expect(document.activeElement).toBe(screen.getByRole('button',{ name: 'Cancelar' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel',{ cancelable: true })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(document.activeElement).toBe(iniciar); expect(ejecutar).not.toHaveBeenCalled();
  fireEvent.click(iniciar); fireEvent.click(iniciar); fireEvent.click(screen.getByRole('button',{ name: 'Confirmar' })); await waitFor(() => expect(ejecutar).toHaveBeenCalledTimes(1));
});
