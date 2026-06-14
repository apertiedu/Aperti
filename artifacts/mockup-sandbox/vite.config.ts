import { defineConfig } from 'vite';
const PORT = process.env.PORT || 5173;
export default defineConfig({
  server: { port: PORT },
  preview: { port: PORT },
});
