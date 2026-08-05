import {
  randomBytes,
  scrypt,
  type ScryptOptions,
  timingSafeEqual,
} from "node:crypto";

const HASH_ALGORITHM = "scrypt";
const SCRYPT_PARAMS: ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
};
const KEY_LENGTH = 64;

function scryptAsync(
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function parsePasswordHash(passwordHash: string) {
  const [algorithm, n, r, p, salt, key] = passwordHash.split("$");

  if (algorithm !== HASH_ALGORITHM || !n || !r || !p || !salt || !key) {
    throw new Error("Unsupported password hash format.");
  }

  return {
    n: Number(n),
    r: Number(r),
    p: Number(p),
    salt,
    key: Buffer.from(key, "base64url"),
  };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  const hash = key.toString("base64url");

  return [
    HASH_ALGORITHM,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt,
    hash,
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string) {
  try {
    const parsed = parsePasswordHash(passwordHash);
    const candidate = await scryptAsync(password, parsed.salt, KEY_LENGTH, {
      N: parsed.n,
      r: parsed.r,
      p: parsed.p,
    });

    return (
      candidate.byteLength === parsed.key.byteLength &&
      timingSafeEqual(candidate, parsed.key)
    );
  } catch {
    return false;
  }
}
