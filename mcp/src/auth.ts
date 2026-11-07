import { AuthorizationError, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { deleteUserBoards, handleBoards } from "./boards.js";
import { appPage, authPage, avatar, callout, esc, icon, redirect, relativeTime } from "./ui.js";

export type Env = Cloudflare.Env & { OAUTH_PROVIDER: OAuthHelpers };
type User = { id: number; email: string; is_admin: number };

const SESSION_COOKIE = "sid";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const LINK_TTL_SECONDS = 15 * 60;
const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

const now = () => Math.floor(Date.now() / 1000);
export const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async (value: string) =>
  b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

export function baseUrl(env: Env, request: Request): string {
  return env.PUBLIC_URL ? env.PUBLIC_URL.replace(/\/+$/, "") : new URL(request.url).origin;
}

function safeNext(next: unknown): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function sessionCookie(value: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function currentUser(request: Request, env: Env): Promise<User | null> {
  const sid = readCookie(request, SESSION_COOKIE);
  if (!sid) return null;
  return env.DB.prepare(
    "SELECT u.id, u.email, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  ).bind(await sha256(sid), now()).first<User>();
}

function loginPage(next: string, error = "", status = 200): Response {
  return authPage(
    "Sign in",
    `<form method="post" action="/login" class="stack">
${error ? callout("error", esc(error)) : ""}
<div><label for="email">Email address</label>
<input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required autofocus></div>
<input name="next" type="hidden" value="${esc(next)}">
<button type="submit" class="btn btn-primary btn-block">${icon.mail}Email me a sign-in link</button>
<p class="muted" style="font-size:.875rem;text-align:center">Invite only. Ask the owner for access.</p>
</form>
<script>document.querySelector('[name=next]').value += location.hash</script>`,
    { lead: "We will email you a one-time link. No password needed.", init: { status } },
  );
}

async function login(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  if (request.method !== "POST") return loginPage(safeNext(url.searchParams.get("next")));

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(form.get("next"));
  if (!email.includes("@") || email.length > 254) return loginPage(next, "Enter a valid email address.", 400);

  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const limits = await Promise.all([
    env.LOGIN_LIMITER.limit({ key: `ip:${ip}` }),
    env.LOGIN_LIMITER.limit({ key: `email:${email}` }),
  ]);
  if (limits.some((l) => !l.success)) {
    return loginPage(next, "Too many attempts. Wait a minute, then try again.", 429);
  }

  if (env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.trim().toLowerCase()) {
    await env.DB.prepare("INSERT INTO users (email, is_admin) VALUES (?, 1) ON CONFLICT (email) DO UPDATE SET is_admin = 1")
      .bind(email).run();
  }
  const user = await env.DB.prepare("SELECT id, email, is_admin FROM users WHERE email = ?").bind(email).first<User>();
  if (user) ctx.waitUntil(sendLoginLink(env, baseUrl(env, request), user, next).catch((err) => console.error("login email failed", err)));

  return authPage(
    "Check your email",
    `<p class="muted" style="font-size:.9rem">Open the link on this device, in this browser. Did not get it? Check spam, or <a href="/login?next=${encodeURIComponent(next)}">try again</a>.</p>`,
    { glyph: icon.mail, lead: `If <strong>${esc(email)}</strong> has access, a sign-in link is on its way. It expires in 15 minutes.` },
  );
}

async function sendLoginLink(env: Env, base: string, user: Pick<User, "id" | "email">, next: string, invite = false): Promise<void> {
  const token = randomToken();
  const ttl = invite ? INVITE_TTL_SECONDS : LINK_TTL_SECONDS;
  const expiry = invite ? "7 days" : "15 minutes";
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(now()),
    env.DB.prepare("INSERT INTO login_tokens (token_hash, user_id, next, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256(token), user.id, next, now() + ttl),
  ]);
  const link = `${base}/auth/verify?token=${token}`;
  const intro = invite ? "You are invited to a shared Excalidraw. Sign in here:" : "Sign in to Excalidraw:";
  await env.EMAIL.send({
    to: user.email,
    from: { email: env.MAIL_FROM, name: "Excalidraw" },
    subject: invite ? "You're invited to Excalidraw" : "Your Excalidraw sign-in link",
    text: `${intro}\n\n${link}\n\nThe link expires in ${expiry}. Later, sign in at ${base}/login. If you did not expect this email, ignore it.`,
    html: `<p>${intro}</p><p><a href="${esc(link)}">Sign in</a></p><p>The link expires in ${expiry}. Later, sign in at ${esc(base)}/login. If you did not expect this email, ignore it.</p>`,
  });
}

async function verify(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "POST") {
    const token = url.searchParams.get("token") ?? "";
    return authPage(
      "You're almost in",
      `<form method="post" action="/auth/verify">
<input name="token" type="hidden" value="${esc(token)}">
<button type="submit" class="btn btn-primary btn-block">Continue to Excalidraw</button>
</form>`,
      { glyph: icon.link, lead: "Confirm to finish signing in on this device." },
    );
  }

  const token = String((await request.formData()).get("token") ?? "");
  const row = await env.DB.prepare(
    "DELETE FROM login_tokens WHERE token_hash = ? AND expires_at > ? RETURNING user_id, next",
  ).bind(await sha256(token), now()).first<{ user_id: number; next: string }>();
  if (!row) {
    return authPage("Link expired", `<a class="btn btn-primary btn-block" href="/login">Get a new link</a>`, {
      glyph: icon.alert,
      lead: "This sign-in link was already used or has expired.",
      init: { status: 400 },
    });
  }

  const sid = randomToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now()),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(await sha256(sid), row.user_id, now() + SESSION_TTL_SECONDS),
  ]);
  return redirect(safeNext(row.next), { "Set-Cookie": sessionCookie(sid, SESSION_TTL_SECONDS) });
}

