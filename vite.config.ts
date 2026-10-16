import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'GRIMOIRE_');
    const extraHosts = (env.GRIMOIRE_ALLOWED_HOSTS ?? '')
        .split(',')
        .map(host => host.trim())
        .filter(Boolean);
    return {
        plugins: [react()],
        base: './',
        server: {
            port: 5173,
            strictPort: true,
            allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', ...extraHosts]
        }
    };
});
