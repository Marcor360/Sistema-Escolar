module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || 'development';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || (appEnv === 'development' ? 'http://localhost:3000/api' : '');

  if (appEnv !== 'development') {
    if (!apiUrl) {
      throw new Error(`EXPO_PUBLIC_API_URL es obligatoria para el perfil ${appEnv}`);
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(apiUrl);
    } catch {
      throw new Error('EXPO_PUBLIC_API_URL debe ser una URL absoluta HTTPS');
    }
    if (parsedUrl.protocol !== 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsedUrl.hostname)) {
      throw new Error(`EXPO_PUBLIC_API_URL debe usar HTTPS y ser accesible desde el dispositivo (${appEnv})`);
    }
  }

  return {
    ...config,
    extra: { ...config.extra, appEnv, apiUrl },
  };
};
