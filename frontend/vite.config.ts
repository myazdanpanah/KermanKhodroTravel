import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Intercept unhandled network socket errors (ECONNRESET, EPIPE, etc.)
// on Windows when mobile devices / browsers sleep, reload or disconnect during HMR.
if (typeof process !== 'undefined') {
  process.on('uncaughtException', (err: any) => {
    if (
      err &&
      (err.code === 'ECONNRESET' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'EPIPE' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNABORTED' ||
        err.message?.includes('ECONNRESET'))
    ) {
      // Gracefully ignore client connection resets
      return
    }
    console.error('Uncaught exception in Vite process:', err)
  })
}

function suppressSocketErrorsPlugin(): Plugin {
  return {
    name: 'suppress-socket-errors',
    configureServer(server) {
      server.httpServer?.on('clientError', (err: any, socket: any) => {
        if (
          err?.code === 'ECONNRESET' ||
          err?.code === 'ECONNABORTED' ||
          err?.code === 'EPIPE' ||
          !socket.writable
        ) {
          return
        }
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), suppressSocketErrorsPlugin()],
  worker: {
    format: 'es',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            // Prevent unhandled ECONNRESET / ECONNREFUSED from crashing the Vite server
            if (err && 'code' in err && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')) {
              return
            }
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'text/plain' })
              res.end('Bad Gateway: backend unreachable')
            }
          })
        },
      },
      // Uploaded company logos live on the backend's media root
      '/media': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (err && 'code' in err && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')) {
              return
            }
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'text/plain' })
              res.end('Bad Gateway')
            }
          })
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks are cached independently of app code.
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          echarts: ['echarts'],
          aggrid: ['ag-grid-community', 'ag-grid-react'],
        },
      },
    },
  },
})
