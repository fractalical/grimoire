# Промпты визуальных референсов

Дата: 15 октября 2026 года. Режим: встроенный `image_gen` (`image_gen.imagegen`); CLI и API-ключ не использовались.

Это точные промпты, переданные генератору. Результаты сохранены в `app/refs/`. Для экранов 02 и 04 переданы локальные изображения 01 и 03 как визуальные референсы. Для экрана 04 выполнена одна правка дизайна гоблина; итог — `04-question-modes-v2.png`, первая версия сохранена отдельно.

## 01-world-map.png

Результат: [01-world-map.png](01-world-map.png).

Входные изображения: отсутствуют.

```text
Use case: ui-mockup
Asset type: portrait mobile browser game world-map reference, a polished pixel-art game screen.
Primary request: French vocabulary learning RPG with a scholar mage walking between lesson nodes on an axonometric overworld. One lesson equals one map node. Make the route and touch interface immediately readable.
Scene/backdrop: a compact grassy fantasy landscape with stone paths and small book shrines, diamond tiles in true 2:1 axonometric projection, gentle elevated terrain. A winding path clearly links six large circular lesson nodes numbered 1, 2, 3, 4, 5, 6 from foreground to distance. Node 1 completed with a check, node 2 is the next available lesson, nodes 3–6 visibly locked. A small book reward badge is attached to node 3; node 6 has a book and mage evolution badge.
Subject: a small friendly novice scholar mage in a pointed hat and simple robe, readable pixel silhouette, standing at node 1. Knowledge and books are the central fantasy.
Style/medium: carefully hand-clustered 16-bit pixel art, visible crisp square pixels, restrained coherent color choices, clean outlines, no blurred painting, no photorealism, no 3D render. UI panels are pixel-art framed with highly readable Russian text, spacious mobile touch targets.
Composition/framing: one tall portrait mobile game screen, approximately 9:16, no device frame, map takes most of the screen, safe top and bottom padding. Compact top bar and a bottom selected-lesson card. Clear separation of interface from map.
Text (verbatim): top "Карта уроков"; progress "1 / 34"; small daily button "Задания"; bottom card "Урок 2" and a large button "Начать"; bottom navigation "Карта", "Книги", "Задания". Lesson node labels only the numbers 1–6.
Constraints: exactly one mage, no enemies on the overworld, no extra playable characters, no money counters, no hearts or energy, no ads, no watermark. This is a mobile product design reference, not a production sprite atlas.
```

## 02-lesson-encounter.png

Результат: [02-lesson-encounter.png](02-lesson-encounter.png).

Входные референсы, по порядку: `01-world-map.png`, `03-mage-progression.png`.

```text
Use case: ui-mockup
Asset type: portrait mobile game screen showing in-lesson movement and a French vocabulary encounter.
Primary request: A polished pixel-art reference for a French-learning RPG. A scholar mage walks from goblin to goblin on an axonometric path inside ONE lesson; one goblin represents one vocabulary encounter.
Input images: Image 1 is a world-map style reference only; Image 2 is the same mage's character design reference only. Produce a new screen, preserve their crisp pixel style, parchment panels and visual identity.
Scene/backdrop: a small axonometric forest clearing on diamond tiles, a winding connected stone path. Visible scene contains one novice mage and three visually IDENTICAL small green goblins with simple brown tunics and pointed ears. The mage stands near the current goblin, the other two wait farther along the route. Identical goblin design must be obvious; no species variations, no bosses. A cleared node behind the mage and a few path arrows show movement. Nonviolent magic-of-knowledge theme.
Style/medium: genuine crisp 16-bit pixel art, intentional square clusters and clean outlines, no blur, no smooth gradients in the game art, no realistic or 3D-rendered characters.
Composition/framing: one tall 9:16 portrait game screen without phone frame; compact header, traversable scene in upper half; bottom half is a large parchment question panel with four generous thumb-sized buttons stacked vertically. Treat the text as readable UI rather than tiny sprite lettering. Keep ample padding and no overlap.
Text (verbatim): header "Урок 1", small progress "12 / 100"; question panel heading "Выбери перевод"; French word "renard"; four answer buttons in this exact order "волк", "лиса", "крыша", "мышь"; a small unobtrusive footer button "Сохранить и выйти". No answer selected, no checkmark or glow revealing the answer. Do not place a fox picture by the word or character.
Constraints: the scene itself stays visible while answering. No health/energy bars, no coins, no timer, no keyboard on this screen, no violence, no watermark. This is a product concept reference, not an implemented game.
```

## 03-mage-progression.png

Результат: [03-mage-progression.png](03-mage-progression.png).

Входные изображения: отсутствуют.

