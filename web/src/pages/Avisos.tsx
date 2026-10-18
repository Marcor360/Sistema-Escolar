import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { FormEvent, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';

const FORM_INICIAL = { titulo: '', mensaje: '', rol: 'ALUMNO' };

export default function AvisosPage() {
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando,setEnviando] = useState(false);
  const trabajo = useModuloTrabajo(enviando);

  const difundir = async (e: FormEvent) => {
    e.preventDefault();
    if(enviando) return;
    setEnviando(true);
    setError(''); setExito('');
    try {
      const { data } = await api.post('/notificaciones/difundir', form);
      setExito(`Aviso enviado a ${data.enviadas} personas con el rol ${form.rol}.`);
      trabajo.guardado(); setForm(FORM_INICIAL);
    } catch (err) { setError(mensajeDeError(err)); } finally {setEnviando(false);}
  };

  return (
    <>
      <Encabezado titulo="Avisos" detalle="Comunicados a toda la comunidad: llegan a la campana del portal y a la app del alumno" />

      <section className="panel">
        <h2>Nuevo aviso</h2>
        <form onSubmit={difundir} aria-busy={enviando}>
          <div className="fila">
            <div className="campo" style={{ flex: '1 1 280px' }}><label>Título</label>
              <input required maxLength={150} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="campo"><label>Destinatarios</label>
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                <option value="ALUMNO">Alumnos</option>
                <option value="MAESTRO">Maestros</option>
                <option value="ADMINISTRATIVO">Administrativos</option>
                <option value="FINANZAS">Finanzas</option>
              </select>
            </div>
          </div>
          <div className="fila" style={{ marginTop: 10 }}>
            <div className="campo" style={{ flex: '1 1 100%' }}><label>Mensaje</label>
              <textarea
                required rows={4} maxLength={600}
                value={form.mensaje}
                onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
              />
            </div>
          </div>
          <div className="fila" style={{ marginTop: 10 }}>
            <button className="boton" disabled={enviando}>Enviar aviso</button>
          </div>
        </form>
        {error && <p className="mensaje-error" role="alert">{error}</p>}
        {exito && <p className="mensaje-ok" role="status">{exito}</p>}
      </section>
    </>
  );
}
