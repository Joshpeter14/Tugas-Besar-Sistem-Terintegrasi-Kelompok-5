export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[service-rekam]', err);

  const known = err instanceof HttpError || status < 500;
  res.status(status).json({
    error: known ? err.message : 'Terjadi kesalahan pada server',
    ...(err.details ? { details: err.details } : {}),
  });
}
