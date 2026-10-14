function getJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || secret.trim().length < 32 || secret === 'your_jwt_secret_key_change_in_production') {
    throw new Error('JWT_SECRET must be configured with at least 32 non-placeholder characters.');
  }
  return secret;
}
function getAllowedOrigins(env = process.env) {
  const configured = [env.CLIENT_URL, ...(env.FRONTEND_ORIGINS || '').split(',')]
    .filter(Boolean).map((origin) => origin.trim()).filter(Boolean);
  const origins = [...new Set(configured)];
  if (!origins.length) throw new Error('Configure CLIENT_URL or FRONTEND_ORIGINS before starting the server.');
  return origins;
}
module.exports = { getJwtSecret, getAllowedOrigins };

