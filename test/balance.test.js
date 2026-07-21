import test from 'node:test';
import assert from 'node:assert/strict';

import { LastManGame } from '../src/engine/game.js';

function playEqualStrategyRound(seed) {
  const game = new LastManGame({
    playerCount: 4,
    gameMode: 'quickPlay',
    cpuDifficulty: 'medium',
    cpuPersonality: 'balanced',
    seed,
  });

  for (const player of game.players) {
    player.isCPU = true;
    player.difficulty = 'medium';
    player.personality = 'balanced';
  }

  for (let turn = 0; game.phase === 'playing' && turn < 5000; turn += 1) {
    const current = game.players[game.currentPlayerIndex];
    const uncalled = game.players.find(
      (player) => player.id !== current.id && player.hand.length === 1 && !player.hasCalledLastCard,
    );
    if (uncalled) game.tryCpuCatch(current.id, uncalled.id);
    if (game.phase !== 'playing') break;

    const action = game.chooseCpuAction(current.id);
    if (action?.type === 'play') {
      game.playCard(current.id, action.cardId, action.color);
    } else if (action?.type === 'draw') {
      game.drawCard(current.id);
    } else {
      throw new Error(`No legal action for ${current.id}`);
    }
  }

  assert.equal(game.phase, 'matchOver');
  return game.matchWinnerId;
}

test('equal-strategy seats have an even long-run opportunity to win', () => {
  const rounds = 1000;
  const wins = { player1: 0, cpu1: 0, cpu2: 0, cpu3: 0 };

  for (let index = 0; index < rounds; index += 1) {
    wins[playEqualStrategyRound(`seat-balance-${index}`)] += 1;
  }

  for (const [playerId, winCount] of Object.entries(wins)) {
    const winRate = winCount / rounds;
    assert.ok(
      winRate >= 0.21 && winRate <= 0.29,
      `${playerId} win rate ${(winRate * 100).toFixed(1)}% is outside the balanced range`,
    );
  }
});
