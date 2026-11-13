const { chromium, expect } = require("../../web/node_modules/@playwright/test");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../dist");
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." +
      (new URL(req.url, "http://localhost").pathname === "/"
        ? "/index.html"
        : new URL(req.url, "http://localhost").pathname),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (e, data) => {
    if (e) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".html")
          ? "text/html"
          : file.endsWith(".ttf")
            ? "font/ttf"
            : "application/octet-stream",
    );
    res.end(data);
  });
});
(async () => {
  await new Promise((r) => server.listen(5190, "127.0.0.1", r));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    for (const width of (process.env.ALUMNO_VIEWPORTS ? process.env.ALUMNO_VIEWPORTS.split(',').map(Number) : [360, 768, 1280, 1920])) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errores = [],
        respuestas = [];
      const entregas = [];
      let estadoBoleta = "PENDIENTE_RESPUESTA";
      page.on("pageerror", (e) => errores.push(e.stack));
      await page.route("https://api.example.invalid/**", async (route) => {
        const p = new URL(route.request().url()).pathname;
        let data = [];
        if (p.endsWith("/configuracion/marca"))
          data = {
            nombreInstitucion: "Instituto Universitario · Demo",
            nombreCorto: "IUA",
            colorPrimario: "#14343B",
            colorAcento: "#C79A3C",
            colorPrimarioOscuro: "#0E262B", logoUrl: null, actualizadoEn: '2026-11-13',
          };
        if (p.endsWith("/auth/login-alumno-web"))
          data = {
            accessToken: "qa",
            usuario: {
              sub: 1,
              email: "qa@example.invalid",
              nombre: "Alumna Elena QA Escolar",
              roles: ["ALUMNO"],
            },
          };
        if (p.endsWith("/auth/me")) data = { accesoPrevio: true };
        if (p.endsWith("/auth/consentimiento")) data = { pendiente: false };
        if (p.endsWith("/calendario/opciones")) data = { ciclos: [{ id: 1, nombre: "Octubre QA", activo: true, fechaInicio: "2026-10-01", fechaFin: "2026-10-31" }] };
        if (p.endsWith("/calendario")) {
          const global = { id: 1, titulo: "Evento institucional QA", fechaInicio: "2026-10-15T12:00:00Z", fechaFin: null, imagenNombre: null };
          const plantel = { ...global, id: 2, titulo: "Evento del plantel QA" };
          data = new URL(route.request().url()).searchParams.get("ambito") === "GLOBAL" ? [global] : [global, plantel];
        }

        if (p.endsWith("/estado-cuenta"))
          data = { saldoTotal: 1825, cargos: [{ id: 1, descripcion: "Colegiatura · Noviembre", fechaVencimiento: "2026-11-20", estatus: "PENDIENTE", total: 2500, pagado: 675, saldo: 1825 }], pagos: [{ id: 2, monto: 675, metodo: "Transferencia", fechaPago: "2026-11-10T12:00:00Z", estatus: "CONFIRMADO", aplicado: true }] };
        if (p.endsWith("/seguimiento/pendientes")) data = [{ titulo: "Actividades sin entrega", cantidad: 1 }, { titulo: "Cargos por cubrir", cantidad: 1 }];
        if (p.endsWith("/actividades/91/entrega") && route.request().method() === 'POST') {
          entregas.push(route.request().postDataBuffer().toString());
          data = { id: 1, estatus: 'ENTREGADA' };
        }
        if (p.endsWith("/recursamientos/me")) data = { datos: [], total: 0 };
        if (p.endsWith("/listado")) data = { datos: [], total: 0 };
        if (p.endsWith("/alumnos/me/tareas/listado")) data = { datos: [{ id: 91, titulo: "Tarea QA", tipo: "TAREA", parcial: 1, fechaEntrega: null, entrega: null }], total: 1 };
        if (p.endsWith("/reportes/mis-boletas"))
          data = [
            {
              inscripcionId: 8,
              cicloId: 2,
              ciclo: "2058",
              grupo: "QA",
              plantel: "Centro",
            },
          ];
        if (p.endsWith("/formatos/mi-boleta"))
          data = {
            institucion: "Escuela QA",
            alumno: "Alumno QA",
            matricula: "QA8",
            plantel: "Centro",
            plan: "Plan QA",
            periodo: "Primero",
            ciclo: "2058",
            escala: "0–10",
            disponible: true,
            aviso: "Informativa",
            promedioGeneral: 8,
            filas: [
              {
                clave: "MAT",
                asignatura: "Matemáticas",
                creditos: 5,
                seriacion: "",
                ciclo: "2058",
                promedioFinal: 8,
                observaciones: "",
              },
            ],
          };
        if (p.endsWith("/boletas/mis-pendientes"))
          data = {
            total: estadoBoleta === "PENDIENTE_RESPUESTA" ? 1 : 0,
            datos: [],
          };
        if (p.endsWith("/boletas/inscripciones/8"))
          data = {
            disponible: true,
            versionHash: "a".repeat(64),
            materias: [
              {
                grupoMateriaId: 4,
                asignatura: "Matemáticas",
                promedioFinal: 8,
              },
            ],
            estado: estadoBoleta,
            atencion: respuestas.length
              ? { estado: "RESUELTA", vigente: true }
              : null,
            historialAtenciones: respuestas.length
              ? [
                  {
                    id: 1,
                    estado: "RESUELTA",
                    responsable: "Responsable QA",
                    comentario:
                      "Los criterios fueron revisados con la familia.",
                    fecha: "2026-10-29T12:05:00Z",
                  },
                ]
              : [],
            historial: respuestas
              .map((r, n) => ({
                id: n + 1,
                estado: r.estado,
                comentario: r.comentario,
                firmanteNombre: r.firmanteNombre,
                firmanteTipo: r.firmanteTipo,
                asignatura: null,
                fecha: "2026-10-29T12:00:00Z",
                vigente: true,
              }))
              .reverse(),
          };
        if (
          p.endsWith("/boletas/inscripciones/8/responder") &&
          route.request().method() === "POST"
        ) {
          respuestas.push(route.request().postDataJSON());
          estadoBoleta = respuestas.at(-1).estado;
          data = { id: respuestas.length, estado: estadoBoleta };
        }
        if (p.endsWith("/reportes/mi-boleta/enlace"))
          data = { url: "/api/reportes/boleta-descarga/1?t=qa" };
        if (p.includes("/reportes/boleta-descarga/")) {
          await route.fulfill({
            body: "%PDF-1.4\n%%EOF",
            headers: {
              "content-type": "application/pdf",
              "content-disposition": 'attachment; filename="boleta-qa.pdf"',
              "access-control-allow-origin": "http://127.0.0.1:5190",
            },
          });
          return;
        }
        if (p.endsWith("/perfil"))
          data = {
            matricula: "QA1",
            estatus: "ACTIVO",
            curp: null,
            usuario: {
              nombre: "Alumna",
              segundoNombre: "Elena",
              apellidoPaterno: "QA",
              apellidoMaterno: "Escolar",
              nombreCompleto: "Alumna Elena QA Escolar",
              email: "qa@example.invalid",
            },
          };
        await route.fulfill({
          json: data,
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:5190",
            "access-control-allow-credentials": "true",
            "access-control-allow-headers":
              "authorization,content-type,x-portal",
            "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          },
        });
      });
      const captura = async (nombre) => {
        if (!process.env.ALUMNO_SCREENSHOT_DIR || ![360, 1280].includes(width)) return;
        fs.mkdirSync(process.env.ALUMNO_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.ALUMNO_SCREENSHOT_DIR, `${nombre}-${width}.png`) });
      };
      await page.goto("http://127.0.0.1:5190");
      await page
        .getByLabel("Correo institucional", { exact: true })
        .fill("qa@example.invalid");
      await page
        .getByLabel("Contraseña", { exact: true })
        .fill("Qa-password12");
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page.getByRole("tab", { name: /Materias/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Omitir recorrido", exact: true })).toHaveCount(0);
      await expect(
        page.getByText("Tienes 1 boleta pendiente de aceptación.", {
          exact: true,
        }),
      ).toBeVisible();
      if (width >= 1000) {
        const lateral = await page.getByTestId('menu-lateral-alumno').boundingBox();
        expect(lateral.width).toBe(88);
      }
      const tarjetaAula = await page.getByRole('button', { name: 'Materias y tareas', exact: true }).boundingBox();
      expect(tarjetaAula.x + tarjetaAula.width).toBeLessThanOrEqual(width);
      await captura('inicio-alumno');
      await page.getByRole('button', { name: 'Abrir menú principal', exact: true }).click();
      await expect(page.getByTestId('menu-lateral-alumno').getByRole('tab', { name: 'Ventanilla de trámites', exact: true })).toBeVisible();
      await captura('menu-alumno');
      if (width >= 1000) await page.getByRole('button', { name: 'Cerrar menú principal', exact: true }).click();
      else {
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Abrir menú principal', exact: true })).toBeFocused();
      }
      await page.getByRole('button', { name: 'Abrir menú principal', exact: true }).click();
      await page.getByTestId('menu-lateral-alumno').getByRole('tab', { name: 'Ventanilla de trámites', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Ventanilla de trámites', exact: true })).toBeVisible();
      if (width >= 1000) await page.getByRole('button', { name: 'Cerrar menú principal', exact: true }).click();
      await page.getByRole('tab', { name: 'Inicio del alumno', exact: true }).click();
      await page.getByRole('button', { name: 'Abrir mi perfil', exact: true }).click();
      await page.getByRole('button', { name: 'Ver recorrido especializado del alumno', exact: true }).click();
      await page.getByRole('button', { name: 'Ver todos los pasos', exact: true }).click();
      await page.getByRole('button', { name: 'Ir al paso 4: Entregar una actividad', exact: true }).click();
      await page.getByRole('button', { name: 'Ver esta pantalla', exact: true }).click();
      await expect(page.getByText('Mis tareas', { exact: true })).toBeVisible();
      expect(entregas).toHaveLength(0);
      await page.getByRole('button', { name: 'Finalizar guía por ahora', exact: true }).click();
      await page.getByRole('tab', { name: 'Inicio del alumno', exact: true }).click();
      await page.getByRole("button", { name: "Ver calendario institucional", exact: true }).click();
      const diaCalendario = page.getByRole("button", { name: "2026-10-15: 2 evento(s)", exact: true });
      await diaCalendario.click();
      const actividadesCalendario = page.getByRole("heading", { name: "Actividades del 2026-10-15", exact: true }).locator("..");
      await expect(actividadesCalendario.getByText("Evento del plantel QA", { exact: true })).toBeVisible();
      const celda = await diaCalendario.boundingBox();
      expect(celda.width).toBeGreaterThanOrEqual(44);
      expect(celda.height).toBeGreaterThanOrEqual(44);
      await page.getByRole("button", { name: "Solo eventos institucionales", exact: true }).click();
      await expect(page.getByRole("button", { name: "2026-10-15: 1 evento(s)", exact: true })).toBeVisible();
      await expect(actividadesCalendario.getByText("Evento institucional QA", { exact: true })).toBeVisible();
      await expect(actividadesCalendario.getByText("Evento del plantel QA", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Ocultar calendario institucional", exact: true }).click();
      for (const name of [
        /materias/i,
        /calificaciones/i,
        /estado de cuenta/i,
        /perfil/i,
      ]) {
        const tab = page.getByRole("tab", { name });
        await expect(tab).toBeVisible();
        await tab.click();
        await page.waitForTimeout(300);
        if (name.test("materias")) {
          await page.getByRole("button", { name: "Tareas y entregas · Subir tarea", exact: true }).click();
          await expect(page.getByText("Mis tareas", { exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Entregar archivo: Tarea QA", exact: true })).toBeEnabled();
          await expect(page.getByRole("button", { name: "Actualizar tareas", exact: true })).toBeVisible();
          await captura('tareas-alumno');
          const selector = page.waitForEvent('filechooser');
          await page.getByRole('button', { name: 'Entregar archivo: Tarea QA', exact: true }).click();
          await (await selector).setFiles({ name: 'tarea-demo.txt', mimeType: 'text/plain', buffer: Buffer.from('Entrega QA desde el portal web') });
          await expect(page.getByRole('dialog')).toContainText('Entrega enviada');
          expect(entregas).toHaveLength(1);
          expect(entregas[0]).toContain('filename="tarea-demo.txt"');
          expect(entregas[0]).toContain('Entrega QA desde el portal web');
          await page.getByRole('dialog').getByRole('button', { name: 'Aceptar', exact: true }).click();
        }
        if (name.test("perfil")) {
          await expect(page.getByText("Segundo nombre: Elena", { exact: true })).toBeVisible();
          await expect(page.getByText("Segundo apellido: Escolar", { exact: true })).toBeVisible();
        }
        if (name.test("estado de cuenta")) await captura('finanzas-alumno');
        if (name.test("calificaciones")) {
          await captura('avance-academico');
          await page
            .getByRole("button", {
              name: "Ver boleta de 2058, QA",
              exact: true,
            })
            .click();
          const archivoPendiente = page.waitForEvent("download");
          await page
            .getByRole("button", {
              name: "Descargar boleta informativa PDF",
              exact: true,
            })
            .click();
          const archivo = await archivoPendiente;
          expect(archivo.suggestedFilename()).toBe("boleta-8.pdf");
          await page
            .getByRole("button", {
              name: "Revisión con comentarios",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", { name: "Padre, madre o tutor", exact: true })
            .click();
          await page
            .getByLabel("Nombre completo de quien firma", { exact: true })
            .fill("Tutor QA");
          await page
            .getByLabel("Comentarios para revisión", { exact: true })
            .fill("a".repeat(2000));
          await page
            .getByRole("button", {
              name: "Confirmo que he revisado la boleta y el nombre de quien firma",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: "Registrar firma y respuesta",
              exact: true,
            })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Registrar", exact: true })
            .click();
          await expect.poll(() => respuestas.length).toBe(1);
          await expect(
            page.getByText(
              "Firma y respuesta registradas. Se conservan su fecha y versión.",
              { exact: true },
            ),
          ).toBeVisible();
          expect(respuestas[0]).toMatchObject({
            estado: "REVISION",
            firmanteTipo: "TUTOR",
            firmanteNombre: "Tutor QA",
            confirmado: true,
          });
          expect(respuestas[0].comentario.length).toBe(2000);
          await expect(
            page.getByText("Los criterios fueron revisados con la familia.", {
              exact: true,
            }),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name: "Aceptar calificaciones",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: "Confirmo que he revisado la boleta y el nombre de quien firma",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: "Registrar firma y respuesta",
              exact: true,
            })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Registrar", exact: true })
            .click();
          await expect.poll(() => respuestas.length).toBe(2);
          const reciboPendiente = page.waitForEvent("download");
          await page
            .getByRole("button", {
              name: "Descargar constancia de aceptación #2",
              exact: true,
            })
            .click();
          expect((await reciboPendiente).suggestedFilename()).toBe(
            "constancia-boleta-2.pdf",
          );
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page
        .getByRole("button", { name: "Cerrar sesión", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancelar", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Cerrar sesión", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cerrar sesión", exact: true })
        .click();
      await expect(
        page.getByLabel("Correo institucional", { exact: true }),
      ).toBeVisible();
      if (errores.length) console.log(errores);
      expect(errores).toEqual([]);
      console.log("PASS Expo web " + width);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
