import {
  COLORS,
  cardPoints,
  createStandardDeck,
  isDrawCard,
  isWild,
  shuffle,
} from './deck.js';
import {
  chooseColor,
  chooseCpuAction,
  cpuCallsLastCard,
  cpuCatchesLastCard,
} from './cpu.js';
import { SeededRandom } from './random.js';

const DEFAULT_CONFIG = Object.freeze({
  playerCount: 4,
  cpuDifficulty: 'medium',
  cpuPersonality: 'balanced',
  gameMode: 'quickPlay',
  matchRounds: 3,
  scoreTarget: 500,
  stacking: false,
  seed: undefined,
});

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const PERSONALITIES = ['aggressive', 'defensive', 'balanced'];
const GAME_MODES = ['quickPlay', 'matchMode', 'scoreTarget'];

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function normalizeConfig(config = {}) {
  const merged = { ...DEFAULT_CONFIG, ...config };
  let matchRounds = boundedInteger(merged.matchRounds, 3, 1, 7);
  if (matchRounds % 2 === 0) matchRounds += 1;

  return {
    playerCount: boundedInteger(merged.playerCount, 4, 2, 4),
    cpuDifficulty: DIFFICULTIES.includes(merged.cpuDifficulty) ? merged.cpuDifficulty : 'medium',
    cpuPersonality: PERSONALITIES.includes(merged.cpuPersonality)
      ? merged.cpuPersonality
      : 'balanced',
    gameMode: GAME_MODES.includes(merged.gameMode) ? merged.gameMode : 'quickPlay',
    matchRounds,
    scoreTarget: boundedInteger(merged.scoreTarget, 500, 50, 5000),
    stacking: Boolean(merged.stacking),
    seed: merged.seed ?? `last-man-${Date.now()}`,
  };
}

function cloneCard(card) {
  return card ? { id: card.id, color: card.color, value: card.value } : null;
}

export class LastManGame {
  constructor(config = {}, options = {}) {
    this.config = normalizeConfig(config);
    this.random = new SeededRandom(this.config.seed);
    this.listeners = new Set();
    this.players = [];
    this.drawPile = [];
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.direction = 1;
    this.activeColor = null;
    this.pendingDraw = 0;
    this.turnDrawnCardId = null;
    this.pendingColorChoice = null;
    this.phase = 'ready';
    this.roundNumber = 0;
    this.roundWinnerId = null;
    this.matchWinnerId = null;
    this.roundScore = 0;

    this.createPlayers();
    if (options.autoStart !== false) this.startMatch();
  }

  get currentPlayerId() {
    return this.players[this.currentPlayerIndex]?.id ?? null;
  }

