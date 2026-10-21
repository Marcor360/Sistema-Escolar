import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { api, archivosBase, mensajeDeError } from '../api/client';
import { useMarca } from '../marca/MarcaContext';
import { MAX_LOGO_ORIGINAL_BYTES, optimizarLogo } from '../utils/optimizar-logo';

export default function ConfiguracionPage() {
  const { marca, recargar } = useMarca();
  const [nombreInstitucion, setNombreInstitucion] = useState(marca.nombreInstitucion);
  const [nombreCorto, setNombreCorto] = useState(marca.nombreCorto);
  const [colorPrimario, setColorPrimario] = useState(marca.colorPrimario);
  const [colorAcento, setColorAcento] = useState(marca.colorAcento);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [logoNoDisponible, setLogoNoDisponible] = useState(false);
  const [archivoRechazado, setArchivoRechazado] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const mutando = useRef(false);
  const selectorLogo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNombreInstitucion(marca.nombreInstitucion);
    setNombreCorto(marca.nombreCorto);
    setColorPrimario(marca.colorPrimario);
    setColorAcento(marca.colorAcento);
  }, [marca]);

  useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia); }, [vistaPrevia]);

  const seleccionarLogo = (evento: ChangeEvent<HTMLInputElement>) => {
    const seleccionado = evento.target.files?.[0] ?? null;
    setError('');
    setLogoNoDisponible(false);
    setArchivoRechazado(false);
    if (seleccionado && seleccionado.size > MAX_LOGO_ORIGINAL_BYTES) {
      setArchivo(null);
      setVistaPrevia(null);
      setArchivoRechazado(true);
      setError('El logotipo supera los 20 MB permitidos. Selecciona una imagen más ligera.');
      return;
    }
    if (seleccionado && (!/\.(png|jpe?g|webp)$/i.test(seleccionado.name) || seleccionado.size === 0)) {
      setArchivo(null);
      setVistaPrevia(null);
      setArchivoRechazado(true);
      setError('Selecciona una imagen PNG, JPG o WebP válida.');
      return;
    }
    setArchivo(seleccionado);
    setVistaPrevia(seleccionado ? URL.createObjectURL(seleccionado) : null);
  };

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (mutando.current || archivoRechazado || (archivo && logoNoDisponible)) return; mutando.current = true;
    setError(''); setMensaje(''); setGuardando(true);
    let datosInstitucionalesGuardados = false;
    let logoGuardado = false;
    try {
      if (archivo) setMensaje('Optimizando el logotipo a WebP…');
      const webp = archivo ? await optimizarLogo(archivo) : null;
      setMensaje('');
      await api.put('/configuracion/marca', { nombreInstitucion, nombreCorto, colorPrimario, colorAcento });
      datosInstitucionalesGuardados = true;
      if (webp) {
        const datos = new FormData();
        datos.append('logo', webp);
        const { data } = await api.post<{ logoUrl: string }>('/configuracion/marca/logo', datos);
        logoGuardado = true;
        if (data.logoUrl) {
          const respuesta = await fetch(archivosBase + data.logoUrl, { cache: 'no-store' });
          if (!respuesta.ok || !/^image\/webp\b/i.test(respuesta.headers.get('content-type') ?? '')) {
            throw new Error('El logotipo se registró, pero no está disponible en la URL pública. Verifica los archivos y permisos de staging.');
          }
        }
      }
      await recargar();
      setArchivo(null); setVistaPrevia(null);
      if (selectorLogo.current) selectorLogo.current.value = '';
      setArchivoRechazado(false);
      setLogoNoDisponible(false);
      setMensaje('Identidad institucional actualizada.');
    } catch (err) {
      const detalle = mensajeDeError(err);
      const mensaje = detalle === 'File too large'
        ? 'El logotipo supera los 20 MB permitidos. Selecciona una imagen más ligera.'
        : detalle;
      setError(logoGuardado
        ? `Los datos y el logotipo se guardaron, pero no se pudo actualizar la vista: ${mensaje}`
        : datosInstitucionalesGuardados && archivo
        ? `Los datos institucionales se guardaron, pero el logotipo no: ${mensaje}`
        : mensaje);
    } finally {
      setMensaje((actual) => actual === 'Optimizando el logotipo a WebP…' ? '' : actual);
      mutando.current = false; setGuardando(false);
    }
  };

  const quitarLogo = async () => {
    if (mutando.current) return; mutando.current = true;
    setError(''); setMensaje(''); setGuardando(true);
    try {
      await api.delete('/configuracion/marca/logo');
      await recargar();
      setArchivo(null); setVistaPrevia(null);
      if (selectorLogo.current) selectorLogo.current.value = '';
      setArchivoRechazado(false); setLogoNoDisponible(false);
      setMensaje('Logo eliminado; se mostrará el monograma.');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      mutando.current = false; setGuardando(false);
    }
  };

  const logoVisible = vistaPrevia || (marca.logoUrl ? archivosBase + marca.logoUrl : null);
  useEffect(() => { setLogoNoDisponible(false); }, [logoVisible]);
  return <>
    <header className="encabezado"><h1>Configuración institucional</h1><p className="detalle">Nombre, logo y colores de los clientes.</p></header>
    <form className="panel" onSubmit={guardar} aria-busy={guardando}>
      <div className="fila">
        <div className="campo"><label htmlFor="nombre-institucion">Nombre de la institución</label><input id="nombre-institucion" maxLength={150} minLength={2} value={nombreInstitucion} onChange={(e) => setNombreInstitucion(e.target.value)} required /></div>
        <div className="campo"><label htmlFor="nombre-corto">Nombre corto</label><input id="nombre-corto" maxLength={10} value={nombreCorto} onChange={(e) => setNombreCorto(e.target.value)} required /></div>
        <div className="campo"><label htmlFor="color-primario">Color primario</label><input id="color-primario" type="color" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)} /></div>
        <div className="campo"><label htmlFor="color-acento">Color de acento</label><input id="color-acento" type="color" value={colorAcento} onChange={(e) => setColorAcento(e.target.value)} /></div>
      </div>
      <div className="campo configuracion-logo">
        <label htmlFor="logo">Logo (PNG, JPG o WebP; máximo 20 MB; se optimiza a WebP)</label>
        <input ref={selectorLogo} disabled={guardando} id="logo" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={seleccionarLogo} />
        {logoVisible && !logoNoDisponible && <img className="logo-marca vista-logo" src={logoVisible} alt="Vista previa del logo" onError={() => setLogoNoDisponible(true)} />}
        {logoNoDisponible && <p role="alert" className="mensaje-error">{vistaPrevia
          ? 'La imagen seleccionada no se puede mostrar. Revisa que sea un archivo de imagen válido.'
          : 'El logotipo guardado no se puede mostrar. Contacta al administrador para verificar el archivo en el servidor.'}</p>}
      </div>
      {error && <p role="alert" className="mensaje-error">{error}</p>}
      {mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}
      <div className="fila">
        <button className="boton" disabled={guardando || archivoRechazado || Boolean(archivo && logoNoDisponible)}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        {marca.logoUrl && <button type="button" className="boton peligro" onClick={quitarLogo} disabled={guardando}>Quitar logo</button>}
      </div>
    </form>
  </>;
}
