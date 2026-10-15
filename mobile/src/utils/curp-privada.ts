/** La vista de perfil solo revela por defecto los cuatro caracteres finales. */
export function ocultarCurp(curp: string): string {
  const texto = curp.trim();
  if (texto.length <= 4) return "••••";
  return "•".repeat(texto.length - 4) + texto.slice(-4);
}
