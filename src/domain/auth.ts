import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

// ---------------------------------------------------------------------------
// CSPRNG & Synchronous Pure-TS SHA-256 / HMAC-SHA256 (Node + Browser Safe)
// ---------------------------------------------------------------------------
function getCryptoApi(): Crypto {
  const c =
    typeof globalThis !== 'undefined' && (globalThis as { crypto?: Crypto }).crypto
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Cryptographically secure PRNG (Web Crypto API) is unavailable in this runtime.');
  }
  return c;
}

export function getCryptographicRandomBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(Math.max(1, byteLength));
  getCryptoApi().getRandomValues(bytes);
  return bytes;
}

export function getCryptographicRandomHex(byteLength: number = 16): string {
  const bytes = getCryptographicRandomBytes(byteLength);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Unbiased uniform random integer in [0, maxExclusive) using CSPRNG rejection sampling.
 */
export function getCryptographicRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer.');
  }
  if (maxExclusive === 1) return 0;
  const cryptoApi = getCryptoApi();
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  while (true) {
    cryptoApi.getRandomValues(buf);
    if (buf[0] < limit) {
      return buf[0] % maxExclusive;
    }
  }
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const withOneLen = data.length + 1;
  const padLen = withOneLen % 64 <= 56 ? 56 - (withOneLen % 64) : 120 - (withOneLen % 64);
  const totalLen = withOneLen + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(data, 0);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(totalLen - 8, highBits, false);
  view.setUint32(totalLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

const utf8Encoder = new TextEncoder();

/**
 * Cryptographic 256-bit HMAC-SHA256 hex digest (FIPS 198-1).
 */
export function hmacSha256Hex(key: string, message: string): string {
  let keyBytes: Uint8Array = utf8Encoder.encode(key);
  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const blockKey = new Uint8Array(64);
  blockKey.set(keyBytes, 0);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = blockKey[i] ^ 0x5c;
    iKeyPad[i] = blockKey[i] ^ 0x36;
  }

  const msgBytes = utf8Encoder.encode(message);
  const innerInput = new Uint8Array(64 + msgBytes.length);
  innerInput.set(iKeyPad, 0);
  innerInput.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(64 + innerHash.length);
  outerInput.set(oKeyPad, 0);
  outerInput.set(innerHash, 64);
  const mac = sha256Bytes(outerInput);

  return Array.from(mac)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

// Ephemeral per-process CSPRNG key used when no explicit secret is supplied in tests/client
let runtimeEphemeralHmacKey: string | null = null;
function getDefaultTokenSigningKey(): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.ERP_SESSION_SECRET) {
      const envSec = process.env.ERP_SESSION_SECRET.trim();
      if (envSec.length >= 32 && envSec !== 'change-this-in-production-hmac-secret-256bit') {
        return envSec;
      }
    }
  } catch {}
  if (!runtimeEphemeralHmacKey) {
    runtimeEphemeralHmacKey = getCryptographicRandomHex(32);
  }
  return runtimeEphemeralHmacKey;
}

/**
 * Checks whether a string is a valid bcrypt Modular Crypt Format hash ($2a$, $2b$, $2y$).
 */
export function isBcryptHash(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

/**
 * Generates a cryptographically random per-user bcrypt salt.
 */
export function generateBcryptSalt(rounds: number = BCRYPT_ROUNDS): string {
  return bcrypt.genSaltSync(Math.max(10, Math.min(14, rounds)));
}

function assertBcryptPasswordBounds(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }
  if (password.trim().length === 0) {
    throw new Error('Password must not be empty or whitespace-only.');
  }
  if (utf8Encoder.encode(password).length > BCRYPT_MAX_PASSWORD_BYTES) {
    throw new Error(`Password must not exceed ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes.`);
  }
  return password;
}

/**
 * Hashes a password using bcrypt with a unique per-user salt.
 * Never uses static salts or non-cryptographic fallbacks.
 */
export async function hashPasswordBcrypt(password: string, customSalt?: string): Promise<string> {
  const validPassword = assertBcryptPasswordBounds(password);
  const salt =
    customSalt && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{22}$/.test(customSalt)
      ? customSalt
      : await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(validPassword, salt);
}

/**
 * Synchronous bcrypt hash helper for initial seeding and server bootstrap.
 */
export function hashPasswordBcryptSync(password: string): string {
  const validPassword = assertBcryptPasswordBounds(password);
  const salt = bcrypt.genSaltSync(BCRYPT_ROUNDS);
  return bcrypt.hashSync(validPassword, salt);
}

/**
 * Verifies a password candidate strictly against a bcrypt hash.
 * Plaintext password comparisons (candidate === storedHash) and static salt fallbacks are strictly prohibited.
 */
export async function verifyPasswordBcrypt(
  candidate: string,
  storedBcryptHash: string
): Promise<boolean> {
  if (!candidate || !storedBcryptHash || typeof candidate !== 'string' || typeof storedBcryptHash !== 'string') {
    return false;
  }
  if (utf8Encoder.encode(candidate).length > BCRYPT_MAX_PASSWORD_BYTES) {
    return false;
  }
  if (candidate === storedBcryptHash || !isBcryptHash(storedBcryptHash)) {
    return false;
  }
  try {
    return await bcrypt.compare(candidate, storedBcryptHash);
  } catch {
    return false;
  }
}

