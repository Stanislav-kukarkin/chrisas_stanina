import { describe, expect, it } from 'vitest';
import { BOSS_ARCHETYPES, SEASON_SLOTS, generateBoss } from './boss-generator';

describe('boss generator', () => {
  it('contains all 32 archetypes and is deterministic per family sprint', () => {
    expect(BOSS_ARCHETYPES).toHaveLength(32);
    expect(SEASON_SLOTS).toHaveLength(24);
    expect(new Set(SEASON_SLOTS.map((slot) => `${slot.month}:${slot.half}`)).size).toBe(24);
    const first = generateBoss('family', 'sprint-12', new Date('2026-10-07T12:00:00'));
    const second = generateBoss('family', 'sprint-12', new Date('2026-10-07T12:00:00'));
    expect(first).toEqual(second);
    expect(first.visualTraits.length).toBeGreaterThan(0);
  });
});
