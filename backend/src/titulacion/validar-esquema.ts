import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'child_process';
import { isAbsolute } from 'path';

// El esquema lo instala la institución; la petición solo aporta el XML generado por el servidor.
const validar = `
import sys
from lxml import etree
parser=etree.XMLParser(resolve_entities=False,no_network=True,load_dtd=False)
schema=etree.XMLSchema(etree.parse(sys.argv[1], parser))
documento=etree.fromstring(sys.stdin.buffer.read(), parser)
sys.exit(0 if schema.validate(documento) else 3)
`;
export async function validarEsquema(tipo: string, xml: string): Promise<void> {
  const ruta = tipo === 'TITULO' ? process.env.EGRESOS_XSD_TITULO : process.env.EGRESOS_XSD_DEC;
  if (!ruta || !isAbsolute(ruta))
    throw new ServiceUnavailableException('Configura el XSD oficial antes de emitir');
  return new Promise((resolve, reject) => {
    const proceso = spawn(process.env.EGRESOS_PYTHON || 'python', ['-I', '-c', validar, ruta], {
      stdio: ['pipe', 'ignore', 'ignore'],
      timeout: 8000,
    });
    const fallo = () =>
      reject(new ServiceUnavailableException('Revisa el validador local y el esquema instalado'));
    proceso.on('error', fallo);
    proceso.stdin.on('error', fallo);
    proceso.on('close', (codigo) =>
      codigo === 0
        ? resolve()
        : codigo === 3
          ? reject(new BadRequestException('El XML no cumple el XSD oficial'))
          : fallo(),
    );
    proceso.stdin.end(xml, 'utf8');
  });
}
