# Cờ Thú 3D

Game Cờ Thú 7 × 9 chạy trên trình duyệt bằng Vite, TypeScript và Three.js.

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://127.0.0.1:5173`.

## Điều khiển

- Chạm/click một quân của phe đang đi, sau đó chọn ô sáng.
- `Đấu với Bot` đổi giữa đấu Bot và hai người chơi cùng máy.
- `Luật chơi` mở ruleset v1 trong game.

## Asset pipeline

- 7 loại quân (Chuột, Mèo, Sói, Báo, Hổ, Sư tử, Voi) dùng model Tripo GLB/PBR riêng và lưu local theo từng thư mục trong `public/assets/models/`; Chó giữ procedural fallback có sẵn vì quota Tripo đã hết trong batch này.
- Move, capture, river jump, trap, victory và ambience được tạo bằng ElevenLabs, lưu tại `public/assets/audio/`.
- Huy hiệu giao diện được tạo bằng image generation tích hợp của Codex tại `public/assets/ui/co-thu-emblem.png`.
- Gemini không được dùng. `.env` chỉ phục vụ các workflow tạo asset và được git-ignore.

## Kiểm tra

```bash
npm run build
npm run test
npm run inspect:canvas -- --mobile
```

Model textured dùng trên desktop; thiết bị màn hình nhỏ dùng bản geometry flat từ cùng model Tripo để tương thích texture tốt hơn trên mobile. HUD trận đấu nằm ở rail bên phải để giữ vùng bàn cờ trung tâm thông thoáng.
