import { b64url, baseUrl, currentUser, type Env } from "./auth.js";
import { appPage, esc, icon, redirect, relativeTime, type Viewer } from "./ui.js";
import type { BoardStore } from "./server.js";

const MAX_SCENE_BYTES = 50 * 1024 * 1024;
const MAX_THUMB_BYTES = 1024 * 1024;
const PSEUDO_ELEMENTS = new Set(["cameraUpdate", "restoreCheckpoint", "delete"]);
const EXCALIFONT = 5;

type BoardRow = { id: string; name: string; updated_at: number };

const newBoardId = () => b64url(crypto.getRandomValues(new Uint8Array(9)));
const sceneKey = (id: string) => `boards/${id}.json`;
const thumbKey = (id: string) => `thumbs/${id}.png`;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function scene(elements: any[], previous?: { appState?: unknown; files?: unknown }): string {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "excalidraw-on-workers",
    elements: elements
      .filter((el) => !PSEUDO_ELEMENTS.has(el?.type))
      .map((el) => (el.type === "text" && el.fontFamily == null ? { ...el, fontFamily: EXCALIFONT } : el)),
    appState: previous?.appState ?? { viewBackgroundColor: "#ffffff" },
    files: previous?.files ?? {},
  });
}

async function ownedBoard(env: Env, userId: number, id: string): Promise<BoardRow | null> {
  return env.DB.prepare("SELECT id, name, updated_at FROM boards WHERE id = ? AND user_id = ?")
    .bind(id, userId).first<BoardRow>();
}

async function createBoard(env: Env, userId: number, name: string, body = scene([])): Promise<string> {
  const id = newBoardId();
  await env.BOARDS.put(sceneKey(id), body, { httpMetadata: { contentType: "application/json" } });
  await env.DB.prepare("INSERT INTO boards (id, user_id, name) VALUES (?, ?, ?)").bind(id, userId, name.slice(0, 200)).run();
  return id;
}

async function writeScene(env: Env, id: string, body: string): Promise<void> {
  await env.BOARDS.put(sceneKey(id), body, { httpMetadata: { contentType: "application/json" } });
  await env.DB.prepare("UPDATE boards SET updated_at = unixepoch() WHERE id = ?").bind(id).run();
}

async function readScene(env: Env, id: string): Promise<any | null> {
  const obj = await env.BOARDS.get(sceneKey(id));
  return obj ? obj.json() : null;
}

export async function deleteUserBoards(env: Env, userId: number): Promise<void> {
  const { results } = await env.DB.prepare("SELECT id FROM boards WHERE user_id = ?").bind(userId).all<{ id: string }>();
  if (results.length) await env.BOARDS.delete(results.flatMap((b) => [sceneKey(b.id), thumbKey(b.id)]));
}

export function mcpBoardStore(env: Env, userId: number, base: string): BoardStore {
  const url = (id: string) => `${base}/b/${id}`;
  return {
    async create(name, elements) {
      const id = await createBoard(env, userId, name, scene(elements));
      return { id, url: url(id) };
    },
    async update(id, elements) {
      if (!(await ownedBoard(env, userId, id))) return null;
      await writeScene(env, id, scene(elements, (await readScene(env, id)) ?? undefined));
      return { id, url: url(id) };
    },
    async load(id) {
      if (!(await ownedBoard(env, userId, id))) return null;
      return (await readScene(env, id))?.elements ?? [];
    },
    async list() {
      const { results } = await env.DB.prepare("SELECT id, name, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100")
        .bind(userId).all<BoardRow>();
      return results.map((b) => ({ id: b.id, name: b.name, url: url(b.id), updatedAt: new Date(b.updated_at * 1000).toISOString() }));
    },
  };
}

function boardCard(b: BoardRow): string {
  const id = esc(b.id);
  return `<article class="card">
<a class="thumb" href="/b/${id}" aria-label="Open ${esc(b.name)}"><span class="thumb-empty">${icon.board}<span>No preview yet</span></span><img src="/api/boards/${id}/thumb?v=${b.updated_at}" alt="" loading="lazy" onerror="this.remove()"></a>
<div class="card-body"><div class="grow"><a class="card-title" href="/b/${id}">${esc(b.name)}</a><div class="card-meta">Edited ${relativeTime(b.updated_at)}</div></div>
<details class="menu"><summary class="btn btn-ghost btn-icon" aria-label="Actions for ${esc(b.name)}">${icon.dots}</summary>
<div class="menu-panel">
<form method="post" action="/boards" class="rename"><input type="hidden" name="action" value="rename"><input type="hidden" name="id" value="${id}">
<label for="n-${id}" style="margin:0">Rename</label><input id="n-${id}" type="text" name="name" value="${esc(b.name)}" required maxlength="200">
<button class="btn btn-primary">${icon.pencil}Save name</button></form>
<div class="menu-sep"></div>
<form method="post" action="/boards"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="${id}"><button class="menu-item danger">${icon.trash}Delete board</button></form>
</div></details></div></article>`;
}