/**
 * Synchronous bcrypt verification helper.
 */
export function verifyPasswordBcryptSync(candidate: string, storedBcryptHash: string): boolean {
  if (!candidate || !storedBcryptHash || candidate === storedBcryptHash || !isBcryptHash(storedBcryptHash)) {
    return false;
  }
  if (utf8Encoder.encode(candidate).length > BCRYPT_MAX_PASSWORD_BYTES) {
    return false;
  }
  try {
    return bcrypt.compareSync(candidate, storedBcryptHash);
  } catch {
    return false;
  }
}

export interface PasswordPolicyResult {
  valid: boolean;
  error?: string;
  entropyBits: number;
}

/**
 * Enforces institutional password complexity, raw/untrimmed consistency, bcrypt 72-byte ceiling,
 * and blocks weak defaults (admin, password123, email prefix, mobile number, roll number).
 */
export function validatePasswordComplexity(
  password: string,
  context?: { email?: string; mobile?: string; rollNo?: string }
): PasswordPolicyResult {
  const raw = typeof password === 'string' ? password : '';
  if (raw.trim().length === 0) {
    return { valid: false, error: 'Password must be at least 8 characters long.', entropyBits: 0 };
  }
  if (raw !== raw.trim()) {
    return {
      valid: false,
      error: 'Password must not begin or end with whitespace.',
      entropyBits: 0,
    };
  }
  if (raw.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.', entropyBits: 0 };
  }
  if (utf8Encoder.encode(raw).length > BCRYPT_MAX_PASSWORD_BYTES) {
    return {
      valid: false,
      error: `Password must not exceed ${BCRYPT_MAX_PASSWORD_BYTES} bytes.`,
      entropyBits: 0,
    };
  }

  const lower = raw.toLowerCase();
  const banned = ['admin', 'password', 'password123', '12345678', 'qwerty123', 'rlsy1234', 'welcome123'];
  if (banned.includes(lower)) {
    return { valid: false, error: 'Common or default passwords are not permitted.', entropyBits: 10 };
  }

  const cleanMobile = (context?.mobile || '').trim();
  if (cleanMobile.length > 0 && raw.includes(cleanMobile)) {
    return { valid: false, error: 'Password must not contain your mobile number.', entropyBits: 15 };
  }
  const cleanRollNo = (context?.rollNo || '').trim().toLowerCase();
  if (cleanRollNo.length > 0 && lower.includes(cleanRollNo)) {
    return { valid: false, error: 'Password must not contain your roll number.', entropyBits: 15 };
  }
  const cleanEmailLocal = (context?.email || '').trim().toLowerCase().split('@')[0] || '';
  if (cleanEmailLocal.length >= 3 && lower.includes(cleanEmailLocal)) {
    return { valid: false, error: 'Password must not contain your email username.', entropyBits: 15 };
  }

  const hasUpper = /[A-Z]/.test(raw);
  const hasLower = /[a-z]/.test(raw);
  const hasDigit = /\d/.test(raw);
  const hasSpecial = /[^A-Za-z0-9]/.test(raw);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return {
      valid: false,
      error: 'Password must include uppercase, lowercase, a number, and a special character.',
      entropyBits: 28,
    };
  }

  let pool = 0;
  if (hasLower) pool += 26;
  if (hasUpper) pool += 26;
  if (hasDigit) pool += 10;
  if (hasSpecial) pool += 32;
  const entropyBits = Math.round(raw.length * Math.log2(Math.max(pool, 2)));

  return { valid: true, entropyBits };
}

/**
 * Cryptographic HMAC-SHA256 signature helper for short-lived forced-reset verification tokens.
 * Binds the token to userId, expiration timestamp, CSPRNG nonce, and the current password hash
 * using a server/runtime secret key so tokens cannot be forged by the client.
 */
function computeResetTokenSignature(
  userId: string,
  expiresAt: number,
  nonce: string,
  currentPasswordHash: string,
  secretKey: string
): string {
  const payload = `${userId}|${expiresAt}|${nonce}|${currentPasswordHash}|RLSY_RESET_TOKEN_V2`;
  return hmacSha256Hex(secretKey, payload);
}

/**
 * Issues a short-lived (default 5 minutes) verification token for forced first-login password resets.
 * Must only be issued after the user has proven knowledge of their initial password or OTP.
 */
export function issuePasswordResetToken(
  userId: string,
  currentPasswordHash: string,
  ttlMs: number = 5 * 60 * 1000,
  secretKey: string = getDefaultTokenSigningKey()
): string {
  const cleanUserId = (userId || '').trim();
  if (!cleanUserId || !currentPasswordHash) {
    throw new Error('Cannot issue password reset token without valid userId and password hash.');
  }
  const expiresAt = Date.now() + Math.max(1000, ttlMs);
  const nonce = getCryptographicRandomHex(16);
  const sig = computeResetTokenSignature(cleanUserId, expiresAt, nonce, currentPasswordHash, secretKey);
  return `RST.${encodeURIComponent(cleanUserId)}.${expiresAt}.${nonce}.${sig}`;
}

