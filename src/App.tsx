import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { attachFxCanvas } from './animations/fx';
import { INGREDIENT_LIST } from './game/data/ingredients';
import { RECIPE_LIST } from './game/data/recipes';
import { TOOL_LIST } from './game/data/tools';
import { useGame } from './game/state/store';
import { DeckModal } from './components/DeckModal';
import { GameScreen } from './components/GameScreen';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { TitleScreen } from './components/TitleScreen';
import { TooltipLayer, useTipStore } from './components/Tooltip';
import { Tutorial } from './components/Tutorial';
import { art, dishArt, ingredientArt, preloadArt, toolArt } from './components/art';
import { keepScreenOn } from './platform/xhs';
import { SAVE_STATUS_TEXT } from './platform/storage';

export default function App() {
  const screen = useGame((s) => s.screen);
  const modal = useGame((s) => s.modal);
  const setModal = useGame((s) => s.setModal);
  const run = useGame((s) => s.run);
  const anim = useGame((s) => s.anim);
  const tutorialDone = useGame((s) => s.settings.tutorialDone);
  const toast = useGame((s) => s.toast);
  const saveStatus = useGame((s) => s.saveStatus);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    attachFxCanvas(canvas.current);
    preloadArt([
      ...INGREDIENT_LIST.map((d) => ingredientArt(d.id)),
      ...TOOL_LIST.map((t) => toolArt(t.id)),
      ...RECIPE_LIST.map((r) => dishArt(r.id)),
      art('scene/wok'),
      art('scene/kitchen'),
    ]);
  }, []);

  // 对局中保持屏幕常亮（小工具客户端 9.55+），回到标题时撤销
  useEffect(() => keepScreenOn(screen === 'game'), [screen]);
  useEffect(() => {
    const onVis = () => keepScreenOn(document.visibilityState === 'visible' && useGame.getState().screen === 'game');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 存档写入失败时提示一次（不支持 / 读失败的提示在标题页常驻）
  useEffect(() => {
    if (saveStatus === 'writeError' || saveStatus === 'tooLarge') useGame.getState().showToast(SAVE_STATUS_TEXT[saveStatus]);
  }, [saveStatus]);

  // 切换界面时收起悬浮提示
  useEffect(() => useTipStore.getState().hide(), [screen, modal, run?.phase]);

  // 自动消失的提示
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => useGame.setState({ toast: null }), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showTutorial = screen === 'game' && run?.phase === 'playing' && !anim && !tutorialDone;

  return (
    <div id="shake-root">
      {screen === 'title' || !run ? <TitleScreen /> : <GameScreen />}
      <AnimatePresence>
        {modal === 'rules' && <RulesModal key="rules" onClose={() => setModal(null)} />}
        {modal === 'settings' && <SettingsModal key="settings" onClose={() => setModal(null)} />}
        {modal === 'deck' && run && <DeckModal key="deck" run={run} onClose={() => setModal(null)} />}
      </AnimatePresence>
      {showTutorial && <Tutorial />}
      <TooltipLayer />
      <AnimatePresence>
        {toast && (
          <div key={toast.id} className="toast-pos">
            <motion.div className="toast" role="status" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
              {toast.text}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <canvas ref={canvas} className="fx-canvas" aria-hidden />
    </div>
  );
}
