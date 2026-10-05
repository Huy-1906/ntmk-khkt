# REST API — server local

Base URL: `http://localhost:3000` (đổi bằng biến `PORT`).

Mọi response là JSON:

- Thành công: `{ "ok": true, ... }`
- Thất bại: `{ "ok": false, "error": "<mô tả>" }`
  - `400` — đầu vào không hợp lệ
  - `502` — lỗi khi gọi Blynk (token sai, mất mạng, timeout)

Tham số `:model` ∈ `metal` | `nonmetal`.

Trường `mock: true` trong response nghĩa là lệnh **không** được gửi xuống phần cứng (chế độ MOCK hoặc thiếu token).

---

## `POST /api/:model/select`

Chọn nguyên tố → gửi `V{z}=1` rồi `V{z}=0`.

Body:

```json
{ "z": 11 }
```

Z hợp lệ:

| model | Z |
|---|---|
| `metal` | 3, 11, 12, 13, 19, 20 |
| `nonmetal` | 1, 7, 8, 9, 15, 16, 17 |

```bash
curl -X POST localhost:3000/api/metal/select -H "Content-Type: application/json" -d '{"z":11}'
# {"ok":true,"mock":true}

curl -X POST localhost:3000/api/metal/select -H "Content-Type: application/json" -d '{"z":17}'
# 400 {"ok":false,"error":"Z=17 không thuộc nhóm metal"}
```

## `POST /api/:model/ion`

Tạo ion trên board → `V100=1` rồi `0`.

```bash
curl -X POST localhost:3000/api/nonmetal/ion
```

## `POST /api/:model/reset`

Hạ toàn bộ servo → `V0=1` rồi `0`.

## `POST /api/magnet`

Bật/tắt nam châm điện (`V102`) trên board `MAGNET_BOARD`.

```json
{ "on": true }
```

Response: `{ "ok": true, "on": true, "mock": false }`

## `POST /api/bond`

Liên kết ion: gửi `V100` song song tới cả 2 board, sau đó `V102=1`.

Response: `{ "ok": true, "magnet": true }`

## `GET /api/status`

Kiểm tra board online qua `isHardwareConnected` của Blynk.

```json
{
  "ok": true,
  "metal":    { "online": true,  "mock": false },
  "nonmetal": { "online": false, "mock": false, "error": "Blynk 400: ..." }
}
```

---

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng server |
| `BLYNK_SERVER` | `blynk.cloud` | Host Blynk (vd `sgp1.blynk.cloud`) |
| `TOKEN_METAL` | — | Auth token board A |
| `TOKEN_NONMETAL` | — | Auth token board B |
| `MAGNET_BOARD` | `nonmetal` | Board có nam châm |
| `MOCK` | `0` | `1` = không gọi Blynk |

## Lệnh Blynk thực tế được gọi

```
GET https://{BLYNK_SERVER}/external/api/update?token={TOKEN}&V{pin}={value}
GET https://{BLYNK_SERVER}/external/api/isHardwareConnected?token={TOKEN}
```
