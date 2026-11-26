import 'dotenv/config';
import app from './src/app.js';
import { antreanBaseUrl } from './src/antreanClient.js';

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`[service-rekam] jalan di http://localhost:${port}`);
  console.log(`[service-rekam] terhubung ke Service Antrean: ${antreanBaseUrl()}`);
  console.log(`[service-rekam] dokumentasi Swagger: http://localhost:${port}/docs`);
});
