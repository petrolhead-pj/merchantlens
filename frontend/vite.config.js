import {defineConfig} from 'vite';
import { fileURLToPath } from 'node:url';
const proxy={'/api':{target:'http://127.0.0.1:3001'}};
const page = name => fileURLToPath(new URL(name, import.meta.url));
export default defineConfig({
  server:{proxy},preview:{proxy},
  build:{rollupOptions:{input:[page('index.html'),page('sportsbook.html')]}},
});
