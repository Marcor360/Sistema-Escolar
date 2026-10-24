export type ProveedorCorreo = 'GODADDY' | 'MICROSOFT365';

interface Props {
  id: string;
  value: ProveedorCorreo;
  onChange: (valor: ProveedorCorreo) => void;
  disabled?: boolean;
}

/** Control reutilizable de preferencia de remitente; nunca expone credenciales. */
export function SelectorProveedorCorreo({ id, value, onChange, disabled = false }: Props) {
  return <div className="campo">
    <label htmlFor={id}>Correo emisor de notificaciones</label>
    <select id={id} value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value as ProveedorCorreo)}>
      <option value="GODADDY">Correo GoDaddy</option>
      <option value="MICROSOFT365">Correo Microsoft 365</option>
    </select>
    <small>Se utilizará para invitaciones, recuperación y avisos dirigidos a esta cuenta.
      Verifica que el proveedor pueda entregar al buzón destinatario; los servicios del dominio iua.edu.mx no están interconectados.</small>
  </div>;
}
