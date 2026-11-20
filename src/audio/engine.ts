import type { AudioEngine } from '../core/types';

export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const gain = ctx.createGain();
  // Âm lượng nhạc (setVolume) nằm SAU analyser để level() (hình ảnh) không đổi theo âm lượng.
  const outGain = ctx.createGain();
  gain.connect(analyser);
  analyser.connect(outGain);
  outGain.connect(ctx.destination);
  const levelBuf = new Float32Array(analyser.fftSize);

  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  let startAt: number | null = null;
  let hasEnded = false;
  let smoothed = 0;
  // Chế độ media element (video karaoke): đồng hồ = el.currentTime.
  let media: HTMLMediaElement | null = null;
  let mediaNode: MediaElementAudioSourceNode | null = null;
  let mediaTimer: ReturnType<typeof setTimeout> | null = null;
  // Tạm dừng riêng phần nhạc (AudioContext vẫn chạy cho tiếng đám đông / thử micro): now() = pausedAt.
  let pausedAt: number | null = null;

  const releaseMedia = () => {
    if (mediaTimer !== null) clearTimeout(mediaTimer);
    mediaTimer = null;
    if (media) {
      media.onended = null;
      media.pause();
    }
    mediaNode?.disconnect();
    mediaNode = null;
    media = null;
  };

  const latency = () => {
    const c = ctx as AudioContext & { outputLatency?: number };
    const l = c.outputLatency;
    return typeof l === 'number' && Number.isFinite(l) && l > 0 ? l : (ctx.baseLatency ?? 0);
  };

  const killSource = () => {
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      /* chưa start / đã dừng */
    }
    source.disconnect();
    source = null;
  };

  return {
    ctx,
    resume: async () => {
      if (ctx.state !== 'running') await ctx.resume();
    },
    async loadMedia(el) {
      killSource();
      releaseMedia();
      buffer = null;
      if (!(el.readyState >= 1)) {
        await new Promise<void>((resolve, reject) => {
          el.addEventListener('loadedmetadata', () => resolve(), { once: true });
          el.addEventListener('error', () => reject(new Error('Trình duyệt không mở được file video này')), { once: true });
          el.load();
        });
      }
      mediaNode = ctx.createMediaElementSource(el);
      mediaNode.connect(gain);
      media = el;
    },
    async load(buf) {
      releaseMedia();
      // decodeAudioData có thể detach buffer; truyền bản sao để gọi lại được.
      buffer = await ctx.decodeAudioData(buf.slice(0));
    },
    play(leadInSec) {
      pausedAt = null;
      if (media) {
        const el = media;
        if (mediaTimer !== null) clearTimeout(mediaTimer);
        el.pause();
        el.currentTime = 0;
        hasEnded = false;
        el.onended = () => {
          if (media === el) hasEnded = true;
        };
        startAt = ctx.currentTime + Math.max(0, leadInSec);
        mediaTimer = setTimeout(() => {
          mediaTimer = null;
          el.play().catch((err) => console.warn('[audio] video.play() bị chặn:', err));
        }, Math.max(0, leadInSec) * 1000);
        return;
      }
      if (!buffer) throw new Error('AudioEngine.play: chưa load audio');
      killSource();
      hasEnded = false;
      const when = ctx.currentTime + Math.max(0, leadInSec);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      src.onended = () => {
        if (source === src) hasEnded = true;
      };
      src.start(when);
      source = src;
      startAt = when;
    },
    seek(sec) {
      if (startAt === null) return;
      const dur = media ? (Number.isFinite(media.duration) ? media.duration : 0) : buffer ? buffer.duration : 0;
      const target = Math.max(0, Math.min(sec, Math.max(0, dur - 1)));
      hasEnded = false;
      if (pausedAt !== null) {
        // Nhạc đang dừng: chỉ dời vị trí, resumeMusic() phát tiếp từ đây.
        if (media) media.currentTime = target;
        pausedAt = target;
        return;
      }
      if (media) {
        const el = media;
        if (mediaTimer !== null) {
          // Tua trong lúc đếm ngược: bỏ chờ, phát luôn từ vị trí mới.
          clearTimeout(mediaTimer);
          mediaTimer = null;
          startAt = ctx.currentTime;
          if (ctx.state === 'running') el.play().catch((err) => console.warn('[audio] video.play() bị chặn:', err));
        }
        el.currentTime = target;
        return;
      }
      if (!buffer) return;
      // Nguồn mới bắt đầu ngay (ctx.currentTime); khi AudioContext đang treo (tạm dừng) thì
      // nó chờ tới lúc resume và phát tiếp từ vị trí mới. now() = target ngay sau khi tua:
      // mẫu phát tại thời điểm x nghe thấy ở x + latency, nên offset = target + latency.
      killSource();
      const L = latency();
      const offset = Math.min(buffer.duration, target + L);
      const c = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      src.onended = () => {
        if (source === src) hasEnded = true;
      };
      src.start(c, offset);
      source = src;
      startAt = c - offset;
    },
    stop() {
      pausedAt = null;
      if (mediaTimer !== null) clearTimeout(mediaTimer);
      mediaTimer = null;
      media?.pause();
      killSource();
      startAt = null;
      hasEnded = false;
    },
    pauseMusic() {
      if (startAt === null || pausedAt !== null) return;
      if (media) {
        if (mediaTimer !== null) return; // còn đang đếm ngược: không hỗ trợ
        pausedAt = media.currentTime;
        media.pause();
        return;
      }
      pausedAt = ctx.currentTime - startAt - latency();
      killSource();
    },
    resumeMusic() {
      if (pausedAt === null) return;
      const at = pausedAt;
      pausedAt = null;
      if (media) {
        media.currentTime = at;
        media.play().catch((err) => console.warn('[audio] video.play() bị chặn:', err));
        return;
      }
      if (!buffer || startAt === null) return;
      // Như seek(): now() = at ngay sau khi phát lại.
      const L = latency();
      const offset = Math.max(0, Math.min(buffer.duration, at + L));
      const c = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      src.onended = () => {
        if (source === src) hasEnded = true;
      };
      src.start(c, offset);
      source = src;
      startAt = c - offset;
    },
    get musicPaused() {
      return pausedAt !== null;
    },
    setVolume(v) {
      const vol = Math.max(0, Math.min(2, Number.isFinite(v) ? v : 1));
      outGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.03);
    },
    now: () => {
      if (startAt === null) return 0;
      if (pausedAt !== null) return pausedAt;
      if (media) {
        const pre = ctx.currentTime - startAt;
        return pre < 0 || (media.paused && media.currentTime === 0) ? Math.min(0, pre) : media.currentTime;
      }
      return ctx.currentTime - startAt - latency();
    },
    level() {
      analyser.getFloatTimeDomainData(levelBuf);
      let s = 0;
      for (let i = 0; i < levelBuf.length; i++) s += levelBuf[i] * levelBuf[i];
      const rms = Math.sqrt(s / levelBuf.length);
      const target = Math.min(1, rms * 3);
      smoothed = target > smoothed ? target : smoothed * 0.9 + target * 0.1;
      return smoothed;
    },
    get ended() {
      return hasEnded;
    },
    get durationSec() {
      if (media) return Number.isFinite(media.duration) ? media.duration : 0;
      return buffer ? buffer.duration : 0;
    },
  };
}
