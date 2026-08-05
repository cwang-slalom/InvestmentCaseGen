import { afterEach, describe, expect, it, vi } from "vitest";

import { createMicrosoftAuthorizationUrl } from "./microsoft";

const ORIGINAL_ENV = { ...process.env };

describe("Microsoft auth", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("asks Microsoft to show the account picker", async () => {
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return Response.json({
          issuer: "https://login.microsoftonline.com/{tenantid}/v2.0",
          authorization_endpoint:
            "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
          token_endpoint:
            "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
          jwks_uri:
            "https://login.microsoftonline.com/organizations/discovery/v2.0/keys",
        });
      }),
    );

    const { url } = await createMicrosoftAuthorizationUrl({
      next: "/",
      origin: "http://localhost:3000",
    });

    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});
