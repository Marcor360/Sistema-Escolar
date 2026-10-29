let secuencia = 0;
/** Solo fixtures sintéticos; no representa una CURP certificada por RENAPO. */
export function curpFicticia() {
  const letras = (++secuencia).toString(26).padStart(4, '0').split('').map(c => String.fromCharCode(65+parseInt(c,26))).join('');
  return `${letras}010101HDFLRN09`;
}
