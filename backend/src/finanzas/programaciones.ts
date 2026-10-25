import { BadRequestException } from '@nestjs/common';
import type { ModalidadFinanciera, PrevisualizarProgramacionDto } from './programaciones.dto';

export interface CuotaCalculada {
  numero: number;
  periodo: string;
  fechaVencimiento: string;
  monto: number;
  etiqueta: string;
}

const centavos = (valor: number): number => Math.round(valor * 100);
const aPesos = (valor: number): number => valor / 100;

function mesDesplazado(mesInicio: string, desplazamiento: number): string {
  const [anio, mes] = mesInicio.split('-').map(Number);
  const indice = anio * 12 + mes - 1 + desplazamiento;
  const year = Math.floor(indice / 12), month = indice % 12 + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function obtenerNumeroCuotas(modalidad: ModalidadFinanciera, extras?: number): number {
  if (modalidad === 'SECUNDARIA') return 1;
  if (modalidad === 'BACHILLERATO') return 2;
  if (modalidad === 'SUPERIOR') return 4;
  if (!Number.isInteger(extras) || !extras || extras < 1 || extras > 12) {
    throw new BadRequestException('Un concepto adicional requiere entre 1 y 12 parcialidades');
  }
  return extras;
}

export function previsualizarProgramacion(dto: PrevisualizarProgramacionDto) {
  if (!['SECUNDARIA','BACHILLERATO','SUPERIOR','ADICIONAL'].includes(dto.modalidad) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(dto.mesInicio) ||
      !Number.isInteger(dto.diaVencimiento) || dto.diaVencimiento < 1 || dto.diaVencimiento > 28 ||
      !Number.isFinite(dto.total) || dto.total <= 0 || dto.total > 9999999999.99 ||
      centavos(dto.total) !== dto.total * 100 && Math.abs(centavos(dto.total) - dto.total * 100) > 0.00001) {
    throw new BadRequestException('Revisa modalidad, total, mes inicial y vencimiento');
  }
  if (dto.modalidad !== 'ADICIONAL' && dto.numeroCuotas !== undefined) {
    throw new BadRequestException('El número de cuotas depende de la modalidad académica');
  }
  if (dto.importes?.length && !['BACHILLERATO','ADICIONAL'].includes(dto.modalidad)) {
    throw new BadRequestException('Solo Bachillerato o un concepto adicional admiten importes personalizados');
  }
  const cantidad = obtenerNumeroCuotas(dto.modalidad, dto.numeroCuotas);
  const total = centavos(dto.total);
  if (total < cantidad) throw new BadRequestException('El importe total debe cubrir al menos un centavo por cuota');
  let importes: number[];
  if (dto.importes !== undefined) {
    if (dto.importes.length !== cantidad || dto.importes.some(m => !Number.isFinite(m) || m <= 0 || Math.abs(centavos(m) - m * 100) > 0.00001)) {
      throw new BadRequestException('Indica un importe positivo por cuota');
    }
    importes = dto.importes.map(centavos);
    if (importes.reduce((a, b) => a + b, 0) !== total) {
      throw new BadRequestException('La suma de las cuotas debe ser exactamente igual al total');
    }
  } else {
    const base = Math.floor(total / cantidad);
    importes = Array.from({ length: cantidad }, (_, index) => base + (index < total % cantidad ? 1 : 0));
  }
  const etiquetas: Record<ModalidadFinanciera, string> = {
    SECUNDARIA: 'Anualidad escolar',
    BACHILLERATO: 'Semestre',
    SUPERIOR: 'Mensualidad del cuatrimestre',
    ADICIONAL: 'Pago del concepto adicional',
  };
  const cuotas: CuotaCalculada[] = importes.map((monto, index) => {
    const periodo = mesDesplazado(dto.mesInicio, index * (dto.modalidad === 'BACHILLERATO' ? 6 : 1));
    return {
      numero: index + 1, periodo, fechaVencimiento: `${periodo}-${String(dto.diaVencimiento).padStart(2, '0')}`,
      monto: aPesos(monto), etiqueta: `${etiquetas[dto.modalidad]} ${index + 1} de ${cantidad}`,
    };
  });
  return { modalidad: dto.modalidad, total: aPesos(total), cuotas,
    advertencia: 'Cotización informativa. No genera cargos ni inscribe al alumno. Finanzas debe validar el plan, conceptos y vencimientos antes de aplicar.',
  };
}
