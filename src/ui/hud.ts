/** HUD (P5): điểm, thanh Hype, trạng thái micro / thông báo. Chỉ cập nhật khi giá trị đổi. */
import type { Hud } from '../core/types';
import './style.css';

function div(cls: string, parent?: HTMLElement): HTMLDivElement {
  const e = document.createElement('div');
  e.className = cls;
  parent?.appendChild(e);
  return e;
}

export function createHud(root: HTMLElement): Hud {
  const wrap = div('cs-hud');
  root.appendChild(wrap);

  const scoreBox = div('cs-hud-score', wrap);
  const scoreVal = div('cs-hud-score-val', scoreBox);
  const scoreSub = div('cs-hud-score-sub', scoreBox);

  const hypeBox = div('cs-hud-hype', wrap);
  const hypeLabel = div('cs-hud-hype-label', hypeBox);
  hypeLabel.textContent = 'HYPE';
  const hypeTrack = div('cs-hud-hype-track', hypeBox);
  const hypeFill = div('cs-hud-hype-fill', hypeTrack);

  const mic = div('cs-hud-mic', wrap);
  const micDot = div('cs-hud-mic-dot', mic);
  const micText = document.createElement('span');
  mic.appendChild(micText);
  mic.style.visibility = 'hidden';

  let lastScore = -1;
  let lastPct = -1;
  let lastCombo = -1;
  let lastHype = -1;
  let hot = false;
  let pitchScore = true;

  return {
    update(f) {
      const s = f.score;
      if (!pitchScore) {
        if (lastScore !== -2) {
          lastScore = -2;
          scoreVal.textContent = '—';
          scoreSub.textContent = 'Không chấm cao độ';
        }
      } else {
      const sc = Math.round(s.score);
      if (sc !== lastScore) {
        lastScore = sc;
        scoreVal.textContent = sc.toLocaleString('vi-VN');
      }
      const pct = Math.round(s.percent);
      if (pct !== lastPct || s.combo !== lastCombo) {
        lastPct = pct;
        lastCombo = s.combo;
        scoreSub.textContent = `${pct}%` + (s.combo >= 3 ? ` · x${s.combo}` : '');
      }
      }
      const h = Math.max(0, Math.min(1, f.hype));
      if (Math.abs(h - lastHype) > 0.002) {
        lastHype = h;
        hypeFill.style.transform = `scaleX(${h.toFixed(3)})`;
        hypeFill.style.filter = `hue-rotate(${(-h * 40).toFixed(0)}deg)`;
        const nowHot = h > 0.7;
        if (nowHot !== hot) {
          hot = nowHot;
          hypeBox.classList.toggle('hot', hot);
        }
      }
    },
    setNotice(text) {
      mic.style.visibility = 'visible';
      if (text === null) {
        micText.textContent = 'Micro thật';
        mic.className = 'cs-hud-mic real';
      } else {
        micText.textContent = text;
        mic.className = /xem|không có/i.test(text) ? 'cs-hud-mic none' : 'cs-hud-mic fake';
      }
    },
    setPitchScore(on) {
      pitchScore = on;
      lastScore = -1;
      lastPct = -1;
      lastCombo = -1;
    },
    setVisible(v) {
      wrap.style.display = v ? '' : 'none';
    },
    dispose: () => wrap.remove(),
  };
}
