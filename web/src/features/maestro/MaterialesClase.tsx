import type { useDialogoMotivo } from '../../components/useDialogoMotivo';
import type { useConfirmacion } from '../../components/useConfirmacion';
import { FormEvent } from 'react';
import { abrirArchivo, api, mensajeDeError } from '../../api/client';
import { fecha } from '../../utils/formato';
import type { GrupoMateria, Material } from './tipos';
import type * as React from 'react';
interface Props {
claseActiva: GrupoMateria;
subirMaterial: (e: FormEvent) => Promise<void>;
tituloMaterial: string;
setTituloMaterial: React.Dispatch<React.SetStateAction<string>>;
archivoMaterial: React.RefObject<HTMLInputElement>;
enviando: boolean;
materiales: Material[];
dialogoMotivo: ReturnType<typeof useDialogoMotivo>;
abrirClase: (clase: GrupoMateria) => Promise<void>;
confirmacion: ReturnType<typeof useConfirmacion>;
setEnviando: React.Dispatch<React.SetStateAction<boolean>>;
setError: React.Dispatch<React.SetStateAction<string>>;
}
export function MaterialesClase({ claseActiva, subirMaterial, tituloMaterial, setTituloMaterial, archivoMaterial, enviando, materiales, dialogoMotivo, abrirClase, confirmacion, setEnviando, setError }: Props) { return (<section className="panel">
          <h2>Materiales de clase — {claseActiva.materia.nombre}</h2>
          <form onSubmit={subirMaterial} className="fila" style={{ marginBottom: 14 }}>
            <div className="campo"><label htmlFor="maestro-campo-6">Título</label>
              <input id="maestro-campo-6" value={tituloMaterial} onChange={(e) => setTituloMaterial(e.target.value)} placeholder="Guía del parcial 1" />
            </div>
            <div className="campo"><label htmlFor="maestro-campo-7">Archivo (PDF, Office, imagen · máx. 5 MB)</label>
              <input id="maestro-campo-7" type="file" ref={archivoMaterial} required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.txt" />
            </div>
            <button disabled={enviando} className="boton">Subir material</button>
          </form>
          <table className="tabla">
            <thead><tr><th>Título</th><th>Archivo</th><th>Tamaño</th><th>Fecha</th></tr></thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.id}>
                  <td>{m.titulo}</td>
                  <td><button className="enlace" onClick={() => abrirArchivo('materiales', m.id)}>{m.archivoNombre}</button></td>
                  <td>{m.tamanoKb} KB</td>
                  <td>{fecha(m.createdAt)}
                    <button disabled={enviando} onClick={() => { if (!claseActiva) return; dialogoMotivo.abrir({ titulo: 'Corregir título del material', inicial: m.titulo, minimo: 1, maximo: 150, ejecutar: async (titulo) => { await api.patch(`/materiales/${m.id}`, { titulo }); await abrirClase(claseActiva); } }); }}>Corregir título</button>
                    <button disabled={enviando} onClick={async () => { if (!claseActiva || !await confirmacion.solicitar('¿Retirar material y eliminar su archivo?')) return; setEnviando(true); try { await api.delete(`/materiales/${m.id}`); await abrirClase(claseActiva); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); } }}>Retirar material</button>
                  </td>
                </tr>
              ))}
              {materiales.length === 0 && (
                <tr><td className="vacio" colSpan={4}>Sin materiales. Sube el primero: los alumnos lo verán en su app.</td></tr>
              )}
            </tbody>
          </table>
        </section>); }
