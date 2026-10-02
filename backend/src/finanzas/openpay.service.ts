import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { isIP } from 'node:net';

export interface OpenpayCharge {
  id: string;
  status: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  transaction_type?: string;
  payment_method?: { url?: string };
  due_date?: string;
}

const URL_API_SANDBOX = 'https://sandbox-api.openpay.mx/v1';
const URL_API_PRODUCCION = 'https://api.openpay.mx/v1';

function validarUrlApiProduccion(valor: string | undefined): string {
  if (!valor) throw new Error('OPENPAY_BASE_URL es obligatorio en produccion');
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('OPENPAY_BASE_URL no es una URL valida');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'api.openpay.mx' ||
      !['', '/', '/v1', '/v1/'].includes(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new Error(`OPENPAY_BASE_URL debe apuntar a ${URL_API_PRODUCCION}`);
  }
  return URL_API_PRODUCCION;
}

function validarUrlRetornoProduccion(valor: string | undefined): string {
  if (!valor) throw new Error('OPENPAY_REDIRECT_URL es obligatorio en produccion');
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('OPENPAY_REDIRECT_URL no es una URL valida');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const esIp = isIP(host);
  const ipLocal = esIp === 4
    ? /^(0|10|127|169\.254|192\.168)\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    : esIp === 6 && (host === '::' || host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host));
  const esLocal = host === 'localhost' || host.endsWith('.localhost') || ipLocal || host.endsWith('.local');
  if (url.protocol !== 'https:' || esLocal || url.username || url.password) {
    throw new Error('OPENPAY_REDIRECT_URL debe usar HTTPS y un host publico en produccion');
  }
  return url.toString();
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
  private readonly redirectUrl: string;

  constructor(private readonly config: ConfigService) {
    const produccion = this.config.get<string>('NODE_ENV') === 'production';
    this.merchantId = this.config.get<string>('OPENPAY_MERCHANT_ID') || '';
    const privateKey = this.config.get<string>('OPENPAY_PRIVATE_KEY') || '';
    const webhookUser = this.config.get<string>('OPENPAY_WEBHOOK_USER') || '';
    const webhookPass = this.config.get<string>('OPENPAY_WEBHOOK_PASS') || '';
    const baseUrl = produccion
      ? validarUrlApiProduccion(this.config.get<string>('OPENPAY_BASE_URL'))
      : this.config.get<string>('OPENPAY_BASE_URL') || URL_API_SANDBOX;
    this.redirectUrl = produccion
      ? validarUrlRetornoProduccion(this.config.get<string>('OPENPAY_REDIRECT_URL'))
      : this.config.get<string>('OPENPAY_REDIRECT_URL') || 'http://localhost:5173/pago-completado';

    if (produccion && (!this.merchantId || !privateKey)) {
      throw new Error('OPENPAY_MERCHANT_ID y OPENPAY_PRIVATE_KEY son obligatorios en produccion');
    }
    if (produccion && (!webhookUser || !webhookPass)) {
      throw new Error('OPENPAY_WEBHOOK_USER y OPENPAY_WEBHOOK_PASS son obligatorios en produccion');
    }
    if (this.merchantId && privateKey) {
      this.http = axios.create({
        baseURL: `${baseUrl}/${this.merchantId}`,
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
    clienteIp?: string;
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
      confirm: false,
      send_email: false,
      redirect_url: this.redirectUrl,
      customer: { name: params.clienteNombre, email: params.clienteEmail },
    }, {
      headers: params.clienteIp ? { 'X-Forwarded-For': params.clienteIp } : undefined,
    });
    this.logger.log(`Orden ${params.ordenId}: cargo Openpay ${data.id} (${data.status})`);
    return data;
  }

  /** Busca una solicitud cuyo POST pudo haber terminado en Openpay tras un timeout local. */
  async buscarCargoPorOrden(ordenId: string): Promise<OpenpayCharge | null> {
    if (!this.http) {
      throw new ServiceUnavailableException('Pasarela no configurada para conciliación');
    }
    const { data } = await this.http.get<OpenpayCharge[]>('/charges', {
      params: { order_id: ordenId, limit: 10 },
    });
    return data.find((cargo) => cargo.order_id === ordenId) ?? null;
  }
}
