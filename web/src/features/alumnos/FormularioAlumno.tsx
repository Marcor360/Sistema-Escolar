import { FORM_INICIAL } from './tipos';
import { FormEvent } from 'react';
import type { Plantel } from './tipos';
import type * as React from 'react';
interface Props {
editando: number | null;
crear: (e: FormEvent) => Promise<void>;
enviando: boolean;
form: { matricula: string; nombre: string; apellidoPaterno: string; apellidoMaterno: string; email: string; password: string; curp: string; tutorNombre: string; tutorTelefono: string; plantelId: string; };
setForm: React.Dispatch<React.SetStateAction<{ matricula: string; nombre: string; apellidoPaterno: string; apellidoMaterno: string; email: string; password: string; curp: string; tutorNombre: string; tutorTelefono: string; plantelId: string; }>>;
planteles: Plantel[];
dar: (campo: Exclude<keyof typeof FORM_INICIAL, 'plantelId'>) => { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; };
setEditando: React.Dispatch<React.SetStateAction<number | null>>;
error: string;
mensaje: string;
}
export function FormularioAlumno({ editando, crear, enviando, form, setForm, planteles, dar, setEditando, error, mensaje }: Props) { return (<section className="panel" id="form-alumno">
        <h2>{editando ? 'Editar alumno' : 'Registrar alumno'}</h2>
        <form onSubmit={crear} aria-busy={enviando}><fieldset disabled={enviando} style={{ border: 0, margin: 0, padding: 0 }}><legend>Datos del alumno</legend>
          <div className="fila">
            <div className="campo"><label htmlFor="alumnos-campo-1">Plantel</label>
              <select id="alumnos-campo-1" required disabled={editando !== null || enviando} value={form.plantelId} onChange={(e) => setForm({ ...form, plantelId: e.target.value })}>
                <option value="">Selecciona…</option>
                {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="campo"><label htmlFor="alumnos-campo-2">Matrícula</label><input id="alumnos-campo-2" required disabled={editando !== null} {...dar('matricula')} /></div>
            <div className="campo"><label htmlFor="alumnos-campo-3">Nombre</label><input id="alumnos-campo-3" required {...dar('nombre')} /></div>
            <div className="campo"><label htmlFor="alumnos-campo-4">Apellido paterno</label><input id="alumnos-campo-4" required {...dar('apellidoPaterno')} /></div>
            <div className="campo"><label htmlFor="alumnos-campo-5">Apellido materno</label><input id="alumnos-campo-5" {...dar('apellidoMaterno')} /></div>
            <div className="campo"><label htmlFor="alumnos-campo-6">CURP</label><input id="alumnos-campo-6" {...dar('curp')} /></div>
          </div>
          <div className="fila" style={{ marginTop: 10 }}>
            <div className="campo"><label htmlFor="alumnos-campo-7">Correo</label><input id="alumnos-campo-7" type="email" required disabled={editando !== null} {...dar('email')} /></div>
            {!editando && <div className="campo"><label htmlFor="alumnos-campo-8">Contraseña inicial</label><input id="alumnos-campo-8" type="password" autoComplete="new-password" required minLength={8} {...dar('password')} /></div>}
            <div className="campo"><label htmlFor="alumnos-campo-9">Tutor</label><input id="alumnos-campo-9" {...dar('tutorNombre')} /></div>
            <div className="campo"><label htmlFor="alumnos-campo-10">Tel. tutor</label><input id="alumnos-campo-10" {...dar('tutorTelefono')} /></div>
            <button className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar alumno'}</button>
            {editando && <button type="button" className="boton secundario" onClick={() => { setEditando(null); setForm(FORM_INICIAL); }}>Cancelar edición</button>}
          </div>
        </fieldset></form>
        {error && <p className="mensaje-error">{error}</p>}
        {mensaje && <p className="mensaje-ok">{mensaje}</p>}
      </section>); }
