/** Identidad visual compartida con el portal: pizarra, papel y dorado. */
export const colores = {
  pizarra: '#14343B',
  pizarraOscuro: '#0E262B',
  papel: '#F7F8F6',
  tinta: '#1C2528',
  dorado: '#C79A3C',
  avisoTexto: '#76510A',
  linea: '#D8DCD6',
  exito: '#2E7D5B',
  peligro: '#B4452F',
  gris: '#5C6A66',
};

/** Tokens visuales compartidos por componentes del alumno. */
export const espacio = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radio = { sm: 10, md: 16, lg: 22 } as const;
export const tipografia = {
  titulo: 25,
  subtitulo: 18,
  cuerpo: 15,
  secundaria: 13,
  dato: 24,
} as const;

/** Determina color de texto sobre un fondo de marca según WCAG 2.2 AA. */
export function textoSobreFondo(fondo: string): '#ffffff' | '#19272c' | '#000000' {
  const luminancia = (color: string): number => {
    const canales = [1, 3, 5].map((pos) => {
      const valor = Number.parseInt(color.slice(pos, pos + 2), 16) / 255;
      return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
    });
    return canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722;
  };
  if (!/^#[0-9a-fA-F]{6}$/.test(fondo)) return '#19272c';
  const l = luminancia(fondo);
  if (1.05 / (l + 0.05) >= 4.5) return '#ffffff';
  const oscuro = luminancia('#19272c');
  return (l + 0.05) / (oscuro + 0.05) >= 4.5 ? '#19272c' : '#000000';
}
