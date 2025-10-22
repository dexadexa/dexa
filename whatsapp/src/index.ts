import express from 'express';

const app = express();

app.get('/', (_req, res) => {
  res.send('DeXa Hedera Last Mile Access is running');
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'dexa-whatsapp', timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});

