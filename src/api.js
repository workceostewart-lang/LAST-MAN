const SESSION_PREFIX = 'last-man:lobby-session:';
const memorySessions = new Map();

function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

function sessionKey(code) {
  return `${SESSION_PREFIX}${normalizeCode(code)}`;
}

function readSession(code) {
  const key = sessionKey(code);
  try {
    const value = globalThis.sessionStorage?.getItem(key);
    if (value) return JSON.parse(value);
  } catch {
    // A private or restricted browser session can still use the in-memory fallback.
  }
  return memorySessions.get(key) ?? null;
}

function writeSession(code, session) {
  const key = sessionKey(code);
  memorySessions.set(key, session);
  try {
    globalThis.sessionStorage?.setItem(key, JSON.stringify(session));
  } catch {
    // A tab-scoped in-memory session is sufficient when sessionStorage is blocked.
  }
}

function clearSession(code) {
  const key = sessionKey(code);
  memorySessions.delete(key);
  try {
    globalThis.sessionStorage?.removeItem(key);
  } catch {
    // The server still expires the lobby even if local cleanup is unavailable.
  }
}

function normalizeLobby(lobby) {
  if (!lobby) return null;
  const session = readSession(lobby.lobbyCode);
  return {
    ...lobby,
    code: lobby.lobbyCode,
    players: lobby.players.map((player) => ({
      ...player,
      name: player.id === session?.playerId
        ? (player.isHost ? 'You (Host)' : 'You')
        : player.name,
    })),
  };
}

async function request(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        accept: 'application/json',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const body = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error: body.error ?? 'Lobby request failed.',
        code: body.code,
        status: response.status,
      };
    }
    return body;
  } catch {
    return {
      ok: false,
      error: 'Unable to reach the lobby service. Check your connection and retry.',
      code: 'NETWORK_ERROR',
      status: 0,
    };
  }
}

function authorization(code) {
  const token = readSession(code)?.token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

function storeLobbySession(result) {
  if (result.ok && result.lobby && result.session) {
    writeSession(result.lobby.lobbyCode, result.session);
  }
  return {
    ...result,
    lobby: normalizeLobby(result.lobby),
  };
}

export class LobbyAPI {
  static getSession(code) {
    return readSession(code);
  }

  static async createLobby(options = {}) {
    const result = await request('/api/lobbies', {
      method: 'POST',
      body: JSON.stringify(options),
    });
    return storeLobbySession(result);
  }

  static async joinLobby(code, playerName = 'Player') {
    const normalized = normalizeCode(code);
    const result = await request(`/api/lobbies/${encodeURIComponent(normalized)}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerName }),
    });
    return storeLobbySession(result);
  }

  static async getLobby(code) {
    const normalized = normalizeCode(code);
    const result = await request(`/api/lobbies/${encodeURIComponent(normalized)}`);
    return { ...result, lobby: normalizeLobby(result.lobby) };
  }

  static async setReady(code, isReady) {
    const normalized = normalizeCode(code);
    const result = await request(`/api/lobbies/${encodeURIComponent(normalized)}/ready`, {
      method: 'PATCH',
      headers: authorization(normalized),
      body: JSON.stringify({ isReady: Boolean(isReady) }),
    });
    return { ...result, lobby: normalizeLobby(result.lobby) };
  }

  static async startGame(code) {
    const normalized = normalizeCode(code);
    const result = await request(`/api/lobbies/${encodeURIComponent(normalized)}/start`, {
      method: 'POST',
      headers: authorization(normalized),
    });
    return { ...result, lobby: normalizeLobby(result.lobby) };
  }

  static async leaveLobby(code) {
    const normalized = normalizeCode(code);
    const result = await request(`/api/lobbies/${encodeURIComponent(normalized)}/players/me`, {
      method: 'DELETE',
      headers: authorization(normalized),
    });
    if (result.ok) clearSession(normalized);
    return { ...result, lobby: normalizeLobby(result.lobby) };
  }
}
