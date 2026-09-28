const CACHE_NAME = "san-lorenzo-antro-v13"

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/logo-san-lorenzo.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/favicon.ico",
];

const OFFLINE_ROUTES = [
  "/",
  "/jugadoras",
  "/jugadoras/1",
  "/control",
  "/historial",
  "/comparativa",
  "/evolucion",
  "/objetivos",
  "/seguimiento",
  "/informes",
  "/plantel",
  "/datos",
  "/pesajes",
  "/hidratacion",
];

function isCacheable(response) {
  return (
    response &&
    (response.ok || response.type === "opaque")
  );
}

async function cacheAssetGraph(
  assetUrl,
  cache,
  visited,
) {
  const absoluteUrl = new URL(
    assetUrl,
    self.location.origin,
  );

  if (
    absoluteUrl.origin !== self.location.origin
  ) {
    return;
  }

  const key = absoluteUrl.href;

  if (visited.has(key)) {
    return;
  }

  visited.add(key);

  let response;

  try {
    response = await fetch(key, {
      cache: "no-store",
    });
  } catch {
    return;
  }

  if (!isCacheable(response)) {
    return;
  }

  await cache.put(
    key,
    response.clone(),
  );

  const contentType =
    response.headers.get("content-type") ?? "";

  const isJavaScript =
    absoluteUrl.pathname.endsWith(".js") ||
    contentType.includes("javascript");

  if (!isJavaScript) {
    return;
  }

  let source;

  try {
    source = await response.text();
  } catch {
    return;
  }

  const dependencies = new Set();

  const assetRegex =
    /["'`]([^"'`]+\.(?:js|css))["'`]/g;

  let match;

  while (
    (match = assetRegex.exec(source)) !== null
  ) {
    try {
      const dependency = new URL(
        match[1],
        absoluteUrl,
      );

      if (
        dependency.origin ===
          self.location.origin &&
        dependency.pathname.startsWith(
          "/assets/",
        )
      ) {
        dependencies.add(
          dependency.href,
        );
      }
    } catch {
      // Ignorar referencias que no sean URLs válidas.
    }
  }

  await Promise.allSettled(
    [...dependencies].map(
      (dependency) =>
        cacheAssetGraph(
          dependency,
          cache,
          visited,
        ),
    ),
  );
}

async function cacheRoute(
  route,
  cache,
  visited,
) {
  let response;

  try {
    response = await fetch(route, {
      cache: "no-store",
    });
  } catch {
    return;
  }

  if (!response.ok) {
    return;
  }

  await cache.put(
    route,
    response.clone(),
  );

  let html;

  try {
    html = await response.text();
  } catch {
    return;
  }

  const assets = new Set();

  const htmlAssetRegex =
    /(?:src|href)=["']([^"']+)["']/g;

  let match;

  while (
    (match =
      htmlAssetRegex.exec(html)) !== null
  ) {
    try {
      const asset = new URL(
        match[1],
        self.location.origin,
      );

      if (
        asset.origin ===
          self.location.origin &&
        asset.pathname.startsWith(
          "/assets/",
        )
      ) {
        assets.add(asset.href);
      }
    } catch {
      // Ignorar URLs inválidas.
    }
  }

  await Promise.allSettled(
    [...assets].map((asset) =>
      cacheAssetGraph(
        asset,
        cache,
        visited,
      ),
    ),
  );
}

async function precacheOfflineApp() {
  const cache =
    await caches.open(CACHE_NAME);

  const visited = new Set();

  await Promise.allSettled(
    OFFLINE_ROUTES.map((route) =>
      cacheRoute(
        route,
        cache,
        visited,
      ),
    ),
  );
}

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      (async () => {
        const cache =
          await caches.open(
            CACHE_NAME,
          );

        await cache.addAll(
          APP_SHELL,
        );

        await precacheOfflineApp();

        await self.skipWaiting();
      })(),
    );
  },
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      (async () => {
        const keys =
          await caches.keys();

        await Promise.all(
          keys
            .filter(
              (key) =>
                key !== CACHE_NAME,
            )
            .map((key) =>
              caches.delete(key),
            ),
        );

        await self.clients.claim();
      })(),
    );
  },
);

self.addEventListener(
  "message",
  (event) => {
    if (
      event.data?.type ===
      "PRECACHE_OFFLINE"
    ) {
      event.waitUntil(
        precacheOfflineApp(),
      );
    }
  },
);

self.addEventListener(
  "fetch",
  (event) => {
    const request = event.request;

    if (request.method !== "GET") {
      return;
    }

    if (
      request.mode === "navigate"
    ) {
      event.respondWith(
        fetch(request, {
          cache: "no-store",
        })
          .then((response) => {
            if (
              isCacheable(response)
            ) {
              const copy =
                response.clone();

              caches
                .open(CACHE_NAME)
                .then((cache) =>
                  cache.put(
                    request,
                    copy,
                  ),
                );
            }

            return response;
          })
          .catch(async () => {
            const exact =
              await caches.match(
                request,
              );

            if (exact) {
              return exact;
            }

            return caches.match("/");
          }),
      );

      return;
    }

    const destination =
      request.destination;

    const isStaticAsset = [
      "script",
      "style",
      "font",
      "image",
      "worker",
    ].includes(destination);

    if (isStaticAsset) {
      event.respondWith(
        fetch(request, {
          cache: "no-store",
        })
          .then(
            async (
              response,
            ) => {
              if (
                isCacheable(
                  response,
                )
              ) {
                const cache =
                  await caches.open(
                    CACHE_NAME,
                  );

                await cache.put(
                  request,
                  response.clone(),
                );
              }

              return response;
            },
          )
          .catch(() =>
            caches.match(
              request,
            ),
          ),
      );

      return;
    }

    const url = new URL(
      request.url,
    );

    if (
      url.origin ===
      self.location.origin
    ) {
      event.respondWith(
        fetch(request, {
          cache: "no-store",
        })
          .then(
            async (
              response,
            ) => {
              if (
                isCacheable(
                  response,
                )
              ) {
                const cache =
                  await caches.open(
                    CACHE_NAME,
                  );

                await cache.put(
                  request,
                  response.clone(),
                );
              }

              return response;
            },
          )
          .catch(() =>
            caches.match(
              request,
            ),
          ),
      );
    }
  },
);
