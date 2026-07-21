const SAVE_KEY = 'last-man:game:v1';
const SETTINGS_KEY = 'last-man:settings:v1';

function readJson(storage, key) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const GameStorage = {
  loadGame(storage = globalThis.localStorage) {
    return readJson(storage, SAVE_KEY);
  },

  saveGame(game, storage = globalThis.localStorage) {
    return writeJson(storage, SAVE_KEY, game.serialize());
  },

  clearGame(storage = globalThis.localStorage) {
    try {
      storage?.removeItem(SAVE_KEY);
    } catch {
      // Storage is optional; a blocked write must never stop a game.
    }
  },

  loadSettings(storage = globalThis.localStorage) {
    return readJson(storage, SETTINGS_KEY) ?? {};
  },

  saveSettings(settings, storage = globalThis.localStorage) {
    return writeJson(storage, SETTINGS_KEY, settings);
  },
};
