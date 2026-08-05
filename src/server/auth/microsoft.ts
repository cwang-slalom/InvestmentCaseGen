import {
  createHash,
  createPublicKey,
  createVerify,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { z } from "zod";

import type { User } from "@/domain";
import { getStorage, type Storage } from "@/server/storage";

const MICROSOFT_AUTH_COOKIE_NAME = "investmentgen_ms_auth";
const MICROSOFT_AUTH_COOKIE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MICROSOFT_TENANT = "organizations";
const MICROSOFT_SCOPES = "openid profile email";
const MICROSOFT_PROMPT = "select_account";

const MicrosoftTokenResponseSchema = z.object({
  id_token: z.string().min(1),
});

const MicrosoftOpenIdConfigurationSchema = z.object({
  issuer: z.string().min(1),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  jwks_uri: z.string().url(),
});

const MicrosoftJwkSchema = z.object({
  kid: z.string(),
  kty: z.literal("RSA"),
  n: z.string(),
  e: z.string(),
});

const MicrosoftJwksSchema = z.object({
  keys: z.array(MicrosoftJwkSchema),
});

const MicrosoftIdTokenClaimsSchema = z.object({
  aud: z.string(),
  exp: z.number(),
  iat: z.number().optional(),
  iss: z.string(),
  name: z.string().optional(),
  nbf: z.number().optional(),
  nonce: z.string(),
  oid: z.string().optional(),
  preferred_username: z.string().optional(),
  email: z.string().optional(),
  sub: z.string(),
  tid: z.string().optional(),
});

export type MicrosoftAuthState = {
  codeVerifier: string;
  createdAt: number;
  nonce: string;
  next: string;
  state: string;
};

type MicrosoftIdTokenClaims = z.infer<typeof MicrosoftIdTokenClaimsSchema>;

function base64UrlEncode(value: Buffer | string) {
  return Buffer.isBuffer(value)
    ? value.toString("base64url")
    : Buffer.from(value).toString("base64url");
}

function base64UrlDecodeJson(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function sha256Base64Url(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function microsoftTenant() {
  return process.env.MICROSOFT_TENANT_ID?.trim() || DEFAULT_MICROSOFT_TENANT;
}

export function getMicrosoftAuthConfig(origin?: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenant = microsoftTenant();
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI?.trim() ||
    (origin ? `${origin}/api/auth/microsoft/callback` : undefined);

  return {
    clientId,
    clientSecret,
    tenant,
    redirectUri,
    configured: Boolean(clientId && clientSecret && redirectUri),
  };
}

export function isMicrosoftLoginConfigured() {
  const config = getMicrosoftAuthConfig();
  return Boolean(config.clientId && config.clientSecret);
}

export function microsoftAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + MICROSOFT_AUTH_COOKIE_TTL_MS),
  };
}

export function expiredMicrosoftAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  };
}

export function getMicrosoftAuthCookieName() {
  return MICROSOFT_AUTH_COOKIE_NAME;
}

export function createMicrosoftAuthState(next: string): MicrosoftAuthState {
  return {
    codeVerifier: randomBytes(48).toString("base64url"),
    createdAt: Date.now(),
    nonce: randomBytes(24).toString("base64url"),
    next,
    state: randomBytes(24).toString("base64url"),
  };
}

export function serializeMicrosoftAuthState(state: MicrosoftAuthState) {
  return base64UrlEncode(JSON.stringify(state));
}

