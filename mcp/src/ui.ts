export type Viewer = { email: string; is_admin: number };
type Section = "boards" | "users";

export const esc = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function redirect(location: string, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("Location", location);
  return new Response(null, { status: 302, headers: h });
}

export function relativeTime(unixSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return "just now";
  const units: [number, string][] = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [size, name] of units) {
    const n = Math.floor(diff / size);
    if (n >= 1) return `${n} ${name}${n > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icon = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  dots: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  board: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l3-3 3 3 4-4"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6"/>'),
  pencil: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  logout: svg('<path d="M14 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3"/><path d="M9 12h12l-3-3M18 15l3-3"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  alert: svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  check: svg('<path d="M5 12l5 5L20 7"/>'),
};

const CSS = `
@font-face{font-family:Excalifont;src:url(/fonts/Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2) format("woff2");font-display:swap}
@font-face{font-family:Assistant;src:url(/Assistant-Regular.woff2) format("woff2");font-display:swap}
:root{--bg:#f6f6f9;--surface:#fff;--surface-low:#ececf4;--surface-hover:#f1f0ff;--text:#1b1b1f;--muted:#6c6c78;--border:#e4e4ec;--primary:#6965db;--primary-hover:#5753d0;--primary-text:#fff;--primary-light:#e3e2fe;--danger:#d63c3c;--danger-light:#fdeaea;--success-light:#e6f7ec;--success:#2b8a3e;--warn-light:#fff4e5;--warn:#b35c00;--shadow:0 0 1px rgba(0,0,0,.17),0 0 3px rgba(0,0,0,.08),0 7px 14px rgba(0,0,0,.05);--shadow-lift:0 0 1px rgba(0,0,0,.17),0 2px 6px rgba(0,0,0,.08),0 14px 28px rgba(0,0,0,.08);--thumb-bg:#fff;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--surface:#232329;--surface-low:#2e2d39;--surface-hover:#31303b;--text:#e3e3e8;--muted:#a1a1ab;--border:#34343e;--primary:#a8a5ff;--primary-hover:#bbb8ff;--primary-text:#121212;--primary-light:#3b3a5c;--danger:#ff8383;--danger-light:#3d2224;--success-light:#1f3326;--success:#7bd88f;--warn-light:#3a2c17;--warn:#ffc078;--shadow:0 0 1px rgba(0,0,0,.6),0 7px 14px rgba(0,0,0,.35);--shadow-lift:0 0 1px rgba(0,0,0,.6),0 14px 28px rgba(0,0,0,.45);--thumb-bg:#121212;color-scheme:dark}.thumb img{filter:invert(93%) hue-rotate(180deg)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 Assistant,system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh}
a{color:var(--primary);text-decoration:none}a:hover{text-decoration:underline}
h1,h2{font-family:Excalifont,Assistant,system-ui,sans-serif;font-weight:400;letter-spacing:.01em;margin:0}
h1{font-size:2rem;line-height:1.2}h2{font-size:1.35rem}
p{margin:0}
.muted{color:var(--muted)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:8px;border:1px solid transparent;background:var(--surface-low);color:var(--text);font:inherit;font-size:.95rem;cursor:pointer;white-space:nowrap;text-decoration:none;transition:background .15s,box-shadow .15s,transform .1s}
.btn:hover{background:var(--surface-hover);text-decoration:none}.btn:active{transform:translateY(1px)}
.btn:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.btn-primary{background:var(--primary);color:var(--primary-text)}.btn-primary:hover{background:var(--primary-hover)}
.btn-ghost{background:transparent}.btn-ghost:hover{background:var(--surface-low)}
.btn-danger{background:var(--danger-light);color:var(--danger)}.btn-danger:hover{background:var(--danger);color:#fff}
.btn-block{width:100%}.btn-icon{width:36px;height:36px;padding:0}
input[type=email],input[type=text]{width:100%;height:42px;padding:0 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit}
input::placeholder{color:var(--muted)}
label{display:block;font-size:.875rem;color:var(--muted);margin-bottom:6px}
.stack{display:grid;gap:16px}.row{display:flex;gap:12px;align-items:center}.row-end{justify-content:flex-end}.grow{flex:1;min-width:0}
.callout{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:10px;font-size:.95rem}
.callout svg{flex:none;margin-top:1px}
.callout-success{background:var(--success-light);color:var(--success)}.callout-error{background:var(--danger-light);color:var(--danger)}.callout-warn{background:var(--warn-light);color:var(--warn)}
.auth{min-height:100vh;display:grid;place-items:center;padding:24px 16px}
.auth-card{width:100%;max-width:420px;background:var(--surface);border-radius:16px;box-shadow:var(--shadow);padding:36px 32px}
.auth-card .brand{margin-bottom:28px}
.auth-icon{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;background:var(--primary-light);color:var(--primary);margin-bottom:16px}
.auth-icon svg{width:26px;height:26px}
.auth-card h1{margin-bottom:8px}.auth-card .lead{color:var(--muted);margin-bottom:24px}
.brand{display:inline-flex;align-items:center;gap:10px;color:var(--text);font-family:Excalifont,system-ui,sans-serif;font-size:1.35rem}
.brand:hover{text-decoration:none}.brand img{width:30px;height:30px}
.topbar{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.topbar-inner{max-width:1180px;margin:0 auto;height:64px;padding:0 24px;display:flex;align-items:center;gap:20px}
.nav{display:flex;gap:4px}
.nav a{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:8px;color:var(--muted)}
.nav a:hover{background:var(--surface-low);color:var(--text);text-decoration:none}
.nav a[aria-current=page]{background:var(--primary-light);color:var(--primary)}
.spacer{flex:1}
.container{max-width:1180px;margin:0 auto;padding:32px 24px 64px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:28px;flex-wrap:wrap}
.page-head p{margin-top:4px}
.menu{position:relative}
.menu>summary{list-style:none;cursor:pointer}.menu>summary::-webkit-details-marker{display:none}
.menu-panel{position:absolute;right:0;top:calc(100% + 6px);min-width:240px;background:var(--surface);border-radius:12px;box-shadow:var(--shadow-lift);padding:8px;z-index:20;display:grid;gap:4px}
.menu-panel form{margin:0}
.menu-item{display:flex;align-items:center;gap:10px;width:100%;height:36px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--text);font:inherit;font-size:.95rem;cursor:pointer;text-align:left}
.menu-item:hover{background:var(--surface-hover);text-decoration:none}
.menu-item.danger{color:var(--danger)}.menu-item.danger:hover{background:var(--danger-light)}
.menu-label{padding:6px 10px 2px;font-size:.8rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis}
.menu-sep{height:1px;background:var(--border);margin:4px 2px}
.avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:.95rem;color:#fff;flex:none;user-select:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}
.card{position:relative;background:var(--surface);border-radius:14px;box-shadow:var(--shadow);transition:box-shadow .15s,transform .15s}
.card:hover{box-shadow:var(--shadow-lift);transform:translateY(-2px)}
.card:focus-within{z-index:5}
.thumb{display:grid;place-items:center;aspect-ratio:16/10;background:var(--thumb-bg);border-radius:14px 14px 0 0;overflow:hidden;border-bottom:1px solid var(--border);position:relative;color:var(--muted)}
.thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:12px}
.thumb-empty{display:grid;justify-items:center;gap:6px;font-size:.8rem}.thumb-empty svg{width:32px;height:32px;opacity:.5}
.card-body{display:flex;align-items:center;gap:8px;padding:12px 10px 12px 16px}
.card-title{display:block;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-title:hover{text-decoration:none;color:var(--primary)}
.card-meta{font-size:.85rem;color:var(--muted)}
.card-new{display:grid;place-items:center;align-content:center;gap:10px;min-height:100%;aspect-ratio:auto;border:2px dashed var(--border);background:transparent;box-shadow:none;color:var(--muted);font:inherit;cursor:pointer;border-radius:14px;width:100%;padding:24px}
.card-new:hover{border-color:var(--primary);color:var(--primary);background:var(--surface-hover);transform:none;box-shadow:none}
.card-new .plus{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--primary-light);color:var(--primary)}
.new-form{margin:0;display:flex}
.rename{display:grid;gap:8px;padding:6px 6px 4px}
.empty{text-align:center;padding:56px 16px;color:var(--muted)}
.empty h2{color:var(--text);margin:12px 0 6px}
.panel{background:var(--surface);border-radius:14px;box-shadow:var(--shadow)}
.panel-pad{padding:20px}
.list{list-style:none;margin:0;padding:0}
.list li{display:flex;align-items:center;gap:14px;padding:14px 20px;border-top:1px solid var(--border)}
.list li:first-child{border-top:0}
.who{min-width:0;flex:1}.who .email{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.badge{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:11px;font-size:.75rem;background:var(--surface-low);color:var(--muted);margin-left:8px;vertical-align:middle;font-weight:400}
.badge-primary{background:var(--primary-light);color:var(--primary)}
.stat{font-size:.85rem;color:var(--muted);white-space:nowrap}
.section-title{margin:32px 0 12px}
.consent-client{display:flex;align-items:center;gap:14px;padding:16px;border-radius:12px;background:var(--surface-low);margin-bottom:16px}
.consent-client strong{display:block;word-break:break-word}
.facts{list-style:none;padding:0;margin:0 0 20px;display:grid;gap:10px;font-size:.95rem}
.facts li{display:flex;justify-content:space-between;gap:12px}.facts span:last-child{font-weight:600;text-align:right;word-break:break-all}
@media (max-width:640px){.topbar-inner{padding:0 16px;gap:10px}.brand span{display:none}.nav a span{display:none}.container{padding:24px 16px 48px}h1{font-size:1.7rem}.auth-card{padding:28px 20px}.stat{display:none}.hide-sm{display:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const AVATAR_COLORS = ["#6965db", "#e8590c", "#2f9e44", "#1971c2", "#c2255c", "#9c36b5", "#0c8599", "#f08c00"];

export function avatar(email: string): string {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="avatar" style="background:${AVATAR_COLORS[hash % AVATAR_COLORS.length]}">${esc(email[0]?.toUpperCase() ?? "?")}</span>`;
}

export function callout(kind: "success" | "error" | "warn", text: string): string {
  const glyph = kind === "success" ? icon.check : icon.alert;
  return `<div class="callout callout-${kind}" role="${kind === "error" ? "alert" : "status"}">${glyph}<span>${text}</span></div>`;
}

const brand = (href: string) => `<a class="brand" href="${href}"><img src="/favicon.svg" alt=""><span>Excalidraw</span></a>`;

function htmlResponse(title: string, body: string, init: ResponseInit): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Excalidraw</title><link rel="icon" href="/favicon.svg"><style>${CSS}</style></head><body>${body}</body></html>`,
    { ...init, headers },
  );
}

export function authPage(
  title: string,
  content: string,
  opts: { lead?: string; glyph?: string; init?: ResponseInit } = {},
): Response {
  return htmlResponse(
    title,
    `<main class="auth"><div class="auth-card">${brand("/")}
${opts.glyph ? `<div class="auth-icon">${opts.glyph}</div>` : ""}
<h1>${esc(title)}</h1>${opts.lead ? `<p class="lead">${opts.lead}</p>` : `<div style="height:16px"></div>`}
${content}</div></main>`,
    opts.init ?? {},
  );
}

export function appPage(
  title: string,
  content: string,
  viewer: Viewer,
  section: Section | null,
  init: ResponseInit = {},
): Response {
  const navLink = (href: string, key: Section, label: string, glyph: string) =>
    `<a href="${href}"${section === key ? ' aria-current="page"' : ""}>${glyph}<span>${label}</span></a>`;
  return htmlResponse(
    title,
    `<header class="topbar"><div class="topbar-inner">
${brand("/boards")}
<nav class="nav" aria-label="Main">${navLink("/boards", "boards", "Boards", icon.board)}${viewer.is_admin ? navLink("/admin", "users", "Users", icon.users) : ""}</nav>
<div class="spacer"></div>
<a class="btn btn-ghost hide-sm" href="/">${icon.pencil}Local canvas</a>
<details class="menu"><summary aria-label="Account">${avatar(viewer.email)}</summary>
<div class="menu-panel"><div class="menu-label">Signed in as</div><div class="menu-label" style="color:var(--text);padding-top:0">${esc(viewer.email)}</div>
<div class="menu-sep"></div>
<a class="menu-item" href="/">${icon.pencil}Local canvas</a>
<a class="menu-item" href="/logout">${icon.logout}Sign out</a></div></details>
</div></header>
<main class="container">${content}</main>`,
    init,
  );
}
