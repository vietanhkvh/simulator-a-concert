# Hệ phong cách (themes)

Bốn phong cách chọn được ở sảnh: `chibi` (mặc định, "Kẹo đêm"), `lacquer` ("Mực & Sơn mài · bản Việt", `design/alt/STYLE_B2…`),
`steel` ("Thép & Lửa", `STYLE_C…`), `pixel` ("Đêm Sao Điểm Ảnh", `STYLE_E…`). Bản hiện tại là **v0 = đổi màu + công tắc**:
ba phong cách mới vẫn dùng builder chibi với token của mình, cộng vài hành vi riêng (mục 6). Phần còn lại ở mục 9.

## 1. Cơ chế
- `src/world/style/themeTypes.ts` — kiểu `Theme`: chuỗi (tên, mô tả, tên 3 trạng thái Hype, khẩu hiệu, chữ băng rôn bí mật) ·
  `ramps` (tên gốc của sheet) · `pal` (gán vào 8 ô token) · ink / da / tóc / áo / motif · `zoneSat` · `shadow` (quy tắc bóng) ·
  `hype` · `sky` · `form` (số đầu, bo, viền `ink｜none｜goldInlay｜pixel1`, tô `toy2｜facet｜brush｜pixel`, emissive, chuyển động) ·
  `features` (`skyFeature`, `secretSet`, `crowdVariant`, `standCrowdVariant`, `rigVariant`, `stageVariant`, `bannerCarrier`,
  `heartFigure`, `postFx`, `ui`) · `ui` (cặp màu kiểm WCAG + dải màu thẻ sảnh). Dữ liệu: `style/themes/{chibi,lacquer,steel,pixel}.ts`.
- `style/theme.ts` — `getTheme()`, `getActiveThemeId()`, `listThemes()`, `applyTheme(id)`, `resolveInitialThemeId()`
  (URL `?theme=` > localStorage `cs-theme` > `chibi`), `rememberTheme`, `onThemeChange(cb)`, `themed(sync)`.
- **`applyTheme` ghi token TẠI CHỖ**: `PAL`, `PAL_HEX`, `RAMPS`, `SKIN`, `HAIR`, `CLOTH`, `MOTIF`, `ZONE_SAT`, `SKY`, `HYPE_STAGES`,
  `toonRamp`, `OUTLINE`, `TOY`, `EMISSIVE`, `SQUASH`, `POP`, `GLARE` giữ nguyên danh tính object; số lẻ (`INK`, `INK_SKY`,
  `SECRET_CORE/RIM`, `CHAR_H`, `HEADS_*`, `BEVEL_MIN`, `VEHICLE_MAX_ASPECT`…) là `export let` (live binding). Nó cũng đặt
  `<html data-theme>`. Sau đó **phải dựng lại world**: `rebuildWorld()` (`world/world.ts`) huỷ world cũ, giữ renderer.
- **Luật cho mọi module**: không chép token vào hằng cấp module (`const X = PAL.berry[500]`, chuỗi GLSL có `${…PAL…}`, atlas
  canvas vẽ lúc import). Đọc token trong hàm dựng; chuỗi shader có màu viết thành hàm `() => \`…\``; bộ nhớ đệm cấp module
  bọc trong `themed(() => …)`. Bóng trong shader dùng `glShadow([r,g,b])`, màu token dùng `glHex(hex)`.
- `shadowOf()` theo `theme.shadow`: chibi L×0,72 ngả tím · lacquer ×0,62 dịch ≤ 25° về chàm · steel ×0,6 dịch ≤ 8° về lạnh ·
  pixel lùi một bậc ramp. `hypeColors`, `auroraAmount` (= `skyFxAmount` của mọi phong cách), `shade` không đổi chữ ký.

