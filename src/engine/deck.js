export const COLORS = Object.freeze(['red', 'blue', 'green', 'yellow']);
export const ACTION_VALUES = Object.freeze(['Skip', 'Reverse', 'Draw 2']);
export const WILD_VALUES = Object.freeze(['Wild', 'Wild Draw 4']);

export function isWild(card) {
  return card?.value === 'Wild' || card?.value === 'Wild Draw 4';
}

export function isDrawCard(card) {
  return card?.value === 'Draw 2' || card?.value === 'Wild Draw 4';
}

export function cardPoints(card) {
  if (!card) return 0;
  if (card.value === 'Wild' || card.value === 'Wild Draw 4') return 50;
  if (ACTION_VALUES.includes(card.value)) return 20;

  const value = Number(card.value);
  return Number.isFinite(value) ? value : 0;
}

export function createStandardDeck(round = 1) {
  const deck = [];
  let sequence = 0;
  const add = (color, value) => {
    sequence += 1;
    deck.push({
      id: `r${round}-c${sequence}`,
      color,
      value: String(value),
    });
  };

  for (const color of COLORS) {
    add(color, 0);
    for (let value = 1; value <= 9; value += 1) {
      add(color, value);
      add(color, value);
    }
    for (const value of ACTION_VALUES) {
      add(color, value);
      add(color, value);
    }
  }

  for (let index = 0; index < 4; index += 1) {
    add('black', 'Wild');
    add('black', 'Wild Draw 4');
  }

  return deck;
}

export function shuffle(cards, random) {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const other = random.integer(index + 1);
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }

  return cards;
}
