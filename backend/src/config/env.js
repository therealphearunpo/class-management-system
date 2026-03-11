function normalizeNodeEnv(value) {
  const env = String(value || 'development').trim().toLowerCase();
  return env || 'development';
}

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const env = {
  nodeEnv: normalizeNodeEnv(process.env.NODE_ENV),
  port: Number(process.env.PORT || 3001),
  jwtSecret: String(process.env.JWT_SECRET || '').trim(),
  jwtExpiresIn: String(process.env.JWT_EXPIRES_IN || '7d').trim(),
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  db: {
    host: String(process.env.DB_HOST || '127.0.0.1').trim(),
    port: Number(process.env.DB_PORT || 3306),
    user: String(process.env.DB_USER || 'root').trim(),
    password: String(process.env.DB_PASSWORD || ''),
    database: String(process.env.DB_NAME || 'class_management').trim(),
  },
};

function validateEnv() {
  const problems = [];

  if (!Number.isFinite(env.port) || env.port <= 0) {
    problems.push('PORT must be a valid positive number');
  }

  if (!Number.isFinite(env.db.port) || env.db.port <= 0) {
    problems.push('DB_PORT must be a valid positive number');
  }

  if (!env.db.host) problems.push('DB_HOST is required');
  if (!env.db.user) problems.push('DB_USER is required');
  if (!env.db.database) problems.push('DB_NAME is required');

  if (!env.jwtSecret || env.jwtSecret.length < 16) {
    problems.push('JWT_SECRET must be set and at least 16 characters long');
  }

  if (problems.length > 0) {
    const error = new Error(`Invalid environment configuration:\n- ${problems.join('\n- ')}`);
    error.code = 'INVALID_ENV';
    throw error;
  }
}

module.exports = {
  env,
  validateEnv,
};
