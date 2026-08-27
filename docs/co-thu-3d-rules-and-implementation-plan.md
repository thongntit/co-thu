# Cờ Thú 3D — Ruleset v1 và Implementation Plan

> Trạng thái: Ruleset v1 đã chốt · MVP implementation đã hoàn thành
> Phạm vi: game chiến thuật theo lượt trên trình duyệt, xây bằng Vite + TypeScript + Three.js

## 1. Tổng quan

Cờ thú còn được gọi là **Dou Shou Qi**, **Jungle**, **Jungle Chess** hoặc **Animal Chess**. Đây là game chiến thuật hai người trên bàn 7×9; mỗi bên điều khiển tám con thú với thứ hạng khác nhau, cùng các địa hình đặc biệt như sông, bẫy và hang.

> **Lưu ý về luật:** Dou Shou Qi không có một ruleset duy nhất được mọi phiên bản sử dụng. Các biến thể thường gặp liên quan đến việc Voi có được ăn Chuột hay không, Hổ có được nhảy ngang qua sông hay không, thứ tự Chó/Sói và cách xử lý thế bí. Vì vậy tài liệu này cố định rõ các lựa chọn cho game v1.

Tham khảo:

- [Leiden University — About Dou Shou Qi](https://liacs.leidenuniv.nl/~visjk/doushouqi/about.html)
- [Yellow Mountain Imports — How to Play Jungle](https://www.ymimports.com/pages/how-to-play-jungle)
- [Ancient Chess — How to Play Dou Shou Qi](https://ancientchess.com/page/play-doushouqi.htm)
- [Wikipedia — Jungle board game](https://en.wikipedia.org/wiki/Jungle_(board_game))

## 2. Ruleset đề xuất cho game v1

### 2.1. Bàn cờ

- Bàn có 7 cột × 9 hàng, ký hiệu cột `a–g` và hàng `1–9`.
- Bên A ở phía dưới, chiếm vùng hàng 1–3 và đi trước.
- Bên B ở phía trên, chiếm vùng hàng 7–9.
- Mọi loại quân đều hiển thị công khai; không có hidden information, xúc xắc hoặc random trong luật cơ bản.

Địa hình đặc biệt:

| Loại ô | Tọa độ |
|---|---|
| Hang A | `d1` |
| Hang B | `d9` |
| Bẫy A | `c1`, `e1`, `d2` |
| Bẫy B | `c9`, `e9`, `d8` |
| Sông trái | `b4`, `c4`, `b5`, `c5`, `b6`, `c6` |
| Sông phải | `e4`, `f4`, `e5`, `f5`, `e6`, `f6` |

### 2.2. Quân và thứ hạng

| Hạng | Quân | Đặc tính |
|---:|---|---|
| 1 | Chuột | Quân duy nhất được xuống sông; có thể ăn Voi |
| 2 | Mèo | Không có đặc tính riêng |
| 3 | Sói | Không có đặc tính riêng |
| 4 | Chó | Không có đặc tính riêng |
| 5 | Báo | Không có đặc tính riêng |
| 6 | Hổ | Được nhảy qua sông |
| 7 | Sư tử | Được nhảy qua sông |
| 8 | Voi | Không được xuống sông |

Ruleset v1 chốt **Chó mạnh hơn Sói**.

### 2.3. Vị trí ban đầu

Bên A:

```text
a1 Hổ          g1 Sư tử
b2 Mèo         f2 Chó
a3 Voi         c3 Sói
e3 Báo         g3 Chuột
```

Bên B:

```text
a9 Sư tử       g9 Hổ
b8 Chó         f8 Mèo
a7 Chuột       c7 Báo
e7 Sói         g7 Voi
```

Hai bên được bố trí đối xứng quay 180 độ.

### 2.4. Di chuyển cơ bản

- Mỗi lượt, người chơi phải di chuyển đúng một quân.
- Quân thường đi đúng một ô theo chiều ngang hoặc dọc.
- Không được đi chéo.
- Không được đi ra ngoài bàn.
- Không được đi vào ô đang có quân cùng phe.
- Không được đi vào hang của chính mình.
- Quân có thể đi vào bẫy của bất kỳ phe nào.

### 2.5. Ăn quân

- Quân có hạng cao hơn hoặc bằng được ăn quân có hạng thấp hơn hoặc bằng.
- Quân tấn công đứng vào ô của quân bị ăn; quân bị ăn bị loại khỏi bàn.
- Quân cùng hạng được phép ăn nhau; quân tấn công thắng.
- Chuột hạng 1 được ăn Voi hạng 8.
- Trong ruleset v1, Voi **không được ăn Chuột**.
- Chuột chỉ được ăn Voi khi cả hai đang ở trên đất.
- Chuột dưới nước không được ăn quân trên đất.
- Quân trên đất không được ăn Chuột đang ở dưới nước.
- Hai Chuột ở dưới nước có thể ăn nhau.

Formalization đề xuất cho engine:

```text
effectiveRank(piece) =
  0    nếu piece đang ở bẫy của đối phương
  rank gốc nếu không

canCapture(attacker, target) =
  false nếu một quân ở nước và quân kia ở đất
  true  nếu attacker là Chuột, target là Voi và cả hai ở đất
  false nếu attacker là Voi, target là Chuột
  effectiveRank(attacker) >= effectiveRank(target) trong các trường hợp còn lại
```

### 2.6. Sông và cú nhảy

- Chỉ Chuột được đứng trên ô sông.
- Hổ và Sư tử không xuống sông nhưng được nhảy qua một dải sông.
- Trong v1, cả Hổ và Sư tử đều được nhảy ngang hoặc dọc.
- Quân nhảy từ bờ này tới ô đất đầu tiên ở bờ bên kia.
- Nếu có bất kỳ Chuột nào trong các ô nước nằm trên đường nhảy, cú nhảy bị chặn.
- Hổ/Sư tử có thể ăn quân tại ô đáp xuống nếu thỏa luật ăn quân.
- Một cú nhảy không được vượt qua cả hai con sông cùng lúc.

### 2.7. Bẫy

- Quân đứng trên bẫy của đối phương có hạng hiệu lực bằng `0`.
- Bất kỳ quân nào của phe sở hữu bẫy cũng có thể ăn quân đang mắc bẫy.
- Khi quân rời khỏi bẫy, hạng trở lại bình thường.
- Quân đứng trên bẫy của chính phe mình không bị yếu.

### 2.8. Thắng và hòa

Người chơi thắng ngay khi xảy ra một trong các điều kiện:

1. Một quân đi vào hang đối phương.
2. Đối phương không còn quân nào.
3. Đối phương còn quân nhưng không còn nước đi hợp lệ.

Ván đấu hòa khi:

- Một vị trí giống hệt lặp lại ba lần.
- Có 100 half-move liên tiếp không có quân bị ăn.

Luật “không còn nước đi là thua” và giới hạn 100 half-move là quyết định cho phiên bản digital, cần để tránh ván đấu hoặc AI lặp vô hạn.

### 2.9. Các quyết định variant đã cố định

| Điểm có nhiều biến thể | Quyết định của v1 |
|---|---|
| Ai đi trước | Bên A đi trước |
| Chó và Sói | Chó hạng 4, Sói hạng 3 |
| Voi ăn Chuột | Không được |
| Chuột ăn Voi | Chỉ khi cả hai ở đất |
| Hổ/Sư tử nhảy ngang | Được phép |
| Quân cùng hạng | Được ăn nhau |
| Không còn nước đi | Bên tới lượt bị xử thua |
| Lặp vị trí | Lặp 3 lần là hòa |

Các điểm này nên được để trong một `RULESET_V1` constant để sau này có thể mở thêm ruleset khác mà không sửa trực tiếp luật lõi.

## 3. Game design brief

- **Player promise:** Điều khiển đội quân thú vượt sông, dụ đối thủ vào bẫy và mở đường xâm nhập hang địch.
- **Target feeling:** Điềm tĩnh như cờ vua, nhưng mỗi lần ăn quân có cảm giác mạnh, rõ và có trọng lượng.
- **Primary verb:** Chọn quân → chọn ô → gây áp lực hoặc đổi quân.
- **Secondary verbs:** Chặn đường nhảy, nhử vào bẫy, bảo vệ Chuột, hy sinh quân, tạo đường vào hang.
- **Objective:** Vào hang đối phương hoặc loại toàn bộ quân đối phương.
- **Pressure:** Đối thủ có thể đe dọa ăn quân, chặn Chuột, kiểm soát bẫy hoặc chạy thẳng vào hang.
- **Reward:** Chiếm vị trí, ăn quân, mở đường và tạo threat mới; không dùng điểm số thay cho kết quả ván đấu.
- **Fail/retry:** Thua khi đối thủ vào hang hoặc đạt điều kiện thắng; có nút rematch/restart nhanh.
- **Skill expression:** Đọc thứ hạng, kiểm soát sông, tính nước nhảy, bảo vệ các ô quanh hang và dự đoán trade.
- **Non-goals của MVP:** Online multiplayer, fog of war, nâng cấp chỉ số, phép thuật, nhiều bản đồ và vật lý tự do.

### Core loop contract

```text
Người chơi chọn một quân để chiếm vị trí hoặc tạo đe dọa vào hang,
trong khi thứ hạng, sông, bẫy và phản công của đối thủ tạo áp lực;
thành công mở đường hoặc loại quân địch, còn thất bại làm mất vị trí/quân
và buộc người chơi tìm cách phòng thủ hoặc restart.
```

### MDA ngắn

- **Mechanics:** Di chuyển theo ô, thứ hạng, ăn quân, sông, bẫy, hang.
- **Dynamics:** Chuột chặn cú nhảy, quân mạnh bị dụ vào bẫy, người chơi phải cân bằng tấn công và phòng thủ.
- **Aesthetics:** Căng thẳng chiến thuật, rõ ràng, tactile, có khoảnh khắc bùng nổ khi ăn quân hoặc chiếm hang.

## 4. Định hướng 3D

### Bàn và camera

- Bàn cờ là một jungle diorama có chiều sâu như mô hình thu nhỏ.
- Camera mặc định dùng orthographic, hơi nghiêng khoảng 35–45 độ.
- Có thể cho phép xoay/inspect giới hạn, nhưng không để camera tự do làm mất khả năng đọc tọa độ.
- Khi chọn quân, các ô hợp lệ được highlight; ô sông, bẫy và hang phải có nhận diện riêng.

### Quân và hiệu ứng

- Tám loại quân là tượng thú 3D stylized/low-poly trong vertical slice.
- Hai phe có màu, viền và huy hiệu riêng; không chỉ dựa vào màu để phân biệt.
- Di chuyển thường: bước hoặc hop ngắn.
- Ăn quân: lao tới, impact rõ, quân bị ăn biến mất hoặc ngã xuống.
- Hổ/Sư tử: animation nhảy qua sông.
- Chuột xuống nước: splash nhỏ và hiệu ứng chặn đường nhảy.
- Bẫy: hiệu ứng suy yếu khi quân địch đứng trên đó.
- Vào hang: win sequence ngắn với camera và UI overlay.

### Quyết định physics

MVP không cần Rapier hoặc cannon-es. Luật là grid-based và theo lượt; engine dùng state transition thuần túy, còn animation chỉ trình bày kết quả đã được xác nhận. Collision chỉ là kiểm tra tọa độ và luật di chuyển.

## 5. Implementation plan

### Phase 0 — Chốt spec và scaffold

Tạo project Vite + TypeScript + Three.js mới bằng scaffold hiện có trong workflow game.

Tạo các tài liệu:

```text
docs/game-rules-v1.md
docs/game-design-brief.md
docs/implementation-plan.md
```

Kết quả cần đạt:

- Tọa độ, setup và variant không còn mơ hồ.
- Có fixture cho trạng thái ban đầu.
- Chốt desktop và mobile browser là target.

### Phase 1 — Rules engine thuần TypeScript

Đề xuất cấu trúc:

```text
src/
  core/
    GameLoop.ts
    InputController.ts
    Diagnostics.ts

  game/
    state/
      GameState.ts
      GamePhase.ts
    rules/
      board.ts
      pieces.ts
      setup.ts
      legalMoves.ts
      capture.ts
      winConditions.ts
      positionHash.ts
    MatchController.ts

  entities/
    PieceEntity.ts

  systems/
    BoardSystem.ts
    AnimationSystem.ts
    CameraSystem.ts
    EffectsSystem.ts

  assets/
    AnimalModels.ts
    Materials.ts

  ui/
    Hud.ts
    GameOverOverlay.ts
    RulesPanel.ts

  ai/
    RandomBot.ts
    MinimaxBot.ts

  tests/
    rules/
    browser/
```

Rules engine phải độc lập với Three.js:

```text
GameState + Move -> GameState mới
```

Test bắt buộc:

- Setup đủ 16 quân.
- Di chuyển ngang/dọc và cấm đi chéo.
- Cấm vào hang nhà.
- Chuột xuống sông; quân khác không xuống sông.
- Chuột ăn Voi trên đất.
- Chuột dưới nước không ăn quân trên đất.
- Hổ/Sư tử nhảy sông.
- Chuột bất kỳ phe nào chặn cú nhảy.
- Bẫy làm hạng hiệu lực bằng 0.
- Vào hang đối phương thắng.
- Hết quân thắng.
- Không còn nước đi thắng.
- Lặp vị trí và điều kiện hòa.

### Phase 2 — Vertical slice có thể chơi

Mục tiêu đầu tiên:

1. Mở app thấy bàn 3D.
2. Có đủ 16 quân.
3. Click/tap quân của mình.
4. Highlight nước đi hợp lệ.
5. Click/tap ô đích.
6. Quân chạy animation.
7. Đổi lượt.
8. Ăn quân được phản ánh trên bàn.
9. Có nút restart.

Chưa làm AI ở phase này. Local two-player là cách nhanh nhất để chứng minh rules engine và interaction.

### Phase 3 — Terrain và feedback

Thêm:

- Mesh và animation nước.
- Nhận diện rõ cho sông, bẫy và hang.
- Animation bước thường và nhảy sông.
- Capture impact.
- Highlight quân đang bị đe dọa.
- Camera impulse nhẹ khi ăn quân.
- Event log cho từng nước đi.

State machine:

```text
LOBBY
  -> PLAYER_TURN
  -> ANIMATING
  -> PLAYER_TURN
  -> GAME_OVER / DRAW
```

Trong `ANIMATING`, khóa input để tránh state và visual bị lệch.

Update order:

```text
input -> validate move -> commit state -> animation/VFX -> camera -> UI -> render
```

### Phase 4 — Game modes và AI

Sau khi engine ổn định:

- Local two-player là mode chính của MVP.
- Easy bot: chọn nước hợp lệ có trọng số.
- Medium bot: minimax/negamax + alpha-beta.
- Evaluation gồm giá trị quân, khoảng cách tới hang, kiểm soát sông, bẫy, mobility và threat vào hang.
- Dùng Web Worker nếu AI bắt đầu làm giật UI.
- Mọi random tie-break phải dùng seeded RNG để test được.

### Phase 5 — UI và mobile

Các trạng thái cần có:

- Main menu.
- Chọn local two-player / chơi với bot.
- Gameplay HUD.
- Pause.
- Rules overlay.
- Win, lose và draw.
- Restart/rematch.

HUD nên hiển thị:

- Lượt hiện tại.
- Quân đã mất của mỗi bên.
- Hướng dẫn ngắn khi chọn quân.
- Nút restart, pause và sound.
- Thông báo đặc biệt như “Chuột đang chặn đường nhảy” hoặc “Quân đang trong bẫy”.

Mobile requirements:

- Dùng Pointer Events chung cho mouse và touch.
- Touch target tối thiểu khoảng 44px.
- Không để UI che bàn hoặc vùng tương tác.
- Xử lý `pointercancel`, `pointerup`, `blur` và resize.
- Giữ bàn cờ dễ đọc ở portrait.

### Phase 6 — QA và release

Acceptance criteria:

- `npm run build` pass.
- Không có console/page error.
- Canvas không trắng và hiển thị scene có độ tương phản.
- Test được nước đi chính bằng click/tap thật.
- Test capture, nhảy sông, bẫy, vào hang và restart.
- Có screenshot desktop và mobile.
- Có visual smoke test cho active board, chọn quân, capture, river jump và win/lose/draw overlay.
- Kiểm tra performance trong active play, không chỉ màn hình menu.

Sau khi scaffold, các lệnh kiểm tra dự kiến:

```bash
npm run build
npm run verify:visual
npm run inspect:canvas
```

## 6. MVP cut

Bản đầu tiên nên có:

- Một bàn 7×9.
- Ruleset v1 đầy đủ.
- Local two-player.
- Một theme jungle diorama.
- Tám loại quân 3D stylized.
- Click/tap interaction.
- Restart, win, lose và draw.
- Không online, không progression, không physics tự do.

Sau MVP mới mở rộng:

- AI Easy/Medium.
- Replay hoặc undo trong chế độ luyện tập.
- Nhiều theme bàn cờ.
- Âm thanh và voice feedback.
- Multiplayer online.
- Bảng xếp hạng và progression.

## 7. Definition of Done

Game được xem là playable khi:

- Rules engine pass toàn bộ scenario test.
- Người chơi chọn quân và di chuyển được bằng input thật.
- Engine xử lý đúng ăn quân, sông, cú nhảy, bẫy và hang.
- Có trạng thái thắng/thua/hòa và restart sạch.
- Scene 3D không làm che mất đường đi hoặc thông tin quan trọng.
- Desktop và mobile đều đọc được bàn cờ và HUD.
- Production build chạy được, không có lỗi console chính.

Repo hiện chỉ có scaffold/skill configuration, chưa có source game. Tài liệu này là spec nền để bắt đầu Phase 0 và Phase 1.
