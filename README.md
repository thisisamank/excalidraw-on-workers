# Excalidraw on Workers

This fork runs the Excalidraw app and the [Excalidraw MCP server](https://github.com/excalidraw/excalidraw-mcp) as one Cloudflare Worker. It adds invite-only sign-in, saved boards and an admin dashboard. The original Excalidraw README follows below this section.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/thisisamank/excalidraw-on-workers)

## What this fork adds

- **One Worker for everything.** The Worker serves the Excalidraw app as static assets and the MCP server at `/mcp`, on one domain.
- **Invite-only sign-in.** Users sign in with a one-time link sent by email (Cloudflare Email Sending). There are no passwords. Only emails in the D1 `users` table can sign in. The app's pages need a session.
- **Admin dashboard.** Admins open `/admin` to invite users by email, resend invites and remove users. Removing a user deletes their sessions and boards and disconnects their MCP clients.
- **Boards.** `/boards` lists your boards with thumbnails. Each board opens at `/b/<id>` in the normal editor and saves to your account (D1 and R2), so it is on every device. The local canvas at `/` stays as it was, in browser storage.
- **Built-in MCP server.** MCP clients such as Claude connect to `/mcp` with OAuth and a consent page. Each new diagram gets its own board. Pass `boardId` to draw on an existing board, and use the `list_boards` tool to find one. Edits that you make in the chat preview save back to the board.
- **Excalidraw-style pages.** The sign-in, boards, admin and consent pages use Excalidraw's fonts and colors, support dark mode and work at phone width.
- **App menu links.** The main menu has *All boards*, *Users* (admins only) and *Sign out*.

## Deploy

### Prerequisites

- A Cloudflare account.
- A domain on that account with [Email Sending](https://developers.cloudflare.com/email-service/) enabled. Sign-in emails come from this domain. Without it, nobody can sign in.

### One click

1. Click **Deploy to Cloudflare** above.
2. Fill in the form:
   - `MAIL_FROM`: the sender address, for example `login@yourdomain.com`.
   - `ADMIN_EMAIL`: your email address. It becomes the first admin when it signs in.
   - `PUBLIC_URL` (optional): your custom domain, for example `https://draw.example.com`. Leave it empty to use the Worker URL.
3. Deploy. Cloudflare creates the D1 database, KV namespaces and R2 bucket, runs the migrations and deploys the Worker.
4. Open the Worker URL, sign in with `ADMIN_EMAIL`, then invite people from `/admin`.

The build installs both the app (Yarn) and the MCP server (pnpm), so the first deploy takes a few minutes. The `deploy` script builds everything, so you can leave the build command empty.

### From your machine

```bash
yarn install
npx wrangler secret put MAIL_FROM
npx wrangler secret put ADMIN_EMAIL
yarn deploy
```

To add a custom domain, add a `routes` entry with `"custom_domain": true` to `wrangler.jsonc`, and set `PUBLIC_URL` to the same URL.

### Local development

```bash
cp .dev.vars.example .dev.vars   # then edit the values
yarn dev:workers
```

Local sign-in emails are not sent. Wrangler writes them to `.wrangler/tmp/email/`.

## Connect an MCP client

Add `https://<your-domain>/mcp` as a custom connector (Claude.ai, Claude Desktop), or run:

```bash
claude mcp add --transport http excalidraw https://<your-domain>/mcp
```

The client opens your sign-in page, then a consent page. Approve it to connect.

## Repository layout

| Path | Contents |
| --- | --- |
| `excalidraw-app/` | The Excalidraw app, with board load and save (`data/board.ts`) and the menu links |
| `mcp/` | The MCP server, plus the Worker code: `src/worker.ts`, `src/auth.ts`, `src/boards.ts`, `src/ui.ts` |
| `mcp/migrations/` | D1 schema for users, sessions, sign-in links and boards |
| `wrangler.jsonc` | Worker configuration: assets, D1, KV, R2, Email and rate limiting |

## Known limits

- When the same board is open in two places, the last save wins. An open tab does not show changes from the MCP server until you reload it.
- A board gets its thumbnail the first time it is edited in the editor. Boards that the MCP server creates show "No preview yet" until then.
- Live collaboration and "Export to excalidraw.com" still use Excalidraw's own servers.
- Images are stored inside the board file, up to 50 MB for each board.

---

<a href="https://excalidraw.com/" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" alt="Excalidraw" srcset="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2_dark.png" />
    <img alt="Excalidraw" src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2.png" />
  </picture>
</a>

<h4 align="center">
  <a href="https://excalidraw.com">Excalidraw Editor</a> |
  <a href="https://plus.excalidraw.com/blog">Blog</a> |
  <a href="https://docs.excalidraw.com">Documentation</a> |
  <a href="https://plus.excalidraw.com">Excalidraw+</a>
</h4>

<div align="center">
  <h2>
    An open source virtual hand-drawn style whiteboard. </br>
    Collaborative and end-to-end encrypted. </br>
  <br />
  </h2>
</div>

<br />
<p align="center">
  <a href="https://github.com/excalidraw/excalidraw/blob/master/LICENSE">
    <img alt="Excalidraw is released under the MIT license." src="https://img.shields.io/badge/license-MIT-blue.svg"  /></a>
  <a href="https://www.npmjs.com/package/@excalidraw/excalidraw">
    <img alt="npm downloads/month" src="https://img.shields.io/npm/dm/@excalidraw/excalidraw"  /></a>
  <a href="https://docs.excalidraw.com/docs/introduction/contributing">
    <img alt="PRs welcome!" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat"  /></a>
  <a href="https://discord.gg/UexuTaE">
    <img alt="Chat on Discord" src="https://img.shields.io/discord/723672430744174682?color=738ad6&label=Chat%20on%20Discord&logo=discord&logoColor=ffffff&widget=false"/></a>
  <a href="https://deepwiki.com/excalidraw/excalidraw">
    <img alt="Ask DeepWiki" src="https://deepwiki.com/badge.svg" /></a>
  <a href="https://twitter.com/excalidraw">
    <img alt="Follow Excalidraw on Twitter" src="https://img.shields.io/twitter/follow/excalidraw.svg?label=follow+@excalidraw&style=social&logo=twitter"/></a>
</p>

<div align="center">
  <figure>
    <a href="https://excalidraw.com" target="_blank" rel="noopener">
      <img src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github%2Fproduct_showcase.png" alt="Product showcase" />
    </a>
    <figcaption>
      <p align="center">
        Create beautiful hand-drawn like diagrams, wireframes, or whatever you like.
      </p>
    </figcaption>
  </figure>
</div>

## Features

The Excalidraw editor (npm package) supports:

- 💯&nbsp;Free & open-source.
- 🎨&nbsp;Infinite, canvas-based whiteboard.
- ✍️&nbsp;Hand-drawn like style.
- 🌓&nbsp;Dark mode.
- 🏗️&nbsp;Customizable.
- 📷&nbsp;Image support.
- 😀&nbsp;Shape libraries support.
- 🌐&nbsp;Localization (i18n) support.
- 🖼️&nbsp;Export to PNG, SVG & clipboard.
- 💾&nbsp;Open format - export drawings as an `.excalidraw` json file.
- ⚒️&nbsp;Wide range of tools - rectangle, circle, diamond, arrow, line, free-draw, eraser...
- ➡️&nbsp;Arrow-binding & labeled arrows.
- 🔙&nbsp;Undo / Redo.
- 🔍&nbsp;Zoom and panning support.

## Excalidraw.com

The app hosted at [excalidraw.com](https://excalidraw.com) is a minimal showcase of what you can build with Excalidraw. Its [source code](https://github.com/excalidraw/excalidraw/tree/master/excalidraw-app) is part of this repository as well, and the app features:

- 📡&nbsp;PWA support (works offline).
- 🤼&nbsp;Real-time collaboration.
- 🔒&nbsp;End-to-end encryption.
- 💾&nbsp;Local-first support (autosaves to the browser).
- 🔗&nbsp;Shareable links (export to a readonly link you can share with others).

We'll be adding these features as drop-in plugins for the npm package in the future.

## Quick start

**Note:** following instructions are for installing the Excalidraw [npm package](https://www.npmjs.com/package/@excalidraw/excalidraw) when integrating Excalidraw into your own app. To run the repository locally for development, please refer to our [Development Guide](https://docs.excalidraw.com/docs/introduction/development).

Use `npm` or `yarn` to install the package.

```bash
npm install react react-dom @excalidraw/excalidraw
# or
yarn add react react-dom @excalidraw/excalidraw
```

Check out our [documentation](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation) for more details!

## Contributing

- Missing something or found a bug? [Report here](https://github.com/excalidraw/excalidraw/issues).
- Want to contribute? Check out our [contribution guide](https://docs.excalidraw.com/docs/introduction/contributing) or let us know on [Discord](https://discord.gg/UexuTaE).
- Want to help with translations? See the [translation guide](https://docs.excalidraw.com/docs/introduction/contributing#translating).

## Integrations

- [VScode extension](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor)
- [npm package](https://www.npmjs.com/package/@excalidraw/excalidraw)

## Who's integrating Excalidraw

[Google Cloud](https://googlecloudcheatsheet.withgoogle.com/architecture) • [Meta](https://meta.com/) • [CodeSandbox](https://codesandbox.io/) • [Obsidian Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) • [Replit](https://replit.com/) • [Slite](https://slite.com/) • [Notion](https://notion.so/) • [HackerRank](https://www.hackerrank.com/) • and many others

## Sponsors & support

If you like the project, you can become a sponsor at [Open Collective](https://opencollective.com/excalidraw) or use [Excalidraw+](https://plus.excalidraw.com/).

## Thank you for supporting Excalidraw

[<img src="https://opencollective.com/excalidraw/tiers/sponsors/0/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/0/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/1/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/1/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/2/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/2/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/3/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/3/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/4/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/4/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/5/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/5/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/6/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/6/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/7/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/7/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/8/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/8/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/9/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/9/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/10/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/10/website)

<a href="https://opencollective.com/excalidraw#category-CONTRIBUTE" target="_blank"><img src="https://opencollective.com/excalidraw/tiers/backers.svg?avatarHeight=32"/></a>

Last but not least, we're thankful to these companies for offering their services for free:

[![Vercel](./.github/assets/vercel.svg)](https://vercel.com) [![Sentry](./.github/assets/sentry.svg)](https://sentry.io) [![Crowdin](./.github/assets/crowdin.svg)](https://crowdin.com)
