import { FormEvent } from 'react';
import type { Alumno, Plantel } from './tipos';
import type * as React from 'react';
interface Props {
transferencia: Alumno;
transferir: (e: FormEvent) => Promise<void>;
destino: string;
setDestino: React.Dispatch<React.SetStateAction<string>>;
planteles: Plantel[];
enviando: boolean;
setTransferencia: React.Dispatch<React.SetStateAction<Alumno | null>>;
}
export function TransferirAlumno({ transferencia, transferir, destino, setDestino, planteles, enviando, setTransferencia }: Props) { return (<section className="panel"><h2>Transferir a {transferencia.usuario.nombre}</h2>
        <form onSubmit={transferir}><label htmlFor="destino">Plantel de destino</label>
          <select id="destino" required value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Selecciona…</option>{planteles.filter((p) => p.id !== transferencia.plantel?.id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select><button disabled={enviando} className="boton">Confirmar transferencia</button>
          <button type="button" onClick={() => setTransferencia(null)}>Cancelar</button>
        </form></section>); }
