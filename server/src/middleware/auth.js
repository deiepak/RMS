const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rms-secret-key-2026';

/**
 * Middleware: verify JWT from Authorization header.
 * Attaches decoded payload to req.user = { id, role, name }
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role, name: decoded.name, station_id: decoded.station_id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Middleware factory: restrict access to specific roles.
 * Usage: requireRole(['admin', 'kitchen'])
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole, JWT_SECRET };