  createPlayers() {
    this.players = Array.from({ length: this.config.playerCount }, (_, index) => ({
      id: index === 0 ? 'player1' : `cpu${index}`,
      name: index === 0 ? 'You' : `CPU ${index}`,
      isCPU: index !== 0,
      difficulty: index === 0 ? null : this.config.cpuDifficulty,
      personality: index === 0 ? null : this.config.cpuPersonality,
      hand: [],
      hasCalledLastCard: false,
      score: 0,
      roundWins: 0,
    }));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ type: 'snapshot' }, this.getState());
    return () => this.listeners.delete(listener);
  }

  emit(type, payload = {}) {
    const event = { type, ...payload };
    const state = this.getState();
    for (const listener of this.listeners) listener(event, state);
  }

  startMatch(config = this.config) {
    this.config = normalizeConfig(config);
    this.random = new SeededRandom(this.config.seed);
    this.createPlayers();
    this.roundNumber = 0;
    this.matchWinnerId = null;
    this.startRound(0, 'matchStarted');
  }

  startRound(startingPlayerIndex = 0, eventType = 'roundStarted') {
    this.roundNumber += 1;
    this.phase = 'playing';
    this.roundWinnerId = null;
    this.roundScore = 0;
    this.direction = 1;
    this.pendingDraw = 0;
    this.turnDrawnCardId = null;
    this.pendingColorChoice = null;
    this.currentPlayerIndex = startingPlayerIndex % this.players.length;
    this.drawPile = shuffle(createStandardDeck(this.roundNumber), this.random);
    this.discardPile = [];

    for (const player of this.players) {
      player.hand = [];
      player.hasCalledLastCard = false;
    }

    for (let cardIndex = 0; cardIndex < 7; cardIndex += 1) {
      for (const player of this.players) {
        player.hand.push(this.drawOne());
      }
    }

    let firstCard = this.drawOne();
    while (firstCard.value === 'Wild Draw 4') {
      this.drawPile.unshift(firstCard);
      shuffle(this.drawPile, this.random);
      firstCard = this.drawOne();
    }
    this.discardPile.push(firstCard);
    this.activeColor = isWild(firstCard)
      ? chooseColor(this.players[this.currentPlayerIndex].hand, this.random)
      : firstCard.color;

    this.applyOpeningCard(firstCard);
    this.emit(eventType, { roundNumber: this.roundNumber, firstCard: cloneCard(firstCard) });
  }

  continueRound() {
    if (this.phase !== 'roundOver') return { ok: false, reason: 'round-not-over' };
    const winnerIndex = this.players.findIndex((player) => player.id === this.roundWinnerId);
    this.startRound(winnerIndex >= 0 ? winnerIndex : 0);
    return { ok: true };
  }

  applyOpeningCard(card) {
    if (card.value === 'Skip') {
      this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex, 1);
    } else if (card.value === 'Reverse') {
      this.direction = -1;
      this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex, 1);
    } else if (card.value === 'Draw 2') {
      const penalized = this.players[this.currentPlayerIndex];
      this.drawCards(penalized, 2);
      this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex, 1);
    }
  }

  nextIndex(fromIndex = this.currentPlayerIndex, steps = 1) {
    const count = this.players.length;
    return ((fromIndex + this.direction * steps) % count + count) % count;
  }

  peekNextPlayerId(playerId = this.currentPlayerId) {
    const index = this.players.findIndex((player) => player.id === playerId);
    if (index < 0) return null;
    return this.players[this.nextIndex(index, 1)]?.id ?? null;
  }

  topDiscard() {
    return this.discardPile[this.discardPile.length - 1] ?? null;
  }

  isCardPlayable(playerId, card) {
    if (!card || this.phase !== 'playing') return false;
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player) return false;

    if (this.pendingDraw > 0) {
      return this.config.stacking && isDrawCard(card);
    }

    if (this.turnDrawnCardId && card.id !== this.turnDrawnCardId) return false;
    if (card.value === 'Wild') return true;
    if (card.value === 'Wild Draw 4') {
      return !player.hand.some(
        (candidate) => candidate.id !== card.id && candidate.color === this.activeColor,
      );
    }

    const topCard = this.topDiscard();
    return card.color === this.activeColor || card.value === topCard?.value;
  }

  getValidCards(playerId) {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || playerId !== this.currentPlayerId || this.phase !== 'playing') return [];
    return player.hand.filter((card) => this.isCardPlayable(playerId, card));
  }

  playCard(playerId, cardId, chosenColor) {
    if (this.phase !== 'playing') return { ok: false, reason: 'game-not-playing' };
    if (playerId !== this.currentPlayerId) return { ok: false, reason: 'not-your-turn' };

    const player = this.players[this.currentPlayerIndex];
    const card = player.hand.find((candidate) => candidate.id === cardId);
    if (!card) return { ok: false, reason: 'card-not-found' };
    if (!this.isCardPlayable(playerId, card)) return { ok: false, reason: 'invalid-card' };

    if (isWild(card) && !COLORS.includes(chosenColor)) {
      this.phase = 'awaitingColor';
      this.pendingColorChoice = { playerId, cardId };
      this.emit('colorRequested', { playerId, card: cloneCard(card) });
      return { ok: true, requiresColor: true };
    }

    return this.commitCard(player, card, chosenColor);
  }

  chooseColor(playerId, color) {
    if (this.phase !== 'awaitingColor' || !this.pendingColorChoice) {
      return { ok: false, reason: 'color-not-requested' };
    }
    if (playerId !== this.pendingColorChoice.playerId || !COLORS.includes(color)) {
      return { ok: false, reason: 'invalid-color' };
    }

    const player = this.players.find((candidate) => candidate.id === playerId);
    const card = player?.hand.find((candidate) => candidate.id === this.pendingColorChoice.cardId);
    if (!player || !card) return { ok: false, reason: 'card-not-found' };

    this.phase = 'playing';
    this.pendingColorChoice = null;
    return this.commitCard(player, card, color);
  }

  commitCard(player, card, chosenColor) {
    const cardIndex = player.hand.findIndex((candidate) => candidate.id === card.id);
    player.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.turnDrawnCardId = null;
    this.activeColor = isWild(card) ? chosenColor : card.color;
    if (player.hand.length !== 1) player.hasCalledLastCard = false;

    if (player.hand.length === 1 && player.isCPU) {
      player.hasCalledLastCard = cpuCallsLastCard(player, this.random);
    }

    if (player.hand.length === 0) {
      this.finishRound(player.id, card);
      return { ok: true, card: cloneCard(card), roundOver: true };
    }

    const playedFromIndex = this.currentPlayerIndex;
    let penalizedPlayer = null;
    let penaltyCards = [];

    if (card.value === 'Reverse') {
      this.direction *= -1;
      const steps = this.players.length === 2 ? 2 : 1;
      this.currentPlayerIndex = this.nextIndex(playedFromIndex, steps);
    } else if (card.value === 'Skip') {
      this.currentPlayerIndex = this.nextIndex(playedFromIndex, 2);
    } else if (isDrawCard(card)) {
      const amount = card.value === 'Draw 2' ? 2 : 4;
      if (this.config.stacking) {
        this.pendingDraw += amount;
        this.currentPlayerIndex = this.nextIndex(playedFromIndex, 1);
      } else {
        const penalizedIndex = this.nextIndex(playedFromIndex, 1);
        penalizedPlayer = this.players[penalizedIndex];
        penaltyCards = this.drawCards(penalizedPlayer, amount);
        this.currentPlayerIndex = this.nextIndex(playedFromIndex, 2);
      }
    } else {
      this.currentPlayerIndex = this.nextIndex(playedFromIndex, 1);
    }

    this.emit('cardPlayed', {
      playerId: player.id,
      card: cloneCard(card),
      chosenColor: this.activeColor,
      penalizedPlayerId: penalizedPlayer?.id ?? null,
      penaltyCards: penaltyCards.map(cloneCard),
    });
    this.applyMissedCallPenalty();
    return { ok: true, card: cloneCard(card) };
  }

  drawCard(playerId) {
    if (this.phase !== 'playing') return { ok: false, reason: 'game-not-playing' };
    if (playerId !== this.currentPlayerId) return { ok: false, reason: 'not-your-turn' };
    if (this.turnDrawnCardId) return { ok: false, reason: 'already-drawn' };

    const player = this.players[this.currentPlayerIndex];
    if (this.pendingDraw > 0) {
      const amount = this.pendingDraw;
      const cards = this.drawCards(player, amount);
      this.pendingDraw = 0;
      player.hasCalledLastCard = false;
      this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex, 1);
      this.emit('penaltyDrawn', { playerId, amount, cards: cards.map(cloneCard) });
      this.applyMissedCallPenalty();
      return { ok: true, cards: cards.map(cloneCard), turnEnded: true };
    }

    if (this.getValidCards(playerId).length) {
      return { ok: false, reason: 'valid-card-available' };
    }

    const card = this.drawOne();
    player.hand.push(card);
    player.hasCalledLastCard = false;

    if (this.isCardPlayable(playerId, card)) {
      this.turnDrawnCardId = card.id;
      this.emit('cardDrawn', { playerId, card: cloneCard(card), playable: true });
      return { ok: true, card: cloneCard(card), playable: true };
    }

    this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex, 1);
    this.emit('cardDrawn', { playerId, card: cloneCard(card), playable: false });
    this.applyMissedCallPenalty();
    return { ok: true, card: cloneCard(card), playable: false, turnEnded: true };
  }

  passDrawnCard(playerId) {
    if (
      this.phase !== 'playing' ||
      playerId !== this.currentPlayerId ||
      !this.turnDrawnCardId
    ) {
      return { ok: false, reason: 'cannot-pass' };
    }

    this.turnDrawnCardId = null;
    this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex, 1);
    this.emit('turnPassed', { playerId });
    this.applyMissedCallPenalty();
    return { ok: true };
  }

  callLastCard(playerId) {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player || player.hand.length !== 1 || player.hasCalledLastCard) {
      return { ok: false, reason: 'cannot-call' };
    }

    player.hasCalledLastCard = true;
    this.emit('lastCardCalled', { playerId });
    return { ok: true };
  }

  catchLastCard(catcherId, targetId) {
    const catcher = this.players.find((player) => player.id === catcherId);
    const target = this.players.find((player) => player.id === targetId);
    if (
      this.phase !== 'playing' ||
      !catcher ||
      !target ||
      catcherId === targetId ||
      target.hand.length !== 1 ||
      target.hasCalledLastCard
    ) {
      return { ok: false, reason: 'cannot-catch' };
    }

    const cards = this.drawCards(target, 2);
    target.hasCalledLastCard = false;
    this.emit('lastCardCaught', { catcherId, targetId, cards: cards.map(cloneCard) });
    return { ok: true, cards: cards.map(cloneCard) };
  }

  tryCpuCatch(catcherId, targetId) {
    const catcher = this.players.find((player) => player.id === catcherId);
    if (!catcher?.isCPU || !cpuCatchesLastCard(catcher, this.random)) return false;
    return this.catchLastCard(catcherId, targetId).ok;
  }

  applyMissedCallPenalty() {
    const player = this.players[this.currentPlayerIndex];
    if (!player || player.hand.length !== 1 || player.hasCalledLastCard) return;

    const cards = this.drawCards(player, 2);
    player.hasCalledLastCard = false;
    this.emit('missedLastCardPenalty', { playerId: player.id, cards: cards.map(cloneCard) });
  }

  drawOne() {
    if (!this.drawPile.length) this.recycleDiscardPile();
    const card = this.drawPile.pop();
    if (!card) throw new Error('No cards remain to draw');
    return card;
  }

  drawCards(player, amount) {
    const cards = [];
    for (let index = 0; index < amount; index += 1) {
      const card = this.drawOne();
      player.hand.push(card);
      cards.push(card);
    }
    if (player.hand.length !== 1) player.hasCalledLastCard = false;
    return cards;
  }

  recycleDiscardPile() {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop();
    this.drawPile = shuffle(this.discardPile.splice(0), this.random);
    this.discardPile = [top];
    this.emit('deckRecycled');
  }

  finishRound(winnerId, winningCard) {
    const winner = this.players.find((player) => player.id === winnerId);
    const score = this.players
      .filter((player) => player.id !== winnerId)
      .flatMap((player) => player.hand)
      .reduce((total, card) => total + cardPoints(card), 0);

    winner.score += score;
    winner.roundWins += 1;
    this.roundWinnerId = winnerId;
    this.roundScore = score;
    this.turnDrawnCardId = null;
    this.pendingDraw = 0;

    const winsNeeded = Math.floor(this.config.matchRounds / 2) + 1;
    const matchIsOver =
      this.config.gameMode === 'quickPlay' ||
      (this.config.gameMode === 'matchMode' && winner.roundWins >= winsNeeded) ||
      (this.config.gameMode === 'scoreTarget' && winner.score >= this.config.scoreTarget);

    this.phase = matchIsOver ? 'matchOver' : 'roundOver';
    this.matchWinnerId = matchIsOver ? winnerId : null;
    this.emit(matchIsOver ? 'matchEnded' : 'roundEnded', {
      winnerId,
      score,
      winningCard: cloneCard(winningCard),
    });
  }

  chooseCpuAction(playerId = this.currentPlayerId) {
    return chooseCpuAction(this, playerId);
  }

  getState() {
    const human = this.players.find((player) => !player.isCPU);
    const currentValidCards = this.getValidCards(this.currentPlayerId);
    const uncalledPlayer = this.players.find(
      (player) => player.hand.length === 1 && !player.hasCalledLastCard,
    );

    return {
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        isCPU: player.isCPU,
        difficulty: player.difficulty,
        personality: player.personality,
        handCount: player.hand.length,
        hasCalledLastCard: player.hasCalledLastCard,
      })),
      currentPlayerId: this.currentPlayerId,
      playDirection: this.direction === 1 ? 'clockwise' : 'counterclockwise',
      discardTop: cloneCard(this.topDiscard()),
      activeColor: this.activeColor,
      drawPileCount: this.drawPile.length,
      hand: human?.hand.map(cloneCard) ?? [],
      gameMode: this.config.gameMode,
      scores: Object.fromEntries(this.players.map((player) => [player.id, player.score])),
      roundWins: Object.fromEntries(this.players.map((player) => [player.id, player.roundWins])),
      phase: this.phase,
      roundNumber: this.roundNumber,
      roundWinnerId: this.roundWinnerId,
      matchWinnerId: this.matchWinnerId,
      roundScore: this.roundScore,
      pendingDraw: this.pendingDraw,
      drawnCardId: this.turnDrawnCardId,
      validCardIds: currentValidCards.map((card) => card.id),
      canDraw:
        this.phase === 'playing' &&
        !this.turnDrawnCardId &&
        (this.pendingDraw > 0 || currentValidCards.length === 0),
      canPass: this.phase === 'playing' && Boolean(this.turnDrawnCardId),
      uncalledLastCardPlayerId: uncalledPlayer?.id ?? null,
      config: { ...this.config },
    };
  }

  serialize() {
    return {
      version: 1,
      config: { ...this.config },
      random: this.random.snapshot(),
      players: this.players.map((player) => ({ ...player, hand: player.hand.map(cloneCard) })),
      drawPile: this.drawPile.map(cloneCard),
      discardPile: this.discardPile.map(cloneCard),
      currentPlayerIndex: this.currentPlayerIndex,
      direction: this.direction,
      activeColor: this.activeColor,
      pendingDraw: this.pendingDraw,
      turnDrawnCardId: this.turnDrawnCardId,
      pendingColorChoice: this.pendingColorChoice ? { ...this.pendingColorChoice } : null,
      phase: this.phase,
      roundNumber: this.roundNumber,
      roundWinnerId: this.roundWinnerId,
      matchWinnerId: this.matchWinnerId,
      roundScore: this.roundScore,
    };
  }

  static restore(saved) {
    if (!saved || saved.version !== 1) throw new Error('Unsupported LAST MAN save');
    const game = new LastManGame(saved.config, { autoStart: false });
    game.random = new SeededRandom(saved.random.seed, saved.random.state);
    game.players = saved.players.map((player) => ({ ...player, hand: player.hand.map(cloneCard) }));
    game.drawPile = saved.drawPile.map(cloneCard);
    game.discardPile = saved.discardPile.map(cloneCard);
    game.currentPlayerIndex = saved.currentPlayerIndex;
    game.direction = saved.direction;
    game.activeColor = saved.activeColor;
    game.pendingDraw = saved.pendingDraw;
    game.turnDrawnCardId = saved.turnDrawnCardId;
    game.pendingColorChoice = saved.pendingColorChoice ? { ...saved.pendingColorChoice } : null;
    game.phase = saved.phase;
    game.roundNumber = saved.roundNumber;
    game.roundWinnerId = saved.roundWinnerId;
    game.matchWinnerId = saved.matchWinnerId;
    game.roundScore = saved.roundScore;
    return game;
  }
}

export { DEFAULT_CONFIG };
