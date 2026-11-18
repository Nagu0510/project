import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The no-flash theme script (src/theme/theme-init.js) is inlined into index.html <head> so it runs before the first paint.
// Production CSP allows exactly that script by its sha256 hash: no 'unsafe-inline' for scripts.
const themeInitCode = readFileSync(new URL('./src/theme/theme-init.js', import.meta.url), 'utf8');
const themeInitHash = `'sha256-${createHash('sha256').update(themeInitCode).digest('base64')}'`;

// Content-Security-Policy for the web app. Google sign-in needs its script, frame, style and connect entries
// (https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#content_security_policy); Google Fonts
// need the two font hosts. Dev adds 'unsafe-inline' scripts (the React refresh preamble) and the Vite websocket.
function contentSecurityPolicy({ dev, apiOrigin }) {
  const connect = ["'self'", 'https://accounts.google.com/gsi/'];
  if (apiOrigin) connect.push(apiOrigin);
  if (dev) connect.push('ws://localhost:*', 'ws://127.0.0.1:*', 'http://localhost:8000', 'http://127.0.0.1:8000');
  return [
    "default-src 'self'",
    `script-src 'self' ${dev ? "'unsafe-inline' " : `${themeInitHash} `}https://accounts.google.com/gsi/client`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style", // inline: React style={{}} attributes
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    `connect-src ${connect.join(' ')}`,
    'frame-src https://accounts.google.com/gsi/',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'", // nobody may frame the app (clickjacking of the admin pages)
  ].join('; ');
}

function securityHeaders(options) {
  return {
    'Content-Security-Policy': contentSecurityPolicy(options),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer', // the verify / reset links carry tokens in the URL: never send them on as a Referer
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBase = env.VITE_API_BASE_URL || '/api';
  const apiOrigin = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : '';
  const dev = securityHeaders({ dev: true, apiOrigin });
  const prod = securityHeaders({ dev: false, apiOrigin });

  return {
    plugins: [
      react(),
      {
        name: 'inline-theme-init',
        transformIndexHtml: (html) => html.replace('<!--theme-init-->', `<script>${themeInitCode}</script>`),
      },
      {
        // dist/_headers: the same production headers for hosts that read it (Netlify, Cloudflare Pages). Any other
        // static host must send them itself (see README, "Security headers"); HSTS belongs to the host's HTTPS setup.
        name: 'emit-security-headers',
        generateBundle() {
          const lines = Object.entries(prod).map(([k, v]) => `  ${k}: ${v}`);
          this.emitFile({ type: 'asset', fileName: '_headers', source: `/*\n${lines.join('\n')}\n` });
        },
      },
    ],
    server: {
      port: 5173,
      host: true,
      headers: dev,
      // Same-origin API in dev: the httpOnly refresh cookie needs localhost and the API on one site.
      // xfwd adds X-Forwarded-For so the API rate-limits the real client, not the proxy (uvicorn trusts 127.0.0.1 by default).
      proxy: {
        '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true, xfwd: true },
      },
    },
    preview: { headers: prod },
    // `npm test` (Vitest): unit tests live next to the code; the Playwright specs in e2e/ are run by their own scripts
    test: { include: ['src/**/*.test.js'], environment: 'node' },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor_react: ['react', 'react-dom', 'react-router-dom'],
            vendor_ui: ['framer-motion', 'lucide-react', 'canvas-confetti'],
            vendor_three: ['three', '@react-three/fiber', '@react-three/drei'],
          },
        },
      },
    },
  };
});
