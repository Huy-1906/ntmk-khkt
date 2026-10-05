# Kiểm thử

## Kiểm thử end-to-end (trình duyệt)

Chạy bằng Chrome headless qua `puppeteer-core` trên server ở chế độ MOCK.

**Kết quả gần nhất: 204 / 204 kiểm tra đạt**, không có lỗi console.

| Nhóm | Nội dung kiểm tra |
|---|---|
| Danh sách | Khu kim loại đúng 6 nút (Li, Na, Mg, Al, K, Ca); khu phi kim đúng 7 nút (H, N, O, F, P, S, Cl); 40 chấm electron |
| Trung hoà (×13) | Số electron từng lớp K/L/M/N khớp bảng; mỗi electron nằm đúng trên vòng của nó (sai số < 3 px); `aria-pressed`; ký hiệu hạt nhân |
| Ion (×13) | Tổng electron sau ion: Li→2, Na/Mg/Al→10, K/Ca→18, H→2, N/O/F→10, P/S/Cl→18; số e tuột/nhô đúng; badge (`+`, `2+`, `3−`…); panel "Sau ion hoá"; nút Tạo ion bị khoá |
| Song song | Chọn Na (mô hình 1) rồi Cl (mô hình 2) → Na giữ nguyên `2,8,1` |
| Race | Bấm Na→Al liên tiếp → hiển thị Al; đổi sang K giữa lúc đang tạo ion → hiển thị K trung hoà, badge ẩn |
| Liên kết ion (×9) | NaCl, MgCl₂, Al₂O₃, Ca₃N₂, Li₃N, K₂S, MgO, AlCl₃, NaH; nam châm bật; electron bay được dọn sạch |
| Nam châm / Reset | Toggle tắt; reset xoá toàn bộ electron, khoá nút ion và nút liên kết |
| API | Gọi đúng `/api/metal/select {"z":11}`, `/api/nonmetal/select {"z":17}`, `/api/bond`, `/api/magnet {"on":false}` |
| Responsive | Xem bảng bên dưới |

## Kiểm thử responsive

9 viewport (có giả lập cảm ứng cho thiết bị di động): không tràn ngang, mọi nút ≥ 44×44 px.

| Thiết bị | Viewport | Bố cục | Đường kính mô hình |
|---|---|---|---|
| iPhone SE | 320×568 | dọc 1 cột | 282 px |
| iPhone | 375×812 | dọc 1 cột | 337 px |
| Android | 412×915 | dọc 1 cột | 374 px |
| Điện thoại ngang | 844×390 | 2 cột | 304 px |
| Điện thoại nhỏ ngang | 667×375 | 2 cột | 290 px |
| iPad dọc | 768×1024 | 2 cột | 298 px |
| iPad ngang | 1024×768 | 2 cột | 426 px |
| Laptop | 1366×768 | 2 cột | 440 px |
| Full HD | 1920×1080 | 2 cột | 440 px |

## Kiểm thử API

| Request | Kỳ vọng | Kết quả |
|---|---|---|
| `POST /api/metal/select {"z":11}` | 200 | ✔ |
| `POST /api/metal/select {"z":17}` | 400 "không thuộc nhóm metal" | ✔ |
| `POST /api/nonmetal/select {"z":"abc"}` | 400 | ✔ |
| `POST /api/foo/ion` | 400 "Mô hình không hợp lệ" | ✔ |
| `POST /api/bond` | 200, `magnet:true` | ✔ |
| Token giả, `MOCK=0` | 502 `Blynk 400: Invalid token.` | ✔ |

## Lỗi đã phát hiện và sửa trong quá trình kiểm thử

1. **Electron văng khỏi vòng** — `transform-origin: 50% 50%` với `transform-box: view-box` xoay quanh điểm (200,200) thay vì tâm. Sửa thành `0 0`; bổ sung kiểm tra hình học vào test.
2. **Lệnh Blynk đầu tiên timeout** sau khi khởi động server (TLS lạnh). Thêm thử lại 1 lần khi lỗi mạng.
3. **404 favicon** gây lỗi console — thêm favicon SVG inline.

## Kiểm thử thủ công với phần cứng (checklist)

- [ ] Đèn trạng thái 2 board xanh
- [ ] Chọn Na → board A nhô servo 0–10; Serial in `[ATOM] Na | Z = 11`
- [ ] Chọn Cl → board B nhô servo 0–16, board A giữ nguyên
- [ ] Tạo ion Na → servo 10 hạ; Tạo ion Cl → servo 17 nhô
- [ ] Liên kết ion → cả 2 board chạy V100, nam châm bật
- [ ] Reset → servo hạ tuần tự từng cái (40 ms/servo)
- [ ] So sánh vị trí servo nhô lên với chấm trên web cho từng nguyên tố
