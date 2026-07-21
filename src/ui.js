export class UIManager {
  constructor(callbacks = {}, settings = {}) {
    this.callbacks = callbacks;
    this.state = null;
    this.messageTimer = null;
    this.drawCountEl = document.getElementById('draw-count');
    this.drawInfo = document.getElementById('draw-info');
    this.playerStatusEl = document.getElementById('player-status');
    this.uiLayer = document.getElementById('ui-layer');
    this.turnIndicator = document.getElementById('turn-indicator');
    this.turnText = this.turnIndicator.querySelector('.turn-text');
    this.directionArrow = this.turnIndicator.querySelector('.direction-arrow');
    this.activeColorIndicator = document.getElementById('active-color-indicator');
    this.activeColorText = document.getElementById('active-color-text');
    this.activeColorSwatch = this.activeColorIndicator.querySelector('.active-color-swatch');
    this.lastCardBtn = document.getElementById('last-card-btn');
    this.passBtn = document.getElementById('pass-btn');
    this.messageEl = document.getElementById('game-message');
    this.colorPicker = document.getElementById('color-picker');
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.endScreen = document.getElementById('end-screen');
    this.restartBtn = document.getElementById('restart-btn');
    this.themeSelector = document.getElementById('theme-selector');
    this.soundToggle = document.getElementById('sound-toggle');

    // New screens
    this.startScreen = document.getElementById('start-screen');
    this.startGameMode = document.getElementById('start-game-mode');
    this.playCpuBtn = document.getElementById('btn-play-cpu');
    this.multiplayerBtn = document.getElementById('btn-multiplayer');
    this.settingsGameMode = document.getElementById('game-mode');
    this.multiplayerMenu = document.getElementById('multiplayer-menu');
    this.lobbyScreen = document.getElementById('lobby-screen');
    this.currentLobbyState = null;
    this.currentLobbyPlayerId = null;

    this.themeSelector.value = settings.theme ?? 'premium';
    this.soundToggle.checked = settings.sound !== false;
    this.setupEvents();
    this.updateStartActionState();

    // Default visibility for HUD
    this.hudElements = [this.turnIndicator, this.drawInfo, this.settingsBtn, this.playerStatusEl];
    this.setHudVisible(false);
  }

  setHudVisible(visible) {
    this.hudElements.forEach(el => {
      if (el) el.classList.toggle('hidden', !visible);
    });
  }

  updateStartActionState() {
    const hasSelectedMode = Boolean(this.startGameMode.value);
    this.playCpuBtn.disabled = !hasSelectedMode;
    this.multiplayerBtn.disabled = !hasSelectedMode;
  }

  showStartScreen() {
    this.endScreen.classList.add('hidden');
    this.settingsModal.classList.add('hidden');
    this.multiplayerMenu.classList.add('hidden');
    this.lobbyScreen.classList.add('hidden');
    this.setHudVisible(false);
    this.startGameMode.value = '';
    this.updateStartActionState();
    this.startScreen.classList.remove('hidden');
  }

  setupEvents() {
    this.settingsBtn.addEventListener('click', () => {
      this.settingsModal.classList.remove('hidden');
    });

    this.closeSettingsBtn.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });

    this.themeSelector.addEventListener('change', () => this.saveSettings());
    this.soundToggle.addEventListener('change', () => this.saveSettings());
    this.startGameMode.addEventListener('change', () => {
      this.settingsGameMode.value = this.startGameMode.value;
      this.updateStartActionState();
    });
    this.settingsGameMode.addEventListener('change', () => {
      this.startGameMode.value = this.settingsGameMode.value;
      this.updateStartActionState();
    });

    document.querySelectorAll('.color-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const accepted = this.callbacks.onColorChosen?.(button.dataset.color);
        if (accepted !== false) this.colorPicker.classList.add('hidden');
      });
    });

    this.lastCardBtn.addEventListener('click', () => this.callbacks.onLastCard?.());
    this.passBtn.addEventListener('click', () => this.callbacks.onPass?.());
    this.drawInfo.addEventListener('click', () => this.callbacks.onDrawPile?.());
    this.restartBtn.addEventListener('click', () => this.callbacks.onContinue?.());

    document.getElementById('new-game-btn').addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
      this.endScreen.classList.add('hidden');
      this.callbacks.onNewGame?.(this.getGameConfig());
    });

    // Start Screen & Multiplayer
    this.playCpuBtn.addEventListener('click', () => {
      if (!this.startGameMode.value) return;
      this.startScreen.classList.add('hidden');
      this.setHudVisible(true);
      this.callbacks.onPlayCPU?.();
    });

    this.multiplayerBtn.addEventListener('click', () => {
      if (!this.startGameMode.value) return;
      this.startScreen.classList.add('hidden');
      this.multiplayerMenu.classList.remove('hidden');
    });

    document.getElementById('btn-back-multiplayer').addEventListener('click', () => {
      this.multiplayerMenu.classList.add('hidden');
      this.startScreen.classList.remove('hidden');
    });

    document.getElementById('btn-create-game').addEventListener('click', () => {
      this.multiplayerMenu.classList.add('hidden');
      this.callbacks.onCreateLobby?.();
    });

    document.getElementById('btn-join-game').addEventListener('click', () => {
      const code = document.getElementById('join-code-input').value;
      if (code.trim()) {
        this.multiplayerMenu.classList.add('hidden');
        this.callbacks.onJoinLobby?.(code.trim().toUpperCase());
      }
    });

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = document.getElementById('lobby-code-display').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('btn-copy-code');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
      });
    });

    document.getElementById('btn-lobby-ready').addEventListener('click', () => {
      const player = this.currentLobbyState?.players.find(
        (candidate) => candidate.id === this.currentLobbyPlayerId,
      );
      this.callbacks.onLobbyReady?.(!player?.isReady);
    });

    document.getElementById('btn-start-lobby-game').addEventListener('click', () => {
      this.callbacks.onStartLobbyGame?.();
    });

    document.getElementById('btn-leave-lobby').addEventListener('click', () => {
      this.lobbyScreen.classList.add('hidden');
      this.multiplayerMenu.classList.remove('hidden');
      this.callbacks.onLeaveLobby?.();
    });
  }

  showLobby(lobbyState, isHost, currentPlayerId = null) {
    this.currentLobbyState = lobbyState;
    this.currentLobbyPlayerId = currentPlayerId;
    this.lobbyScreen.classList.remove('hidden');
    const lobbyCode = lobbyState.lobbyCode ?? lobbyState.code;
    document.getElementById('lobby-code-display').textContent = lobbyCode;

    // Generate QR using an external API
    const qrImg = document.getElementById('qr-code-img');
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(lobbyCode)}`;
    qrImg.style.display = 'block';

    const playersList = document.getElementById('lobby-players-list');
    playersList.innerHTML = '';

    lobbyState.players.forEach(p => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.padding = '8px 12px';
      div.style.background = 'rgba(255,255,255,0.05)';
      div.style.borderRadius = '6px';

      const name = document.createElement('span');
      name.textContent = p.name;

      const status = document.createElement('span');
      status.textContent = p.isReady ? 'Ready' : (p.isHost ? 'Host • Waiting' : 'Waiting');
      status.style.color = p.isReady ? '#34c759' : '#ff9500';

      div.appendChild(name);
      div.appendChild(status);
      playersList.appendChild(div);
    });

    const startBtn = document.getElementById('btn-start-lobby-game');
    const readyBtn = document.getElementById('btn-lobby-ready');
    const currentPlayer = lobbyState.players.find((player) => player.id === currentPlayerId);

    readyBtn.classList.remove('hidden');
    readyBtn.disabled = lobbyState.status === 'in-game';
    readyBtn.textContent = currentPlayer?.isReady ? 'Not Ready' : 'Ready';

    if (isHost) {
      startBtn.classList.remove('hidden');
      startBtn.disabled = lobbyState.status !== 'ready';
      startBtn.style.opacity = lobbyState.status === 'ready' ? '1' : '0.5';
    } else {
      startBtn.classList.add('hidden');
    }
  }

  hideLobby() {
    this.lobbyScreen.classList.add('hidden');
    this.setHudVisible(true);
  }

  saveSettings() {
    this.callbacks.onSettingsChanged?.({
      theme: this.themeSelector.value,
      sound: this.soundToggle.checked,
    });
  }

  getGameConfig() {
    const gameMode = this.settingsGameMode.value;
    return {
      playerCount: Number(document.getElementById('player-count').value),
      cpuDifficulty: document.getElementById('cpu-difficulty').value,
      cpuPersonality: document.getElementById('cpu-personality').value,
      gameMode,
      matchRounds: 3,
      scoreTarget: 500,
      stacking: document.getElementById('stacking-toggle').checked,
      seed: `last-man-${Date.now()}`,
    };
  }

  applyConfig(config) {
    if (!config) return;
    document.getElementById('player-count').value = String(config.playerCount ?? 4);
    document.getElementById('cpu-difficulty').value = config.cpuDifficulty ?? 'medium';
    document.getElementById('cpu-personality').value = config.cpuPersonality ?? 'balanced';
    this.settingsGameMode.value = config.gameMode ?? 'quickPlay';
    document.getElementById('stacking-toggle').checked = Boolean(config.stacking);
  }

  update(state, event = {}) {
    this.state = state;
    this.uiLayer.dataset.phase = state.phase;
    this.uiLayer.dataset.currentPlayer = state.currentPlayerId ?? '';
    this.uiLayer.dataset.handCount = String(state.hand.length);
    this.uiLayer.dataset.validCards = state.validCardIds.join(',');
    this.uiLayer.dataset.canDraw = String(state.canDraw);
    this.uiLayer.dataset.canPass = String(state.canPass);
    this.uiLayer.dataset.round = String(state.roundNumber);
    this.drawCountEl.textContent = state.drawPileCount;

    const showActiveColor = state.phase !== 'ready' && Boolean(state.activeColor);
    this.activeColorIndicator.classList.toggle('hidden', !showActiveColor);
    if (showActiveColor) {
      const colorName = state.activeColor.toUpperCase();
      this.activeColorText.textContent = colorName;
      this.activeColorSwatch.style.backgroundColor = `var(--color-${state.activeColor})`;
      this.activeColorIndicator.setAttribute('aria-label', `Current color: ${colorName}`);
    }

    if (this.playerStatusEl) {
      this.playerStatusEl.innerHTML = '';
      state.players.forEach(player => {
        const isCurrent = state.currentPlayerId === player.id;
        const div = document.createElement('div');
        div.textContent = `${player.name}: ${player.handCount} card${player.handCount !== 1 ? 's' : ''}`;
        if (isCurrent) {
          div.style.color = 'var(--color-blue)';
          div.style.fontWeight = '900';
        }
        if (player.handCount === 1) {
          div.style.color = 'var(--color-red)';
          div.textContent += ' 🔥';
        }
        this.playerStatusEl.appendChild(div);
      });
    }

    const currentPlayer = state.players.find((player) => player.id === state.currentPlayerId);
    if (state.phase === 'awaitingColor') {
      this.turnText.textContent = 'Choose a color';
    } else if (currentPlayer) {
      this.turnText.textContent = currentPlayer.isCPU ? `${currentPlayer.name}'s Turn` : 'Your Turn';
    }
    this.directionArrow.textContent = state.playDirection === 'clockwise' ? '↻' : '↺';

    const human = state.players.find((player) => !player.isCPU);
    const uncalled = state.players.find(
      (player) => player.id === state.uncalledLastCardPlayerId,
    );
    if (human?.handCount === 1 && !human.hasCalledLastCard) {
      this.lastCardBtn.textContent = 'LAST MAN!';
      this.lastCardBtn.dataset.action = 'call';
      this.lastCardBtn.classList.remove('hidden');
    } else if (uncalled?.isCPU) {
      this.lastCardBtn.textContent = `CATCH ${uncalled.name}!`;
      this.lastCardBtn.dataset.action = 'catch';
      this.lastCardBtn.classList.remove('hidden');
    } else {
      this.lastCardBtn.classList.add('hidden');
    }

    const humanTurn = state.currentPlayerId === human?.id;
    this.passBtn.classList.toggle('hidden', !(humanTurn && state.canPass));

    if (
      (event.type === 'colorRequested' && event.playerId === human?.id) ||
      (state.phase === 'awaitingColor' && state.currentPlayerId === human?.id)
    ) {
      this.colorPicker.classList.remove('hidden');
    } else if (state.phase !== 'awaitingColor') {
      this.colorPicker.classList.add('hidden');
    }

    if (state.phase === 'roundOver' || state.phase === 'matchOver') {
      this.showEndScreen(state);
    } else {
      this.endScreen.classList.add('hidden');
    }

    this.applyConfig(state.config);
  }

  showEndScreen(state) {
    const winnerId = state.matchWinnerId ?? state.roundWinnerId;
    const winner = state.players.find((player) => player.id === winnerId);
    const isMatch = state.phase === 'matchOver';
    document.getElementById('winner-text').textContent = `${winner?.name ?? 'Player'} Wins${isMatch ? '!' : ' the Round!'}`;

    const scoreLines = state.players
      .map((player) => `${player.name}: ${state.scores[player.id]} pts`)
      .join(' • ');
    document.getElementById('score-text').textContent =
      state.gameMode === 'quickPlay'
        ? `Round score: ${state.roundScore}`
        : `${scoreLines} • Round score: ${state.roundScore}`;
    this.restartBtn.textContent = isMatch ? 'Play Again' : 'Next Round';
    this.endScreen.classList.remove('hidden');
  }

  showMessage(message, timeout = 1400) {
    window.clearTimeout(this.messageTimer);
    this.messageEl.textContent = message;
    this.messageEl.classList.remove('hidden');
    this.messageTimer = window.setTimeout(() => {
      this.messageEl.classList.add('hidden');
    }, timeout);
  }
}
