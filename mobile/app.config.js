module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || "development";
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ||
    (appEnv === "development" ? "http://localhost:3000/api" : "");

  if (!["development", "preview", "production"].includes(appEnv))
    throw new Error("APP_ENV móvil no reconocido");
  if (appEnv !== "development") {
    if (!apiUrl) {
      throw new Error(
        `EXPO_PUBLIC_API_URL es obligatoria para el perfil ${appEnv}`,
      );
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(apiUrl);
    } catch {
      throw new Error("EXPO_PUBLIC_API_URL debe ser una URL absoluta HTTPS");
    }
    if (
      parsedUrl.protocol !== "https:" ||
      /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsedUrl.hostname)
    ) {
      throw new Error(
        `EXPO_PUBLIC_API_URL debe usar HTTPS y ser accesible desde el dispositivo (${appEnv})`,
      );
    }
  }

  const url = new URL(apiUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api"
  ) {
    throw new Error(
      "EXPO_PUBLIC_API_URL debe terminar en /api sin credenciales, parámetros ni fragmentos",
    );
  }
  return {
    ...config,
    extra: { ...config.extra, appEnv, apiUrl },
  };
};