```text
Use case: stylized-concept
Asset type: pixel-art character and book-artifact progression reference sheet for a mobile French-learning RPG.
Primary request: Show the same scholar mage evolving as the player completes lessons, plus a collection of earned magical book artifacts. A new book is earned every three completed lessons and the appearance evolves every six.
Subject: six full-body designs of the SAME recognizable mage, in a clear 3-column by 2-row grid. Top row labels "0", "6", "12"; second row labels "18", "24", "30". These numbers mean completed lessons. At 0: plain robe, pointed hat, novice silhouette, no earned magical book. At 6: enriched trim and a book at the belt; 12: more accomplished scholar and a floating book; 18: layered scholarly robes and a stronger book spell; 24: dignified master mage with a luminous book; 30: most accomplished archmage, recognizable same face and hat silhouette, elaborate but compact robe and controlled magical accents. All six figures must remain the same display scale and clearly readable as small mobile game sprites. Progression must be clear through costume and silhouette, not body size.
Composition/framing: landscape reference board, warm plain neutral backdrop, evenly spaced character cells occupying the upper three quarters. Bottom strip is a collection shelf of ELEVEN separate magical books, distinct cover details, labeled beneath in order "3", "6", "9", "12", "15", "18", "21", "24", "27", "30", "33". Keep all labels and figures uncropped. No interface around the board.
Style/medium: crisp genuine 16-bit pixel art with visibly square clusters, clean outlines and limited coordinated colors, 3/4 axonometric-compatible character view. Scholarly, adventurous, friendly, readable. No smooth vector, no painterly brushstrokes, no realism, no 3D rendering.
Text (verbatim): title "Маг знаний"; a small heading above the bottom books "Книги-артефакты"; only the specified milestone numbers.
Constraints: six character stages, eleven collectible books, no other characters, no monsters, no weapons or armor focus, no logos or watermarks. A concept reference sheet, not an animation spritesheet.
```

## 04-question-modes.png

Результат: [04-question-modes.png](04-question-modes.png).

Первая итерация; итоговая версия — [04-question-modes-v2.png](04-question-modes-v2.png).

Входные референсы, по порядку: `01-world-map.png`, `03-mage-progression.png`.

```text
Use case: ui-mockup
Asset type: three-panel mobile UI reference board showing exactly three vocabulary question modes in a pixel-art French learning RPG.
Primary request: Show three different mobile question panels side by side, equal size, aligned on one landscape board: choosing a translation, typing the French word, selecting an image.
Input images: Image 1 is the world-map art/interface style reference only; Image 2 is the mage character reference only. Reuse the consistent parchment panels, pixel borders and novice mage design. Build a new reference board.
Composition/framing: landscape image with three complete tall mobile panel designs, clear gaps between them, no phone hardware. Each panel has the same compact mini scene at the top containing one novice mage facing one identical green goblin on a 2:1 axonometric forest path. Question UI takes most of each panel; large readable text and touch targets. Do not clutter with other controls.
Panel 1 text (verbatim): heading "Выбор перевода"; prompt "renard"; four unselected wide answer buttons "волк", "лиса", "крыша", "мышь".
Panel 2 text (verbatim): heading "Ввод слова"; prompt "лиса"; helper "Напиши по-французски"; one text input containing "renard" with visible caret; primary action "Проверить"; small accent shortcuts "é è ê à ç". Leave space below for a mobile software keyboard, but do not render a fake full keyboard.
Panel 3 text (verbatim): heading "Выбор картинки"; prompt "renard"; four large square picture answer buttons in a 2 by 2 grid. The four illustrations are, separately: a RED FOX with white-tipped bushy tail; a GREY WOLF; a SMALL GREY MOUSE with round ears; a HOUSE ROOF clearly depicting the red roof. Make each subject visually unambiguous, same pixel style, no labels, no selection state, no correctness hint.
Style/medium: crisp high-quality 16-bit pixel art and legible UI typography, intentional hard pixel clusters, friendly adventure tone; no painterly or realistic elements.
Constraints: French "renard" means Russian "лиса" and must be spelled exactly. No correct-answer highlighting. No extra question modes, no audio or speaking button, no timer, no health bars, no currency, no brands or watermark. This is a visual design reference, not a production sprite sheet.
```

## 04-question-modes-v2.png — согласование гоблина

Итоговый результат: [04-question-modes-v2.png](04-question-modes-v2.png).

Входные изображения, по порядку: `04-question-modes.png` — цель редактирования; `02-lesson-encounter.png` — референс персонажа. Исправлен только дизайн гоблина, сохранены вопросы, варианты, иллюстрации и композиция.

```text
Use case: precise-object-edit
Asset type: three-panel mobile question-mode reference board for a pixel-art French vocabulary RPG.
Primary request: Change ONLY the goblin character in the top mini-scene of each of the THREE panels in Image 1. All three goblins must use exactly the same friendly small goblin design shown in Image 2: compact round green head, large pointed ears, simple brown tunic and belt, small wooden club, no sword, no shield, no armor. Match that character's proportions, face, costume and pixel-art design in each panel of Image 1.
Input images: Image 1 is the EDIT TARGET (three question modes); Image 2 is the character-design REFERENCE (lesson encounter). This is a targeted consistency correction.
Invariants: keep Image 1's canvas dimensions, three-column composition, backgrounds, mage characters, all UI panels and buttons, all Russian and French text, the input caret and accent keys, and all four answer illustrations EXACTLY unchanged. Keep the goblins in their existing respective top-scene locations facing the mage, roughly the same occupied area, with readable silhouettes.
Style: preserve original crisp pixel-art look, hard pixel clusters, palette and shading. No new elements, no extra labels. No watermark.
```
