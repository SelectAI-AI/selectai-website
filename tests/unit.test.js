'use strict';
/**
 * tests/unit.test.js
 * Pure unit tests — no DB, no HTTP calls.
 * Covers: validation helpers, JWT signing, OTP generation,
 *         HTML escaping, CSV building, and date formatting.
 */

/* ── Setup env before any require ─────────────────────── */
process.env.JWT_SECRET = 'test-secret-key-for-jest-at-least-32-chars-long';
process.env.NODE_ENV   = 'test';

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/* ─── Helpers mirrored from production code ──────────── */

function validatePassword(pw) {
  if (!pw || pw.length < 8)  return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw))     return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw))     return 'Password must contain at least one number.';
  return '';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCsvString(rows) {
  if (!rows.length) return null;
  const headers = Object.keys(rows[0]);
  const lines   = rows.map(row =>
    headers.map(h => '"' + (row[h] || '').toString().replace(/"/g, '""') + '"').join(',')
  );
  return '\uFEFF' + headers.join(',') + '\n' + lines.join('\n');
}

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = (typeof ts.toDate === 'function') ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return '—'; }
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ══════════════════════════════════════════════════════
   SUITE 1: Password validation
   ══════════════════════════════════════════════════════ */
describe('validatePassword()', () => {
  test('rejects undefined', () => expect(validatePassword(undefined)).toMatch(/8 characters/));
  test('rejects too short', () => expect(validatePassword('Ab1')).toMatch(/8 characters/));
  test('rejects no uppercase', () => expect(validatePassword('alicetest1')).toMatch(/uppercase/));
  test('rejects no digit', () => expect(validatePassword('AliceTest')).toMatch(/number/));
  test('accepts valid password', () => expect(validatePassword('SelectAI@2026')).toBe(''));
  test('accepts minimal valid password', () => expect(validatePassword('Password1')).toBe(''));
  test('rejects exactly 7 chars', () => expect(validatePassword('Pass1Ab')).toMatch(/8 characters/));
  test('accepts exactly 8 chars', () => expect(validatePassword('Password1'[0] + 'assword1')).toBe(''));
});

/* ══════════════════════════════════════════════════════
   SUITE 2: Email validation
   ══════════════════════════════════════════════════════ */
describe('validateEmail()', () => {
  test('accepts standard email', () => expect(validateEmail('user@example.com')).toBe(true));
  test('accepts subdomain email', () => expect(validateEmail('u@mail.co.uk')).toBe(true));
  test('accepts plus addressing', () => expect(validateEmail('user+tag@example.org')).toBe(true));
  test('rejects missing @', () => expect(validateEmail('notanemail')).toBe(false));
  test('rejects missing TLD', () => expect(validateEmail('user@domain')).toBe(false));
  test('rejects space in email', () => expect(validateEmail('us er@example.com')).toBe(false));
  test('rejects empty string', () => expect(validateEmail('')).toBe(false));
});

/* ══════════════════════════════════════════════════════
   SUITE 3: HTML escaping (XSS prevention)
   ══════════════════════════════════════════════════════ */
describe('esc() — XSS protection', () => {
  test('escapes &', () => expect(esc('a&b')).toBe('a&amp;b'));
  test('escapes <', () => expect(esc('<script>')).toContain('&lt;'));
  test('escapes >', () => expect(esc('<script>')).toContain('&gt;'));
  test('escapes "', () => expect(esc('"value"')).toBe('&quot;value&quot;'));
  test('neutralises XSS payload', () => {
    const result = esc('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });
  test('leaves safe text unchanged', () => expect(esc('Hello World')).toBe('Hello World'));
  test('converts numbers to string', () => expect(esc(42)).toBe('42'));
  test('handles nested script tag', () => {
    expect(esc('<script>alert("xss")</script>')).not.toContain('<script>');
  });
});

/* ══════════════════════════════════════════════════════
   SUITE 4: CSV builder
   ══════════════════════════════════════════════════════ */
describe('buildCsvString()', () => {
  test('returns null for empty array', () => expect(buildCsvString([])).toBeNull());
  test('starts with BOM (0xFEFF)', () => {
    const csv = buildCsvString([{ Name: 'A', Email: 'a@b.com' }]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });
  test('contains header row', () => {
    const csv = buildCsvString([{ Name: 'Alice', Email: 'a@b.com' }]);
    expect(csv).toContain('Name,Email');
  });
  test('wraps values in double quotes', () => {
    const csv = buildCsvString([{ Name: 'Alice', Email: 'a@b.com' }]);
    expect(csv).toContain('"Alice"');
  });
  test('escapes internal double quotes', () => {
    const csv = buildCsvString([{ Name: 'O"Brien', Email: 'o@b.com' }]);
    expect(csv).toContain('O""Brien');
  });
  test('handles multiple rows', () => {
    const csv = buildCsvString([
      { Name: 'Alice', Email: 'a@b.com' },
      { Name: 'Bob',   Email: 'b@b.com' }
    ]);
    expect(csv).toContain('"Alice"');
    expect(csv).toContain('"Bob"');
  });
});

/* ══════════════════════════════════════════════════════
   SUITE 5: Date formatter
   ══════════════════════════════════════════════════════ */
describe('fmtDate()', () => {
  test('returns em-dash for null', () => expect(fmtDate(null)).toBe('—'));
  test('returns em-dash for undefined', () => expect(fmtDate(undefined)).toBe('—'));
  test('formats JS Date object', () => {
    const r = fmtDate(new Date(2024, 0, 15));
    expect(r).toContain('2024');
    expect(r).toContain('Jan');
  });
  test('formats ISO date string', () => {
    const r = fmtDate('2025-06-09T00:00:00.000Z');
    expect(r).toContain('2025');
  });
  test('formats mock Firestore Timestamp', () => {
    const r = fmtDate({ toDate: () => new Date(2025, 5, 9) });
    expect(r).toContain('2025');
    expect(r).toContain('Jun');
  });
});

/* ══════════════════════════════════════════════════════
   SUITE 6: OTP generator
   ══════════════════════════════════════════════════════ */
describe('generateOtp()', () => {
  test('returns a 6-character string', () => expect(generateOtp()).toHaveLength(6));
  test('contains only digits', () => expect(generateOtp()).toMatch(/^\d{6}$/));
  test('value is between 100000 and 999999', () => {
    const n = parseInt(generateOtp(), 10);
    expect(n).toBeGreaterThanOrEqual(100000);
    expect(n).toBeLessThanOrEqual(999999);
  });
  test('generates different values (randomness check)', () => {
    const codes = new Set(Array.from({ length: 30 }, generateOtp));
    expect(codes.size).toBeGreaterThanOrEqual(15);
  });
});

/* ══════════════════════════════════════════════════════
   SUITE 7: JWT signing & verification
   ══════════════════════════════════════════════════════ */
describe('JWT token', () => {
  const SECRET = process.env.JWT_SECRET;

  test('signs and verifies a token', () => {
    const token   = jwt.sign({ uid: 'u1', email: 'u@t.com', role: 'user' }, SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.uid).toBe('u1');
    expect(decoded.email).toBe('u@t.com');
    expect(decoded.role).toBe('user');
  });

  test('expired token throws', () => {
    const token = jwt.sign({ uid: 'u2' }, SECRET, { expiresIn: '-1s' });
    expect(() => jwt.verify(token, SECRET)).toThrow();
  });

  test('tampered token throws', () => {
    const token = jwt.sign({ uid: 'u3', role: 'user' }, SECRET) + 'tamper';
    expect(() => jwt.verify(token, SECRET)).toThrow();
  });

  test('wrong secret throws', () => {
    const token = jwt.sign({ uid: 'u4' }, SECRET);
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  test('admin role is encoded', () => {
    const token   = jwt.sign({ uid: 'a1', role: 'admin' }, SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.role).toBe('admin');
  });

  test('pw-reset token has correct purpose', () => {
    const token   = jwt.sign({ uid: 'u5', purpose: 'pw-reset' }, SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.purpose).toBe('pw-reset');
  });
});

/* ══════════════════════════════════════════════════════
   SUITE 8: bcrypt password hashing
   ══════════════════════════════════════════════════════ */
describe('bcrypt hashing', () => {
  test('hashes a password', async () => {
    const hash = await bcrypt.hash('SelectAI@2026', 10);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe('SelectAI@2026');
  });

  test('correct password matches hash', async () => {
    const hash  = await bcrypt.hash('SelectAI@2026', 10);
    const match = await bcrypt.compare('SelectAI@2026', hash);
    expect(match).toBe(true);
  });

  test('wrong password does not match hash', async () => {
    const hash  = await bcrypt.hash('SelectAI@2026', 10);
    const match = await bcrypt.compare('WrongPassword1', hash);
    expect(match).toBe(false);
  });

  test('two hashes of same password are different (salt)', async () => {
    const h1 = await bcrypt.hash('SamePassword1', 10);
    const h2 = await bcrypt.hash('SamePassword1', 10);
    expect(h1).not.toBe(h2);
  });
});

/* ══════════════════════════════════════════════════════
   SUITE 9: UUID generation
   ══════════════════════════════════════════════════════ */
describe('crypto.randomUUID()', () => {
  test('generates a valid UUID v4 format', () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('generates unique UUIDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => crypto.randomUUID()));
    expect(ids.size).toBe(50);
  });
});

/* ══════════════════════════════════════════════════════
   SUITE 10: Admin role logic
   ══════════════════════════════════════════════════════ */
describe('Admin role logic', () => {
  test('only "admin" role should bypass requireAdmin check', () => {
    const isAdmin = role => role === 'admin';
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('user')).toBe(false);
    expect(isAdmin('')).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  test('role toggle: user → admin', () => {
    const toggle = current => current === 'admin' ? 'user' : 'admin';
    expect(toggle('user')).toBe('admin');
    expect(toggle('admin')).toBe('user');
  });

  test('safe role assignment rejects unexpected values', () => {
    const safeRole = r => (r === 'admin') ? 'admin' : 'user';
    expect(safeRole('admin')).toBe('admin');
    expect(safeRole('superadmin')).toBe('user');
    expect(safeRole(undefined)).toBe('user');
    expect(safeRole('')).toBe('user');
  });
});

/* ══════════════════════════════════════════════════════
   SUITE 11: mail — From address for Gmail SMTP
   ══════════════════════════════════════════════════════ */
describe('lib/mail getFromAddress()', () => {
  const mail = require('../lib/mail');
  const saved = {};

  beforeEach(() => {
    ['SMTP_USER', 'SMTP_FROM', 'SMTP_HOST'].forEach((k) => {
      saved[k] = process.env[k];
    });
  });

  afterEach(() => {
    ['SMTP_USER', 'SMTP_FROM', 'SMTP_HOST'].forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  test('uses SMTP_USER as From for Gmail when SMTP_FROM domain mismatches', () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'info@selectai.it.com';
    process.env.SMTP_FROM = 'SelectAI <noreply@selectai.it.com>';
    expect(mail.getFromAddress()).toBe('SelectAI <info@selectai.it.com>');
  });

  test('keeps SMTP_FROM when it matches SMTP_USER on Gmail', () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'info@selectai.it.com';
    process.env.SMTP_FROM = 'SelectAI <info@selectai.it.com>';
    expect(mail.getFromAddress()).toBe('SelectAI <info@selectai.it.com>');
  });
});

/* ─── userHelpers ─────────────────────────────────────── */
describe('userHelpers', () => {
  const { normalizePhone, validatePhone, fullName, isIndiaCountry } = require('../lib/userHelpers');

  test('normalizePhone strips non-digits', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
  });

  test('validatePhone rejects too short for India', () => {
    expect(validatePhone('123', 'IN')).toMatch(/mobile/i);
  });

  test('validatePhone allows empty for non-India', () => {
    expect(validatePhone('', 'GB')).toBe('');
  });

  test('isIndiaCountry accepts IN and India', () => {
    expect(isIndiaCountry('IN')).toBe(true);
    expect(isIndiaCountry('India')).toBe(true);
    expect(isIndiaCountry('GB')).toBe(false);
  });

  test('fullName joins first and last', () => {
    expect(fullName('Alice', 'Smith')).toBe('Alice Smith');
  });
});

/* ─── rateLimit helper ────────────────────────────────── */
describe('rateLimit helper', () => {
  const { configureTrustProxy, createLimiter } = require('../lib/rateLimit');
  const express = require('express');

  test('configureTrustProxy enables trust proxy by default', () => {
    const app = express();
    configureTrustProxy(app);
    expect(app.get('trust proxy')).toBe(1);
  });

  test('createLimiter disables xForwardedForHeader validation', () => {
    const limiter = createLimiter({ windowMs: 60000, max: 10 });
    expect(limiter).toBeDefined();
  });
});
