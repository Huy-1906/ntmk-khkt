# Kiến trúc hệ thống

## Tổng quan

```
Trình duyệt ──POST /api/*──► server.js ──GET /external/api/update──► Blynk Cloud ──► ESP32 (core.cpp)
     ▲                            │                                                      │
     └──── GET /api/status ◄──────┴──── GET /external/api/isHardwareConnected ◄──────────┘
```

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| `web/public/*` | HTML/CSS/JS thuần, SVG | Giao diện, animation, logic mô phỏng |
| `web/server.js` | Node.js 18+, Express | Phục vụ file tĩnh, kiểm tra hợp lệ, giữ token, gọi Blynk |
| Blynk Cloud | Blynk IoT HTTP API | Chuyển virtual pin tới thiết bị |
| `core.cpp` | ESP32 Arduino, PCA9685 | Điều khiển 20 servo + nam châm |

Hai board chạy **cùng một firmware**, chỉ khác `BLYNK_AUTH_TOKEN`. Server ánh xạ `metal` → `TOKEN_METAL`, `nonmetal` → `TOKEN_NONMETAL`.

## Ánh xạ servo ↔ electron

Khớp `ELECTRON_CHANNELS` trong `core.cpp`:

| Lớp | Sức chứa | Servo index | Bán kính vẽ (SVG) |
|---|---|---|---|
| K | 2 | 0–1 | 52 |
| L | 8 | 2–9 | 98 |
| M | 8 | 10–17 | 144 |
| N | 2 | 18–19 | 186 |

Servo 0–15 nằm trên PCA9685 `0x40`, servo 16–19 trên PCA9685 `0x41`.

Trên web, mỗi chấm electron có `data-servo=<index>` tương ứng 1:1 với servo vật lý.

## Virtual pin Blynk

| Pin | Kiểu | Hành vi firmware |
|---|---|---|
| `V0` | push | `resetModel()` — hạ tuần tự 20 servo |
| `V1`–`V20` | push | `selectAtom(Z)` — hiển thị nguyên tử trung hoà |
| `V100` | push | `executeIonicBond()` — hiển thị trung hoà rồi nhường/nhận e |
| `V102` | switch | Nam châm điện GPIO18 bật/tắt |

Firmware chỉ phản ứng khi nhận giá trị `1`, nên với pin kiểu push server gửi `1` rồi `0` (giống thả nút) để lần bấm sau vẫn kích hoạt.

## Logic ion — đồng bộ web và firmware

`app.js` sao chép đúng thuật toán của firmware để hình trên web trùng với servo thật:

| Firmware (`core.cpp`) | Web (`app.js`) | Quy tắc |
|---|---|---|
| `displayNeutralAtom` | `neutralTargets` | Điền `shells[i]` electron đầu tiên của mỗi lớp |
| `getOuterShellIndex` | `outerShellIndex` | Lớp cao nhất có electron |
| `removeOuterElectrons` | `ionTargets` (metal) | Hạ từ index **cuối** lớp ngoài cùng lùi về |
| `addOuterElectrons` | `ionTargets` (nonmetal) | Bật các slot **trống đầu tiên** trong lớp ngoài cùng |
| `updateServoScheduler` (40 ms/servo) | `applyTargets` (`STEP_MS = 40`) | Cập nhật tuần tự từng servo theo index |

Số electron nhường/nhận (`transfer`) lấy từ cột `ionicTransfer` trong bảng `ELEMENTS` của firmware, sao chép vào `web/public/elements.js`.

> Khi sửa dữ liệu nguyên tố trong `core.cpp`, cần cập nhật `elements.js` (phía web) và `ALLOWED_Z` trong `server.js` cho khớp.

## Frontend

- **`elements.js`** — dữ liệu tĩnh 13 nguyên tố: `z, symbol, name, shells[4], transfer, noble`.
- **`app.js`**
  - `buildAtom()` dựng SVG: 4 vòng, 20 slot, hạt nhân, badge ion. Mỗi lớp là một `<g class="shell">` xoay bằng CSS.
  - Mỗi panel có state riêng `{ el, ionized, state[20], busy, runId }` → hai mô hình hoàn toàn độc lập.
  - `runId` tăng mỗi khi chọn nguyên tố/reset; animation đang chạy kiểm tra `runId` và tự dừng → bấm nhanh liên tục không làm lẫn trạng thái.
  - Gọi API theo kiểu **optimistic**: animation chạy ngay, lỗi mạng chỉ hiện toast, mô phỏng vẫn tiếp tục.
- **`styles.css`** — animation bằng `@keyframes`: `pop` (chồi lên), `drop` (tuột xuống theo hướng bán kính), `rise` (nhô lên từ ngoài vào), `stable` (nhấp nháy lớp vỏ bền), `spin` (xoay vòng).

Lưu ý kỹ thuật: lớp vỏ xoay dùng `transform-box: view-box; transform-origin: 0 0`. Với `view-box`, gốc toạ độ là điểm (0,0) của user space — trùng tâm nguyên tử vì `viewBox="-200 -200 400 400"`. Dùng `50% 50%` sẽ xoay quanh điểm (200,200) và làm electron văng khỏi vòng.

## Backend

- `isMock(model)` = `MOCK=1` **hoặc** board không có token → chỉ log `[MOCK] metal V11=1`, không gọi mạng.
- `blynkRequest()` dùng `fetch` có sẵn trong Node, timeout 5 s, **thử lại 1 lần** khi lỗi mạng (lần kết nối TLS đầu tiên có thể chậm).
- Lỗi Blynk được trả về dạng `{ ok:false, error }` với HTTP 502; lỗi đầu vào trả HTTP 400.