export function parseMicrosoftAuthState(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const state = z
      .object({
        codeVerifier: z.string().min(32),
        createdAt: z.number(),
        nonce: z.string().min(16),
        next: z.string(),
        state: z.string().min(16),
      })
      .parse(base64UrlDecodeJson(value));

    if (Date.now() - state.createdAt > MICROSOFT_AUTH_COOKIE_TTL_MS) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

async function loadOpenIdConfiguration(tenant: string) {
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(
      tenant,
    )}/v2.0/.well-known/openid-configuration`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Microsoft sign-in metadata could not be loaded.");
  }

  return MicrosoftOpenIdConfigurationSchema.parse(await response.json());
}

export async function createMicrosoftAuthorizationUrl({
  next,
  origin,
}: {
  next: string;
  origin: string;
}) {
  const config = getMicrosoftAuthConfig(origin);

  if (!config.configured || !config.clientId || !config.redirectUri) {
    throw new Error("Microsoft sign-in is not configured.");
  }

  const metadata = await loadOpenIdConfiguration(config.tenant);
  const state = createMicrosoftAuthState(next);
  const url = new URL(metadata.authorization_endpoint);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_SCOPES);
  url.searchParams.set("prompt", MICROSOFT_PROMPT);
  url.searchParams.set("state", state.state);
  url.searchParams.set("nonce", state.nonce);
  url.searchParams.set("code_challenge", sha256Base64Url(state.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");

  return {
    state,
    url,
  };
}

function decodeJwtPart(value: string) {
  return base64UrlDecodeJson(value);
}

function verifyJwtSignature({
  idToken,
  jwk,
}: {
  idToken: string;
  jwk: z.infer<typeof MicrosoftJwkSchema>;
}) {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Microsoft ID token is malformed.");
  }

  const keyObject = createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    },
    format: "jwk",
  });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  if (!verifier.verify(keyObject, Buffer.from(encodedSignature, "base64url"))) {
    throw new Error("Microsoft ID token signature could not be verified.");
  }
}

function expectedIssuer(
  metadataIssuer: string,
  claims: MicrosoftIdTokenClaims,
) {
  return metadataIssuer.replace("{tenantid}", claims.tid ?? "");
}

function validateIdTokenClaims({
  claims,
  clientId,
  issuer,
  nonce,
}: {
  claims: MicrosoftIdTokenClaims;
  clientId: string;
  issuer: string;
  nonce: string;
}) {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (claims.aud !== clientId) {
    throw new Error("Microsoft ID token audience is invalid.");
  }

  if (claims.exp <= nowInSeconds) {
    throw new Error("Microsoft ID token has expired.");
  }

  if (claims.nbf && claims.nbf > nowInSeconds) {
    throw new Error("Microsoft ID token is not active yet.");
  }

  if (claims.nonce !== nonce) {
    throw new Error("Microsoft ID token nonce is invalid.");
  }

  if (claims.iss !== expectedIssuer(issuer, claims)) {
    throw new Error("Microsoft ID token issuer is invalid.");
  }
}

async function verifyMicrosoftIdToken({
  clientId,
  idToken,
  issuer,
  jwksUri,
  nonce,
}: {
  clientId: string;
  idToken: string;
  issuer: string;
  jwksUri: string;
  nonce: string;
}) {
  const [encodedHeader, encodedPayload] = idToken.split(".");
  const header = z
    .object({
      alg: z.literal("RS256"),
      kid: z.string(),
    })
    .parse(decodeJwtPart(encodedHeader ?? ""));
  const claims = MicrosoftIdTokenClaimsSchema.parse(
    decodeJwtPart(encodedPayload ?? ""),
  );
  const jwksResponse = await fetch(jwksUri, { cache: "no-store" });

  if (!jwksResponse.ok) {
    throw new Error("Microsoft signing keys could not be loaded.");
  }

  const jwks = MicrosoftJwksSchema.parse(await jwksResponse.json());
  const jwk = jwks.keys.find((key) => key.kid === header.kid);

  if (!jwk) {
    throw new Error("Microsoft signing key was not found.");
  }

  verifyJwtSignature({ idToken, jwk });
  validateIdTokenClaims({
    claims,
    clientId,
    issuer,
    nonce,
  });

  return claims;
}

async function exchangeCodeForIdToken({
  code,
  origin,
  state,
}: {
  code: string;
  origin: string;
  state: MicrosoftAuthState;
}) {
  const config = getMicrosoftAuthConfig(origin);

  if (
    !config.configured ||
    !config.clientId ||
    !config.clientSecret ||
    !config.redirectUri
  ) {
    throw new Error("Microsoft sign-in is not configured.");
  }

  const metadata = await loadOpenIdConfiguration(config.tenant);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: state.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    scope: MICROSOFT_SCOPES,
  });
  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Microsoft authorization code could not be exchanged.");
  }

  const tokenResponse = MicrosoftTokenResponseSchema.parse(
    await response.json(),
  );

  return verifyMicrosoftIdToken({
    clientId: config.clientId,
    idToken: tokenResponse.id_token,
    issuer: metadata.issuer,
    jwksUri: metadata.jwks_uri,
    nonce: state.nonce,
  });
}

function emailFromClaims(claims: MicrosoftIdTokenClaims) {
  return (claims.email ?? claims.preferred_username)?.trim().toLowerCase();
}

function nameFromClaims(claims: MicrosoftIdTokenClaims, email: string) {
  return claims.name?.trim() || email.split("@")[0] || "Microsoft user";
}

async function getOrCreateMicrosoftUser({
  claims,
  storage,
}: {
  claims: MicrosoftIdTokenClaims;
  storage: Storage;
}): Promise<User> {
  const email = emailFromClaims(claims);

  if (!email) {
    throw new Error("Microsoft account did not provide an email address.");
  }

  const existing = await storage.getUserByEmail(email);

  if (existing) {
    if (!existing.active) {
      throw new Error("This account is inactive.");
    }

    return existing;
  }

  return storage.createUser({
    id: randomUUID(),
    email,
    name: nameFromClaims(claims, email),
    passwordHash: `external:microsoft:${claims.tid ?? "unknown"}:${
      claims.oid ?? claims.sub
    }`,
    systemRole: "member",
    active: true,
  });
}

export async function authenticateMicrosoftCallback({
  code,
  origin,
  state,
  storage = getStorage(),
}: {
  code: string;
  origin: string;
  state: MicrosoftAuthState;
  storage?: Storage;
}) {
  const claims = await exchangeCodeForIdToken({ code, origin, state });
  return getOrCreateMicrosoftUser({ claims, storage });
}
