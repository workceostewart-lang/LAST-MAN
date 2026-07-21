import { DurableObject } from 'cloudflare:workers';

import { DurableLobbyStore } from './durable-store.js';
import { LobbyError, LobbyService, normalizeLobbyCode } from './lobby.js';

const JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new LobbyError(400, 'The request body must be valid JSON.', 'INVALID_JSON');
  }
}

function bearerToken(request) {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/iu);
  return match?.[1] ?? '';
}

export class LobbyRoom extends DurableObject {
  constructor(context, env) {
    super(context, env);
    this.context = context;
    this.store = new DurableLobbyStore(context.storage);
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (request.method === 'POST' && url.pathname === '/internal/create') {
        const input = await readJson(request);
        const lobbyCode = normalizeLobbyCode(input.lobbyCode);
        if (await this.store.hasLobbyCode(lobbyCode)) {
          return json({ ok: false, code: 'LOBBY_CODE_COLLISION' }, 409);
        }
        const service = new LobbyService(this.store, { codeFactory: () => lobbyCode });
        const result = await service.createLobby(input);
        return json({ ok: true, ...result }, 201);
      }

      const match = url.pathname.match(/^\/api\/lobbies\/([^/]+)(?:\/(join|ready|start|players\/me))?$/u);
      if (!match) throw new LobbyError(404, 'API route not found.', 'ROUTE_NOT_FOUND');

      const [, rawLobbyCode, action] = match;
      const lobbyCode = normalizeLobbyCode(rawLobbyCode);
      const service = new LobbyService(this.store);

      if (request.method === 'GET' && !action) {
        return json({ ok: true, lobby: await service.getLobby(lobbyCode) });
      }
      if (request.method === 'POST' && action === 'join') {
        const result = await service.joinLobby(lobbyCode, await readJson(request));
        return json({ ok: true, ...result }, 201);
      }
      if (request.method === 'PATCH' && action === 'ready') {
        const body = await readJson(request);
        const lobby = await service.setReady(lobbyCode, bearerToken(request), body.isReady);
        return json({ ok: true, lobby });
      }
      if (request.method === 'POST' && action === 'start') {
        const lobby = await service.startLobby(lobbyCode, bearerToken(request));
        return json({ ok: true, lobby });
      }
      if (request.method === 'DELETE' && action === 'players/me') {
        const lobby = await service.leaveLobby(lobbyCode, bearerToken(request));
        return json({ ok: true, lobby });
      }

      throw new LobbyError(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
    } catch (error) {
      if (error instanceof LobbyError) {
        return json({ ok: false, error: error.message, code: error.code }, error.status);
      }
      console.error('Lobby room error', error);
      return json({ ok: false, error: 'Lobby service unavailable.', code: 'INTERNAL_ERROR' }, 500);
    }
  }

  async alarm() {
    await this.context.storage.deleteAll();
  }
}
