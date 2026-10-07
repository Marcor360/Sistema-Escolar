import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useDialogoMotivo } from './useDialogoMotivo';
it('conserva motivo y error tras fallo; evita doble envío y restaura el foco al cerrar', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const enviar = vi.fn().mockRejectedValueOnce(new Error('Red no disponible')).mockResolvedValue(undefined);
  function Formulario() { const d = useDialogoMotivo(); return <>{d.elemento}<button onClick={() => d.abrir({ titulo: 'Cancelar cargo', ejecutar: enviar })}>Abrir</button></>; }
  render(<Formulario />); const boton = screen.getByText('Abrir'); boton.focus(); fireEvent.click(boton);
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Corrección institucional' } }); fireEvent.click(screen.getByText('Confirmar'));
  await screen.findByRole('alert'); expect((screen.getByLabelText('Motivo') as HTMLInputElement).value).toBe('Corrección institucional');
  fireEvent.click(screen.getByText('Confirmar')); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(document.activeElement).toBe(boton); expect(enviar).toHaveBeenCalledTimes(2);
});
