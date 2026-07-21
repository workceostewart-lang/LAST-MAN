import test from 'node:test';
import assert from 'node:assert/strict';

import { cardPoints, createStandardDeck } from '../src/engine/deck.js';
import { LastManGame } from '../src/engine/game.js';

let cardSequence = 0;
const card = (color, value) => ({ id: `test-${++cardSequence}`, color, value: String(value) });

function createScenario(config = {}) {
  const game = new LastManGame(
    { playerCount: 2, seed: 'scenario', ...config },
    { autoStart: false },
  );
  game.phase = 'playing';
  game.roundNumber = 1;
  game.direction = 1;
  game.currentPlayerIndex = 0;
  game.pendingDraw = 0;
  game.turnDrawnCardId = null;
  game.pendingColorChoice = null;
  game.discardPile = [card('red', '5')];
  game.activeColor = 'red';
  game.drawPile = Array.from({ length: 30 }, (_, index) => card('yellow', index % 10));
  for (const player of game.players) {
    player.hand = [];
    player.score = 0;
    player.roundWins = 0;
    player.hasCalledLastCard = false;
  }
  return game;
}

test('a pre-game engine stays idle until the player explicitly starts a mode', () => {
  const game = new LastManGame({}, { autoStart: false });

  assert.equal(game.phase, 'ready');
  assert.equal(game.roundNumber, 0);
  assert.equal(game.drawPile.length, 0);
  assert.equal(game.discardPile.length, 0);
  assert.equal(game.players.every((player) => player.hand.length === 0), true);

  game.startMatch({ gameMode: 'matchMode', seed: 'explicit-start' });
  assert.equal(game.phase, 'playing');
  assert.equal(game.config.gameMode, 'matchMode');
  assert.equal(game.roundNumber, 1);
});

test('standard deck has the correct 108-card composition', () => {
  const deck = createStandardDeck();
  assert.equal(deck.length, 108);
  assert.equal(deck.filter((candidate) => candidate.value === 'Wild').length, 4);
  assert.equal(deck.filter((candidate) => candidate.value === 'Wild Draw 4').length, 4);

  for (const color of ['red', 'blue', 'green', 'yellow']) {
    assert.equal(deck.filter((candidate) => candidate.color === color).length, 25);
    assert.equal(
      deck.filter((candidate) => candidate.color === color && candidate.value === '0').length,
      1,
    );
    assert.equal(
      deck.filter((candidate) => candidate.color === color && candidate.value === '9').length,
      2,
    );
  }
});

test('seeded setup is reproducible', () => {
  const left = new LastManGame({ playerCount: 4, seed: 'repeatable' });
  const right = new LastManGame({ playerCount: 4, seed: 'repeatable' });

  assert.deepEqual(left.serialize(), right.serialize());
});

test('matching rules and Wild Draw Four restriction are enforced', () => {
  const game = createScenario();
  const red = card('red', '2');
  const five = card('blue', '5');
  const miss = card('green', '8');
  const wild = card('black', 'Wild');
  const drawFour = card('black', 'Wild Draw 4');
  game.players[0].hand = [red, five, miss, wild, drawFour];

  assert.deepEqual(
    game.getValidCards('player1').map((candidate) => candidate.id),
    [red.id, five.id, wild.id],
  );
});

test('wild play waits for a valid color choice before committing', () => {
  const game = createScenario();
  const wild = card('black', 'Wild');
  game.players[0].hand = [wild, card('blue', '1')];
  game.players[1].hand = [card('green', '3'), card('yellow', '4')];

  const pending = game.playCard('player1', wild.id);
  assert.equal(pending.requiresColor, true);
  assert.equal(game.phase, 'awaitingColor');
  assert.equal(game.players[0].hand.length, 2);

  assert.equal(game.chooseColor('player1', 'purple').ok, false);
  assert.equal(game.chooseColor('player1', 'blue').ok, true);
  assert.equal(game.activeColor, 'blue');
  assert.equal(game.getState().activeColor, 'blue');
  assert.equal(game.topDiscard().id, wild.id);
  assert.equal(game.players[0].hand.length, 1);
});

