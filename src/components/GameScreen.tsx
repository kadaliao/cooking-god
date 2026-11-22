import { AnimatePresence } from 'motion/react';
import { useGame } from '../game/state/store';
import { Actions, Hand } from './Hand';
import { GameOver, LevelIntro, LevelWon, Victory } from './PhaseOverlays';
import { ScoringDirector } from './ScoringDirector';
import { ShopScreen } from './ShopScreen';
import { SidePanel } from './SidePanel';
import { Stove } from './Stove';
import { ToolRail } from './ToolRail';
import { TopBar } from './TopBar';
import { art } from './art';

export function GameScreen() {
  const run = useGame((s) => s.run);
  const anim = useGame((s) => s.anim);
  if (!run) return null;
  const phase = run.phase;

  if (phase === 'shop') {
    return (
      <div className="game shop-mode" style={{ backgroundImage: `url(${art('scene/kitchen')})` }}>
        <ShopScreen />
      </div>
    );
  }

  return (
    <div className="game" style={{ backgroundImage: `url(${art('scene/kitchen')})` }}>
      <TopBar />
      <div className="board">
        <div data-tut="tools" className="rail-wrap">
          <ToolRail />
        </div>
        <div className="center">
          <Stove />
          <Actions />
        </div>
        <SidePanel />
      </div>
      <Hand />
      <ScoringDirector />
      <AnimatePresence>
        {!anim && phase === 'levelIntro' && <LevelIntro key="intro" />}
        {!anim && phase === 'levelWon' && <LevelWon key="won" />}
        {!anim && phase === 'gameOver' && <GameOver key="over" />}
        {!anim && phase === 'victory' && <Victory key="victory" />}
      </AnimatePresence>
    </div>
  );
}
