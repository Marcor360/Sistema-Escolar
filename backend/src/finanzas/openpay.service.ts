import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface OpenpayCharge {
  id: string;
  status: string;
  payment_method?: { url?: string };
  due_date?: string;
}

/**
 * Integración con Openpay (cargo con redirección / checkout alojado).
 * Las credenciales las proporciona el cliente (contrato, cláusula DÉCIMA).
 * Sandbox y producción se controlan con OPENPAY_BASE_URL.
 */
@Injectable()
export class OpenpayService {
  private readonly logger = new Logger(OpenpayService.name);
  private readonly http: AxiosInstance | null = null;
  private readonly merchantId: string;

  constructor(private readonly config: ConfigService) {
    this.merchantId = this.config.get<string>('OPENPAY_MERCHANT_ID') || '';
    const privateKey = this.config.get<string>('OPENPAY_PRIVATE_KEY') || '';
    if (this.merchantId && privateKey) {
      this.http = axios.create({
        baseURL: `${this.config.get('OPENPAY_BASE_URL') || 'https://sandbox-api.openpay.mx/v1'}/${this.merchantId}`,
        auth: { username: privateKey, password: '' },
        timeout: 15000,
      });
    }
  }

  get habilitado(): boolean {
    return this.http !== null;
  }

  /** Crea un cargo con redirección; el alumno paga en la página de Openpay. */
  async crearCargoRedirect(params: {
    monto: number;
    descripcion: string;
    ordenId: string;
    clienteNombre: string;
    clienteEmail: string;
  }): Promise<OpenpayCharge> {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Pasarela no configurada: faltan OPENPAY_MERCHANT_ID / OPENPAY_PRIVATE_KEY (credenciales del cliente)',
      );
    }
    const { data } = await this.http.post<OpenpayCharge>('/charges', {
      method: 'card',
      amount: Number(params.monto.toFixed(2)),
      currency: 'MXN',
      description: params.descripcion,
      order_id: params.ordenId,
      confirm: 'false',
      send_email: false,
      redirect_url: this.config.get<string>('OPENPAY_REDIRECT_URL') || 'http://localhost:5173/pago-completado',
      customer: { name: params.clienteNombre, email: params.clienteEmail },
    });
    this.logger.log(`Orden ${params.ordenId}: cargo Openpay ${data.id} (${data.status})`);
    return data;
  }
}
