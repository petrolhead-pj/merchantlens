import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const proxy = { "/api": { target: process.env.MERCHANTLENS_API_TARGET || "http://127.0.0.1:3001" } };
const checkoutPages = ["/bakery.html", "/sportsbook.html"];
const pages = ["/index.html", ...checkoutPages];

function previewPages() {
  return {
    name: "merchantlens-preview-pages",
    configurePreviewServer(server) {
      const allowed = new Set(server.config.preview.port === 4174 ? checkoutPages : ["/"]);
      server.middlewares.use((request, response, next) => {
        const { pathname } = new URL(request.url, "http://127.0.0.1");
        if (allowed.has(pathname) || pathname.startsWith("/assets/") ||
            pathname.startsWith("/api/") || pathname === "/chocolate-cake.jpg") {
          next();
          return;
        }
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Page not found");
      });
    },
  };
}

export default defineConfig({
  appType: "mpa",
  plugins: [previewPages()],
  server: { proxy },
  preview: { proxy, strictPort: true },
  build: {
    rollupOptions: {
      input: pages.map((page) => fileURLToPath(new URL("." + page, import.meta.url))),
    },
  },
});