/**
 * Verifies a short-lived password reset token against the target userId and current password hash.
 */
export function verifyPasswordResetToken(
  token: string | undefined | null,
  expectedUserId: string,
  currentPasswordHash: string,
  secretKey: string = getDefaultTokenSigningKey()
): boolean {
  if (!token || typeof token !== 'string' || !expectedUserId || !currentPasswordHash) {
    return false;
  }
  const parts = token.trim().split('.');
  if (parts.length !== 5 || parts[0] !== 'RST') {
    return false;
  }
  let tokenUserId = '';
  try {
    tokenUserId = decodeURIComponent(parts[1]);
  } catch {
    return false;
  }
  const expiresAt = Number(parts[2]);
  const nonce = parts[3];
  const providedSig = parts[4];

  if (!nonce || !/^[0-9a-f]{16,}$/i.test(nonce)) {
    return false;
  }
  if (tokenUserId !== expectedUserId.trim()) {
    return false;
  }
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }
  const expectedSig = computeResetTokenSignature(
    tokenUserId,
    expiresAt,
    nonce,
    currentPasswordHash,
    secretKey
  );
  return constantTimeEqual(providedSig, expectedSig);
}

/**
 * Generates an institutional temporary password meeting complexity requirements
 * using Web Crypto CSPRNG (zero Math.random, zero predictable prefix).
 */
export function generateSecureTemporaryPassword(length: number = 14): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const specials = '@#$%&*!';
  const all = uppers + lowers + digits + specials;

  const targetLen = Math.max(12, Math.min(32, Math.floor(length)));
  const chars: string[] = [
    uppers[getCryptographicRandomInt(uppers.length)],
    uppers[getCryptographicRandomInt(uppers.length)],
    lowers[getCryptographicRandomInt(lowers.length)],
    lowers[getCryptographicRandomInt(lowers.length)],
    digits[getCryptographicRandomInt(digits.length)],
    digits[getCryptographicRandomInt(digits.length)],
    specials[getCryptographicRandomInt(specials.length)],
  ];
  while (chars.length < targetLen) {
    chars.push(all[getCryptographicRandomInt(all.length)]);
  }
  // CSPRNG Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = getCryptographicRandomInt(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

export interface PasswordResetOtpSession {
  email: string;
  otp: string;
  expiresAt: number;
  attempts: number;
}

// Shadow tracker prevents client-side mutation of session.attempts or OTP replay
const otpSessionShadow = new WeakMap<PasswordResetOtpSession, { attempts: number; verified: boolean }>();

/**
 * Issues a cryptographically random 6-digit one-time password (OTP) for registered email recovery.
 */
export function issuePasswordResetOtp(
  email: string,
  ttlMs: number = 10 * 60 * 1000
): PasswordResetOtpSession {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Valid registered email is required to issue OTP.');
  }
  const otp = String(100000 + getCryptographicRandomInt(900000));
  const session: PasswordResetOtpSession = {
    email: cleanEmail,
    otp,
    expiresAt: Date.now() + Math.max(60000, ttlMs),
    attempts: 0,
  };
  otpSessionShadow.set(session, { attempts: 0, verified: false });
  return session;
}

/**
 * Verifies a 6-digit OTP against an active session, enforcing expiration, single-use, and brute-force limits.
 */
export function verifyPasswordResetOtp(
  session: PasswordResetOtpSession | null | undefined,
  email: string,
  candidateOtp: string
): { success: boolean; error?: string } {
  if (!session || !session.email || session.email.toLowerCase() !== (email || '').trim().toLowerCase()) {
    return { success: false, error: 'No active OTP verification session found for this email.' };
  }
  if (Date.now() > session.expiresAt) {
    return { success: false, error: 'OTP has expired. Please request a new verification code.' };
  }

  const shadow = otpSessionShadow.get(session) || { attempts: session.attempts || 0, verified: false };
  if (shadow.verified) {
    return { success: false, error: 'OTP has already been used. Please request a new verification code.' };
  }
  const effectiveAttempts = Math.max(session.attempts || 0, shadow.attempts);
  if (effectiveAttempts >= 5) {
    session.attempts = effectiveAttempts;
    return { success: false, error: 'Maximum verification attempts exceeded. Please request a new code.' };
  }

  const cleanCandidate = (candidateOtp || '').trim();
  if (!constantTimeEqual(cleanCandidate, session.otp)) {
    const nextAttempts = effectiveAttempts + 1;
    session.attempts = nextAttempts;
    shadow.attempts = nextAttempts;
    otpSessionShadow.set(session, shadow);
    const remaining = Math.max(0, 5 - nextAttempts);
    return {
      success: false,
      error:
        remaining > 0
          ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Maximum verification attempts exceeded. Please request a new code.',
    };
  }

  shadow.verified = true;
  otpSessionShadow.set(session, shadow);
  return { success: true };
}