## 2. Vòng đời world
`main.ts`: `applyTheme(resolveInitialThemeId())` → `createWorld` → `bindWorld(world)` (gán lại mọi handle main giữ: crowd, led,
confetti, emotes, stageFx, crew, entrance, controls, view provider). Chọn thẻ ở sảnh = `selectTheme` (token + CSS đổi ngay, world
chưa đổi); bấm Bắt đầu: nếu `world.themeId` khác phong cách đang bật thì `rebuildWorldNow()` dưới màn đen. Bảng developer /
`window.__dev.setTheme(id)` dựng lại ngay, giữ vị trí + góc máy, bài hát không bị đụng. `__dev.leakCheck(3)` dựng lại 3 vòng
qua 4 phong cách và so `renderer.info.memory`; `__dev.buildTimes()` cho ms dựng. Đo trên Chromium headless (SwiftShader):
44 geometry / 11 texture / 36 program trước và sau 3 vòng (**lệch 0**); dựng 570–830 ms + frame đầu 710–910 ms mỗi phong cách.
Sửa khi rà `dispose()`: `sky` gỡ `activeBurst`; sự kiện bí mật đang diễn phát `cs-secret end` + xoá tiêu điểm camera; world
gỡ đích hậu kỳ, `scene.clear()`, `renderLists.dispose()`; PRNG khinh khí cầu đặt lại mỗi lần dựng (hình giống hệt lần đầu).

## 3. Bảng gán ramp → 8 ô token (builder mặc định đọc `PAL.<ô>`)
| Ô | lacquer | steel | pixel |
|---|---|---|---|
| night | sơn then | than `coal` | mực + lam Phổ-700 + tím chiều-700/500 |
| berry | đỏ son | lửa `flame` (chủ đạo nóng) | hồng sen `#E46A9A` (ramp suy ra) |
| grape | chàm | thép `steel` | tím chiều `tim` |
| soda | bạc quỳ · xà cừ | hồ quang `arc` | lam Phổ lùi 1 bậc |
| mint | ngọc bích | tungsten | lục bách lùi 1 bậc |
| honey | vàng quỳ | trắng nung `whitehot` | vàng crôm |
| peach | cam đèn lồng | than hồng `ember` | son Munch |
| cream | vỏ trứng | giấy `paper` | kem crôm-100, bóng xám mây-300 |
Ramp không có ô: steel `blood` (Hype ≥ 80 %, áo merch) · pixel `dat` (da, gỗ), `may` (đá), lẻ `ngoc` — đọc qua `RAMPS.<tên>`.
Màu trời lấy ở `SKY` (lacquer: chàm · steel: than · pixel: lam Phổ), không lấy ở ô night. Giá trị suy ra có `// derived`.
Khối CSS (`ui/tokens.css`, `:root[data-theme=…]`) gán lại các biến `--cs-<ô>-<bậc>` riêng cho UI (ghi ở đầu mỗi khối).
**Form chưa được builder mặc định tôn trọng:** số đầu 7,5 / 6,5 (rig chibi cố định ~2,3 đầu; chỉ `CHAR_H` đội quay phim đổi),
`outlineRule` `none`/`goldInlay`/`pixel1` (vẫn viền kiểu chibi bằng màu `INK` của phong cách), `shading` `facet`/`brush`/`pixel`,
`bevelMin = 0` (chỉ hộp bo của `stageStyle` giảm bo), `squash`/`pop` (rig ca sĩ có số riêng). Màu chưa theo token: tint biểu
tượng cảm xúc (`emotesAtlas.ICON_TINT`), bảng pháo `secretShared.PALETTE`, dù `entranceProps`, vài highlight gần trắng.

