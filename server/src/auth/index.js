import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { newId } from '../lib/ids.js';
import { config } from '../config.js';

export function createUser(email, password) {
  const normalized = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
  if (existing) {
    const error = new Error('An account with that email already exists');
    error.status = 409;
    throw error;
  }
  const id = newId('usr');
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
    id,
    normalized,
    bcrypt.hashSync(password, 10),
  );
  return { id, email: normalized };
}

export function verifyUser(email, password) {
  const normalized = String(email).trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }
  return { id: row.id, email: row.email };
}

export function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.auth.jwtSecret, {
    expiresIn: config.auth.tokenTtl,
  });
}

function readToken(req) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch {
    return null;
  }
}

/** Attaches `req.user` when a valid token is present; never rejects. */
export function optionalAuth(req, _res, next) {
  const payload = readToken(req);
  req.user = payload ? { id: payload.sub, email: payload.email } : null;
  next();
}

export function requireAuth(req, res, next) {
  const payload = readToken(req);
  if (!payload) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  req.user = { id: payload.sub, email: payload.email };
  next();
}