async function logout(request: Request, env: Env): Promise<Response> {
  const sid = readCookie(request, SESSION_COOKIE);
  if (sid) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(sid)).run();
  return redirect("/login", { "Set-Cookie": sessionCookie("", 0) });
}

async function authorize(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);

  try {
    if (request.method !== "POST") {
      const authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      const consent = await env.OAUTH_PROVIDER.describeConsent(authRequest);
      const { handle, headers } = await env.OAUTH_PROVIDER.beginConsent(authRequest);
      const client = consent.clientDomain ? `${consent.clientName} (${consent.clientDomain})` : consent.clientName;
      return authPage(
        "Connect an app",
        `<div class="consent-client"><span class="auth-icon" style="margin:0">${icon.link}</span><div><strong>${esc(client)}</strong><span class="muted" style="font-size:.9rem">wants to draw and read your boards</span></div></div>
<ul class="facts"><li><span class="muted">Signed in as</span><span>${esc(user.email)}</span></li><li><span class="muted">Sends you back to</span><span>${esc(consent.redirectHost)}</span></li></ul>
${consent.redirectIsLoopback ? `<div style="margin-bottom:20px">${callout("warn", "This goes to an app on your computer. Approve only if you just started this connection.")}</div>` : ""}
<form method="post" action="/authorize" class="row">
<input name="handle" type="hidden" value="${esc(handle)}">
<button name="action" value="deny" class="btn grow">Deny</button>
<button name="action" value="approve" class="btn btn-primary grow">Approve</button>
</form>`,
        { lead: "An MCP client asks for access to your Excalidraw.", init: { headers } },
      );
    }

    const form = await request.formData();
    const handle = String(form.get("handle") ?? "");
    if (form.get("action") !== "approve") {
      const denied = await env.OAUTH_PROVIDER.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    const approved = await env.OAUTH_PROVIDER.approveConsent(request, handle);
    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      request: approved.request,
      userId: String(user.id),
      metadata: {},
      scope: approved.request.scope,
      props: { userId: user.id, email: user.email },
    });
    return redirect(redirectTo, approved.headers);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return err.redirectTo
        ? redirect(err.redirectTo)
        : authPage("Authorization failed", `<a class="btn btn-block" href="/boards">Back to boards</a>`, { glyph: icon.alert, lead: esc(err.description), init: { status: 400 } });
    }
    throw err;
  }
}

async function revokeMcpGrants(env: Env, userId: number): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.OAUTH_PROVIDER.listUserGrants(String(userId), { cursor });
    await Promise.all(page.items.map((g) => env.OAUTH_PROVIDER.revokeGrant(g.id, String(userId))));
    cursor = page.cursor;
  } while (cursor);
}

async function adminPage(env: Env, admin: User, notice: { kind: "success" | "error"; text: string } | null = null, status = 200): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.is_admin, u.created_at,
       (SELECT COUNT(*) FROM boards b WHERE b.user_id = u.id) AS boards,
       (SELECT MAX(s.expires_at) FROM sessions s WHERE s.user_id = u.id) AS last_session
     FROM users u ORDER BY u.is_admin DESC, u.created_at`,
  ).all<User & { created_at: number; boards: number; last_session: number | null }>();
  const rows = results.map((u) => {
    const status = u.last_session ? `Last sign-in ${relativeTime(u.last_session - SESSION_TTL_SECONDS)}` : "Invited, not signed in yet";
    const actions = u.id === admin.id ? "" : `<details class="menu"><summary class="btn btn-ghost btn-icon" aria-label="Actions for ${esc(u.email)}">${icon.dots}</summary>
