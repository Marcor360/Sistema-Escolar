import { ChangeEvent, FormEvent, useState } from 'react';
import { api, archivosBase, mensajeDeError } from '../api/client';
import { useMarca } from '../marca/MarcaContext';
import { optimizarLogo, MAX_LOGO_ORIGINAL_BYTES } from '../utils/optimizar-logo';
import { useConfirmacion } from './useConfirmacion';

type Recurso = 'faviconAdministrativoUrl' | 'faviconAlumnoUrl' | 'logoAlumnoUrl';
const recursos: Array<{ campo: Recurso; nombre: string; ruta: string; favicon: boolean }> = [
  { campo: 'faviconAdministrativoUrl', nombre: 'Favicon del sistema administrativo', ruta: 'favicon/administrativo', favicon: true },
  { campo: 'faviconAlumnoUrl', nombre: 'Favicon del Portal Alumno', ruta: 'favicon/alumno', favicon: true },
  { campo: 'logoAlumnoUrl', nombre: 'Logo específico del Portal Alumno', ruta: 'logo-alumno', favicon: false },
];

export function RecursosMarcaPortales() {
  const { marca, recargar } = useMarca();
  const confirmacion = useConfirmacion();
  const [archivos, setArchivos] = useState<Partial<Record<Recurso, File>>>({});
  const [ocupado, setOcupado] = useState<Recurso | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const seleccionar = (campo: Recurso, evento: ChangeEvent<HTMLInputElement>) => {
    setError(''); setExito('');
    setArchivos((actual) => ({ ...actual, [campo]: evento.target.files?.[0] }));
  };
  const guardar = async (evento: FormEvent, campo: Recurso, ruta: string, favicon: boolean) => {
    evento.preventDefault();
    const archivo = archivos[campo];
    if (!archivo || ocupado) return;
    if (archivo.size === 0 || archivo.size > (favicon ? 512 * 1024 : MAX_LOGO_ORIGINAL_BYTES) ||
      (favicon ? !(archivo.type === 'image/png' && /\.png$/i.test(archivo.name)) : !/\.(png|jpe?g|webp)$/i.test(archivo.name))) {
      setError(favicon ? 'El favicon debe ser PNG cuadrado, de 16 a 512 px y pesar hasta 512 KiB.' : 'El logo debe ser PNG, JPG o WebP de máximo 20 MB.');
      return;
    }
    setOcupado(campo); setError(''); setExito('');
    try {
      const datos = new FormData();
      datos.append(favicon ? 'imagen' : 'logo', favicon ? archivo : await optimizarLogo(archivo));
      await api.post('/configuracion/marca/' + ruta, datos);
      setArchivos((actual) => ({ ...actual, [campo]: undefined }));
      try {
        await recargar();
        setExito('Recurso actualizado correctamente.');
      } catch {
        setError('El recurso se guardó, pero no se pudo actualizar la vista. Recarga la página para visualizarlo.');
      }
    } catch (error) { setError(mensajeDeError(error)); }
    finally { setOcupado(null); }
  };
  const quitar = async (campo: Recurso, ruta: string) => {
    if (ocupado || !await confirmacion.solicitar({
      titulo: 'Retirar recurso visual',
      descripcion: 'Se retirará el archivo seleccionado y el portal utilizará la imagen predeterminada. Esta acción no elimina otros logotipos.',
      riesgo: 'alto',
      etiqueta: 'Retirar recurso',
    })) return;
    setOcupado(campo); setError(''); setExito('');
    try {
      await api.delete('/configuracion/marca/' + ruta);
      try {
        await recargar();
        setExito('Recurso retirado correctamente.');
      } catch {
        setError('El recurso se retiró, pero no se pudo actualizar la vista. Recarga la página para comprobarlo.');
      }
    } catch (error) { setError(mensajeDeError(error)); }
    finally { setOcupado(null); }
  };
  return <section className="panel" aria-labelledby="recursos-marca-titulo">
    {confirmacion.elemento}
    <h2 id="recursos-marca-titulo">Favicons y logos por portal</h2>
    <p className="detalle">El favicon se muestra en la pestaña del navegador. El logo del alumno se muestra en la app y su portal; el institucional funciona como respaldo.</p>
    {recursos.map(({ campo, nombre, ruta, favicon }) => <form key={campo} className="campo" onSubmit={(evento) => void guardar(evento, campo, ruta, favicon)} aria-busy={ocupado === campo}>
      <label htmlFor={'recurso-' + campo}>{nombre}</label>
      {marca[campo] && <img src={archivosBase + marca[campo]} alt={'Vista previa de ' + nombre} style={{ maxWidth: 110, maxHeight: 80, objectFit: 'contain' }}/>}
      <input id={'recurso-' + campo} type="file" accept={favicon ? '.png,image/png' : '.png,.jpg,.jpeg,.webp'} disabled={ocupado !== null} onChange={(evento) => seleccionar(campo, evento)} />
      <div className="fila">
        <button className="boton" disabled={ocupado !== null || !archivos[campo]} type="submit">{ocupado === campo ? 'Guardando…' : 'Subir recurso'}</button>
        {marca[campo] && <button className="boton secundario" disabled={ocupado !== null} type="button" onClick={() => void quitar(campo, ruta)}>Quitar</button>}
      </div>
    </form>)}
    {error && <p role="alert" className="mensaje-error">{error}</p>}
    {exito && <p role="status" className="mensaje-ok">{exito}</p>}
  </section>;
}
