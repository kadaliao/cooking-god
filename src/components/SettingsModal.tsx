import { useEffect, useState } from 'react';
import { useGame } from '../game/state/store';
import { canVibrate, IS_MINITOOL } from '../platform/xhs';
import { Modal } from './Modal';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useGame((s) => s.settings);
  const update = useGame((s) => s.updateSettings);
  const run = useGame((s) => s.run);
  const screen = useGame((s) => s.screen);
  const toTitle = useGame((s) => s.toTitle);
  const abandon = useGame((s) => s.abandonRun);
  const [confirm, setConfirm] = useState(false);
  const [vibrateSupported, setVibrateSupported] = useState(false);
  useEffect(() => {
    let alive = true;
    void canVibrate().then((ok) => alive && setVibrateSupported(ok));
    return () => {
      alive = false;
    };
  }, []);
  const vibrateOn = settings.vibrate !== false;
  return (
    <Modal onClose={onClose} className="settings-modal">
      <h2>⚙️ 设置</h2>
      <div className="setting-row">
        <span>结算动画速度</span>
        <div className="seg">
          {([1, 2, 4] as const).map((v) => (
            <button key={v} className={settings.speed === v ? 'on' : ''} onClick={() => update({ speed: v })}>
              {v}×
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span>音效</span>
        <div className="seg">
          <button className={settings.sound ? 'on' : ''} onClick={() => update({ sound: true })}>
            开
          </button>
          <button className={!settings.sound ? 'on' : ''} onClick={() => update({ sound: false })}>
            关
          </button>
        </div>
      </div>
      {vibrateSupported && (
        <div className="setting-row">
          <span>振动反馈</span>
          <div className="seg">
            <button className={vibrateOn ? 'on' : ''} onClick={() => update({ vibrate: true })}>
              开
            </button>
            <button className={!vibrateOn ? 'on' : ''} onClick={() => update({ vibrate: false })}>
              关
            </button>
          </div>
        </div>
      )}
      <div className="setting-row">
        <span>新手教程</span>
        <button
          className="btn btn-mini"
          onClick={() => {
            update({ tutorialDone: false });
            onClose();
          }}
        >
          下次进入对局时重看
        </button>
      </div>
      {run && !IS_MINITOOL && (
        <div className="setting-row">
          <span className="muted small">本局种子：{run.seed}</span>
        </div>
      )}
      {run && screen === 'game' && (
        <div className="row-btns">
          <button
            className="btn"
            onClick={() => {
              toTitle();
            }}
          >
            保存并回到标题
          </button>
          {confirm ? (
            <button className="btn btn-danger" onClick={abandon}>
              确定放弃本局？
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
              放弃本局
            </button>
          )}
        </div>
      )}
      <div className="muted small">
        {IS_MINITOOL ? '进度会自动保存在小工具里，退出后再打开可以继续。' : '进度会自动保存在本机浏览器里，刷新页面不会丢失。'}
      </div>
    </Modal>
  );
}