## 4. Chỗ đã sửa "chép token lúc import" (58 chỗ ở zones + 13 số lẻ trong style)
`world/style/palette.ts` (`STAGE_RGB`, `toonRamp`, `INK…` → `let`), `form.ts` (7 số lẻ → `let`).
Chuỗi GLSL → hàm: `outside/skyShaders.ts:41,118,171,227,279` · `secretDragonShaders.ts:9,50,154,253,421` ·
`secretJetShaders.ts:6,50,126,138,225,267` · `balloonKit.ts:348,357` · `flyby.ts:76` · `stands/stadiumShaders.ts:11,188` ·
`arena/entranceProps.ts:82,129,328,350,378,394,620,641` · `cameraCrewToon.ts:23` · `lightsGlare.ts:12` · `lights.ts:33,61,107` ·
`stageFx.ts:45,147,179` · `stageDecoFixtures.ts:22,58` · `stageDeco.ts:212,263` · `ledWall.ts:9` · `stageStyle.ts:39`.
Bảng màu cấp module → hàm / `themed`: `outside/balloonKit.ts:78` · `balloons.ts:43,63` (+ khẩu hiệu mặc định) ·
`secretDragon.ts:62` · `secretJet.ts:32` · `secretRocket.ts:31,32` · `stands/stadiumDecor.ts:9,10` · `arena/band.ts:36` ·
`cameraCrew.ts:38` (11 hằng) · `crowd.ts:70` (19 uniform) · `stageDeco.ts:16` · `stageDecoPal.ts:17` · `stageStyle.ts:23` ·
`emotesAtlas.ts` (INK) · `chibiRig.ts` (MOTIF_BOW). Màu số cứng trong GLSL nay lấy token: nền LED `N5/N3/CREAM`, mặt hành
khách khinh khí cầu / phi công, hệ số bóng tím (`glShadow`). Chibi lệch tối đa 0,002 ở kênh xanh của `CREAM` (0,9 → 0,902).

## 5. Khe builder (variant registry)
Mỗi khu có `builders.ts`: kiểu `<Khu>Builders` (khe → chữ ký), `DEFAULT_BUILDERS` (bản chibi), `pickBuilder(khe, variant)`.
`variant` lấy từ `theme.features`: `'default'` → ép builder mặc định; khác → builder của phong cách nếu có, **chưa có thì mặc định**.
| Khu | Khe → handle | variant |
|---|---|---|
| outside | `sky(ctx) → SkyHandle{update(t),dispose,burstMeteors?}` · `skyFeature(ctx) → {update(f,t),dispose}` (mặc định `null`: cực quang nằm trong `sky`; có builder thì `ctx.aurora=false`) · `bannerCarriers(ctx) → {update?,dispose}` · `flyby(ctx) → {update(f,t),dispose}` · `secretUfo｜secretRocket｜secretDragon｜secretJet(scene) → SecretAct` | `skyFeature`, `bannerCarrier`, `secretSet.*` (`plane` = khe `flyby`) |
| stands | `structure(ctx) → {update?,dispose}` · `standCrowd(ctx) → {update?,dispose}` (mặc định `null`: nằm trong `structure`; có builder thì `ctx.crowd=false`) | `stageVariant`, `standCrowdVariant` |
| arena | `stageBase → {dispose}` · `runway｜ledWall｜stageDeco → {update(f,t),dispose}` · `band → Band` · `crowd → Crowd` (tự tạo ShaderMaterial = biến thể shader) · `lights → Updatable` · `ledScreens → LedScreens` · `confetti → Confetti` · `emotes → Emotes` · `stageFx → StageFx` · `singer → SingerAvatar` · `cameraCrew → CameraCrew` · `entranceProps → Partial<EntranceKit>` · `entrance(ctx, kit) → Entrance` | `stageVariant` (sàn, runway, LED, deco, đèn, fx) · `rigVariant` (ca sĩ, ban nhạc, quay phim) · `crowdVariant` |
`ctx` = `ZoneContext` (`scene, camera, uniforms, glow`) + trường riêng của khu. Handle phải đúng kiểu hiện có: `index.ts` và `main.ts` không biết phong cách.
**Bố cục file:** builder riêng ở `src/zones/<khu>/themes/<id>/<module>.ts`; file tự khai `export const builders = { <khe>: fn }`;
`themes/<id>/index.ts` quét cả thư mục (`import.meta.glob`) nên **không ai phải sửa file chung**. File không có `builders` là
file phụ trợ. Trong thư mục phong cách: chỉ `import type` từ `../../builders`; được import module mặc định của khu, `src/core`,
`src/world`; cấm import thư mục phong cách khác (test `world/zones.test.ts`). Một khe đăng ký hai lần → cảnh báo console.

