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

    this.themeSelector.value = settings.theme ?? 'premium';
    this.soundToggle.checked = settings.sound !== false;
    this.setupEvents();
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
  }

  saveSettings() {
    this.callbacks.onSettingsChanged?.({
      theme: this.themeSelector.value,
      sound: this.soundToggle.checked,
    });
  }

  getGameConfig() {
    const gameMode = document.getElementById('game-mode').value;
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
    document.getElementById('game-mode').value = config.gameMode ?? 'quickPlay';
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
