import { createHash, createPrivateKey, createPublicKey, randomUUID, sign, X509Certificate } from 'crypto';
import { readFileSync } from 'fs';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TokenGraph { access_token: string; expires_in: number; token_type: string }

/**
 * Cliente Graph sin bibliotecas nuevas. La identidad privada nunca sale del backend.
 * El certificado público debe ser exactamente el cargado en Microsoft Entra.
 */
@Injectable()
export class CorreoMicrosoftService {
  private readonly activo: boolean;
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly sender: string;
  private readonly privateKey?: ReturnType<typeof createPrivateKey>;
  private readonly thumbprint?: string;
  private token?: { valor: string; expira: number };

  constructor(config: ConfigService) {
    this.activo = config.get<string>('GRAPH_CORREO_HABILITADO') === 'true';
    this.tenantId = config.get<string>('GRAPH_TENANT_ID') || '';
    this.clientId = config.get<string>('GRAPH_CLIENT_ID') || '';
    this.sender = config.get<string>('GRAPH_CORREO_REMITENTE') || '';
    if (!this.activo) return;
    const keyPath = config.get<string>('GRAPH_PRIVATE_KEY_PATH');
    const certPath = config.get<string>('GRAPH_CERTIFICATE_PATH');
    if (!this.tenantId || !this.clientId || !this.sender || !keyPath || !certPath) {
      throw new Error('La configuración de Microsoft Graph está incompleta');
    }
    if (!/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(this.sender)) {
      throw new Error('GRAPH_CORREO_REMITENTE debe ser un correo válido');
    }
    const certificado = new X509Certificate(readFileSync(certPath));
    const ahora = Date.now();
    if (Date.parse(certificado.validFrom) > ahora || Date.parse(certificado.validTo) <= ahora) {
      throw new Error('El certificado de Microsoft Graph no está vigente');
    }
    const llave = createPrivateKey(readFileSync(keyPath));
    const desdeLlave = createHash('sha256').update(
      createPublicKey(llave).export({ type: 'spki', format: 'der' }),
    ).digest('hex');
    const desdeCert = createHash('sha256').update(
      certificado.publicKey.export({ type: 'spki', format: 'der' }),
    ).digest('hex');
    if (desdeLlave !== desdeCert) throw new Error('La clave privada no corresponde al certificado Graph');
    this.privateKey = llave;
    this.thumbprint = certificado.fingerprint.replace(/:/g, '').toLowerCase();
  }

  get habilitado() { return this.activo; }

  private async obtenerToken(): Promise<string> {
    if (this.token && this.token.expira > Date.now() + 60_000) return this.token.valor;
    if (!this.privateKey || !this.thumbprint) throw new ServiceUnavailableException('Correo Microsoft 365 no configurado');
    const ahora = Math.floor(Date.now() / 1000);
    const base64 = (obj: Record<string, string | number>) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const audience = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const encabezado = base64({ alg: 'RS256', typ: 'JWT', x5t: Buffer.from(this.thumbprint, 'hex').toString('base64url') });
    const cuerpo = base64({ aud: audience, iss: this.clientId, sub: this.clientId, jti: randomUUID(), nbf: ahora - 30, iat: ahora, exp: ahora + 300 });
    const assertion = `${encabezado}.${cuerpo}`;
    const firma = sign('RSA-SHA256', Buffer.from(assertion), this.privateKey).toString('base64url');
    let response: Response;
    try {
      response = await fetch(audience, {
        method: 'POST', signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId, scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: `${assertion}.${firma}`,
        }),
      });
    } catch {
      throw new ServiceUnavailableException('No se pudo contactar con Microsoft 365');
    }
    if (!response.ok) throw new ServiceUnavailableException('Microsoft 365 rechazó la autenticación');
    const datos = (await response.json()) as TokenGraph;
    if (datos.token_type !== 'Bearer' || !datos.access_token || !Number.isFinite(datos.expires_in) || datos.expires_in <= 0) {
      throw new ServiceUnavailableException('Respuesta de autenticación de Microsoft 365 inválida');
    }
    this.token = { valor: datos.access_token, expira: Date.now() + datos.expires_in * 1000 };
    return this.token.valor;
  }

  async enviar(destino: string, asunto: string, html: string, correlacion: string, referencia?: string): Promise<void> {
    if (!this.activo) throw new ServiceUnavailableException('Correo Microsoft 365 no habilitado');
    const token = await this.obtenerToken();
    let response: Response;
    try {
      response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.sender)}/sendMail`, {
        method: 'POST', signal: AbortSignal.timeout(25_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: asunto, body: { contentType: 'HTML', content: html },
            toRecipients: [{ emailAddress: { address: destino } }],
            internetMessageHeaders: [
              { name: 'x-sistema-correlacion', value: correlacion },
              ...(referencia ? [{ name: 'x-sistema-referencia', value: referencia }] : []),
            ],
          },
          saveToSentItems: true,
        }),
      });
    } catch {
      throw new ServiceUnavailableException('No se pudo confirmar el envío con Microsoft 365');
    }
    if (response.status !== 202) {
      if (response.status === 401) this.token = undefined;
      throw new ServiceUnavailableException('Microsoft 365 no aceptó el correo');
    }
  }
}

