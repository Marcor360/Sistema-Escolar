import { createContext, useContext } from 'react';

/** Ancho del área de trabajo, descontando el menú de escritorio. */
export const AnchoPortalContext = createContext<number | null>(null);
export const IdentidadAlumnoContext = createContext<{ matricula?: string; estatus?: string }>({});
export const useIdentidadAlumno = () => useContext(IdentidadAlumnoContext);
