import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import {
  useEffect,
  type ReactNode,
} from "react";

import appCss from "../styles.css?url";

import {
  reportLovableError,
} from "../lib/lovable-error-reporting";

import {
  AuthGate,
} from "../components/auth-gate";

import {
  Toaster,
} from "../components/ui/sonner";

const OFFLINE_CACHE_NAME =
  "san-lorenzo-antro-v12";

/* ============================================================
   CACHE DE RECURSOS
============================================================ */

async function cacheLoadedAssets() {
  if (
    !("caches" in window) ||
    !navigator.onLine
  ) {
    return;
  }

  const cache =
    await caches.open(
      OFFLINE_CACHE_NAME,
    );

  const resources =
    performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];

  const urls = [
    ...new Set(
      resources
        .map(
          (resource) =>
            resource.name,
        )
        .filter(
          (
            resourceUrl,
          ) => {
            try {
              const url =
                new URL(
                  resourceUrl,
                );

              return (
                url.origin ===
                  window
                    .location
                    .origin &&
                (
                  url.pathname.startsWith(
                    "/assets/",
                  ) ||
                  url.pathname ===
                    "/manifest.webmanifest" ||
                  url.pathname.endsWith(
                    ".png",
                  ) ||
                  url.pathname.endsWith(
                    ".ico",
                  )
                )
              );
            } catch {
              return false;
            }
          },
        ),
    ),
  ];

  await Promise.allSettled(
    urls.map(
      async (
        url,
      ) => {
        try {
          const request =
            new Request(
              url,
            );

          const response =
            await fetch(
              request,
            );

          if (
            response.ok
          ) {
            await cache.put(
              request,
              response.clone(),
            );
          }
        } catch {
          /*
           * Si un recurso puntual falla,
           * seguimos con los demás.
           */
        }
      },
    ),
  );

  console.log(
    `${urls.length} recursos guardados para uso offline`,
  );
}

/* ============================================================
   PRECARGAR PANTALLAS
============================================================ */

async function preloadAppScreens() {
  if (
    !navigator.onLine
  ) {
    return;
  }

  const results =
    await Promise.allSettled(
      [
        import(
          "./index"
        ),

        import(
          "./jugadoras.index"
        ),

        import(
          "./jugadoras.$id"
        ),

        import(
          "./control"
        ),

        import(
          "./historial"
        ),

        import(
          "./comparativa"
        ),

        import(
          "./evolucion"
        ),

        import(
          "./objetivos"
        ),

        import(
          "./seguimiento"
        ),

        import(
          "./informes"
        ),

        import(
          "./plantel"
        ),

        import(
          "./datos"
        ),

        import(
          "./pesajes"
        ),

        import(
          "./hidratacion"
        ),
      ],
    );

  const failed =
    results.filter(
      (
        result,
      ) =>
        result.status ===
        "rejected",
    );

  await cacheLoadedAssets();

  if (
    failed.length ===
    0
  ) {
    console.log(
      "Pantallas principales precargadas y guardadas para uso offline",
    );
  } else {
    console.warn(
      `${failed.length} pantallas no pudieron precargarse`,
    );
  }
}

/* ============================================================
   404
============================================================ */

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">
          404
        </h1>

        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Página no encontrada
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscás no existe o fue movida.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ERROR GENERAL
============================================================ */

function ErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(
    error,
  );

  const router =
    useRouter();

  useEffect(() => {
    reportLovableError(
      error,
      {
        boundary:
          "tanstack_root_error_component",
      },
    );
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no pudo cargarse
        </h1>

        <div className="mt-3 rounded-md border p-3 text-left">
          <p className="mb-2 text-sm font-semibold">
            Error técnico:
          </p>

          <pre className="whitespace-pre-wrap break-words text-xs text-red-600">
            {
              error.message
            }
          </pre>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();

              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Intentar nuevamente
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ROOT ROUTE
============================================================ */

export const Route =
  createRootRouteWithContext<{
    queryClient: QueryClient;
  }>()({
    head: () => ({
      meta: [
        {
          charSet:
            "utf-8",
        },

        {
          name:
            "viewport",

          content:
            "width=device-width, initial-scale=1, viewport-fit=cover",
        },

        {
          title:
            "San Lorenzo Antro",
        },

        {
          name:
            "description",

          content:
            "Seguimiento de antropometría, pesajes y nutrición del Fútbol Femenino de San Lorenzo.",
        },

        {
          name:
            "theme-color",

          content:
            "#18345f",
        },

        {
          name:
            "mobile-web-app-capable",

          content:
            "yes",
        },

        {
          name:
            "apple-mobile-web-app-capable",

          content:
            "yes",
        },

        {
          name:
            "apple-mobile-web-app-status-bar-style",

          content:
            "default",
        },

        {
          name:
            "apple-mobile-web-app-title",

          content:
            "CASLA Antro",
        },
      ],

      links: [
        {
          rel:
            "stylesheet",

          href:
            appCss,
        },

        {
          rel:
            "manifest",

          href:
            "/manifest.webmanifest",
        },

        {
          rel:
            "icon",

          href:
            "/pwa-192x192.png",

          type:
            "image/png",
        },

        {
          rel:
            "apple-touch-icon",

          href:
            "/pwa-192x192.png",
        },
      ],
    }),

    shellComponent:
      RootShell,

    component:
      RootComponent,

    notFoundComponent:
      NotFoundComponent,

    errorComponent:
      ErrorComponent,
  });

/* ============================================================
   HTML BASE
============================================================ */

function RootShell({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>

      <body>
        {
          children
        }

        <Scripts />
      </body>
    </html>
  );
}

/* ============================================================
   ROOT COMPONENT
============================================================ */

function RootComponent() {
  const {
    queryClient,
  } =
    Route.useRouteContext();

  /* ==========================================================
     SERVICE WORKER
  ========================================================== */

  useEffect(() => {
    if (
      !(
        "serviceWorker" in
        navigator
      )
    ) {
      return;
    }

    navigator.serviceWorker
      .register(
        "/sw.js",
        {
          scope:
            "/",
        },
      )
      .then(
        async (
          registration,
        ) => {
          console.log(
            "Modo offline activo",
            registration.scope,
          );

          await navigator
            .serviceWorker
            .ready;

          if (
            navigator.onLine
          ) {
            await preloadAppScreens();
          }
        },
      )
      .catch(
        (
          error,
        ) => {
          console.error(
            "No se pudo activar el modo offline",
            error,
          );
        },
      );
  }, []);

  /* ==========================================================
     CUANDO VUELVE INTERNET
  ========================================================== */

  useEffect(() => {
    const handleOnline =
      () => {
        void preloadAppScreens();
      };

    window.addEventListener(
      "online",
      handleOnline,
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline,
      );
    };
  }, []);

  /* ==========================================================
     APP
  ========================================================== */

  return (
    <QueryClientProvider
      client={
        queryClient
      }
    >
      <AuthGate>
        <Outlet />

        <Toaster
          richColors
          position="top-center"
        />
      </AuthGate>
    </QueryClientProvider>
  );
}
