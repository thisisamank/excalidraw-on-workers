import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import html from "../dist/mcp-app.html";
import { baseUrl, handleApp, type Env } from "./auth.js";
import { mcpBoardStore } from "./boards.js";
import { KvCheckpointStore } from "./checkpoint-store.js";
import { registerTools } from "./server.js";

async function handleMcp(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const { userId } = ctx.props as { userId: number };
  const base = baseUrl(env, request);
  const server = new McpServer({ name: "Excalidraw", version: "1.0.0" });
  registerTools(server, async () => html, new KvCheckpointStore(env.CHECKPOINTS), base, mcpBoardStore(env, userId, base));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

const providers = new Map<string, OAuthProvider<Env>>();

function providerFor(base: string): OAuthProvider<Env> {
  let provider = providers.get(base);
  if (!provider) {
    provider = new OAuthProvider<Env>({
      apiRoute: "/mcp",
      apiHandler: { fetch: handleMcp },
      defaultHandler: { fetch: handleApp },
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/token",
      clientRegistrationEndpoint: "/register",
      resourceMetadata: { resource: `${base}/mcp`, resource_name: "Excalidraw" },
    });
    providers.set(base, provider);
  }
  return provider;
}

export default {
  fetch(request, env, ctx) {
    return providerFor(baseUrl(env, request)).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
