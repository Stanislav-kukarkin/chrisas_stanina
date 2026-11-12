"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const economy_js_1 = require("./economy.js");
(0, vitest_1.describe)('server economy', () => {
    (0, vitest_1.it)('uses the documented deadline brackets', () => {
        (0, vitest_1.expect)((0, economy_js_1.deadlinePenalty)('2026-10-01', new Date('2026-10-03T12:00:00'))).toBe(1);
        (0, vitest_1.expect)((0, economy_js_1.deadlinePenalty)('2026-10-01', new Date('2026-10-06T12:00:00'))).toBe(2);
        (0, vitest_1.expect)((0, economy_js_1.deadlinePenalty)('2026-10-01', new Date('2026-10-08T12:00:00'))).toBe(3);
    });
    (0, vitest_1.it)('keeps the level curve deterministic', () => {
        (0, vitest_1.expect)((0, economy_js_1.levelFromTotalXp)(0)).toBe(1);
        (0, vitest_1.expect)((0, economy_js_1.levelFromTotalXp)(100)).toBe(2);
    });
    (0, vitest_1.it)('keeps daily and chest selection deterministic', () => {
        (0, vitest_1.expect)((0, economy_js_1.dailyDefinitionIds)('2026-10-11', 2)).toEqual((0, economy_js_1.dailyDefinitionIds)('2026-10-11', 2));
        (0, vitest_1.expect)((0, economy_js_1.mysteryReward)('family:user:chest:1')).toEqual((0, economy_js_1.mysteryReward)('family:user:chest:1'));
    });
});
//# sourceMappingURL=economy.test.js.map