## 6. Thêm một builder theo phong cách
1) Chọn khe ở mục 5. 2) Tạo `src/zones/<khu>/themes/<id>/<module>.ts`. 3) Trả đúng handle, tự `scene.add` và gỡ + `dispose()`
geometry/material/texture/listener trong `dispose`. 4) Đọc màu qua `RAMPS`/`PAL`/`getTheme()` bên trong hàm. 5) Chạy
`npm test`, mở `?theme=<id>&dev=1`, bấm "Kiểm rò rỉ". Ví dụ (đã có: `outside/themes/lacquer/skyLanterns.ts`):
```ts
// src/zones/outside/themes/steel/secretMirrorBall.ts
import * as THREE from 'three';
import { RAMPS } from '../../../../world/style';
import type { OutsideBuilders, SecretAct } from '../../builders';

function createMirrorBall(scene: THREE.Scene): SecretAct {
  const mat = new THREE.MeshBasicMaterial({ color: RAMPS.steel![300] });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(6, 1), mat);
  ball.visible = false; scene.add(ball);
  return {
    duration: 20,
    start() { ball.visible = true; }, stop() { ball.visible = false; },
    update(t) { ball.position.set(0, 30 + Math.min(t, 4) * 5, -40); ball.rotation.y = t * 0.6; },
    dispose() { scene.remove(ball); ball.geometry.dispose(); mat.dispose(); },
  };
}
export const builders: Partial<OutsideBuilders> = { secretUfo: createMirrorBall };
```

## 7. Hậu kỳ (post-fx)
`theme.features.postFx = { kind: 'pixelate', width, height }` (chỉ `pixel`: 480×270): `world.render()` vẽ cảnh vào
`WebGLRenderTarget` (nearest, không MSAA), hệ số `k = ceil(cao bộ đệm / height)`, đích = `ceil(bộ đệm / k)` (1280×720 → 427×240 ×3; 640×360 → 320×180 ×2;
1920×1080 → 480×270 ×4), rồi một tam giác phủ màn hình phóng **nguyên lần** bằng `floor(gl_FragCoord / k)`. Đích được đánh dấu
như đích XR để vật liệu có sẵn của three mã hoá sRGB như khi vẽ thẳng. UI/lời là DOM nên giữ độ phân giải gốc; chuột/kéo không
đổi. Số liệu (`renderer.info`) gồm cả lượt phóng (+1 draw call). Module tính cỡ điểm / bề dày viền theo pixel phải dùng
`world/shared/viewport.ts` (`viewHeightPx()`, `drawSize()`) thay cho `window.innerHeight` / `getDrawingBufferSize`.

## 8. Hành vi riêng đã có ở v0
lacquer: trời chàm, ẩn cực quang, 150 → 400 đèn trời (1 Points) khi Hype > 40 % · steel: ẩn cực quang, 8 đèn rọi + trần mây khói
hắt than hồng, ửng huyết ≥ 80 % (2 draw call) · pixel: pixelate. Cả ba: khối CSS riêng (sơn mài viền kép vàng + serif · thép góc
vát, condensed IN HOA, nút cam · pixel góc vuông, monospace, bóng cứng), khẩu hiệu cổ vũ + chữ băng rôn bí mật riêng.

## 9. Kế hoạch gói việc tiếp theo (chạy song song được)
Luật chung: mỗi gói **chỉ tạo/sửa file mình sở hữu** trong `src/zones/*/themes/<id>/`; **không sửa** `builders.ts`, `index.ts`,
module mặc định, `src/world/**`, `src/ui/**`, `main.ts` (cần đổi hợp đồng → báo người điều phối). Xong khi: `npm test` +
`npx tsc --noEmit` sạch, `__dev.leakCheck(3)` lệch 0, chibi không đổi, ảnh `?theme=<id>` đạt tiêu chí. Thứ tự = tác động hình ảnh.

