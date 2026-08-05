import { redirect } from "next/navigation";

import { getCurrentUser, safeNextPath } from "@/server/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const nextPath = safeNextPath(firstValue(params.next));
  const status = firstValue(params.status);
  const message = firstValue(params.message);

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-copy">
          <p className="eyebrow">Investment Case Generator</p>
          <h1 id="login-title">Investment Case Generator</h1>
          <p>
            Turn strategy documents into source-grounded investor and donor
            materials.
          </p>
        </div>

        <div className="login-form">
          {status === "error" && message ? (
            <p className="alert error">{message}</p>
          ) : null}

          <a
            className="button primary generate-button"
            href={`/api/auth/microsoft/start?next=${encodeURIComponent(
              nextPath,
            )}`}
          >
            Continue with Microsoft
          </a>

          <div className="login-divider" aria-hidden="true">
            <span>or</span>
          </div>

          <form action="/api/auth/login" className="local-login" method="post">
            <input name="next" type="hidden" value={nextPath} />
            <label className="field">
              <span>Email</span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                autoFocus
                inputMode="email"
                name="email"
                placeholder="you@example.com"
                required
                spellCheck={false}
                type="email"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                name="password"
                required
                type="password"
              />
            </label>
            <label className="checkbox-row login-remember">
              <input autoComplete="off" name="remember" type="checkbox" />
              <span>Remember me</span>
            </label>
            <button className="button generate-button" type="submit">
              Login
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
