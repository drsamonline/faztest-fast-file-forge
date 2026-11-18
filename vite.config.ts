import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Plain TanStack Start + Tailwind + Nitro. This replaces the hosted config wrapper the
// project was scaffolded with, so every plugin and every option below is explicit and
// reviewable instead of arriving from a dependency.
//
// Two rules this file has to respect, because the server runs on Cloudflare Workers:
//   - never set `ssr.external` or `resolve.external` — the Worker has no runtime module
//     resolution, so the build fails;
//   - never add a compression plugin — hosting compresses at the edge.
export default defineConfig(({ command, mode }) => {
  // VITE_* variables, inlined exactly as Vite does for import.meta.env.
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // A client module importing a server-only path is an error, not a warning.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Redirect TanStack Start's bundled server entry to src/server.ts (the SSR error wrapper).
      server: { entry: "server" },
    }),
  ];

  if (command === "build") {
    // The deploy target. Nitro is a build-time dependency only.
    plugins.push(nitro({ defaultPreset: "cloudflare-module" }));
  }

  plugins.push(react());

  return {
    define,
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
      ignoreOutdatedRequests: true,
    },
    server: { host: "::", port: 8080 },
    plugins,
  };
});
