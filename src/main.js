import * as THREE from 'three';
import { Card } from './card.js';
import { LastManGame } from './engine/game.js';
import { GameStorage } from './engine/storage.js';
import { InteractionManager } from './interaction.js';
import { PhysicsWorld } from './physics.js';
import { UIManager } from './ui.js';
import { LobbyAPI } from './api.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

function isMobileViewport() {
  return window.innerWidth <= 700 || (window.innerHeight <= 500 && window.innerWidth <= 950);
}

function getTableLayout() {
  return isMobileViewport()
    ? { drawX: -1.05, discardX: 1.05, tableZ: -1.1, pileScale: 0.65 }
    : { drawX: -1.15, discardX: 1.15, tableZ: -0.7, pileScale: 0.82 };
}

function getDrawPilePosition(layout, index = 0) {
  return new THREE.Vector3(layout.drawX, index * 0.025, layout.tableZ);
}

function getDiscardPilePosition(layout, index = 0) {
  const offsetX = (index % 4 - 1.5) * 0.02;
  const offsetZ = (index % 5 - 2) * 0.02;
  return new THREE.Vector3(
    layout.discardX + offsetX,
    0.03 + index * 0.02,
    layout.tableZ + offsetZ,
  );
}

function getDiscardPileBasePosition(layout, index = 0) {
  return new THREE.Vector3(
    layout.discardX,
    0.03 + index * 0.02,
    layout.tableZ,
  );
}

function updateCameraLayout() {
  camera.aspect = window.innerWidth / window.innerHeight;
  if (isMobileViewport()) {
    camera.fov = 62;
    camera.position.set(0, 4, 13);
    camera.lookAt(0, -0.8, 0);
  } else {
    camera.fov = 45;
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
  }
  camera.updateProjectionMatrix();
}

updateCameraLayout();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.ShadowMaterial({ opacity: 0.5 }),
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

const physics = new PhysicsWorld();
const savedSettings = GameStorage.loadSettings();

GameStorage.clearGame();
let game = new LastManGame({}, { autoStart: false });

let latestState = game.getState();
let renderedRound = -1;
let cpuTimer = null;
let cardViews = new Map();
let handViews = [];
let discardViews = [];
let drawViews = [];
let lobbyPollTimer = null;
let lobbyGameStarted = false;

function stopLobbyPolling() {
  window.clearInterval(lobbyPollTimer);
  lobbyPollTimer = null;
}

function applyLobbyUpdate(lobby) {
  if (!lobby) return;
  const lobbyCode = lobby.lobbyCode ?? lobby.code;
  const session = LobbyAPI.getSession(lobbyCode);
  const isHost = session?.playerId === lobby.hostPlayerId;
  window.currentLobbyCode = lobbyCode;
  uiManager.showLobby(lobby, isHost, session?.playerId);

  if (lobby.status === 'in-game' && !lobbyGameStarted) {
    lobbyGameStarted = true;
    stopLobbyPolling();
    uiManager.hideLobby();
    game.startMatch({
      ...uiManager.getGameConfig(),
      ...lobby.gameSettings,
      playerCount: lobby.maxPlayers,
    });
  }
}

function startLobbyPolling() {
  stopLobbyPolling();
  lobbyPollTimer = window.setInterval(async () => {
    if (!window.currentLobbyCode) return;
    const result = await LobbyAPI.getLobby(window.currentLobbyCode);
    if (result.ok) applyLobbyUpdate(result.lobby);
    else if (result.status === 404) {
      stopLobbyPolling();
      uiManager.showMessage('This lobby has expired or was closed.');
      uiManager.lobbyScreen.classList.add('hidden');
      uiManager.multiplayerMenu.classList.remove('hidden');
      window.currentLobbyCode = null;
    }
  }, 2000);
}

function drawForHuman() {
  const result = game.drawCard('player1');
  if (!result.ok) {
    const message = result.reason === 'valid-card-available'
      ? 'You already have a playable card.'
      : 'You cannot draw right now.';
    uiManager.showMessage(message);
  }
  return result;
}

