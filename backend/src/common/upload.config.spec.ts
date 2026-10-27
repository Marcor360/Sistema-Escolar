import { uploadConfig } from './upload.config';
it('lee el límite al crear Multer después de cargar el entorno, no al importar el módulo', () => {
  const previo = process.env.MAX_UPLOAD_MB;
  try {
    process.env.MAX_UPLOAD_MB = '12';
    expect(uploadConfig.limits.fileSize).toBe(12 * 1024 * 1024);
    process.env.MAX_UPLOAD_MB = '2';
    expect(uploadConfig.limits.fileSize).toBe(2 * 1024 * 1024);
    delete process.env.MAX_UPLOAD_MB;
    expect(uploadConfig.limits.fileSize).toBe(5 * 1024 * 1024);
  } finally {
    if (previo === undefined) delete process.env.MAX_UPLOAD_MB;
    else process.env.MAX_UPLOAD_MB = previo;
  }
});
it('las entregas admiten 100 MiB y un solo archivo sin ampliar otros módulos', async () => {
  const { entregaUploadConfig, MAX_ENTREGA_BYTES } = await import('./upload.config');
  expect(MAX_ENTREGA_BYTES).toBe(104857600);
  expect(entregaUploadConfig.limits).toMatchObject({ fileSize: MAX_ENTREGA_BYTES, files: 1 });
});
