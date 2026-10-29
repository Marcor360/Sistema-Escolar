import { ConfiguracionBbva } from '../features/finanzas/ConfiguracionBbva';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { api, archivosBase, mensajeDeError } from '../api/client';
import { useMarca } from '../marca/MarcaContext';
import { MAX_LOGO_ORIGINAL_BYTES, optimizarLogo } from '../utils/optimizar-logo';
import { crearLogoPdfPng } from '../utils/crear-logo-pdf';

export default function ConfiguracionPage() {
  const { marca, recargar } = useMarca();
  const [nombreAdministrativo, setNombreAdministrativo] = useState(marca.nombreAdministrativo || 'Sistema Escolar Administrativo');
  const [nombrePortalAlumno, setNombrePortalAlumno] = useState(marca.nombrePortalAlumno || 'Sistema Escolar Portal Alumno');
  const [nombreInstitucion, setNombreInstitucion] = useState(marca.nombreInstitucion);
  const [nombreCorto, setNombreCorto] = useState(marca.nombreCorto);
  const [colorPrimario, setColorPrimario] = useState(marca.colorPrimario);
  const [colorAcento, setColorAcento] = useState(marca.colorAcento);
  const [mensajeBienvenida, setMensajeBienvenida] = useState(marca.mensajeBienvenida ?? '');
  const [tamanoLogo, setTamanoLogo] = useState<'NORMAL' | 'GRANDE'>(marca.tamanoLogo ?? 'NORMAL');
  const [guardandoOpciones, setGuardandoOpciones] = useState(false);
  const [estadoOpciones, setEstadoOpciones] = useState('');
  const [errorOpciones, setErrorOpciones] = useState('');
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
    setNombreAdministrativo(marca.nombreAdministrativo || 'Sistema Escolar Administrativo');
    setNombrePortalAlumno(marca.nombrePortalAlumno || 'Sistema Escolar Portal Alumno');
    setNombreInstitucion(marca.nombreInstitucion);
    setNombreCorto(marca.nombreCorto);
    setColorPrimario(marca.colorPrimario);
    setColorAcento(marca.colorAcento);
  }, [marca.nombreAdministrativo, marca.nombrePortalAlumno, marca.nombreInstitucion, marca.nombreCorto, marca.colorPrimario, marca.colorAcento]);

  useEffect(() => {
    setMensajeBienvenida(marca.mensajeBienvenida ?? '');
    setTamanoLogo(marca.tamanoLogo ?? 'NORMAL');
  }, [marca.mensajeBienvenida, marca.tamanoLogo]);

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
    let logoPdfGuardado = false;
    try {
      if (archivo) setMensaje('Optimizando el logotipo a WebP…');
      const webp = archivo ? await optimizarLogo(archivo) : null;
      const logoPdfPng = archivo ? await crearLogoPdfPng(archivo) : null;
      setMensaje('');
      await api.put('/configuracion/marca', { nombreInstitucion, nombreAdministrativo, nombrePortalAlumno, nombreCorto, colorPrimario, colorAcento });
      datosInstitucionalesGuardados = true;
      if (webp) {
        const datos = new FormData();
        datos.append('logo', webp);
        const { data } = await api.post<{ logoUrl: string }>('/configuracion/marca/logo', datos);
        logoGuardado = true;
        if (!data.logoUrl) throw new Error('La API no devolvió el nombre del logo guardado; vuelve a cargarlo.');
        if (logoPdfPng) {
          const archivoPdf = new FormData();
          archivoPdf.append('logoPdf', logoPdfPng);
          archivoPdf.append('logoUrl', data.logoUrl);
          await api.post('/configuracion/marca/logo/pdf', archivoPdf);
          logoPdfGuardado = true;
        }
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
      setMensaje(archivo ? 'Identidad institucional actualizada; logo listo para portal y fichas PDF.' : 'Identidad institucional actualizada.');
    } catch (err) {
      const detalle = mensajeDeError(err);
      const mensaje = detalle === 'File too large'
        ? logoGuardado && !logoPdfGuardado
          ? 'El PNG imprimible supera los 3 MiB permitidos por la API. Selecciona una imagen más ligera.'
          : 'El WebP optimizado supera los 10 MiB permitidos por la API. Selecciona una imagen más ligera.'
        : detalle;
      setError(logoGuardado
        ? logoPdfGuardado
          ? `Los datos y el logotipo se guardaron, pero no se pudo verificar o actualizar la vista: ${mensaje}`
          : `El logotipo WebP se guardó, pero la versión PNG para fichas PDF no: ${mensaje}`
        : datosInstitucionalesGuardados && archivo
        ? `Los datos institucionales se guardaron, pero el logotipo no: ${mensaje}`
        : mensaje);
    } finally {
      setMensaje((actual) => actual === 'Optimizando el logotipo a WebP…' ? '' : actual);
      mutando.current = false; setGuardando(false);
    }
  };

  const guardarOpciones = async (evento: FormEvent) => {
    evento.preventDefault();
    if (mutando.current) return;
    mutando.current = true; setGuardandoOpciones(true); setEstadoOpciones(''); setErrorOpciones('');
    try {
      await api.put('/configuracion/opciones', { mensajeBienvenida, tamanoLogo });
      await recargar();
      setEstadoOpciones('Opciones globales guardadas.');
    } catch (err) {
      setErrorOpciones(mensajeDeError(err));
    } finally {
      mutando.current = false; setGuardandoOpciones(false);
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
    <section className="panel" aria-labelledby="tutorial-configuracion">
      <h2 id="tutorial-configuracion">Tutorial del portal</h2>
      <p>Vuelve a consultar el recorrido de las secciones disponibles para tu cuenta.</p>
      <button type="button" className="boton secundario" onClick={() => window.dispatchEvent(new Event('escolar:reiniciar-recorrido'))}>Ver nuevamente el tutorial</button>
    </section>
    <form className="panel" onSubmit={guardar} aria-busy={guardando}>
      <div className="fila">
        <div className="campo"><label htmlFor="nombre-institucion">Nombre de la institución</label><input id="nombre-institucion" maxLength={150} minLength={2} value={nombreInstitucion} onChange={(e) => setNombreInstitucion(e.target.value)} required /></div>
        <div className="campo"><label htmlFor="nombre-administrativo">Nombre del sistema administrativo</label><input id="nombre-administrativo" required minLength={2} maxLength={150} value={nombreAdministrativo} onChange={e=>setNombreAdministrativo(e.target.value)} /></div>
        <div className="campo"><label htmlFor="nombre-portal-alumno">Nombre del portal del alumno</label><input id="nombre-portal-alumno" required minLength={2} maxLength={150} value={nombrePortalAlumno} onChange={e=>setNombrePortalAlumno(e.target.value)} /></div>
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
    <form className="panel configuracion-global" onSubmit={guardarOpciones} aria-busy={guardandoOpciones}>
      <header><h2>Opciones globales del portal web</h2>
        <p className="detalle">Solo el Superadministrador puede modificar esta configuración. No se presenta en la app del alumno.</p></header>
      <div className="fila">
        <div className="campo">
          <label htmlFor="mensaje-bienvenida">Mensaje institucional de bienvenida</label>
          <textarea id="mensaje-bienvenida" maxLength={180} value={mensajeBienvenida} onChange={(e) => setMensajeBienvenida(e.target.value)}
            placeholder="Bienvenido al portal institucional" />
          <small>Texto público del acceso; nunca incluyas información privada.</small>
        </div>
        <div className="campo">
          <label htmlFor="tamano-logo">Tamaño del logo institucional</label>
          <select id="tamano-logo" value={tamanoLogo} onChange={(e) => setTamanoLogo(e.target.value as 'NORMAL' | 'GRANDE')}>
            <option value="NORMAL">Normal</option><option value="GRANDE">Grande</option>
          </select>
          <small>No cambia la imagen original; se adapta a la pantalla.</small>
        </div>
      </div>
      {errorOpciones && <p role="alert" className="mensaje-error">{errorOpciones}</p>}
      {estadoOpciones && <p role="status" className="mensaje-ok">{estadoOpciones}</p>}
      <button type="submit" className="boton" disabled={guardandoOpciones || guardando}>Guardar opciones globales</button>
    </form>
    <ConfiguracionBbva />
  </>;
}
