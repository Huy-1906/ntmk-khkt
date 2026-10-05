# Mô hình Nguyên tử cho người khiếm thị

Mô hình nguyên tử vật lý giúp người khiếm thị **cảm nhận cấu hình electron bằng tay**: mỗi electron là một servo, electron có mặt thì servo **nhô lên**, không có thì **hạ xuống**. Hệ thống gồm 2 mô hình chạy song song — một cho **kim loại** (tạo cation), một cho **phi kim** (tạo anion) — và một giao diện web để điều khiển, minh hoạ trực quan, và mô phỏng liên kết ion.

```
┌──────────────┐   HTTP    ┌──────────────┐  HTTPS   ┌─────────────┐  WiFi   ┌────────────────────┐
│ Trình duyệt  │ ───────►  │ Server local │ ───────► │ Blynk Cloud │ ──────► │ ESP32 A (Kim loại) │
│ (web/public) │  /api/*   │ (web/server) │  token   │             │         │ ESP32 B (Phi kim)  │
└──────────────┘           └──────────────┘          └─────────────┘         └────────────────────┘
                                                                              20 servo / board
```

## Tính năng

- **2 mô hình độc lập**: chọn Natri ở Mô hình 1 và Clo ở Mô hình 2 mà không ảnh hưởng lẫn nhau.
- **Chọn nguyên tố** → electron "chồi lên" lần lượt vào các lớp K, L, M, N (đúng thứ tự và nhịp 40 ms của servo).
- **Tạo ion**
  - Kim loại: electron lớp ngoài cùng **tuột xuống** (bị nhường), lộ ra lớp vỏ bền của khí hiếm.
  - Phi kim: electron **nhô lên** lấp đầy lớp ngoài cùng.
- **Liên kết ion**: electron bay từ kim loại sang phi kim, hiện công thức hợp chất (NaCl, MgCl₂, Al₂O₃, Ca₃N₂…) và bật nam châm điện.
- **Panel thông tin hoá học**: số hiệu Z, cấu hình electron, xu hướng nhường/nhận, cấu hình sau ion hoá, khí hiếm tương ứng.
- **Trợ năng**: thông báo qua `aria-live` cho trình đọc màn hình, điều khiển bằng bàn phím, tôn trọng `prefers-reduced-motion`.
- **Chế độ mô phỏng (MOCK)**: chạy web không cần phần cứng.

## Nguyên tố hỗ trợ

| Mô hình 1 — Kim loại (Cation) | Cấu hình → Ion | Mô hình 2 — Phi kim (Anion) | Cấu hình → Ion |
|---|---|---|---|
| Liti (Li) — 3e | 2,1 → Li⁺ (2) | Hiđro (H) — 1e | 1 → H⁻ (2) |
| Natri (Na) — 11e | 2,8,1 → Na⁺ (2,8) | Nitơ (N) — 7e | 2,5 → N³⁻ (2,8) |
| Magie (Mg) — 12e | 2,8,2 → Mg²⁺ (2,8) | Oxi (O) — 8e | 2,6 → O²⁻ (2,8) |
| Nhôm (Al) — 13e | 2,8,3 → Al³⁺ (2,8) | Flo (F) — 9e | 2,7 → F⁻ (2,8) |
| Kali (K) — 19e | 2,8,8,1 → K⁺ (2,8,8) | Phốt pho (P) — 15e | 2,8,5 → P³⁻ (2,8,8) |
| Canxi (Ca) — 20e | 2,8,8,2 → Ca²⁺ (2,8,8) | Lưu huỳnh (S) — 16e | 2,8,6 → S²⁻ (2,8,8) |
| — | — | Clo (Cl) — 17e | 2,8,7 → Cl⁻ (2,8,8) |

## Cấu trúc thư mục

```
ntmk/
├── core.cpp              Firmware ESP32 (dùng chung cho cả 2 board)
├── secrets.h             (tự tạo, không commit) token Blynk + WiFi
├── README.md
├── docs/
│   ├── huong-dan-su-dung.md   Hướng dẫn sử dụng giao diện
│   ├── kien-truc.md           Kiến trúc & luồng dữ liệu
│   ├── api.md                 REST API của server local
│   ├── phan-cung.md           Phần cứng, đấu dây, nạp firmware
│   └── kiem-thu.md            Kế hoạch & kết quả kiểm thử
└── web/
    ├── package.json
    ├── server.js         Express: phục vụ web + chuyển lệnh sang Blynk
    └── public/
        ├── index.html
        ├── styles.css    Giao diện & animation
        ├── elements.js   Dữ liệu 13 nguyên tố
        └── app.js        Logic mô hình, animation, gọi API
```

## Chạy nhanh

Yêu cầu: **Node.js 18+**.

```bash
cd web
npm install
npm start
```

Mở http://localhost:3000. Trên điện thoại/tablet cùng WiFi: dùng địa chỉ `http://<IP-LAN>:3000` mà server in ra khi khởi động. Giao diện responsive từ 320 px đến màn lớn, cả chiều dọc lẫn ngang.

Nếu chưa cấu hình token, server tự chạy **chế độ MOCK** (chỉ mô phỏng trên web, đèn trạng thái màu tím).

### Kết nối phần cứng thật

Tạo file `web/.env`:

```ini
# Server Blynk (vd: blynk.cloud, sgp1.blynk.cloud)
BLYNK_SERVER=blynk.cloud

# Auth token từng ESP32 (cùng template, 2 device khác nhau)
TOKEN_METAL=<token board A - kim loại>
TOKEN_NONMETAL=<token board B - phi kim>

# Board có nối nam châm điện (V102): metal | nonmetal
MAGNET_BOARD=nonmetal

PORT=3000

# 1 = chỉ mô phỏng, không gửi lệnh xuống phần cứng
MOCK=0
```

Khởi động lại server (`npm start`). Đèn trạng thái trên header chuyển **xanh** khi board online, **đỏ** khi mất kết nối.

Token chỉ nằm ở server, trình duyệt không bao giờ nhìn thấy.

## Tài liệu

- [Hướng dẫn sử dụng](docs/huong-dan-su-dung.md)
- [Kiến trúc hệ thống](docs/kien-truc.md)
- [REST API](docs/api.md)
- [Phần cứng & firmware](docs/phan-cung.md)
- [Kiểm thử](docs/kiem-thu.md)

## Lưu ý bảo mật

Token Blynk và mật khẩu WiFi của firmware nằm trong `secrets.h`; token server nằm trong `web/.env`. Cả hai đều có trong `.gitignore` — không commit. Mẫu `secrets.h` xem [docs/phan-cung.md](docs/phan-cung.md#nạp-firmware).
