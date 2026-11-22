// 平衡模拟：pnpm vitest run scripts/sim.test.ts（不在默认测试里）
import { simulate } from '../src/game/sim/bot';
import { format } from '../src/game/scoring/bignum';

test('simulate', () => {
  const n = Number(process.env.SIM_N ?? 20);
  const levels: number[] = [];
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const r = simulate(`SIM${i}`);
    levels.push(r.level);
    if (r.won) wins++;
    console.log(`${r.seed} won=${r.won} level=${r.level} best=${format(r.best)} tools=${r.tools.join(',')}`);
  }
  const dist: Record<number, number> = {};
  for (const l of levels) dist[l] = (dist[l] ?? 0) + 1;
  console.log('wins', wins, '/', n, 'level dist', JSON.stringify(dist));
}, 600000);
