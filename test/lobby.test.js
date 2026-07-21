import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LobbyError,
  LobbyService,
  generateLobbyCode,
  hashSessionToken,
  lobbyConstants,
} from '../worker/lobby.js';

function clone(value) {
  return value == null ? value : structuredClone(value);
}

class MemoryLobbyStore {
  constructor() {
    this.lobbies = new Map();
    this.tokenPlayers = new Map();
    this.reservedCodes = new Set();
  }

  async hasLobbyCode(code) {
    return this.reservedCodes.has(code) || this.lobbies.has(code);
  }

  async createLobby(lobby, host, tokenHash) {
    if (this.lobbies.has(lobby.lobbyCode)) return false;
    this.lobbies.set(lobby.lobbyCode, clone(lobby));
    this.tokenPlayers.set(`${lobby.lobbyCode}:${tokenHash}`, clone(host));
    return true;
  }

  async getLobby(code, now) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return null;
    if (lobby.expiresAt <= now) {
      this.lobbies.delete(code);
      return null;
    }
    return clone(lobby);
  }

  async addPlayer(code, player, tokenHash, now) {
    const lobby = this.lobbies.get(code);
    if (!lobby || lobby.expiresAt <= now || lobby.status !== 'waiting') return false;
    if (lobby.players.length >= lobby.maxPlayers) return false;
    lobby.players.push(clone(player));
    this.tokenPlayers.set(`${code}:${tokenHash}`, clone(player));
    return true;
  }

  async findPlayerByToken(code, tokenHash, now) {
    const lobby = await this.getLobby(code, now);
    if (!lobby) return null;
    return clone(this.tokenPlayers.get(`${code}:${tokenHash}`) ?? null);
  }

  recompute(lobby) {
    if (lobby.status === 'in-game') return;
    lobby.status = lobby.players.length >= 2 && lobby.players.every((player) => player.isReady)
      ? 'ready'
      : 'waiting';
  }

  async setPlayerReady(code, playerId, isReady, now) {
    const lobby = this.lobbies.get(code);
    if (!lobby || lobby.expiresAt <= now || lobby.status === 'in-game') return null;
    const player = lobby.players.find((candidate) => candidate.id === playerId);
    if (!player) return null;
    player.isReady = isReady;
    for (const [key, storedPlayer] of this.tokenPlayers) {
      if (key.startsWith(`${code}:`) && storedPlayer.id === playerId) storedPlayer.isReady = isReady;
    }
    this.recompute(lobby);
    return clone(lobby);
  }

  async startLobby(code, hostPlayerId, now) {
    const lobby = this.lobbies.get(code);
    if (!lobby || lobby.expiresAt <= now) return null;
    if (lobby.hostPlayerId !== hostPlayerId || lobby.status !== 'ready') return null;
    lobby.status = 'in-game';
    return clone(lobby);
  }

  async removePlayer(code, playerId, isHost, now) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return null;
    if (isHost) {
      this.lobbies.delete(code);
      return null;
    }
    lobby.players = lobby.players.filter((player) => player.id !== playerId);
    this.recompute(lobby);
    return this.getLobby(code, now);
  }

  async deleteExpired(now) {
    let deleted = 0;
    for (const [code, lobby] of this.lobbies) {
      if (lobby.expiresAt <= now) {
        this.lobbies.delete(code);
        deleted += 1;
      }
    }
    return deleted;
  }
}

function createService(store, options = {}) {
  const ids = ['host-id', 'guest-id', 'third-id', 'fourth-id', 'fifth-id'];
  const tokens = ['host-token', 'guest-token', 'third-token', 'fourth-token', 'fifth-token'];
  return new LobbyService(store, {
    now: options.now ?? (() => Date.UTC(2026, 6, 21, 12)),
    codeFactory: options.codeFactory ?? (() => 'LAST7K2A'),
    idFactory: () => ids.shift(),
    tokenFactory: () => tokens.shift(),
  });
}

