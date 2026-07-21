import { GameState } from './gameState.js';

export class UIManager {
  constructor() {
    this.drawCountEl = document.getElementById('draw-count');
    this.turnIndicator = document.getElementById('turn-indicator');
    this.turnText = this.turnIndicator.querySelector('.turn-text');
    this.directionArrow = this.turnIndicator.querySelector('.direction-arrow');
    this.lastCardBtn = document.getElementById('last-card-btn');
    this.colorPicker = document.getElementById('color-picker');
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.endScreen = document.getElementById('end-screen');
    
    this.setupEvents();
    this.updateHUD();
  }
  
  setupEvents() {
    this.settingsBtn.addEventListener('click', () => {
      this.settingsModal.classList.remove('hidden');
    });
    
    this.closeSettingsBtn.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });
    
    // Theme switching logic placeholder
    document.getElementById('theme-selector').addEventListener('change', (e) => {
      console.log('Theme changed to:', e.target.value);
      // In a full build, this would trigger a texture re-load in Card class
    });
    
    // Color picker
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        console.log('Color chosen:', color);
        GameState.activeColor = color;
        this.colorPicker.classList.add('hidden');
        // Resume game logic
      });
    });
    
    // Last card badge
    this.lastCardBtn.addEventListener('click', () => {
      console.log('Last card called!');
      this.lastCardBtn.classList.remove('pulsing');
      this.lastCardBtn.style.background = 'green';
      this.lastCardBtn.innerText = 'CALLED!';
      setTimeout(() => {
        this.lastCardBtn.classList.add('hidden');
      }, 1000);
    });
    
    // Restart
    document.getElementById('restart-btn').addEventListener('click', () => {
      location.reload();
    });
  }
  
  updateHUD() {
    this.drawCountEl.innerText = GameState.drawPileCount;
    
    const currentPlayer = GameState.players.find(p => p.id === GameState.currentPlayerId);
    this.turnText.innerText = currentPlayer.isCPU ? `${currentPlayer.name}'s Turn` : 'Your Turn';
    
    this.directionArrow.innerText = GameState.playDirection === 'clockwise' ? '↻' : '↺';
    
    // If player has 1 card, show the badge
    const human = GameState.players.find(p => !p.isCPU);
    if (human.handCount === 1 && !human.hasCalledLastCard) {
      this.lastCardBtn.classList.remove('hidden');
    } else {
      this.lastCardBtn.classList.add('hidden');
    }
  }
  
  showColorPicker() {
    this.colorPicker.classList.remove('hidden');
  }
  
  showEndScreen(winnerName, score) {
    this.endScreen.classList.remove('hidden');
    document.getElementById('winner-text').innerText = `${winnerName} Wins!`;
    document.getElementById('score-text').innerText = `Score: ${score}`;
  }
}
