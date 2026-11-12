import { describe, expect, it } from 'vitest';
import { dailyDefinitionIds, deadlinePenalty, levelFromTotalXp, mysteryReward } from './economy.js';

describe('server economy', () => {
  it('uses the documented deadline brackets', () => {
    expect(deadlinePenalty('2026-10-01', new Date('2026-10-03T12:00:00'))).toBe(1);
    expect(deadlinePenalty('2026-10-01', new Date('2026-10-06T12:00:00'))).toBe(2);
    expect(deadlinePenalty('2026-10-01', new Date('2026-10-08T12:00:00'))).toBe(3);
  });

  it('keeps the level curve deterministic', () => {
    expect(levelFromTotalXp(0)).toBe(1);
    expect(levelFromTotalXp(100)).toBe(2);
  });

  it('keeps daily and chest selection deterministic', () => {
    expect(dailyDefinitionIds('2026-10-11', 2)).toEqual(dailyDefinitionIds('2026-10-11', 2));
    expect(mysteryReward('family:user:chest:1')).toEqual(mysteryReward('family:user:chest:1'));
  });
});
