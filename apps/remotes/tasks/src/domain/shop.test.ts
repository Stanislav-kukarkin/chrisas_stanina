import { describe, expect, it } from 'vitest';
import { chestRarity, mysteryReward } from './shop';

describe('mystery chest', () => {
  it('is deterministic and only returns an item of the rolled rarity', () => {
    const seed = 'family:player:chest:1';
    expect(mysteryReward(seed)).toEqual(mysteryReward(seed));
    expect(mysteryReward(seed).rarity).toBe(chestRarity(seed));
  });

  it('uses all configured rarity bands', () => {
    const rarities = new Set(Array.from({ length: 2_000 }, (_, index) => chestRarity(`seed-${index}`)));
    expect(rarities).toEqual(new Set(['common', 'rare', 'epic', 'legendary']));
  });
});
