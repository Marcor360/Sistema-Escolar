import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { PonderacionCalificaciones } from './PonderacionCalificaciones';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('no convierte campos vacíos en cero y exige 100 % antes de enviar',()=>{
 const post=vi.spyOn(api,'post');render(<PonderacionCalificaciones claseId={1} parcial={4} alumnos={[{id:2,matricula:'A2'}]} deshabilitado={false} alCambiar={()=>{}} alOcupado={()=>{}} alGuardar={()=>{}}/>);
 fireEvent.click(screen.getByText('Capturar por porcentajes'));fireEvent.click(screen.getByText('Calcular y guardar parcial'));expect(screen.getByRole('alert').textContent).toContain('Un campo vacío no es cero');expect(post).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Porcentaje 1'),{target:{value:'30'}});fireEvent.click(screen.getByText('Calcular y guardar parcial'));expect(screen.getByRole('alert').textContent).toContain('sumen 100');expect(post).not.toHaveBeenCalled();
});
it('conserva datos tras error y envía criterios y notas al servidor al reintentar',async()=>{
 const post=vi.spyOn(api,'post').mockRejectedValueOnce(new Error('Sin red')).mockResolvedValueOnce({data:{capturadas:1}}),guardar=vi.fn();
 render(<PonderacionCalificaciones claseId={1} parcial={4} alumnos={[{id:2,matricula:'A2'}]} deshabilitado={false} alCambiar={()=>{}} alOcupado={()=>{}} alGuardar={guardar}/>);
 fireEvent.click(screen.getByText('Capturar por porcentajes'));
 for(const nombre of ['Entregables','Exámenes','Participación'])fireEvent.change(screen.getByLabelText(`A2: ${nombre}`),{target:{value:'7.5'}});
 fireEvent.click(screen.getByText('Calcular y guardar parcial'));await screen.findByRole('alert');expect((screen.getByLabelText('A2: Exámenes') as HTMLInputElement).value).toBe('7.5');
 fireEvent.click(screen.getByText('Calcular y guardar parcial'));await waitFor(()=>expect(guardar).toHaveBeenCalledTimes(1));expect(post).toHaveBeenLastCalledWith('/calificaciones/captura-ponderada',expect.objectContaining({grupoMateriaId:1,parcial:4,items:[{alumnoId:2,notas:[7.5,7.5,7.5]}]}));
});