test('lobby codes are secure-format eight-character alphanumeric values', () => {
  const code = generateLobbyCode(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 31]));
  assert.match(code, /^[A-Z0-9]{8}$/u);
  assert.equal(code.length, lobbyConstants.codeLength);
});

test('creating a lobby stores the host, sanitized settings, and a 24-hour expiry', async () => {
  const store = new MemoryLobbyStore();
  const now = Date.UTC(2026, 6, 21, 12);
  const service = createService(store, { now: () => now });
  const result = await service.createLobby({
    playerName: '  Lexington   Host  ',
    maxPlayers: 7,
    gameSettings: {
      gameMode: 'scoreTarget',
      difficulty: 'hard',
      personality: 'aggressive',
      theme: 'neon',
      scoreTarget: 750,
      stacking: true,
    },
  });

  assert.equal(result.lobby.lobbyCode, 'LAST7K2A');
  assert.equal(result.lobby.hostPlayerId, 'host-id');
  assert.equal(result.lobby.players.length, 1);
  assert.deepEqual(result.lobby.players[0], {
    id: 'host-id',
    name: 'Lexington Host',
    isReady: false,
    isHost: true,
    joinedAt: new Date(now).toISOString(),
  });
  assert.equal(result.lobby.status, 'waiting');
  assert.equal(result.lobby.maxPlayers, 4);
  assert.equal(
    Date.parse(result.lobby.expiresAt) - Date.parse(result.lobby.createdAt),
    lobbyConstants.ttlMs,
  );
  assert.deepEqual(result.lobby.gameSettings, {
    gameMode: 'scoreTarget',
    cpuDifficulty: 'hard',
    cpuPersonality: 'aggressive',
    theme: 'neon',
    matchRounds: 3,
    scoreTarget: 750,
    stacking: true,
    sound: true,
    seed: 'lobby-LAST7K2A',
  });
  assert.equal(result.session.playerId, 'host-id');
  assert.equal(result.session.token, 'host-token');
  assert.equal(await store.hasLobbyCode('LAST7K2A'), true);
});

test('code collisions are checked before a lobby is inserted', async () => {
  const store = new MemoryLobbyStore();
  store.reservedCodes.add('ABCDEFGH');
  const codes = ['ABCDEFGH', 'JKLMNPQR'];
  const service = createService(store, { codeFactory: () => codes.shift() });

  const result = await service.createLobby();
  assert.equal(result.lobby.lobbyCode, 'JKLMNPQR');
});

test('players drive waiting, ready, and in-game status transitions', async () => {
  const store = new MemoryLobbyStore();
  const service = createService(store);
  const created = await service.createLobby({ maxPlayers: 2 });
  const joined = await service.joinLobby(created.lobby.lobbyCode, { playerName: 'Guest' });

  assert.equal(joined.lobby.status, 'waiting');
  assert.equal(joined.lobby.players.length, 2);
  assert.equal((await service.setReady(created.lobby.lobbyCode, created.session.token, true)).status, 'waiting');
  assert.equal((await service.setReady(created.lobby.lobbyCode, joined.session.token, true)).status, 'ready');

  await assert.rejects(
    service.startLobby(created.lobby.lobbyCode, joined.session.token),
    (error) => error instanceof LobbyError && error.status === 403,
  );
  const started = await service.startLobby(created.lobby.lobbyCode, created.session.token);
  assert.equal(started.status, 'in-game');
});

test('expired lobbies are deleted and their sessions stop authorizing', async () => {
  const store = new MemoryLobbyStore();
  let now = Date.UTC(2026, 6, 21, 12);
  const service = createService(store, { now: () => now });
  const created = await service.createLobby();
  now += lobbyConstants.ttlMs;

  await assert.rejects(
    service.getLobby(created.lobby.lobbyCode),
    (error) => error instanceof LobbyError && error.status === 404,
  );
  assert.equal(await service.cleanupExpired(), 0);
  assert.equal(store.lobbies.size, 0);
  assert.match(await hashSessionToken(created.session.token), /^[a-f0-9]{64}$/u);
});
