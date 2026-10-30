import { FormEvent } from 'react';
import type * as React from 'react';
import { FORM_INICIAL } from './tipos';
import { SelectorProveedorCorreo } from '../../components/SelectorProveedorCorreo';
import type { Plantel } from './tipos';

interface Props {
  cancelar?: () => void;
  editando: number | null;
  crear: (e: FormEvent) => Promise<void>;
  enviando: boolean;
  form: typeof FORM_INICIAL;
  setForm: React.Dispatch<React.SetStateAction<typeof FORM_INICIAL>>;
  planteles: Plantel[];
  dar: (campo: Exclude<keyof typeof FORM_INICIAL, 'plantelId'>) => {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  setEditando: React.Dispatch<React.SetStateAction<number | null>>;
  error: string;
  mensaje: string;
}

export function FormularioAlumno({
  editando, crear, enviando, form, setForm, planteles, dar, setEditando, error, mensaje, cancelar,
}: Props) {
  const nuevo = editando === null;
  const curpValida = /^[A-ZÑ&]{4}\d{6}[HM][A-ZÑ]{5}[A-Z0-9]\d$/.test(form.curp.trim().toUpperCase());
  const mostrarErrorCurp = form.curp.trim().length > 0 && !curpValida;

  return (
    <section className="panel formulario-expediente" id="form-alumno" aria-labelledby="titulo-form-alumno">
      <div className="cabecera-expediente">
        <div>
          <p className="sobrelinea">CONTROL ESCOLAR</p>
          <h2 id="titulo-form-alumno">{nuevo ? 'Registrar alumno' : 'Editar expediente'}</h2>
          <p className="texto-ayuda">Paso 1: crea el expediente. Después Control Escolar realiza la apertura de cartera para asignar contexto, grupo y cargos. Completa los datos de identidad y contacto. Los campos marcados con * son obligatorios.</p>
        </div>
        <span className="sello neutro">{nuevo ? 'Alta individual' : 'Edición'}</span>
      </div>

      <form onSubmit={crear} aria-busy={enviando} aria-describedby={error ? 'error-alumno' : undefined}>
        <fieldset disabled={enviando} className="grupo-formulario">
          <legend>Identidad del alumno</legend>
          <div className="rejilla-formulario">
            <div className="campo">
              <label htmlFor="alumno-plantel">Plantel *</label>
              <select id="alumno-plantel" required disabled={!nuevo || enviando} value={form.plantelId}
                onChange={(e) => setForm((previo) => ({ ...previo, plantelId: e.target.value }))}>
                <option value="">Selecciona un plantel</option>
                {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="alumno-matricula">Matrícula *</label>
              <input id="alumno-matricula" required maxLength={20} disabled={!nuevo} autoComplete="off"
                {...dar('matricula')} aria-describedby="ayuda-matricula" />
              <small id="ayuda-matricula">Identificador único de hasta 20 caracteres.</small>
            </div>
            <div className="campo">
              <label htmlFor="alumno-nombre">Nombre *</label>
              <input id="alumno-nombre" required maxLength={80} autoComplete="given-name" {...dar('nombre')} />
            </div>
            <div className="campo">
              <label htmlFor="alumno-segundo-nombre">Segundo nombre (opcional)</label>
              <input id="alumno-segundo-nombre" maxLength={80} {...dar('segundoNombre')} />
            </div>
            <div className="campo">
              <label htmlFor="alumno-paterno">Primer apellido *</label>
              <input id="alumno-paterno" required maxLength={80} autoComplete="family-name" {...dar('apellidoPaterno')} />
            </div>
            <div className="campo">
              <label htmlFor="alumno-materno">Segundo apellido *</label>
              <input id="alumno-materno" required maxLength={80} {...dar('apellidoMaterno')} />
            </div>
            <div className="campo">
              <label htmlFor="alumno-curp">CURP {nuevo ? '*' : ''}</label>
              <input id="alumno-curp" required={nuevo} maxLength={18} minLength={18}
                autoCapitalize="characters" autoComplete="off" {...dar('curp')}
                aria-invalid={mostrarErrorCurp} aria-describedby="ayuda-curp"
                onChange={(e) => setForm((previo) => ({ ...previo, curp: e.target.value.toUpperCase() }))} />
              <small id="ayuda-curp" className={mostrarErrorCurp ? 'mensaje-error' : undefined}>
                {mostrarErrorCurp ? 'Revisa el formato de los 18 caracteres de la CURP.' : '18 caracteres. Se convertirá a mayúsculas.'}
              </small>
            </div>
          </div>
        </fieldset>

        <fieldset disabled={enviando} className="grupo-formulario">
          <legend>Acceso institucional</legend>
          <div className="rejilla-formulario">
            <div className="campo">
              <label htmlFor="alumno-correo">Correo institucional (acceso) *</label>
              <input id="alumno-correo" type="email" required maxLength={120} disabled={!nuevo} placeholder={!nuevo && !form.email ? 'Pendiente de asignar desde Usuarios' : undefined}
                autoComplete="email" {...dar('email')} />
            </div>
            <div className="campo">
              <label htmlFor="alumno-correo-personal">Correo personal (opcional)</label>
              <input id="alumno-correo-personal" type="email" maxLength={120} autoComplete="email" {...dar('correoPersonal')} />
              <small>Solo contacto alternativo. Las invitaciones y los códigos de acceso se envían al correo institucional.</small>
            </div>
            <div className="campo">
              <label htmlFor="alumno-telefono">Teléfono del alumno</label>
              <input id="alumno-telefono" type="tel" maxLength={20} autoComplete="tel-national" inputMode="tel"
                placeholder="10 dígitos" aria-describedby="ayuda-telefono-alumno" {...dar('telefono')} />
              <small id="ayuda-telefono-alumno">Número de contacto del alumno. Podrá actualizarlo desde su perfil en la aplicación.</small>
            </div>
            <SelectorProveedorCorreo id="alumno-correo-proveedor" value={form.correoProveedor}
              onChange={(correoProveedor) => setForm((anterior) => ({ ...anterior, correoProveedor }))} />
            {nuevo && <div className="aviso-credenciales" role="note">
              <strong>Primer acceso del alumno</strong>
              <p>La matrícula solo identifica su expediente: no es una contraseña. El alumno solicitará un código de activación enviado a su correo, establecerá una contraseña y después podrá iniciar sesión. Si no tiene acceso al correo, Control escolar deberá resolverlo mediante un canal institucional autorizado.</p><p>Al registrar el expediente todavía no se asigna un grupo ni materias. Después Control Escolar debe completar la apertura de cartera en el plantel y ciclo que correspondan.</p>
            </div>}
          </div>
        </fieldset>

        <fieldset disabled={enviando} className="grupo-formulario">
          <legend>Contacto y datos adicionales</legend>
          <p className="texto-ayuda">Estos campos son opcionales y pueden completarse posteriormente.</p>
          <div className="rejilla-formulario">
            <div className="campo">
              <label htmlFor="alumno-tutor">Nombre del tutor</label>
              <input id="alumno-tutor" maxLength={120} {...dar('tutorNombre')} />
            </div>
            <div className="campo">
              <label htmlFor="alumno-telefono-tutor">Teléfono del tutor</label>
              <input id="alumno-telefono-tutor" type="tel" maxLength={20} {...dar('tutorTelefono')} />
            </div>
            <div className="campo">
              <label htmlFor="alumno-nacimiento">Fecha de nacimiento</label>
              <input id="alumno-nacimiento" type="date" {...dar('fechaNacimiento')} />
            </div>
            <div className="campo campo-ancho">
              <label htmlFor="alumno-direccion">Dirección</label>
              <input id="alumno-direccion" maxLength={200} {...dar('direccion')} />
            </div>
          </div>
        </fieldset>

        <div className="acciones-formulario">
          <button className="boton" disabled={enviando || (nuevo && !curpValida)} type="submit">
            {enviando ? 'Guardando…' : nuevo ? 'Registrar alumno' : 'Guardar cambios'}
          </button>
          {!nuevo && <button type="button" className="boton secundario" disabled={enviando}
            onClick={() => { if (cancelar) cancelar(); else { setEditando(null); setForm(FORM_INICIAL); } }}>
            Cancelar edición
          </button>}
        </div>
      </form>
      {error && <p id="error-alumno" className="mensaje-error" role="alert">{error}</p>}
      {mensaje && <p className="mensaje-ok" role="status">{mensaje}</p>}
    </section>
  );
}
