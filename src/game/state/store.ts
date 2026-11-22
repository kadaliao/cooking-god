import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as run from '../engine/run';
import * as shopActions from '../engine/shop';
import { randomSeed } from '../engine/rng';
import { big, gt, type Big } from '../scoring/bignum';
import type { CardInstance, CookResult, RunState, ToolInstance } from '../types';
import { sfx } from '../../audio/sfx';

type SfxName = Exclude<keyof typeof sfx, 'setEnabled'>;

export interface ScoringAnim {
  result: CookResult;
  cards: CardInstance[];
  tools: ToolInstance[];
  cursor: number;
  done: boolean;
  /** 本次烹饪前的关卡分数，用于进度条动画 */
  scoreBefore: Big;
}

export interface Settings {
  speed: 1 | 2 | 4;
  sound: boolean;
  tutorialDone: boolean;
}

export interface Records {
  runs: number;
  wins: number;
  bestLevel: number;
  bestCook: Big;
}

interface Store {
  run: RunState | null;
  settings: Settings;
  records: Records;
  anim: ScoringAnim | null;
  toast: { text: string; id: number } | null;
  screen: 'title' | 'game';
  modal: null | 'rules' | 'deck' | 'settings' | 'tutorial';

  newRun(seed?: string): void;
  continueRun(): void;
  toTitle(): void;
  abandonRun(): void;
  act(fn: (s: RunState) => RunState, sound?: SfxName): boolean;
  cook(): void;
  advanceAnim(cursor: number): void;
  finishAnim(): void;
  showToast(text: string): void;
  setModal(m: Store['modal']): void;
  updateSettings(p: Partial<Settings>): void;
  shop: typeof shopActions;
}

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
      run: null,
      settings: { speed: 1, sound: true, tutorialDone: false },
      records: { runs: 0, wins: 0, bestLevel: 0, bestCook: big(0) },
      anim: null,
      toast: null,
      screen: 'title',
      modal: null,
      shop: shopActions,

      newRun(seed) {
        const s = run.createRun((seed || randomSeed()).toUpperCase());
        set((st) => ({
          run: s,
          anim: null,
          screen: 'game',
          modal: null,
          records: { ...st.records, runs: st.records.runs + 1 },
        }));
      },
      continueRun() {
        if (get().run) set({ screen: 'game', anim: null });
      },
      toTitle() {
        set({ screen: 'title', anim: null, modal: null });
      },
      abandonRun() {
        set({ run: null, screen: 'title', anim: null, modal: null });
      },
      act(fn, sound) {
        const s = get().run;
        if (!s) return false;
        try {
          const next = fn(s);
          trackRecords(s, next);
          set({ run: next });
          if (sound) (sfx[sound] as () => void)();
          return true;
        } catch (e) {
          if (e instanceof run.GameError || e instanceof Error) get().showToast(e.message);
          sfx.error();
          return false;
        }
      },
      cook() {
        const s = get().run;
        if (!s || get().anim) return;
        const cards = s.pot.map((u) => run.cardByUid(s, u));
        const tools = structuredClone(s.tools);
        const scoreBefore = s.levelState.score;
        const ok = get().act(run.cook, 'sizzle');
        if (!ok) return;
        const next = get().run!;
        set({ anim: { result: next.lastResult!, cards, tools, cursor: -1, done: false, scoreBefore } });
      },
      advanceAnim(cursor) {
        const a = get().anim;
        if (a) set({ anim: { ...a, cursor } });
      },
      finishAnim() {
        set({ anim: null });
        const s = get().run;
        if (s?.phase === 'levelWon') sfx.win();
        if (s?.phase === 'gameOver') sfx.lose();
        if (s?.phase === 'victory') sfx.win();
      },
      showToast(text) {
        set({ toast: { text, id: Date.now() } });
      },
      setModal(m) {
        set({ modal: m });
      },
      updateSettings(p) {
        set((st) => ({ settings: { ...st.settings, ...p } }));
        if (p.sound !== undefined) sfx.setEnabled(p.sound);
      },
    }),
    {
      name: 'cooking-god:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (st) => ({ run: st.run, settings: st.settings, records: st.records, screen: st.screen }),
      onRehydrateStorage: () => (st) => {
        if (st) sfx.setEnabled(st.settings.sound);
      },
    },
  ),
);

function trackRecords(prev: RunState, s: RunState) {
  const st = useGame.getState();
  const r = st.records;
  let changed = false;
  const next = { ...r };
  const reached = s.phase === 'levelWon' || s.phase === 'victory' ? s.level : s.level - 1;
  if (reached > r.bestLevel) {
    next.bestLevel = reached;
    changed = true;
  }
  if (gt(s.stats.bestCook, r.bestCook)) {
    next.bestCook = s.stats.bestCook;
    changed = true;
  }
  if (s.phase === 'victory' && prev.phase !== 'victory') {
    next.wins += 1;
    changed = true;
  }
  if (changed) useGame.setState({ records: next });
}

export const runActions = run;