### lacquer — "Mực & Sơn mài · bản Việt" (STYLE_B2 + STYLE_B mục 4)
| Gói | Mục tiêu · khe | File sở hữu | Tiêu chí ảnh · mục sheet |
|---|---|---|---|
| L1 | Đình 2 tầng mái đầu đao, cột son, bình phong, mặt trống đồng 14 tia (sàn + B-stage), tường LED mặt trời trống đồng; khán đài mái ngói cong + cờ ngũ sắc · `stageBase runway ledWall stageDeco lights stageFx` + stands `structure` | `arena/themes/lacquer/stage*.ts`, `stands/themes/lacquer/structure*.ts` | góc ca sĩ + toàn cảnh thấy mái đình đỏ son/vàng, sàn trống đồng; không còn cổng bóng bay · B2 §7 |
| L2 | Đôi rồng Lý chầu nguyệt (thân trơn uốn sin, không sừng, mào lửa, 3 móng, ngậm ngọc, "nét cọ vẽ ra") · `secretDragon` | `outside/themes/lacquer/secretDragon*.ts` | `__csSecret.trigger('dragon',true)`: 2 rồng vàng quỳ + ngọc bích hai bên trăng · B2 §5 |
| L3 | Chín hạc + sông đèn trời vẽ chữ S, đủ Hoàng Sa (5) + Trường Sa (7), sao vàng nền son · `secretJet` | `outside/themes/lacquer/secretJet*.ts` | chữ S dựng đứng 25–45° trên khán đài đối diện, hai cụm đảo ≥ 3 px, không cắt xén · B2 §6, §9 |
| L4 | Ca sĩ áo dài 7,5 đầu + ban nhạc dân tộc; khán giả vệt cọ cầm đèn lồng / nón lá; khán đài đốm đèn lồng · `singer band cameraCrew crowd` + stands `standCrowd` | `arena/themes/lacquer/{rig,singer,band,crew,crowd}*.ts`, `stands/themes/lacquer/standCrowd*.ts` | ca sĩ áo dài son khăn vấn vàng, không mắt chibi; biển đèn lồng dưới sân · B2 §4, §7 |
| L5 | Trời: trăng khảm vỏ trứng, núi đá vôi 3 lớp, đèn trời instanced + mưa vàng quỳ ≥ 80 % · `sky skyFeature` | `outside/themes/lacquer/sky*.ts` (gồm `skyLanterns.ts`) | trời chàm, trăng tròn khảm, dãy núi sau khán đài · B2 §3, §7 |
| L6 | Đèn trăng khổng lồ thả đèn trời, pháo bông trúc 5 ống, diều sáo kéo liễn, đèn lồng Hội An mang liễn dọc; emote/pháo giấy lá vàng · `secretUfo secretRocket flyby bannerCarriers confetti emotes` | `outside/themes/lacquer/{secretUfo,secretRocket,flyby,banner}*.ts`, `arena/themes/lacquer/{confetti,emotes}*.ts` | 6 đèn lồng đỏ mang liễn thay khinh khí cầu; pháo hoa cúc/sen · B2 §7 |

### steel — "Thép & Lửa" (STYLE_C)
| Gói | Mục tiêu · khe | File sở hữu | Tiêu chí ảnh · mục sheet |
|---|---|---|---|
| S1 | Giàn hộp thép chữ X mái đầu hồi, tường loa 2 × 9, line-array, 8 ống lửa, thác pyro, catwalk lưới thép, B-stage sọc cảnh báo, LED đỏ tia sét; khán đài dầm thép + cột đèn hộp · `stageBase runway ledWall stageDeco lights stageFx` + stands `structure` | `arena/themes/steel/stage*.ts`, `stands/themes/steel/structure*.ts` | góc ca sĩ thấy giàn thép + lửa, không còn hình bo tròn · C §5 |
| S2 | Rig 7,5 đầu đẽo mặt phẳng (mặt 3 mặt phẳng, không mắt, không viền, rim lửa): ca sĩ + ban nhạc (guitar chữ V, trống đủ, ampli) + quay phim · `singer band cameraCrew` | `arena/themes/steel/{rig,singer,band,crew}*.ts` | ca sĩ tỉ lệ thật ở góc cần cẩu, flatShading thấy rõ mặt phẳng · C §4, §5 |
| S3 | Khán giả đa giác 6,5 đầu: nắm đấm / tay sừng / điện thoại / bật lửa, sóng mosh; khán đài đốm tungsten/arc; tàn lửa thay pháo giấy · `crowd confetti emotes` + stands `standCrowd` | `arena/themes/steel/{crowd,confetti,emotes}*`, `stands/themes/steel/standCrowd*.ts` | không còn lightstick kẹo; 30 % đèn điện thoại · C §4, §5 |
| S4 | Rồng cơ khí (đốt thép bản lề, khe lò đỏ, phun lửa 3 lớp) + cầu gương 12 m treo cần cẩu, 64 tia · `secretDragon secretUfo` | `outside/themes/steel/{secretDragon,secretUfo}*.ts` | hai sự kiện đọc được từ góc toàn cảnh, chữ ký vòng tia lửa · C §5 |
| S5 | Tên lửa thép 4 : 1 + thác lửa + sao nhọn; phản lực vẽ tia sét; 2 trực thăng căng banner; blimp tấm ghép + cờ tour stencil · `secretRocket secretJet flyby bannerCarriers` | `outside/themes/steel/{secretRocket,secretJet,flyby,banner}*.ts` | tia sét thay tim khói; blimp thay khinh khí cầu · C §5 |
| S6 | Trời gần đen, trăng nhỏ sắc cạnh, tàn lửa bay lên ≥ 80 % thay sao băng, mây khói có khối + đèn rọi chạm mây · `sky skyFeature` | `outside/themes/steel/sky*.ts` (gồm `skySearchlights.ts`) | trên lạnh – dưới ấm; không còn trăng chibi ngủ · C §3 |

