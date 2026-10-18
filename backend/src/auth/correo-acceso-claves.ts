import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AuthCorreoOutbox } from '../entities/auth-correo-outbox.entity';

/** No se persiste ni cifra un OTP: se reconstruye con HMAC y una clave externa versionada. */
export class ClavesCorreoAcceso {
  readonly activa: string | null;
  private readonly claves = new Map<string, Buffer>();
  constructor(config: ConfigService) {
    const json = config.get<string>('AUTH_OUTBOX_KEYS');
    try {
      const claves: unknown = json ? JSON.parse(json) : {};
      if (!claves || Array.isArray(claves) || typeof claves !== 'object') throw new Error();
      for (const [id, valor] of Object.entries(claves)) {
        if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id) || typeof valor !== 'string' || !/^[a-fA-F0-9]{64}$/.test(valor)) throw new Error();
        this.claves.set(id, Buffer.from(valor, 'hex'));
      }
      this.activa = config.get<string>('AUTH_OUTBOX_ACTIVE_KEY') || null;
      if ((this.claves.size > 0 || this.activa) && (!this.activa || !this.claves.has(this.activa))) throw new Error();
      if (config.get<string>('SMTP_HOST') && !this.activa) throw new Error();
    } catch {
      throw new Error('Configura AUTH_OUTBOX_KEYS (claves hex de 32 bytes) y AUTH_OUTBOX_ACTIVE_KEY; no retirar claves con trabajos vigentes');
    }
  }
  token(trabajo: Pick<AuthCorreoOutbox, 'id' | 'tipo' | 'usuarioId' | 'version' | 'claveId'>) {
    const clave = trabajo.claveId ? this.claves.get(trabajo.claveId) : undefined;
    if (!clave) throw new Error('CLAVE_NO_DISPONIBLE');
    const token = createHmac('sha256', clave)
      .update(JSON.stringify(['escolar-auth-correo-v1', trabajo.id, trabajo.tipo, trabajo.usuarioId, trabajo.version])).digest('hex');
    return trabajo.tipo === 'RECUPERACION' ? token.slice(0, 32) : token;
  }
}
