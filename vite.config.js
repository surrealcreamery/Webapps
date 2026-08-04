import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
	resolve: {
		alias: {
			"@": "/src",
		},
	},
	esbuild: mode === 'production' ? {
		drop: ['console', 'debugger'],
	} : {},
	server: {
		port: 5173,
		watch: {
			// FSEvents fails on paths with spaces (e.g. "React Apps").
			// Polling is the reliable alternative.
			usePolling: true,
			interval: 500,
		},
	},
}))