const uiManager = new UIManager(
  {
    onColorChosen: (color) => {
      const result = game.chooseColor('player1', color);
      if (!result.ok) uiManager.showMessage('That color cannot be selected.');
      return result.ok;
    },
    onLastCard: () => {
      const human = latestState.players.find((player) => !player.isCPU);
      let result;
      if (human?.handCount === 1 && !human.hasCalledLastCard) {
        result = game.callLastCard(human.id);
      } else {
        const target = latestState.players.find(
          (player) => player.isCPU && player.id === latestState.uncalledLastCardPlayerId,
        );
        result = target ? game.catchLastCard(human.id, target.id) : { ok: false };
      }
      if (!result.ok) uiManager.showMessage('The call window has closed.');
    },
    onPass: () => {
      const result = game.passDrawnCard('player1');
      if (!result.ok) uiManager.showMessage('Draw a playable card before passing.');
    },
    onDrawPile: drawForHuman,
    onContinue: () => {
      if (latestState.phase === 'roundOver') game.continueRound();
      else {
        GameStorage.clearGame();
        window.clearTimeout(cpuTimer);
        clearTable();
        uiManager.showStartScreen();
      }
    },
    onNewGame: (config) => {
      interaction.clearSelection();
      GameStorage.clearGame();
      game.startMatch(config);
    },
    onSettingsChanged: (settings) => GameStorage.saveSettings(settings),
    onPlayCPU: () => {
      game.startMatch(uiManager.getGameConfig());
    },
    onCreateLobby: async () => {
      uiManager.showMessage('Creating lobby...', 10000);
      const config = uiManager.getGameConfig();
      const res = await LobbyAPI.createLobby({
        playerName: 'Host',
        maxPlayers: config.playerCount,
        gameSettings: {
          ...config,
          ...GameStorage.loadSettings(),
        },
      });
      uiManager.messageEl.classList.add('hidden');
      if (res.ok) {
        lobbyGameStarted = false;
        applyLobbyUpdate(res.lobby);
        startLobbyPolling();
      } else {
        uiManager.showMessage(res.error || 'Failed to create lobby.');
        uiManager.multiplayerMenu.classList.remove('hidden');
      }
    },
    onJoinLobby: async (code) => {
      uiManager.showMessage('Joining lobby...', 10000);
      const res = await LobbyAPI.joinLobby(code);
      uiManager.messageEl.classList.add('hidden');
      if (res.ok) {
        lobbyGameStarted = false;
        applyLobbyUpdate(res.lobby);
        startLobbyPolling();
      } else {
        uiManager.showMessage(res.error || 'Failed to join');
        uiManager.multiplayerMenu.classList.remove('hidden');
      }
    },
    onLobbyReady: async (isReady) => {
      const res = await LobbyAPI.setReady(window.currentLobbyCode, isReady);
      if (res.ok) applyLobbyUpdate(res.lobby);
      else uiManager.showMessage(res.error || 'Unable to update readiness.');
    },
    onStartLobbyGame: async () => {
      const res = await LobbyAPI.startGame(window.currentLobbyCode);
      if (res.ok) applyLobbyUpdate(res.lobby);
      else uiManager.showMessage(res.error || 'Unable to start the game.');
    },
    onLeaveLobby: async () => {
      const lobbyCode = window.currentLobbyCode;
      stopLobbyPolling();
      window.currentLobbyCode = null;
      if (lobbyCode) await LobbyAPI.leaveLobby(lobbyCode);
    }
  },
  savedSettings,
);

function createCardView(cardData, isCPU = false) {
  const view = new Card(
    cardData.id,
    cardData.color,
    cardData.value,
    scene,
    physics,
    isCPU,
  );
  cardViews.set(cardData.id, view);
  return view;
}

function clearTable() {
  interaction?.clearSelection();
  physics.clearCards();
  for (const view of cardViews.values()) view.remove();
  for (const view of drawViews) view.remove();
  cardViews = new Map();
  handViews = [];
  discardViews = [];
  drawViews = [];
}

function buildRound(state) {
  clearTable();
  renderedRound = state.roundNumber;
  const layout = getTableLayout();

  if (state.discardTop) {
    const top = createCardView(state.discardTop).setZone('discard');
    top.pinToTable('discard', getDiscardPilePosition(layout), layout.pileScale);
    discardViews.push(top);
  }

  for (let index = 0; index < 5; index += 1) {
    const view = new Card(`draw-visual-${index}`, 'back', '', scene, physics).setZone('draw');
    view.pinToTable('draw', getDrawPilePosition(layout, index), layout.pileScale);
    drawViews.push(view);
  }

  syncHand(state, true);
}

function syncHand(state, dealing = false) {
  const handIds = new Set(state.hand.map((card) => card.id));
  for (const view of handViews) {
    if (!handIds.has(view.id)) {
      view.remove();
      cardViews.delete(view.id);
    }
  }

  handViews = state.hand.map((cardData) => {
    let view = cardViews.get(cardData.id);
    if (!view) {
      view = createCardView(cardData).setZone('hand');
      view.setPosition(-3, 0.5, 0);
      view.setRotation(-Math.PI / 2, 0, 0);
    }
    view.setZone('hand');
    return view;
  });

  handViews.forEach((view, index) => {
    view.animateToHand(index, handViews.length, false);
  });

  if (!dealing) interaction?.clearSelection();
}

