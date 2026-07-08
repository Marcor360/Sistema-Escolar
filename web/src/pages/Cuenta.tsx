import { FormEvent, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useAuth } from '../auth/AuthContext';

export default function CuentaPage() {
  const { sesion } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cambiar = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setExito('');
    if (nueva !== confirmar) { setError('La confirmación no coincide con la nueva contraseña'); return; }
    try {
      await api.post('/auth/cambiar-password', { actual, nueva });
      setExito('Contraseña actualizada correctamente.');
      setActual(''); setNueva(''); setConfirmar('');
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>
      <Encabezado titulo="Mi cuenta" detalle={`${sesion?.nombre} · ${sesion?.email}`} />

      <section className="panel" style={{ maxWidth: 420 }}>
        <h2>Cambiar contraseña</h2>
        <form onSubmit={cambiar}>
          <div className="campo" style={{ marginBottom: 10 }}>
            <label>Contraseña actual</label>
            <input type="password" required value={actual} onChange={(e) => setActual(e.target.value)} />
          </div>
          <div className="campo" style={{ marginBottom: 10 }}>
            <label>Nueva contraseña (mínimo 8 caracteres)</label>
            <input type="password" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </div>
          <div className="campo" style={{ marginBottom: 14 }}>
            <label>Confirmar nueva contraseña</label>
            <input type="password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </div>
          {error && <p className="mensaje-error">{error}</p>}
          {exito && <p className="mensaje-ok">{exito}</p>}
          <button className="boton">Actualizar contraseña</button>
        </form>
      </section>
    </>
  );
}
