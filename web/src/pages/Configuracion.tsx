import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { api, archivosBase, mensajeDeError } from '../api/client';
import { useMarca } from '../marca/MarcaContext';

export default function ConfiguracionPage() {
  const { marca, recargar } = useMarca();
  const [nombreInstitucion, setNombreInstitucion] = useState(marca.nombreInstitucion);
  const [nombreCorto, setNombreCorto] = useState(marca.nombreCorto);
  const [colorPrimario, setColorPrimario] = useState(marca.colorPrimario);
  const [colorAcento, setColorAcento] = useState(marca.colorAcento);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setNombreInstitucion(marca.nombreInstitucion);
    setNombreCorto(marca.nombreCorto);
    setColorPrimario(marca.colorPrimario);
    setColorAcento(marca.colorAcento);
  }, [marca]);

  useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia); }, [vistaPrevia]);

  const seleccionarLogo = (evento: ChangeEvent<HTMLInputElement>) => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    const seleccionado = evento.target.files?.[0] ?? null;
    setArchivo(seleccionado);
    setVistaPrevia(seleccionado ? URL.createObjectURL(seleccionado) : null);
  };

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(''); setMensaje(''); setGuardando(true);
    try {
      await api.put('/configuracion/marca', { nombreInstitucion, nombreCorto, colorPrimario, colorAcento });
      if (archivo) {
        const datos = new FormData();
        datos.append('logo', archivo);
        await api.post('/configuracion/marca/logo', datos);
      }
      await recargar();
      setArchivo(null); setVistaPrevia(null);
      setMensaje('Identidad institucional actualizada.');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const quitarLogo = async () => {
    setError(''); setMensaje(''); setGuardando(true);
    try {
      await api.delete('/configuracion/marca/logo');
      await recargar();
      setArchivo(null); setVistaPrevia(null);
      setMensaje('Logo eliminado; se mostrará el monograma.');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const logoVisible = vistaPrevia || (marca.logoUrl ? archivosBase + marca.logoUrl : null);
  return <>
    <header className="encabezado"><h1>Configuración institucional</h1><p className="detalle">Nombre, logo y colores de los clientes.</p></header>
    <form className="panel" onSubmit={guardar}>
      <div className="fila">
        <div className="campo"><label htmlFor="nombre-institucion">Nombre de la institución</label><input id="nombre-institucion" maxLength={150} minLength={2} value={nombreInstitucion} onChange={(e) => setNombreInstitucion(e.target.value)} required /></div>
        <div className="campo"><label htmlFor="nombre-corto">Nombre corto</label><input id="nombre-corto" maxLength={10} value={nombreCorto} onChange={(e) => setNombreCorto(e.target.value)} required /></div>
        <div className="campo"><label htmlFor="color-primario">Color primario</label><input id="color-primario" type="color" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)} /></div>
        <div className="campo"><label htmlFor="color-acento">Color de acento</label><input id="color-acento" type="color" value={colorAcento} onChange={(e) => setColorAcento(e.target.value)} /></div>
      </div>
      <div className="campo configuracion-logo">
        <label htmlFor="logo">Logo (PNG, JPG o WebP; máximo 2 MB)</label>
        <input id="logo" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={seleccionarLogo} />
        {logoVisible && <img className="logo-marca vista-logo" src={logoVisible} alt="Vista previa del logo" />}
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      {mensaje && <p className="mensaje-ok">{mensaje}</p>}
      <div className="fila">
        <button className="boton" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        {marca.logoUrl && <button type="button" className="boton peligro" onClick={quitarLogo} disabled={guardando}>Quitar logo</button>}
      </div>
    </form>
  </>;
}