### pixel — "Đêm Sao Điểm Ảnh" (STYLE_E)
| Gói | Mục tiêu · khe | File sở hữu | Tiêu chí ảnh · mục sheet |
|---|---|---|---|
| P1 | Trời "Đêm đầy sao" động: trường dòng + vệt cọ, 11 sao quầng đập theo phách, trăng khuyết cam, cây bách + làng; Hype ≥ 80 %: trời "Tiếng thét" dải gợn son–cam · `sky skyFeature` | `outside/themes/pixel/sky*.ts` | xoáy Van Gogh nhận ra ngay ở 427×240; đổi sang son ≥ 80 % trong ≥ 1,2 s · E §3, §5 |
| P2 | Khán giả sprite 4 tầng cầm sao quầng, 1/12 "Người thét", khách mời ≤ 1/40 (chỉ tác phẩm công cộng ở E §5); khán đài điểm hoạ chấm 1 px · `crowd` + stands `structure standCrowd` | `arena/themes/pixel/crowd*`, `stands/themes/pixel/*.ts` | đếm được Người thét ở hàng đầu; ≥ 80 % cả sân ôm má · E §4, §5 |
| P3 | Sân khấu khung tranh mạ vàng, LED = toan trên giá vẽ, runway vệt cọ vàng, B-stage bảng pha màu, đèn dither · `stageBase runway ledWall stageDeco ledScreens lights stageFx` | `arena/themes/pixel/stage*.ts` | khung vàng 4 góc hoa thị quanh sân khấu · E §6 |
| P4 | Ca sĩ "hoạ sĩ rock" (mũ nồi son, áo dính sơn, mic = cọ) + ban nhạc thùng sơn / bảng pha màu / giá vẽ, 12 fps · `singer band cameraCrew` | `arena/themes/pixel/{singer,band,crew}*.ts` | sprite 20×32 px đọc được ở góc cần cẩu · E §4, §6 |
| P5 | Bảng pha màu bay, đôi rồng nét cọ, tuýp sơn + pháo sao Van Gogh / hướng dương, hai cọ vẽ tim son, máy bay giấy kéo toan, toan căng khung + plaque · `secretUfo secretDragon secretRocket secretJet flyby bannerCarriers` | `outside/themes/pixel/{secret*,flyby,banner}*.ts` | mỗi sự kiện có viền mực 1 px, không gradient mượt · E §6 |
| P6 | Hậu kỳ: lượng tử hoá 31 màu (LUT) + Bayer 4×4, bám lưới texel cho camera · **gói duy nhất được sửa** `src/world/world.ts` (phần `post`) + file mới `src/world/shared/pixelPost.ts` | như bên | ảnh ≤ 31 màu, không rung khi camera trôi · E §4, §8 |
