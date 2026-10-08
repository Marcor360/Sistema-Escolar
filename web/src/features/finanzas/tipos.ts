export interface Alumno { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } }
export interface Concepto { id: number; clave: string; nombre: string; tipo: string; montoBase: number }
export interface Ciclo { id: number; clave: string }
export interface Cargo {
  id: number; descripcion: string; periodo: string | null; monto: number; descuento: number;
  recargo: number; fechaVencimiento: string | null; estatus: string;
  alumno: Alumno;
}
export interface Adeudo extends Cargo { total: number; pagado: number; saldo: number }
export interface Pago {
  id: number; monto: number; metodo: string; referencia: string | null;
  fechaPago: string; estatus: string; alumno: Alumno;
}
export interface ResultadoCargos { datos: Cargo[]; total: number; pagina: number; porPagina: number }
export interface ResultadoPagos { datos: Pago[]; total: number; pagina: number; porPagina: number }