test('a playable drawn card may be played or passed, and no other card can be played', () => {
  const game = createScenario();
  const unplayable = card('blue', '1');
  const drawn = card('red', '9');
  game.players[0].hand = [unplayable];
  game.players[1].hand = [card('green', '2'), card('yellow', '3')];
  game.drawPile.push(drawn);

  const result = game.drawCard('player1');
  assert.equal(result.playable, true);
  assert.equal(game.currentPlayerId, 'player1');
  assert.deepEqual(game.getState().validCardIds, [drawn.id]);
  assert.equal(game.playCard('player1', unplayable.id).reason, 'invalid-card');
  assert.equal(game.passDrawnCard('player1').ok, true);
  assert.equal(game.currentPlayerId, 'cpu1');
});

test('Draw Two applies its penalty and skips the target when stacking is off', () => {
  const game = createScenario({ stacking: false });
  const drawTwo = card('red', 'Draw 2');
  game.players[0].hand = [drawTwo, card('blue', '1')];
  game.players[1].hand = [card('green', '2'), card('yellow', '3')];

  game.playCard('player1', drawTwo.id);
  assert.equal(game.players[1].hand.length, 4);
  assert.equal(game.currentPlayerId, 'player1');
  assert.equal(game.pendingDraw, 0);
});

test('draw penalties can be stacked when the house rule is enabled', () => {
  const game = createScenario({ stacking: true });
  const playerDraw = card('red', 'Draw 2');
  const cpuDraw = card('blue', 'Draw 2');
  game.players[0].hand = [playerDraw, card('green', '7')];
  game.players[1].hand = [cpuDraw, card('yellow', '3')];

  game.playCard('player1', playerDraw.id);
  assert.equal(game.pendingDraw, 2);
  assert.deepEqual(game.getState().validCardIds, [cpuDraw.id]);

  game.playCard('cpu1', cpuDraw.id);
  assert.equal(game.pendingDraw, 4);
  assert.equal(game.drawCard('player1').cards.length, 4);
  assert.equal(game.currentPlayerId, 'cpu1');
});

test('Reverse acts as Skip in a two-player game', () => {
  const game = createScenario();
  const reverse = card('red', 'Reverse');
  game.players[0].hand = [reverse, card('blue', '1')];
  game.players[1].hand = [card('green', '2'), card('yellow', '3')];

  game.playCard('player1', reverse.id);
  assert.equal(game.currentPlayerId, 'player1');
  assert.equal(game.getState().playDirection, 'counterclockwise');
});

test('Skip and Wild Draw Four advance turns with the standard penalties', () => {
  const skipGame = createScenario({ playerCount: 3 });
  const skip = card('red', 'Skip');
  skipGame.players[0].hand = [skip, card('blue', '1')];
  skipGame.players[1].hand = [card('green', '2'), card('yellow', '3')];
  skipGame.players[2].hand = [card('blue', '4'), card('yellow', '5')];
  skipGame.playCard('player1', skip.id);
  assert.equal(skipGame.currentPlayerId, 'cpu2');

  const drawFourGame = createScenario({ playerCount: 3 });
  const drawFour = card('black', 'Wild Draw 4');
  drawFourGame.players[0].hand = [drawFour, card('blue', '1')];
  drawFourGame.players[1].hand = [card('green', '2'), card('yellow', '3')];
  drawFourGame.players[2].hand = [card('blue', '4'), card('yellow', '5')];
  drawFourGame.playCard('player1', drawFour.id, 'blue');
  assert.equal(drawFourGame.players[1].hand.length, 6);
  assert.equal(drawFourGame.currentPlayerId, 'cpu2');
  assert.equal(drawFourGame.activeColor, 'blue');
});

