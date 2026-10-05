# Hướng dẫn sử dụng giao diện web

## Bố cục

```
┌───────────────────────────────────────────────────────────────┐
│ Mô hình Nguyên tử            ● Board A · Kim loại  ● Board B   │  ← đèn trạng thái
├───────────────────────────────┬───────────────────────────────┤
│ MÔ HÌNH 1 — Kim loại          │ MÔ HÌNH 2 — Phi kim           │
│ [Li][Na][Mg][Al][K][Ca]       │ [H][N][O][F][P][S][Cl]        │
│        (mô hình atom)         │        (mô hình atom)         │
│ [Tạo ion] [Reset]             │ [Tạo ion] [Reset]             │
│ Panel thông tin               │ Panel thông tin               │
├───────────────────────────────┴───────────────────────────────┤
│ Liên kết ion     Na + Cl      [Liên kết ion] [Nam châm: TẮT]  │
└───────────────────────────────────────────────────────────────┘
```

## Dùng trên điện thoại / tablet

1. Điện thoại và máy chạy server **cùng mạng WiFi**.
2. Khi `npm start`, server in địa chỉ LAN, ví dụ `Điện thoại/tablet: http://192.168.1.34:3000` → mở địa chỉ đó trên trình duyệt điện thoại.
3. Nếu không vào được: cho phép Node.js qua Windows Firewall (mạng Private).

Giao diện tự co giãn theo thiết bị:

| Thiết bị | Bố cục |
|---|---|
| Điện thoại dọc (320–719 px) | 2 mô hình xếp dọc, nút to dàn full chiều ngang, panel thông tin 1 cột (≤ 420 px) |
| Điện thoại ngang (cao ≤ 500 px) | 2 mô hình cạnh nhau, mô hình co theo chiều cao màn, ẩn tên nguyên tố dưới ký hiệu |
| Tablet / laptop (≥ 720 px) | 2 mô hình cạnh nhau |

Nút có kích thước chạm ≥ 44 px, không dính hiệu ứng hover trên màn cảm ứng, hỗ trợ tai thỏ (safe-area).

## Đèn trạng thái

| Màu | Ý nghĩa |
|---|---|
| Tím | Chế độ MOCK — chưa có token, chỉ mô phỏng trên web |
| Xanh lá | Board đang kết nối Blynk |
| Đỏ | Có token nhưng board offline / lỗi mạng (rê chuột để xem lỗi) |

Trạng thái được cập nhật mỗi 15 giây.

## Thao tác

### 1. Chọn nguyên tố

Bấm một ô nguyên tố trong khu vực tương ứng.

- Mô hình xoá hình cũ, electron **chồi lên** lần lượt vào lớp K → L → M → N.
- Hạt nhân hiển thị ký hiệu và điện tích `+Z`.
- Servo trên board tương ứng nhô lên theo đúng thứ tự.
- Mỗi khu vực chỉ có nguyên tố thuộc nhóm của nó; server cũng từ chối nếu gửi sai nhóm.

### 2. Tạo ion

Bấm **Tạo ion** (chỉ bật khi đã chọn nguyên tố và chưa ion hoá).

- **Kim loại**: electron lớp ngoài cùng chuyển đỏ và **tuột xuống** ra ngoài. Lớp vỏ còn lại nhấp nháy để thể hiện cấu hình bền. Badge điện tích `+`, `2+`, `3+` xuất hiện cạnh hạt nhân.
- **Phi kim**: electron mới màu xanh lá **nhô lên** từ ngoài vào, lấp chỗ trống lớp ngoài cùng. Badge `−`, `2−`, `3−`.
- Panel thông tin thêm dòng "Sau ion hoá" với cấu hình mới và khí hiếm tương ứng.

### 3. Liên kết ion

Khi cả 2 mô hình đã chọn nguyên tố, nút **Liên kết ion** được bật.

1. Electron bay theo đường cong từ kim loại sang hạt nhân phi kim.
2. Kim loại ion hoá, sau đó phi kim ion hoá.
3. Công thức hợp chất hiện ra (tính theo bội chung nhỏ nhất của điện tích), ví dụ:
   - Na + Cl → **NaCl**
   - Mg + Cl → **MgCl₂**
   - Al + O → **Al₂O₃**
   - Ca + N → **Ca₃N₂**
4. Nam châm điện tự bật (V102).

### 4. Nam châm

Nút **Nam châm** bật/tắt độc lập nam châm điện trên board được cấu hình `MAGNET_BOARD`.

### 5. Reset

Hạ toàn bộ electron của mô hình đó về trạng thái ban đầu (servo hạ tuần tự), bỏ chọn nguyên tố.

## Trợ năng

- Mọi thao tác được đọc qua vùng `aria-live` (ví dụ: "Natri, 11 electron, cấu hình 2, 8, 1").
- Dùng `Tab` để di chuyển, `Enter`/`Space` để bấm; nút đang chọn có `aria-pressed="true"`.
- Hệ điều hành bật "giảm chuyển động" → các vòng electron ngừng xoay.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Thông báo đỏ "Không gửi được lệnh xuống phần cứng" | Kiểm tra token trong `web/.env`, board có online trên Blynk Console không |
| `Blynk 400: Invalid token.` | Token sai hoặc thuộc server khác — kiểm tra `BLYNK_SERVER` (vd `sgp1.blynk.cloud`) |
| `EADDRINUSE :::3000` khi `npm start` | Cổng 3000 đang bị chiếm — tắt tiến trình cũ hoặc đặt `PORT=3001` |
| Web chạy nhưng servo không động | Đèn trạng thái tím → đang MOCK; điền token và khởi động lại server |
