import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
/** AES-256-GCM, nonce por fila y AAD por preview/actor/tipo/posición; nunca guarda claves/PII en claro. */
export class PreviewCifrado {
  private readonly clave: Buffer;
  constructor(secreto: string) { this.clave = createHash('sha256').update('escolar/importaciones/v1\0').update(secreto).digest(); }
  cifrar(fila: Record<string,string>, contexto: string) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.clave, iv); cipher.setAAD(Buffer.from(contexto));
    const contenido = Buffer.concat([cipher.update(JSON.stringify(fila), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), contenido]).toString('base64');
  }
  descifrar(contenido: string, contexto: string): Record<string,string> {
    const bytes = Buffer.from(contenido, 'base64'), decipher = createDecipheriv('aes-256-gcm', this.clave, bytes.subarray(0,12));
    decipher.setAAD(Buffer.from(contexto)); decipher.setAuthTag(bytes.subarray(12,28));
    const valor: unknown = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.values(valor).some((v) => typeof v !== 'string')) throw new Error('Preview inválido');
    return valor as Record<string,string>;
  }
}
