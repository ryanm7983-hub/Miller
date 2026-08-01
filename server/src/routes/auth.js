import { Router } from 'express';
import { z } from 'zod';
import { createUser, issueToken, requireAuth, verifyUser } from '../auth/index.js';

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

authRouter.post('/register', (req, res, next) => {
  try {
    const { email, password } = credentials.parse(req.body ?? {});
    const user = createUser(email, password);
    res.status(201).json({ user, token: issueToken(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', (req, res, next) => {
  try {
    const { email, password } = credentials.parse(req.body ?? {});
    const user = verifyUser(email, password);
    res.json({ user, token: issueToken(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
