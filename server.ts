import express from 'express';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json());

// Health & Architecture Status Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'Firebase Firestore',
    sync: 'Real-time multi-device snapshot listeners',
    timestamp: new Date().toISOString(),
  });
});

// Backward-compatible stores endpoint
app.get('/api/stores', (req, res) => {
  res.json({
    success: true,
    stores: [{ name: 'Binti Gym' }],
  });
});

// SPA Route Fallback for Entrance Check-In
app.get('/checkin', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  } else {
    next();
  }
});

// Server Initialization
async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Service-Worker-Allowed', '/');
          } else if (filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL && !process.env.NOW_BUILDER) {
  startServer();
}
