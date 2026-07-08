import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { fechaHora } from '../utils/formato';

interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  createdAt: string;
}

/** Notificaciones in-app del usuario: contador de no leídas y panel desplegable. */
export function Campana() {
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [abierta, setAbierta] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const cargar = () => api.get<Notificacion[]>('/notificaciones/mias').then((r) => setLista(r.data));

  useEffect(() => { cargar(); }, []);

  // Cerrar al hacer clic fuera del panel
  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener('mousedown', alClic);
    return () => document.removeEventListener('mousedown', alClic);
  }, []);

  const noLeidas = lista.filter((n) => !n.leida).length;

  const leer = async (notificacion: Notificacion) => {
    if (notificacion.leida) return;
    await api.patch(`/notificaciones/${notificacion.id}/leer`);
    setLista((previa) => previa.map((n) => (n.id === notificacion.id ? { ...n, leida: true } : n)));
  };

  return (
    <div className="campana" ref={contenedor}>
      <button
        className="campana-boton"
        onClick={() => { setAbierta(!abierta); if (!abierta) cargar(); }}
        aria-label={`Notificaciones${noLeidas > 0 ? `: ${noLeidas} sin leer` : ''}`}
      >
        🔔{noLeidas > 0 && <span className="campana-conteo">{noLeidas}</span>}
      </button>
      {abierta && (
        <div className="campana-panel">
          <p className="campana-titulo">Notificaciones</p>
          {lista.length === 0 && <p className="campana-vacia">Sin notificaciones.</p>}
          {lista.slice(0, 15).map((n) => (
            <button
              key={n.id}
              className={`campana-item ${n.leida ? '' : 'sin-leer'}`}
              onClick={() => leer(n)}
            >
              <span className="campana-item-titulo">{n.titulo}</span>
              <span className="campana-item-mensaje">{n.mensaje}</span>
              <span className="campana-item-fecha">{fechaHora(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