test('last-card calls and catches update the penalty state', () => {
  const game = createScenario();
  game.players[0].hand = [card('blue', '1')];
  game.players[1].hand = [card('green', '2'), card('yellow', '3')];

  assert.equal(game.callLastCard('player1').ok, true);
  assert.equal(game.players[0].hasCalledLastCard, true);
  assert.equal(game.catchLastCard('cpu1', 'player1').ok, false);

  game.players[0].hasCalledLastCard = false;
  assert.equal(game.catchLastCard('cpu1', 'player1').ok, true);
  assert.equal(game.players[0].hand.length, 3);
});

test('an uncalled player draws two before their next turn', () => {
  const game = createScenario();
  game.currentPlayerIndex = 1;
  game.players[0].hand = [card('blue', '1')];
  const cpuCard = card('red', '2');
  game.players[1].hand = [cpuCard, card('yellow', '3')];

  game.playCard('cpu1', cpuCard.id);
  assert.equal(game.currentPlayerId, 'player1');
  assert.equal(game.players[0].hand.length, 3);
});

test('the discard pile is recycled while preserving its top card', () => {
  const game = createScenario();
  const recyclable = card('blue', '7');
  const top = card('red', '5');
  game.discardPile = [recyclable, top];
  game.drawPile = [];
  game.players[0].hand = [card('green', '2')];
  game.players[1].hand = [card('yellow', '3'), card('green', '4')];

  const result = game.drawCard('player1');
  assert.equal(result.card.id, recyclable.id);
  assert.equal(game.topDiscard().id, top.id);
});

test('round scoring uses number, action, and wild point values', () => {
  assert.equal(cardPoints(card('red', '7')), 7);
  assert.equal(cardPoints(card('red', 'Skip')), 20);
  assert.equal(cardPoints(card('black', 'Wild Draw 4')), 50);

  const game = createScenario({ gameMode: 'quickPlay' });
  const winning = card('red', '9');
  game.players[0].hand = [winning];
  game.players[1].hand = [card('green', '7'), card('blue', 'Skip'), card('black', 'Wild')];

  game.playCard('player1', winning.id);
  assert.equal(game.phase, 'matchOver');
  assert.equal(game.players[0].score, 77);
  assert.equal(game.matchWinnerId, 'player1');
});

test('match and score-target modes continue rounds until their win condition', () => {
  const match = createScenario({ gameMode: 'matchMode', matchRounds: 3 });
  let winning = card('red', '8');
  match.players[0].hand = [winning];
  match.players[1].hand = [card('blue', '2')];
  match.playCard('player1', winning.id);
  assert.equal(match.phase, 'roundOver');

  match.phase = 'playing';
  match.currentPlayerIndex = 0;
  match.discardPile = [card('red', '5')];
  match.activeColor = 'red';
  winning = card('red', '9');
  match.players[0].hand = [winning];
  match.players[1].hand = [card('blue', '4')];
  match.playCard('player1', winning.id);
  assert.equal(match.phase, 'matchOver');

  const target = createScenario({ gameMode: 'scoreTarget', scoreTarget: 50 });
  winning = card('red', '6');
  target.players[0].hand = [winning];
  target.players[1].hand = [card('black', 'Wild')];
  target.playCard('player1', winning.id);
  assert.equal(target.phase, 'matchOver');
});

test('CPU levels follow their intended baseline strategy', () => {
  const game = createScenario({ cpuDifficulty: 'easy' });
  game.currentPlayerIndex = 1;
  const first = card('red', '2');
  const action = card('red', 'Skip');
  game.players[1].hand = [first, action, card('black', 'Wild Draw 4')];
  assert.equal(game.chooseCpuAction('cpu1').cardId, first.id);

  game.players[1].difficulty = 'medium';
  assert.equal(game.chooseCpuAction('cpu1').cardId, action.id);
});

test('a saved game restores the exact deterministic state', () => {
  const game = new LastManGame({ seed: 'save-me', playerCount: 3, gameMode: 'matchMode' });
  const restored = LastManGame.restore(JSON.parse(JSON.stringify(game.serialize())));

  assert.deepEqual(restored.serialize(), game.serialize());
  assert.deepEqual(restored.getState(), game.getState());
});