function movePlayedCard(event) {
  const cardData = event.card ?? event.winningCard;
  if (!cardData || discardViews.some((view) => view.id === cardData.id)) return;

  let view = cardViews.get(cardData.id);
  if (!view) {
    view = createCardView(cardData, true);
    view.setPosition(0, 5, -3);
    view.setRotation(Math.PI, 0, 0);
  }

  handViews = handViews.filter((candidate) => candidate !== view);
  view.setZone('discard');
  const layout = getTableLayout();
  view.mesh.scale.setScalar(layout.pileScale);
  const target = getDiscardPileBasePosition(layout, discardViews.length);
  view.playToDiscard(target, discardViews.length);
  discardViews.push(view);
}

function syncDiscard(state, event) {
  if (event.type === 'cardPlayed' || event.type === 'roundEnded' || event.type === 'matchEnded') {
    movePlayedCard(event);
  }

  if (state.discardTop && !cardViews.has(state.discardTop.id)) {
    movePlayedCard({ card: state.discardTop });
  }
}

function describeEvent(event) {
  if (event.type === 'lastCardCalled') return 'LAST MAN called!';
  if (event.type === 'lastCardCaught') return 'Caught! Two-card penalty.';
  if (event.type === 'missedLastCardPenalty') return 'Missed LAST MAN — draw two.';
  if (event.type === 'penaltyDrawn') return `Draw ${event.amount} penalty.`;
  if (event.type === 'deckRecycled') return 'Discard pile reshuffled.';
  return null;
}

function scheduleCpuTurn(state) {
  window.clearTimeout(cpuTimer);
  const current = state.players.find((player) => player.id === state.currentPlayerId);
  if (state.phase !== 'playing' || !current?.isCPU) return;

  cpuTimer = window.setTimeout(() => {
    const target = game.players.find(
      (player) => player.id !== current.id && player.hand.length === 1 && !player.hasCalledLastCard,
    );
    if (target) game.tryCpuCatch(current.id, target.id);

    if (game.phase !== 'playing' || game.currentPlayerId !== current.id) return;
    const action = game.chooseCpuAction(current.id);
    if (action?.type === 'play') {
      game.playCard(current.id, action.cardId, action.color);
    } else if (action?.type === 'draw') {
      game.drawCard(current.id);
    }
  }, 650);
}

function onEngineEvent(event, state) {
  latestState = state;
  if (state.phase === 'ready') {
    clearTable();
    uiManager.update(state, event);
    return;
  }

  if (state.roundNumber !== renderedRound || ['roundStarted', 'matchStarted'].includes(event.type)) {
    buildRound(state);
  } else {
    syncDiscard(state, event);
    syncHand(state);
  }

  uiManager.update(state, event);
  const message = describeEvent(event);
  if (message) uiManager.showMessage(message);
  GameStorage.saveGame(game);
  scheduleCpuTurn(state);
}

const interaction = new InteractionManager(camera, scene, {
  onCardPlayed: (view) => {
    const result = game.playCard('player1', view.id);
    if (!result.ok) {
      const messages = {
        'not-your-turn': 'Wait for your turn.',
        'invalid-card': 'Match the active color, number, or symbol.',
        'game-not-playing': 'Finish the current choice first.',
      };
      uiManager.showMessage(messages[result.reason] ?? 'That card cannot be played.');
    }
    return result.ok && !result.requiresColor;
  },
  onDrawPile: () => {
    drawForHuman();
  },
});

game.subscribe(onEngineEvent);

window.__LAST_MAN__ = {
  getState: () => game.getState(),
  newGame: (config) => game.startMatch(config),
};

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  physics.update(clock.getDelta());
  renderer.render(scene, camera);
}
animate();

function reflowTable() {
  updateCameraLayout();
  const layout = getTableLayout();
  drawViews.forEach((view, index) => {
    view.pinToTable('draw', getDrawPilePosition(layout, index), layout.pileScale);
  });
  discardViews.forEach((view, index) => {
    const rotationZ = (index % 3 - 1) * 0.05;
    view.pinToTable(
      'discard',
      getDiscardPilePosition(layout, index),
      layout.pileScale,
      rotationZ,
    );
  });
  handViews.forEach((view, index) => view.animateToHand(index, handViews.length, false));
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  reflowTable();
});
