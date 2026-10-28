import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { PropuestasFinal } from './PropuestasFinal';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const props={claseId:7,propuestas:[{alumnoId:1,propuesta:8.29584175,definitiva:null,revision:'a'.repeat(64)}],alumnos:[{id:1,matricula:'AL1'}],motivo:'',deshabilitado:false,alOcupado:vi.fn(),alGuardar:vi.fn()};
it('muestra propuesta separada y exige acción explícita sin enviar la nota del cliente',async()=>{
 const post=vi.spyOn(api,'post').mockResolvedValue({data:{capturadas:1}});render(<PropuestasFinal {...props}/>);
 expect(screen.getByText('8.29584175')).toBeTruthy();expect(screen.getByText('Pendiente de aprobación')).toBeTruthy();expect(post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Aprobar propuesta de AL1'}));await screen.findByText('Final aprobada y guardada.');expect(post).toHaveBeenCalledWith('/calificaciones/final/aprobar',{grupoMateriaId:7,alumnoId:1,revision:'a'.repeat(64),motivo:undefined});
});
it('conserva la propuesta ante fallo y permite reintentar',async()=>{
 vi.spyOn(api,'post').mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({data:{}});const alGuardar=vi.fn();render(<PropuestasFinal {...props} alGuardar={alGuardar}/>);
 fireEvent.click(screen.getByRole('button'));await screen.findByRole('alert');expect(alGuardar).not.toHaveBeenCalled();expect(screen.getByText('8.29584175')).toBeTruthy();
 fireEvent.click(screen.getByRole('button'));await waitFor(()=>expect(alGuardar).toHaveBeenCalledTimes(1));
});
it('no aprueba sin parciales o durante cierres/consulta y exige motivo al sustituir',async()=>{
 const post=vi.spyOn(api,'post');const {rerender}=render(<PropuestasFinal {...props} deshabilitado/>);expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
 rerender(<PropuestasFinal {...props} propuestas={[{...props.propuestas[0],propuesta:null}]}/>);expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
 rerender(<PropuestasFinal {...props} propuestas={[{...props.propuestas[0],definitiva:7}]}/>);fireEvent.click(screen.getByRole('button'));await screen.findByRole('alert');expect(post).not.toHaveBeenCalled();
});
