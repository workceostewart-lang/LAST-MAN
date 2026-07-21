import { COLORS, cardPoints, isDrawCard, isWild } from './deck.js';

const CALL_CHANCE = Object.freeze({ easy: 0.68, medium: 0.9, hard: 1 });
const CATCH_CHANCE = Object.freeze({ easy: 0.3, medium: 0.65, hard: 0.92 });

function colorCounts(hand) {
  return Object.fromEntries(
    COLORS.map((color) => [color, hand.filter((card) => card.color === color).length]),
  );
}

export function chooseColor(hand, random) {
  const counts = colorCounts(hand);
  const highest = Math.max(...Object.values(counts));
  const choices = COLORS.filter((color) => counts[color] === highest);
  return random.pick(choices) ?? random.pick(COLORS);
}

function nextPlayerIsThreat(game, playerId) {
  const nextId = game.peekNextPlayerId(playerId);
  return game.players.find((player) => player.id === nextId)?.hand.length <= 2;
}

function actionWeight(card, personality, threatened) {
  if (card.value === 'Wild Draw 4') return threatened ? 38 : 26;
  if (card.value === 'Draw 2') return threatened ? 34 : 24;
  if (card.value === 'Skip') return threatened ? 30 : 21;
  if (card.value === 'Reverse') return threatened ? 27 : 19;
  if (card.value === 'Wild') return 15;

  if (personality === 'aggressive') return cardPoints(card) * 0.9;
  if (personality === 'defensive') return cardPoints(card) * 1.35;
  return cardPoints(card);
}

function scoreHardCard(game, player, card) {
  const threatened = nextPlayerIsThreat(game, player.id);
  const personality = player.personality ?? 'balanced';
  const remaining = player.hand.filter((candidate) => candidate.id !== card.id);
  const remainingColorCount = remaining.filter((candidate) => candidate.color === card.color).length;
  let score = actionWeight(card, personality, threatened) + cardPoints(card) * 0.4;

  if (!isWild(card)) score += remainingColorCount * 2.5;
  if (isWild(card) && remaining.length > 2) score -= 8;
  if (card.value === 'Wild Draw 4' && !threatened && remaining.length > 1) score -= 12;

  if (personality === 'aggressive' && ['Skip', 'Draw 2', 'Wild Draw 4'].includes(card.value)) {
    score += 12;
  }
  if (personality === 'defensive' && isDrawCard(card) && !threatened) {
    score -= 10;
  }

  return score;
}

export function chooseCpuAction(game, playerId) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player?.isCPU || game.currentPlayerId !== playerId) {
    return null;
  }

  const validCards = game.getValidCards(playerId);
  if (!validCards.length) return { type: 'draw' };

  const difficulty = player.difficulty ?? 'medium';
  let card;

  if (difficulty === 'easy') {
    card = validCards[0];
  } else if (difficulty === 'medium') {
    const nonDrawFour = validCards.filter((candidate) => candidate.value !== 'Wild Draw 4');
    const pool = nonDrawFour.length ? nonDrawFour : validCards;
    card = [...pool].sort((left, right) => {
      const rightAction = actionWeight(right, player.personality, nextPlayerIsThreat(game, playerId));
      const leftAction = actionWeight(left, player.personality, nextPlayerIsThreat(game, playerId));
      return rightAction - leftAction;
    })[0];
  } else {
    card = [...validCards].sort(
      (left, right) => scoreHardCard(game, player, right) - scoreHardCard(game, player, left),
    )[0];
  }

  return {
    type: 'play',
    cardId: card.id,
    color: isWild(card)
      ? chooseColor(player.hand.filter((candidate) => candidate.id !== card.id), game.random)
      : undefined,
  };
}

export function cpuCallsLastCard(player, random) {
  let chance = CALL_CHANCE[player.difficulty ?? 'medium'];
  if (player.personality === 'defensive') chance += 0.04;
  if (player.personality === 'aggressive') chance -= 0.04;
  return random.chance(chance);
}

export function cpuCatchesLastCard(player, random) {
  let chance = CATCH_CHANCE[player.difficulty ?? 'medium'];
  if (player.personality === 'aggressive') chance += 0.06;
  if (player.personality === 'defensive') chance -= 0.04;
  return random.chance(chance);
}
