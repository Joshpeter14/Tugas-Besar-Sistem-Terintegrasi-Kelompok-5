import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { antreanApi, antreanBaseUrl } from './antreanClient.js';
import { errorHandler, notFound } from './errors.js';
import integrasiRouter from './routes/integrasi.js';
import kunjunganRouter from './routes/kunjungan.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const openapiPath = path.join(here, '..', 'openapi.yaml');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'service-rekam', docs: '/docs', openapi: '/openapi.yaml', health: '/api/health' });
});

// Health juga mengecek apakah Service Antrean bisa dihubungi
app.get('/api/health', async (req, res) => {
  let antrean;
  try {
    antrean = { url: antreanBaseUrl(), status: 'ok', detail: await antreanApi.health() };
  } catch (err) {
    antrean = { url: antreanBaseUrl(), status: 'down', error: err.message };
  }
  res.json({ status: 'ok', service: 'service-rekam', storage: 'sqlite', antrean, time: new Date().toISOString() });
});

app.get('/openapi.yaml', (req, res) => {
  res.type('text/yaml').send(fs.readFileSync(openapiPath, 'utf8'));
});

app.get('/docs', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Service Rekam Kunjungan - API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>window.ui = SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger-ui' });</script>
</body>
</html>`);
});

app.use('/api/kunjungan', kunjunganRouter);
app.use('/api', integrasiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
