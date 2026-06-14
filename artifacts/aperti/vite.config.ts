import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { execSync } from "child_process";

function getCommitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return process.env.COMMIT_HASH || "dev";
  }
}

const isBuild = process.argv.includes("build");

const rawPort = process.env.PORT;
if (!isBuild && !rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}
const port = Number(rawPort ?? "5000");
if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? (isBuild ? "/" : undefined);
if (!isBuild && !basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

const apiPort = process.env.API_PORT || "3001";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  define: {
    "import.meta.env.VITE_COMMIT_HASH": JSON.stringify(getCommitHash()),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react-dom/") || id.includes("/node_modules/react/")) return "vendor-react";
          if (id.includes("/node_modules/@tanstack/")) return "vendor-query";
          if (id.includes("/node_modules/framer-motion")) return "vendor-motion";
          if (id.includes("/node_modules/recharts") || id.includes("/node_modules/d3-")) return "vendor-charts";
          if (id.includes("/node_modules/@radix-ui/")) return "vendor-ui";
          if (id.includes("/node_modules/katex") || id.includes("/node_modules/react-markdown") || id.includes("/node_modules/remark") || id.includes("/node_modules/rehype")) return "vendor-markdown";
          if (id.includes("/node_modules/qrcode") || id.includes("/node_modules/jszip") || id.includes("/node_modules/html5-qrcode")) return "vendor-qr";
        },
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/socket.io": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        ws: true,
      },
      "^/": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        rewrite: (path) => {
          // These paths work at the bare root level (relative-path routers mounted directly)
          const BARE_OK = [
            "/api", "/auth", "/courses", "/parent", "/uploads",
            "/socket.io", "/dashboard", "/flashcards", "/lessons",
            "/subscriptions", "/homework", "/question-bank",
            "/mentor", "/revisit", "/attendance", "/students",
          ];
          if (
            path === "/" ||
            BARE_OK.some(p => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"))
          ) return path;
          // Everything else is served under /api on the backend
          return `/api${path}`;
        },
        bypass(req) {
          const url = req.url ?? "";
          if (url.startsWith("/@") || url.startsWith("/__")) return url;
          if (url.match(/\.(tsx?|jsx?|css|scss|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|map)(\?.*)?$/)) return url;
          if ((req.headers.accept ?? "").includes("text/html")) return "/index.html";
        },
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
