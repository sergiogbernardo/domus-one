import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const realtimeOrigin = supabaseOrigin?.replace(/^https:/, 'wss:');

  return {
    base: '/domus-one/',
    plugins: [
      react(),
      {
        name: 'production-content-security-policy',
        transformIndexHtml: command === 'build' ? () => securityPolicyTag(supabaseOrigin, realtimeOrigin) : undefined,
      },
    ],
  };
});

function securityPolicyTag(supabaseOrigin: string | null, realtimeOrigin: string | null) {
  const connections = ["'self'", supabaseOrigin, realtimeOrigin].filter(Boolean).join(' ');

  return [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          `connect-src ${connections}`,
          "manifest-src 'self'",
          "worker-src 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      },
      injectTo: 'head-prepend' as const,
    },
  ];
}
