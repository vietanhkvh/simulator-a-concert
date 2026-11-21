// Bốn sự kiện bí mật mặc định (chibi) — gói riêng, tải LƯỜI qua secretEvents.ts (preloadDefaultSecrets) khi Hype ≥ 0,8
// hoặc khi có lệnh trigger; ~29 kB gzip không nằm trong lần tải đầu. Không import tĩnh file này từ mã tải ngay.
export { createUfo } from './secretUfo';
export { createRocket } from './secretRocket';
export { createDragon } from './secretDragon';
export { createJet } from './secretJet';
