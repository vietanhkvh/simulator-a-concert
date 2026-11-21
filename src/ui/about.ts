/**
 * Panel "Giới thiệu / Bản quyền" ở sảnh: ghi công bài hát (CC BY 4.0), giấy phép thư viện, quyền riêng tư.
 * Nội dung bài hát lấy từ manifest (SongManifestEntry) để không lệch với file thật.
 */
import './tokens.css';
import './style.css';
import './about.css';

export interface AboutSong { title: string; artist: string; license?: string; licenseUrl?: string; sourceUrl?: string }

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const safeUrl = (u?: string): string => (u && /^https?:\/\//i.test(u) ? esc(u) : '');

let openPanel: { close(): void } | null = null;

export function openAbout(song: AboutSong | null, opener?: HTMLElement): void {
  openPanel?.close();
  const licUrl = safeUrl(song?.licenseUrl) || 'https://creativecommons.org/licenses/by/4.0/';
  const src = safeUrl(song?.sourceUrl);
  const veil = document.createElement('div');
  veil.className = 'cs-about-veil';
  veil.innerHTML = `<div class="cs-about" role="dialog" aria-modal="true" aria-labelledby="cs-about-h">
    <h2 id="cs-about-h">Giới thiệu / Bản quyền</h2>
    <p>Simulator A Concert là trò chơi giả lập buổi hòa nhạc chạy trên trình duyệt, phi thương mại: bạn đứng trên sân khấu, hát vào micro và được chấm cao độ.</p>
    <h3>Nhạc trong game</h3>
    <p>“${esc(song?.title ?? 'Chasing Marks')}” — ${esc(song?.artist ?? 'Silver Note')}, theo giấy phép
      <a href="${licUrl}" target="_blank" rel="noopener noreferrer">Creative Commons Ghi công 4.0 (CC BY 4.0)</a>.
      ${src ? `Nguồn bộ file nốt: <a href="${src}" target="_blank" rel="noopener noreferrer">UltraStar Deluxe songs</a>. ` : ''}
      Trang của tác giả: <a href="https://silvernote.bandcamp.com/track/chasing-marks" target="_blank" rel="noopener noreferrer">silvernote.bandcamp.com</a>.</p>
    <p>Thay đổi so với bản gốc: game dùng bản không lời (Instrumental) do chính tác giả phát hành, cùng file nốt UltraStar để chấm điểm. Game không dùng ảnh bìa hay ảnh nền của bài. Tác giả không bảo trợ hay xác nhận trò chơi này.</p>
    <h3>Thư viện mã nguồn mở</h3>
    <ul>
      <li><a href="https://threejs.org" target="_blank" rel="noopener noreferrer">three.js</a> — giấy phép MIT, © three.js authors.</li>
      <li><a href="https://github.com/ianjohnson/pitchy" target="_blank" rel="noopener noreferrer">pitchy</a> — giấy phép MIT, © 2018–2021 Ian Johnson (nhận diện cao độ).</li>
    </ul>
    <h3>Quyền riêng tư</h3>
    <ul>
      <li>Âm thanh từ micro chỉ được xử lý ngay trên thiết bị của bạn để chấm điểm; không ghi âm, không gửi đi đâu.</li>
      <li>File nhạc, lời, video bạn chọn từ máy chỉ được đọc cục bộ trong trình duyệt và không bao giờ được tải lên máy chủ.</li>
      <li>Trò chơi không dùng cookie theo dõi; chỉ lưu cài đặt (phong cách, micro, âm lượng) trong trình duyệt của bạn.</li>
    </ul>
    <h3>File do bạn nhập</h3>
    <p>Bạn tự chịu trách nhiệm bảo đảm mình có quyền sử dụng những bài hát, lời và video mà bạn nhập vào game.</p>
    <button type="button" class="cs-btn cs-btn-sub cs-about-close">Đóng</button>
  </div>`;
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  const close = (): void => {
    window.removeEventListener('keydown', onKey, true);
    veil.remove();
    openPanel = null;
    opener?.focus({ preventScroll: true });
  };
  veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
  veil.querySelector('.cs-about-close')!.addEventListener('click', close);
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(veil);
  (veil.querySelector('.cs-about-close') as HTMLElement).focus({ preventScroll: true });
  openPanel = { close };
}

/** Nút liên kết nhỏ "Giới thiệu / Bản quyền" để gắn vào thẻ sảnh. */
export function createAboutLink(song: AboutSong | null): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cs-about-link';
  b.textContent = 'Giới thiệu / Bản quyền';
  b.addEventListener('click', () => openAbout(song, b));
  return b;
}
