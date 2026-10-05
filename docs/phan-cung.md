# Phần cứng & firmware

## Linh kiện (mỗi mô hình)

| Linh kiện | Số lượng | Ghi chú |
|---|---|---|
| ESP32 DevKit | 1 | WiFi + Blynk |
| PCA9685 16 kênh | 2 | Địa chỉ `0x40` và `0x41` (hàn jumper A0 trên board thứ 2) |
| Servo SG90 | 20 | 1 servo = 1 electron |
| Nam châm điện + mạch driver (MOSFET/relay) | 1 | Chỉ cần ở board được chọn làm `MAGNET_BOARD` |
| Nguồn 5 V cho servo | ≥ 5 A | Không cấp servo từ chân 5V của ESP32 |

Toàn hệ thống: **2 bộ** như trên (Board A – Kim loại, Board B – Phi kim).

## Đấu dây

| ESP32 | Nối tới |
|---|---|
| GPIO21 (SDA) | SDA của cả 2 PCA9685 |
| GPIO22 (SCL) | SCL của cả 2 PCA9685 |
| GPIO18 | Tín hiệu driver nam châm |
| GND | GND chung với nguồn servo và PCA9685 |

| Servo index | Lớp | Board PCA9685 | Kênh |
|---|---|---|---|
| 0–1 | K | 0x40 | 0–1 |
| 2–9 | L | 0x40 | 2–9 |
| 10–15 | M | 0x40 | 10–15 |
| 16–17 | M | 0x41 | 0–1 |
| 18–19 | N | 0x41 | 2–3 |

Sắp xếp servo trên mô hình vật lý theo vòng tròn đồng tâm, thứ tự index chạy theo chiều kim đồng hồ bắt đầu từ đỉnh — trùng với cách web vẽ, để người dùng đối chiếu.

## Thông số servo

Trong `core.cpp`:

```cpp
constexpr uint16_t PULSE_RAISE_US = 1200; // nhô lên
constexpr uint16_t PULSE_LOWER_US = 1350; // hạ xuống
constexpr uint32_t SERVO_STEP_INTERVAL_MS = 40;
```

Servo nào lắp ngược chiều: đặt `true` ở vị trí tương ứng trong mảng `SERVO_REVERSED`.

## Thiết lập Blynk

1. Trên Blynk Console dùng template **"Mo Hinh Nguyen Tu"** (`TMPL6IQvhzg7F`).
2. Datastreams (Virtual Pin, integer 0–1): `V0`, `V1`…`V20`, `V100`, `V102`.
3. Tạo **2 device** từ template: "Model A – Kim loại" và "Model B – Phi kim". Mỗi device có một auth token riêng.
4. Ghi 2 token vào `web/.env` (`TOKEN_METAL`, `TOKEN_NONMETAL`).
5. Kiểm tra region của tài khoản (góc dưới Console, vd `sgp1`) và đặt `BLYNK_SERVER` tương ứng nếu khác `blynk.cloud`.

## Nạp firmware

Thư viện Arduino cần cài: **Blynk**, **Adafruit PWM Servo Driver Library**. Board: *ESP32 Dev Module*.

1. Mở `core.cpp` (đổi thành `.ino` nếu dùng Arduino IDE, hoặc đặt vào `src/` nếu dùng PlatformIO).
2. Tạo file `secrets.h` **cùng thư mục** với `core.cpp` (file này nằm trong `.gitignore`, không bao giờ bị push):
   ```cpp
   #pragma once
   #define BLYNK_AUTH_TOKEN "YOUR_BLYNK_DEVICE_TOKEN"
   #define WIFI_SSID_VALUE  "YOUR_WIFI_SSID"
   #define WIFI_PASS_VALUE  "YOUR_WIFI_PASSWORD"
   ```
3. **Board A**: `BLYNK_AUTH_TOKEN` = token device kim loại → nạp.
4. **Board B**: `BLYNK_AUTH_TOKEN` = token device phi kim → nạp.
5. Mở Serial Monitor 115200 baud, kiểm tra:
   ```
   [I2C] Checking 0x40... OK
   [I2C] Checking 0x41... OK
   [WIFI] CONNECTED
   [BLYNK] CONNECTED
   MODEL A READY
   ```

## Bảo mật

Token Blynk và mật khẩu WiFi nằm trong `secrets.h` (đã `.gitignore`), không nằm trong `core.cpp`. Không commit `secrets.h` và `web/.env`. Nếu token từng bị lộ: tạo lại token trên Blynk Console và đổi mật khẩu WiFi.
