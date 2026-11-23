// 兼容补丁必须最先执行（小工具要兼容旧版 Android WebView）
import { detectFlexGap } from './platform/polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/zcool-kuaile/400.css';
import './styles.css';
import App from './App';
import { IS_MINITOOL, setupWindowInfo } from './platform/xhs';

detectFlexGap();
if (IS_MINITOOL) {
  document.documentElement.classList.add('minitool');
  setupWindowInfo();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
