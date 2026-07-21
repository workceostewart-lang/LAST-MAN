const LOBBY_KEY = 'lobby';
const tokenKey = (hash) => `session:${hash}`;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

export class DurableLobbyStore {
  constructor(storage) {
    this.storage = storage;
  }

  async hasLobbyCode(lobbyCode) {
    const lobby = await this.storage.get(LOBBY_KEY);
    return lobby?.lobbyCode === lobbyCode;
  }

  async createLobby(lobby, host, tokenHash) {
    let created = false;
    await this.storage.transaction(async (transaction) => {
      if (await transaction.get(LOBBY_KEY)) return;
      await transaction.put(LOBBY_KEY, clone(lobby));
      await transaction.put(tokenKey(tokenHash), host.id);
      created = true;
    });
    if (created) await this.storage.setAlarm(lobby.expiresAt);
    return created;
  }

  async getLobby(lobbyCode, now) {
    const lobby = await this.storage.get(LOBBY_KEY);
    if (!lobby || lobby.lobbyCode !== lobbyCode) return null;
    if (lobby.expiresAt <= now) {
      await this.storage.deleteAll();
      return null;
    }
    return clone(lobby);
  }

  async addPlayer(lobbyCode, player, tokenHash, now) {
    let joined = false;
    await this.storage.transaction(async (transaction) => {
      const lobby = await transaction.get(LOBBY_KEY);
      if (
        !lobby ||
        lobby.lobbyCode !== lobbyCode ||
        lobby.expiresAt <= now ||
        lobby.status !== 'waiting' ||
        lobby.players.length >= lobby.maxPlayers
      ) return;

      lobby.players.push(clone(player));
      await transaction.put(LOBBY_KEY, lobby);
      await transaction.put(tokenKey(tokenHash), player.id);
      joined = true;
    });
    return joined;
  }

  async findPlayerByToken(lobbyCode, tokenHash, now) {
    const [lobby, playerId] = await Promise.all([
      this.getLobby(lobbyCode, now),
      this.storage.get(tokenKey(tokenHash)),
    ]);
    if (!lobby || !playerId) return null;
    return clone(lobby.players.find((player) => player.id === playerId) ?? null);
  }

  async setPlayerReady(lobbyCode, playerId, isReady, now) {
    let result = null;
    await this.storage.transaction(async (transaction) => {
      const lobby = await transaction.get(LOBBY_KEY);
      if (
        !lobby ||
        lobby.lobbyCode !== lobbyCode ||
        lobby.expiresAt <= now ||
        lobby.status === 'in-game'
      ) return;

      const player = lobby.players.find((candidate) => candidate.id === playerId);
      if (!player) return;
      player.isReady = isReady;
      lobby.status = lobby.players.length >= 2 && lobby.players.every((candidate) => candidate.isReady)
        ? 'ready'
        : 'waiting';
      await transaction.put(LOBBY_KEY, lobby);
      result = clone(lobby);
    });
    return result;
  }

  async startLobby(lobbyCode, hostPlayerId, now) {
    let result = null;
    await this.storage.transaction(async (transaction) => {
      const lobby = await transaction.get(LOBBY_KEY);
      if (
        !lobby ||
        lobby.lobbyCode !== lobbyCode ||
        lobby.hostPlayerId !== hostPlayerId ||
        lobby.expiresAt <= now ||
        lobby.status !== 'ready'
      ) return;

      lobby.status = 'in-game';
      await transaction.put(LOBBY_KEY, lobby);
      result = clone(lobby);
    });
    return result;
  }

  async removePlayer(lobbyCode, playerId, isHost, now) {
    if (isHost) {
      await this.storage.deleteAll();
      return null;
    }

    let result = null;
    await this.storage.transaction(async (transaction) => {
      const lobby = await transaction.get(LOBBY_KEY);
      if (!lobby || lobby.lobbyCode !== lobbyCode || lobby.expiresAt <= now) return;
      lobby.players = lobby.players.filter((player) => player.id !== playerId);
      if (lobby.status !== 'in-game') {
        lobby.status = lobby.players.length >= 2 && lobby.players.every((player) => player.isReady)
          ? 'ready'
          : 'waiting';
      }
      await transaction.put(LOBBY_KEY, lobby);
      result = clone(lobby);
    });
    return result;
  }

  async deleteExpired(now) {
    const lobby = await this.storage.get(LOBBY_KEY);
    if (!lobby || lobby.expiresAt > now) return 0;
    await this.storage.deleteAll();
    return 1;
  }
}