<div class="menu-panel"><form method="post" action="/admin"><input type="hidden" name="action" value="invite"><input type="hidden" name="email" value="${esc(u.email)}"><button class="menu-item">${icon.mail}Resend invite</button></form>
<div class="menu-sep"></div>
<form method="post" action="/admin"><input type="hidden" name="action" value="remove"><input type="hidden" name="id" value="${u.id}"><button class="menu-item danger">${icon.trash}Remove access</button></form>
<div class="menu-label">Deletes their boards and disconnects their apps.</div></div></details>`;
    return `<li>${avatar(u.email)}<div class="who"><div class="email">${esc(u.email)}${u.is_admin ? '<span class="badge badge-primary">Admin</span>' : ""}${u.id === admin.id ? '<span class="badge">You</span>' : ""}</div>
<div class="card-meta">${status}</div></div>
<span class="stat">${u.boards} board${u.boards === 1 ? "" : "s"}</span><span class="stat">Joined ${relativeTime(u.created_at)}</span>${actions}</li>`;
  }).join("");
  return appPage(
    "Users",
    `<div class="page-head"><div><h1>Users</h1><p class="muted">${results.length} ${results.length === 1 ? "person has" : "people have"} access. Invite friends by email.</p></div></div>
${notice ? `<div style="margin-bottom:20px">${callout(notice.kind, esc(notice.text))}</div>` : ""}
<form method="post" action="/admin" class="panel panel-pad">
<input type="hidden" name="action" value="invite">
<label for="email">Invite by email</label>
<div class="row"><input id="email" name="email" type="email" placeholder="friend@example.com" required class="grow">
<button type="submit" class="btn btn-primary">${icon.mail}<span class="hide-sm">Send invite</span></button></div>
<p class="muted" style="font-size:.85rem;margin-top:10px">They get a sign-in link that works for 7 days.</p>
</form>
<h2 class="section-title">People</h2>
<ul class="list panel">${rows}</ul>`,
    admin,
    "users",
    { status },
  );
}

async function adminHandler(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return redirect(`/login?next=${encodeURIComponent(url.pathname)}`);
  if (!user.is_admin) {
    return appPage("Not allowed", `<div class="empty">${icon.alert}<h2>Admins only</h2><p>Ask the owner if you need to manage users.</p><p style="margin-top:16px"><a class="btn" href="/boards">Back to boards</a></p></div>`, user, null, { status: 403 });
  }
  if (request.method !== "POST") return adminPage(env, user);

  if (request.headers.get("Origin") !== new URL(baseUrl(env, request)).origin) {
    return adminPage(env, user, { kind: "error", text: "Request blocked: it came from another site." }, 403);
  }
  const form = await request.formData();

  if (form.get("action") === "remove") {
    const id = Number(form.get("id"));
    if (!Number.isInteger(id) || id === user.id) return adminPage(env, user, { kind: "error", text: "You cannot remove that user." }, 400);
    await deleteUserBoards(env, id);
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    await revokeMcpGrants(env, id);
    return redirect("/admin");
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@") || email.length > 254) return adminPage(env, user, { kind: "error", text: "Enter a valid email address." }, 400);
  const invited = await env.DB.prepare(
    "INSERT INTO users (email) VALUES (?) ON CONFLICT (email) DO UPDATE SET email = excluded.email RETURNING id, email",
  ).bind(email).first<Pick<User, "id" | "email">>();
  try {
    await sendLoginLink(env, baseUrl(env, request), invited!, "/", true);
  } catch (err) {
    console.error("invite email failed", err);
    return adminPage(env, user, { kind: "error", text: `Added ${email}, but the invite email failed: ${(err as Error).message}` }, 502);
  }
  return adminPage(env, user, { kind: "success", text: `Invite sent to ${email}.` });
}

export async function handleApp(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  switch (url.pathname) {
    case "/login": return login(request, env, ctx, url);
    case "/auth/verify": return verify(request, env, url);
    case "/logout": return logout(request, env);
    case "/authorize": return authorize(request, env, url);
    case "/admin": return adminHandler(request, env, url);
    case "/api/me": {
      const user = await currentUser(request, env);
      return user
        ? Response.json({ email: user.email, isAdmin: !!user.is_admin }, { headers: { "Cache-Control": "no-store" } })
        : Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  if (url.pathname === "/boards" || url.pathname.startsWith("/b/") || url.pathname.startsWith("/api/boards/")) {
    return handleBoards(request, env, url);
  }

  // ponytail: only HTML is gated; JS/CSS/fonts are public open-source bundles. Gate them too if the build ever embeds secrets.
  if (/\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith(".html")) return env.ASSETS.fetch(request);

  if (!(await currentUser(request, env))) {
    return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return env.ASSETS.fetch(request);
}
