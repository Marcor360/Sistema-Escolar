import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
export interface ContextoIntegracion {
 app: NestExpressApplication; dataSource: DataSource; baseUrl: string; sufijo: string;
 plantelId: number;
otroPlantelId: number;
adminId: number;
finanzasId: number;
superadminId: number;
alumnoId: number;
alumnoUsuarioId: number;
grupoMateriaIdMaestro: number;
docenteFueraDeAlcanceId: number;
ordenId: number;
cargoWebhookId: number;
 archivoPrueba: string | undefined; passwords: Map<string,string>;
 api: (ruta: string, opciones?: { method?: string; token?: string; body?: unknown; headers?: Record<string,string> }) => Promise<{ response: Response; data: any }>;
 emitirToken: (email: string) => Promise<string>; emitirFinanzasB: () => Promise<string>;
}
