const LOBBY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOBBY_CODE_LENGTH = 8;
const LOBBY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CREATE_ATTEMPTS = 12;

const ALLOWED_GAME_MODES = new Set(['quickPlay', 'matchMode', 'scoreTarget']);
const ALLOWED_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const ALLOWED_PERSONALITIES = new Set(['balanced', 'aggressive', 'defensive']);
const ALLOWED_THEMES = new Set(['premium', 'cartoon', 'neon', 'retro', 'nature', 'space', 'minimalist']);

export class LobbyError extends Error {
  constructor(status, message, code = 'LOBBY_ERROR') {
    super(message);
    this.name = 'LobbyError';
    this.status = status;
    this.code = code;
  }
}

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function pickAllowed(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function generateLobbyCode(bytes = randomBytes(LOBBY_CODE_LENGTH)) {
  if (bytes.length < LOBBY_CODE_LENGTH) {
    throw new Error(`Lobby code generation requires ${LOBBY_CODE_LENGTH} random bytes.`);
  }

  let code = '';
  for (let index = 0; index < LOBBY_CODE_LENGTH; index += 1) {
    code += LOBBY_CODE_ALPHABET[bytes[index] & 31];
  }
  return code;
}

export function generateSessionToken() {
  return bytesToBase64Url(randomBytes(32));
}

export async function hashSessionToken(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizeLobbyCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (!new RegExp(`^[A-Z0-9]{${LOBBY_CODE_LENGTH}}$`, 'u').test(code)) {
    throw new LobbyError(400, 'Lobby codes must be 8 letters or numbers.', 'INVALID_LOBBY_CODE');
  }
  return code;
}

export function sanitizePlayerName(value, fallback = 'Player') {
  const normalized = String(value ?? '').trim().replace(/\s+/gu, ' ');
  if (!normalized) return fallback;
  return normalized.slice(0, 24);
}

export function sanitizeGameSettings(value = {}) {
  const settings = value && typeof value === 'object' ? value : {};
  return {
    gameMode: pickAllowed(settings.gameMode, ALLOWED_GAME_MODES, 'quickPlay'),
    cpuDifficulty: pickAllowed(
      settings.cpuDifficulty ?? settings.difficulty,
      ALLOWED_DIFFICULTIES,
      'medium',
    ),
    cpuPersonality: pickAllowed(
      settings.cpuPersonality ?? settings.personality,
      ALLOWED_PERSONALITIES,
      'balanced',
    ),
    theme: pickAllowed(settings.theme, ALLOWED_THEMES, 'premium'),
    matchRounds: clampInteger(settings.matchRounds, 3, 1, 9),
    scoreTarget: clampInteger(settings.scoreTarget, 500, 50, 2000),
    stacking: Boolean(settings.stacking),
    sound: settings.sound !== false,
  };
}

function toIsoTimestamp(value) {
  return new Date(value).toISOString();
}

export function toPublicLobby(lobby) {
  return {
    lobbyCode: lobby.lobbyCode,
    hostPlayerId: lobby.hostPlayerId,
    players: lobby.players.map((player) => ({
      id: player.id,
      name: player.name,
      isReady: Boolean(player.isReady),
      isHost: Boolean(player.isHost),
      joinedAt: toIsoTimestamp(player.joinedAt),
    })),
    status: lobby.status,
    createdAt: toIsoTimestamp(lobby.createdAt),
    expiresAt: toIsoTimestamp(lobby.expiresAt),
    maxPlayers: lobby.maxPlayers,
    gameSettings: lobby.gameSettings,
  };
}

export class LobbyService {
  constructor(store, options = {}) {
    this.store = store;
    this.now = options.now ?? (() => Date.now());
    this.codeFactory = options.codeFactory ?? generateLobbyCode;
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.tokenFactory = options.tokenFactory ?? generateSessionToken;
  }

  async createLobby(input = {}) {
    const createdAt = this.now();
    const maxPlayers = clampInteger(input.maxPlayers, 4, 2, 4);
    const hostPlayerId = this.idFactory();
    const token = this.tokenFactory();
    const tokenHash = await hashSessionToken(token);
    const host = {
      id: hostPlayerId,
      name: sanitizePlayerName(input.playerName, 'Host'),
      isReady: false,
      isHost: true,
      joinedAt: createdAt,
    };

    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      const lobbyCode = normalizeLobbyCode(this.codeFactory());
      if (await this.store.hasLobbyCode(lobbyCode)) continue;

      const lobby = {
        lobbyCode,
        hostPlayerId,
        players: [host],
        status: 'waiting',
        createdAt,
        expiresAt: createdAt + LOBBY_TTL_MS,
        maxPlayers,
        gameSettings: {
          ...sanitizeGameSettings(input.gameSettings),
          seed: `lobby-${lobbyCode}`,
        },
      };

      const created = await this.store.createLobby(lobby, host, tokenHash);
      if (!created) continue;

      return {
        lobby: toPublicLobby(lobby),
        session: { playerId: hostPlayerId, token },
      };
    }

    throw new LobbyError(503, 'Unable to allocate a unique lobby code. Please retry.', 'CODE_ALLOCATION_FAILED');
  }

  async getLobby(value) {
    const lobbyCode = normalizeLobbyCode(value);
    const lobby = await this.store.getLobby(lobbyCode, this.now());
    if (!lobby) {
      throw new LobbyError(404, 'Lobby not found or expired.', 'LOBBY_NOT_FOUND');
    }
    return toPublicLobby(lobby);
  }

  async joinLobby(value, input = {}) {
    const lobbyCode = normalizeLobbyCode(value);
    const now = this.now();
    const lobby = await this.store.getLobby(lobbyCode, now);
    if (!lobby) {
      throw new LobbyError(404, 'Lobby not found or expired.', 'LOBBY_NOT_FOUND');
    }
    if (lobby.status !== 'waiting') {
      throw new LobbyError(409, 'This lobby is no longer accepting players.', 'LOBBY_NOT_WAITING');
    }
    if (lobby.players.length >= lobby.maxPlayers) {
      throw new LobbyError(409, 'This lobby is full.', 'LOBBY_FULL');
    }

    const playerId = this.idFactory();
    const token = this.tokenFactory();
    const tokenHash = await hashSessionToken(token);
    const player = {
      id: playerId,
      name: sanitizePlayerName(input.playerName),
      isReady: false,
      isHost: false,
      joinedAt: now,
    };

    const joined = await this.store.addPlayer(lobbyCode, player, tokenHash, now);
    if (!joined) {
      const latest = await this.store.getLobby(lobbyCode, now);
      if (!latest) {
        throw new LobbyError(404, 'Lobby not found or expired.', 'LOBBY_NOT_FOUND');
      }
      if (latest.players.length >= latest.maxPlayers) {
        throw new LobbyError(409, 'This lobby is full.', 'LOBBY_FULL');
      }
      throw new LobbyError(409, 'This lobby is no longer accepting players.', 'LOBBY_NOT_WAITING');
    }

    return {
      lobby: toPublicLobby(await this.store.getLobby(lobbyCode, now)),
      session: { playerId, token },
    };
  }

  async setReady(value, token, isReady) {
    const lobbyCode = normalizeLobbyCode(value);
    const player = await this.authorize(lobbyCode, token);
    const updated = await this.store.setPlayerReady(
      lobbyCode,
      player.id,
      Boolean(isReady),
      this.now(),
    );
    if (!updated) {
      throw new LobbyError(409, 'Readiness cannot be changed after the game starts.', 'LOBBY_IN_GAME');
    }
    return toPublicLobby(updated);
  }

  async startLobby(value, token) {
    const lobbyCode = normalizeLobbyCode(value);
    const player = await this.authorize(lobbyCode, token);
    if (!player.isHost) {
      throw new LobbyError(403, 'Only the host can start the game.', 'HOST_REQUIRED');
    }

    const lobby = await this.store.startLobby(lobbyCode, player.id, this.now());
    if (!lobby) {
      throw new LobbyError(409, 'Every player must be ready before the game starts.', 'LOBBY_NOT_READY');
    }
    return toPublicLobby(lobby);
  }

  async leaveLobby(value, token) {
    const lobbyCode = normalizeLobbyCode(value);
    const player = await this.authorize(lobbyCode, token);
    const lobby = await this.store.removePlayer(lobbyCode, player.id, player.isHost, this.now());
    return lobby ? toPublicLobby(lobby) : null;
  }

  async authorize(lobbyCode, token) {
    if (!token) {
      throw new LobbyError(401, 'A lobby session is required.', 'SESSION_REQUIRED');
    }
    const player = await this.store.findPlayerByToken(
      lobbyCode,
      await hashSessionToken(token),
      this.now(),
    );
    if (!player) {
      throw new LobbyError(401, 'The lobby session is invalid or expired.', 'INVALID_SESSION');
    }
    return player;
  }

  async cleanupExpired() {
    return this.store.deleteExpired(this.now());
  }
}

export const lobbyConstants = {
  codeLength: LOBBY_CODE_LENGTH,
  ttlMs: LOBBY_TTL_MS,
};
