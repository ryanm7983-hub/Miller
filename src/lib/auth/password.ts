import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export interface PasswordCheck {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  problems: string[];
}

const COMMON = new Set([
  'password',
  'password1',
  'passw0rd',
  '12345678',
  'qwertyui',
  'letmein1',
  'welcome1',
  'iloveyou',
  'admin123',
  'auditready',
]);

/** Shared by the signup form (client) and the signup action (server). */
export function checkPasswordStrength(password: string): PasswordCheck {
  const problems: string[] = [];
  if (password.length < 10) problems.push('Use at least 10 characters.');
  if (!/[a-z]/.test(password)) problems.push('Include a lowercase letter.');
  if (!/[A-Z0-9]/.test(password)) problems.push('Include an uppercase letter or a number.');
  if (COMMON.has(password.toLowerCase())) problems.push('This password is too common.');

  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  return {
    ok: problems.length === 0,
    score: Math.min(score, 4) as PasswordCheck['score'],
    problems,
  };
}
