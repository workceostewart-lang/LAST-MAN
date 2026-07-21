export const GameState = {
  players: [
    { id: 'player1', name: 'You', isCPU: false, handCount: 7, hasCalledLastCard: false },
    { id: 'cpu1', name: 'CPU 1', isCPU: true, handCount: 7, hasCalledLastCard: false },
    { id: 'cpu2', name: 'CPU 2', isCPU: true, handCount: 7, hasCalledLastCard: false },
    { id: 'cpu3', name: 'CPU 3', isCPU: true, handCount: 7, hasCalledLastCard: false },
  ],
  currentPlayerId: 'player1',
  playDirection: 'clockwise',
  discardTop: { color: 'red', value: '7' },
  activeColor: 'red',
  drawPileCount: 84,
  hand: [
    { id: 'c1', color: 'red', value: '7' },
    { id: 'c2', color: 'blue', value: '2' },
    { id: 'c3', color: 'green', value: 'Skip' },
    { id: 'c4', color: 'yellow', value: '5' },
    { id: 'c5', color: 'black', value: 'Wild' },
    { id: 'c6', color: 'red', value: 'Reverse' },
    { id: 'c7', color: 'blue', value: 'Draw 2' }
  ],
  gameMode: 'quickPlay',
  scores: { player1: 0, cpu1: 0, cpu2: 0, cpu3: 0 }
};
