export class CharacterSystem {
  constructor({ collisionEnvironment }) {
    this.collisionEnvironment = collisionEnvironment;
    this.charactersById = new Map();
  }

  add(character) {
    if (this.charactersById.has(character.id)) {
      throw new Error(`Duplicate character ID: ${character.id}`);
    }
    this.charactersById.set(character.id, character);
    return character;
  }

  has(id) {
    return this.charactersById.has(id);
  }

  get(id) {
    return this.charactersById.get(id) ?? null;
  }

  require(id) {
    const character = this.get(id);
    if (!character) throw new Error(`Unknown character ID: ${id}`);
    return character;
  }

  values() {
    return Array.from(this.charactersById.values());
  }

  getSnapshot(id) {
    return this.require(id).getSnapshot();
  }

  getSnapshots() {
    return this.values().map((character) => character.getSnapshot());
  }

  update(deltaMs) {
    for (const character of this.charactersById.values()) {
      character.update(deltaMs, this.collisionEnvironment);
    }
  }

  destroy() {
    for (const character of this.charactersById.values()) {
      character.destroy?.();
    }
    this.charactersById.clear();
  }
}

export function createCharacterSystem(options) {
  return new CharacterSystem(options);
}
