import { generateLobbyCode, LobbyError, normalizeLobbyCode } from './lobby.js';
import { LobbyRoom } from './lobby-room.js';

export { LobbyRoom };

const CREATE_ATTEMPTS = 12;
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

function getRoom(env, lobbyCode) {
  const id = env.LOBBIES.idFromName(lobbyCode);
  return env.LOBBIES.get(id);
}

async function createLobby(request, env) {
  const input = await readJson(request);

  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
    const lobbyCode = generateLobbyCode();
    const response = await getRoom(env, lobbyCode).fetch('https://lobby.internal/internal/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, lobbyCode }),
    });
    if (response.status !== 409) return response;
    const body = await response.clone().json();
    if (body.code !== 'LOBBY_CODE_COLLISION') return response;
  }

  return json({
    ok: false,
    error: 'Unable to allocate a unique lobby code. Please retry.',
    code: 'CODE_ALLOCATION_FAILED',
  }, 503);
}

async function fetchHandler(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { allow: 'GET, POST, PATCH, DELETE, OPTIONS' },
      });
    }
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, service: 'last-man-lobbies' });
    }
    if (request.method === 'POST' && url.pathname === '/api/lobbies') {
      return createLobby(request, env);
    }

    const match = url.pathname.match(/^\/api\/lobbies\/([^/]+)/u);
    if (!match) throw new LobbyError(404, 'API route not found.', 'ROUTE_NOT_FOUND');
    const lobbyCode = normalizeLobbyCode(match[1]);
    return getRoom(env, lobbyCode).fetch(request);
  } catch (error) {
    if (error instanceof LobbyError) {
      return json({ ok: false, error: error.message, code: error.code }, error.status);
    }
    console.error('Lobby API error', error);
    return json({ ok: false, error: 'Lobby service unavailable.', code: 'INTERNAL_ERROR' }, 500);
  }
}

export default { fetch: fetchHandler };
