function hashSeed(seed) {
  const text = String(seed ?? 'last-man');
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export class SeededRandom {
  constructor(seed = Date.now(), state) {
    this.seed = String(seed);
    this.state = state === undefined ? hashSeed(this.seed) : state >>> 0;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer');
    }

    return Math.floor(this.next() * maxExclusive);
  }

  chance(probability) {
    return this.next() < Math.max(0, Math.min(1, probability));
  }

  pick(items) {
    return items.length ? items[this.integer(items.length)] : undefined;
  }

  snapshot() {
    return { seed: this.seed, state: this.state };
  }
}