function boardsPage(boards: BoardRow[], viewer: Viewer): Response {
  const newCard = `<form method="post" action="/boards" class="new-form"><input type="hidden" name="action" value="create">
<button class="card-new"><span class="plus">${icon.plus}</span><span>New board</span></button></form>`;
  const body = boards.length
    ? `<div class="grid">${newCard}${boards.map(boardCard).join("")}</div>`
    : `<div class="panel empty"><div class="auth-icon" style="margin:0 auto">${icon.board}</div><h2>No boards yet</h2>
<p>Start a board here, or ask Claude to draw a diagram. Each new diagram gets its own board.</p>
<form method="post" action="/boards" style="margin-top:20px"><input type="hidden" name="action" value="create"><button class="btn btn-primary">${icon.plus}New board</button></form></div>`;
  return appPage(
    "Boards",
    `<div class="page-head"><div><h1>Boards</h1><p class="muted">${boards.length ? `${boards.length} board${boards.length === 1 ? "" : "s"}, saved to your account.` : "Saved to your account, on every device."}</p></div>
</div>
${body}`,
    viewer,
    "boards",
  );
}

export async function handleBoards(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await currentUser(request, env);
  const thumbMatch = url.pathname.match(/^\/api\/boards\/([A-Za-z0-9_-]{6,64})\/thumb$/);
  if (thumbMatch) {
    if (!user) return json({ error: "unauthorized" }, 401);
    if (!(await ownedBoard(env, user.id, thumbMatch[1]))) return json({ error: "not found" }, 404);
    if (request.method === "PUT") {
      const body = await request.arrayBuffer();
      const isPng = new Uint8Array(body.slice(0, 4)).join() === "137,80,78,71";
      if (!isPng || body.byteLength > MAX_THUMB_BYTES) return json({ error: "invalid thumbnail" }, 400);
      await env.BOARDS.put(thumbKey(thumbMatch[1]), body, { httpMetadata: { contentType: "image/png" } });
      return json({ ok: true });
    }
    const obj = await env.BOARDS.get(thumbKey(thumbMatch[1]));
    if (!obj) return new Response(null, { status: 404 });
    return new Response(obj.body, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000", "X-Content-Type-Options": "nosniff" } });
  }

  const apiMatch = url.pathname.match(/^\/api\/boards\/([A-Za-z0-9_-]{6,64})$/);

  if (apiMatch) {
    if (!user) return json({ error: "unauthorized" }, 401);
    const board = await ownedBoard(env, user.id, apiMatch[1]);
    if (!board) return json({ error: "not found" }, 404);
    if (request.method === "GET") {
      const obj = await env.BOARDS.get(sceneKey(board.id));
      return obj
        ? new Response(obj.body, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
        : json(JSON.parse(scene([])));
    }
    if (request.method === "PUT") {
      const body = await request.text();
      if (body.length > MAX_SCENE_BYTES) return json({ error: "board too large" }, 413);
      try {
        if (!Array.isArray(JSON.parse(body).elements)) throw new Error();
      } catch {
        return json({ error: "invalid scene" }, 400);
      }
      await writeScene(env, board.id, body);
      return json({ ok: true });
    }
    return json({ error: "method not allowed" }, 405);
  }

  if (!user) return redirect(`/login?next=${encodeURIComponent(url.pathname)}`);

  const boardMatch = url.pathname.match(/^\/b\/([A-Za-z0-9_-]{6,64})$/);
  if (boardMatch) {
    if (!(await ownedBoard(env, user.id, boardMatch[1]))) {
      return appPage("Board not found", `<div class="panel empty">${icon.alert}<h2>Board not found</h2><p>It was deleted, or it belongs to someone else.</p><p style="margin-top:16px"><a class="btn btn-primary" href="/boards">All boards</a></p></div>`, user, "boards", { status: 404 });
    }
    return env.ASSETS.fetch(new Request(new URL("/", url), request));
  }

  if (url.pathname !== "/boards") return redirect("/boards");

  if (request.method === "POST") {
    if (request.headers.get("Origin") !== new URL(baseUrl(env, request)).origin) {
      return json({ error: "cross-origin request blocked" }, 403);
    }
    const form = await request.formData();
    const action = form.get("action");
    const name = String(form.get("name") ?? "").trim();
    if (action === "create") {
      return redirect(`/b/${await createBoard(env, user.id, name || "Untitled board")}`);
    }
    const id = String(form.get("id") ?? "");
    if (await ownedBoard(env, user.id, id)) {
      if (action === "rename" && name) {
        await env.DB.prepare("UPDATE boards SET name = ? WHERE id = ?").bind(name.slice(0, 200), id).run();
      } else if (action === "delete") {
        await env.DB.prepare("DELETE FROM boards WHERE id = ?").bind(id).run();
        await env.BOARDS.delete([sceneKey(id), thumbKey(id)]);
      }
    }
    return redirect("/boards");
  }

  const { results } = await env.DB.prepare("SELECT id, name, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC")
    .bind(user.id).all<BoardRow>();
  return boardsPage(results, user);
}
