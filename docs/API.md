# SkinEngine — документация

Полный справочник API. Быстрый старт — в [README](../README.md).
Живая демка: https://1eugesha.github.io/skin-engine/

---

## Содержание

1. [Подключение](#подключение)
2. [Веб-компонент `<skin-viewer>`](#веб-компонент-skin-viewer)
3. [JS API: `SkinEngine`](#js-api-skinengine)
4. [Класс `SkinStage`](#класс-skinstage)
   - [Опции](#опции)
   - [Методы](#методы)
   - [События](#события)
5. [Формат анимаций](#формат-анимаций)
6. [Рецепты](#рецепты)
7. [Производительность](#производительность)
8. [Как устроен движок](#как-устроен-движок)

---

## Подключение

### С CDN (рекомендуется)

```html
<script src="https://cdn.jsdelivr.net/gh/1Eugesha/skin-engine@main/skin-engine.anims.js"></script>
<script src="https://cdn.jsdelivr.net/gh/1Eugesha/skin-engine@main/skin-engine.js"></script>
```

После загрузки доступны глобальный объект `window.SkinEngine` и
веб-компонент `<skin-viewer>`.

`skin-engine.anims.js` — пак фирменных анимаций (idle-дыхание, оживители,
interact). Подключать **до** движка не обязательно, но желательно; без него
движок работает на встроенном простом дыхании.

### Локально

Скопируй `skin-engine.js` и `skin-engine.anims.js` к себе и подключи так же.
Зависимость [skinview3d](https://github.com/bs-community/skinview3d) движок
подгружает с CDN сам — на странице ничего ставить не нужно.

### Как ES-модуль

```js
import SkinEngine from "./skin-engine.mjs"; // подтянет и анимации, и движок
```

Типы TypeScript — в `skin-engine.d.ts` (подхватываются автоматически при
установке из репозитория).

### Шрифт нейм-тега

Чтобы ник над головой рисовался майнкрафтовским шрифтом, подключи шрифт с
именем `Minecraft`:

```css
@font-face {
  font-family: "Minecraft";
  src: url("https://cdn.jsdelivr.net/gh/South-Paw/typeface-minecraft@1.0.0/files/minecraft.woff2") format("woff2");
  font-display: swap;
}
```

Движок сам перерисует нейм-тег, когда шрифт догрузится.

---

## Веб-компонент `<skin-viewer>`

Персонаж на странице без единой строки JavaScript:

```html
<skin-viewer nick="1Eugesha"></skin-viewer>
```

| Атрибут | Описание |
|---------|----------|
| `nick` | ник игрока: сам подтянет скин (mc-heads.net), плащ (capes.dev) и нейм-тег |
| `skin` | URL текстуры скина (перекрывает скин из `nick`) |
| `name-tag` | текст нейм-тега (перекрывает `nick`; пустая строка — убрать) |
| `cape` | URL плаща, `auto` (по нику, по умолчанию) или `none` |
| `elytra` | URL текстуры плаща → элитры (крылья) вместо плаща |
| `width`, `height` | размер вьюпорта в px (по умолчанию 300×420) |

Атрибуты `nick` / `skin` / `cape` / `elytra` / `name-tag` — реактивные:
поменяешь атрибут — компонент перезагрузит скин/плащ/тег.

Доступ к движку компонента, если всё же нужен JS: `element._stage`.

---

## JS API: `SkinEngine`

| Свойство/метод | Описание |
|----------------|----------|
| `SkinEngine.mount(canvas, opts)` | создать и вернуть `SkinStage` |
| `SkinEngine.Stage` | класс `SkinStage` (то же, что mount, но через `new`) |
| `SkinEngine.loadCape(nick)` | `Promise<string \| null>` — URL плаща игрока |
| `SkinEngine.load()` | промис загрузки skinview3d (обычно не нужен) |
| `SkinEngine.gpu()` | `"hardware"` / `"software"` / `"none"` |
| `SkinEngine.defaults` | объект опций по умолчанию (можно читать) |
| `SkinEngine.version`, `SkinEngine.author` | версия и автор |

Низкоуровневые примитивы (для своих проигрывателей и рендера кадров):
`ensureRig(player)`, `restPose(player)`, `applyPose(skin, data, gv)`,
`applyAnimTick(skin, data, tick)`, `sampleTrack(points, t)`,
`fixTransparency(player)`, `applyDamageTint(player, amt)`,
`resetDamageTint(player)`, `AnimPlayer(skinview3d)`.

---

## Класс `SkinStage`

```js
const stage = SkinEngine.mount(canvas, {
  skin: "https://mc-heads.net/skin/1Eugesha",
  nameTag: "1Eugesha",
  width: 300, height: 420,
});
await stage.ready; // движок готов
```

### Опции

| Опция | Дефолт | Описание |
|-------|--------|----------|
| `skin` | — | URL текстуры скина (можно позже через `setSkin`) |
| `width`, `height` | 300, 420 | размер вьюпорта в px |
| `fov` | 45 | угол обзора камеры, градусы |
| `zoom` | 0.66 | приближение камеры |
| `idle` | `true` | живая стойка после загрузки (иначе — статика) |
| `gestures` | `true` | случайные анимации-оживители раз в ~8 с |
| `nameTag` | `null` | нейм-тег над головой |
| `nameTagHeight` | `21.5` | высота нейм-тега над моделью |
| `interactive` | `true` | клик/тап = interact-анимация + сквош-импульс |
| `lookFollow` | `true` | голова следит за курсором |
| `intro` | `true` | интро-появление модели при загрузке |
| `initialYaw` | `0.14` | стартовый разворот модели, рад (лёгкий ¾-ракурс) |
| `xfade` | `0.45` | кроссфейд между режимами, с |
| `skinSwapFx` | `true` | кинематографичный разворот при смене скина |
| `spinDur` | `0.72` | длительность разворота, с |
| `lights` | `true` | витринный свет: холодный rim + тёплый fill |
| `cape` | — | URL плаща (загрузится вместе со скином) |
| `model` | `"auto"` | тип модели: `"auto"` (по текстуре), `"wide"` или `"slim"` |
| `pixelRatio` | `0` (авто) | плотность рендера; авто = clamp(dpr, 1.5..2.5) |
| `clickMaxEnergy` | `5` | кликов до вспышки урона |
| `clickEnergyPerHit` | `1` | «энергия» за один клик |
| `clickDecay` | `2` | скорость затухания энергии, ед/с |
| `damageFlash` | `0.7` | сила красной вспышки (0..1) |
| `damageDecay` | `3.5` | скорость затухания вспышки |
| `tapMoveThreshold` | `6` | px движения, после которых тап считается драгом |
| `tapTimeThreshold` | `400` | мс, дольше — не тап |

### Методы

Все методы (кроме `setSkin` и `snapshot`) возвращают `this` — можно чейнить.

| Метод | Описание |
|-------|----------|
| `await stage.ready` | дождаться инициализации (WebGL, skinview3d, скин) |
| `stage.idle()` | живая стойка: дыхание + оживители + взгляд за курсором |
| `stage.walk()` | непрерывная походка на месте |
| `stage.stand()` | статичная поза |
| `stage.play(data)` | проиграть анимацию ([формат](#формат-анимаций)); одноразовая сама вернётся в idle |
| `stage.stop()` | синоним `idle()` |
| `await stage.setSkin(url)` | сменить скин: разворот-эффект, авто-slim по текстуре |
| `stage.setModel(type)` | принудительно тип модели: `"wide"` (classic) или `"slim"` (Alex) |
| `stage.setCape(url)` | плащ (с физикой ткани) |
| `stage.clearCape()` | убрать плащ |
| `stage.setElytra(url)` | элитры из текстуры плаща (вместо плаща) |
| `stage.setEars(url)` | уши из текстуры ушей |
| `stage.setNameTag(name)` | нейм-тег; `null`/`""` — убрать |
| `stage.snapshot(type?, quality?)` | dataURL текущего кадра (`"image/png"` по умолчанию) |
| `stage.hit(power?)` | программный «клик»: interact + импульс (power по умолчанию 1) |
| `stage.damageFlash()` | красная вспышка урона немедленно |
| `stage.setInteractive(on)` | вкл/выкл реакцию на клики |
| `stage.setPaused(on)` | пауза рендера вручную (движок сам никогда не останавливается) |
| `stage.on(event, cb)` / `off(event, cb)` | события |
| `stage.dispose()` | освободить WebGL-контекст и снять все обработчики |

Свойства: `stage.mode` (`"idle" | "walk" | "stand" | "emote" | "loading" | "disposed"`),
`stage.model` (`"wide" | "slim"` — текущий тип модели),
`stage.damage` (текущий уровень вспышки 0..1), `stage.software`
(true = программный рендер без GPU).

### События

```js
stage.on("hit", (energy) => { /* 0..1 — накопленная энергия кликов */ });
```

| Событие | Аргумент | Когда |
|---------|----------|-------|
| `ready` | stage | скин загружен, движок работает |
| `hit` | 0..1 | клик/тап или `hit()` |
| `damage` | — | вспышка урона (энергия дошла до максимума) |
| `emoteend` | — | одноразовая анимация доиграла (движок сам ушёл в idle) |
| `skinchange` | url | начался разворот смены скина |
| `skin` | url | новая текстура применена (в середине разворота) |

---

## Формат анимаций

`stage.play(data)` принимает JSON-объект с треками. 20 тиков = 1 секунда.

```js
stage.play({
  loop: false,      // true — крутить бесконечно (до stop()/idle())
  stop: 40,         // длина в тиках
  end: 40, ret: 0,  // для loop: конец петли и тик возврата
  tracks: {
    // канал: массив ключей [тик, значение], интерполяция линейная
    "rightArm.pitch": [[0, 0], [20, -2.4], [40, 0]],
    "rightArm.bend":  [[0, 0], [20, -1.8], [40, 0]],
    "torso.yaw":      [[0, 0], [20,  0.4], [40, 0]],
    "waist.y":        [[0, 0], [20, -0.5], [40, 0]],
  },
});
```

**Каналы.**

| Группа | Каналы | Единицы |
|--------|--------|---------|
| Конечности: `head`, `rightArm`, `leftArm`, `rightLeg`, `leftLeg` | `.pitch .yaw .roll` — поворот; `.bend` — сгиб локтя/колена; `.x .y .z` — позиция | радианы; позиции — юниты модели (1 юнит = 1 px текстуры) |
| Корпус: `torso` | `.pitch .yaw .roll` — наклон в поясе; `.bend` — доп. сгиб; `.x .y .z` — смещение всего тела (прыжки) | радианы / юниты |
| Верх тела: `waist` | `.x .y .z` — смещение верха тела относительно ног (оси three, y вверх) | юниты |
| Всё тело: `turn` | разворот вокруг вертикали | радианы |

**Гарантия цельности.** Позиции конечностей проходят через мягкий
tanh-лимитер (свободно до 1.2 юнита, предел 2.4), сгибы закрыты
вставками-заглушками — какие бы значения ни пришли в треках, персонаж
останется цельным.

**Зацикливание.** При `loop: true` движок бесшовно сшивает конец петли с
тиком `ret`: за несколько тиков до `end` поза плавно сводится к началу
следующей итерации, углы подматываются по 2π (без контр-вращений).

---

## Рецепты

### Личный кабинет игрока

```js
const stage = SkinEngine.mount(canvas, { width: 320, height: 460 });

async function showPlayer(nick) {
  stage.setNameTag(nick);
  await stage.setSkin(`https://mc-heads.net/skin/${encodeURIComponent(nick)}`);
  const cape = await SkinEngine.loadCape(nick);
  if (cape) stage.setCape(cape); else stage.clearCape();
}
await stage.ready;
await showPlayer("1Eugesha");
```

Или то же самое одной строкой HTML: `<skin-viewer nick="1Eugesha"></skin-viewer>`.

### Аватарка из текущего кадра

```js
const png = stage.snapshot();            // dataURL
const img = new Image(); img.src = png;  // или отправить на сервер:
await fetch("/api/avatar", { method: "POST", body: await (await fetch(png)).blob() });
```

### Реакция на клики (счётчик, звук и т.п.)

```js
stage.on("hit", (energy) => playSound("pop", 0.5 + energy * 0.5));
stage.on("damage", () => showHearts());
```

### React

```jsx
function PlayerCard({ nick }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const stage = SkinEngine.mount(ref.current, {
      skin: `https://mc-heads.net/skin/${nick}`, nameTag: nick,
    });
    return () => stage.dispose();
  }, [nick]);
  return <canvas ref={ref} />;
}
```

### Статичный кадр своей позы (без анимации)

```js
await stage.ready;
stage.stand();
const p = stage.viewer.playerObject;
SkinEngine.applyPose(p.skin, { tracks: pose }, (k) => pose[k] || 0);
// pose = { "rightArm.pitch": -1.2, "rightArm.bend": -0.8, ... }
```

---

## Производительность

Движок изначально лёгкий: один draw-цикл skinview3d, ноль аллокаций в горячем
пути кадра (предвычисленные ключи каналов, кэш разбора, без строковых
конкатенаций), физика плаща — 8 сегментов с фиксированными подшагами.

Что ещё можно настроить:

- **`pixelRatio`** — главный рычаг. Авто-режим: clamp(devicePixelRatio,
  1.5…2.5). На обычных мониторах это уже даёт ~25 % экономии кадра по
  сравнению с форсированными 2×; хочешь ещё дешевле — поставь `pixelRatio: 1`
  (FXAA внутри skinview3d всё равно сгладит края).
- **`lights: false`** — минус два источника света.
- **`gestures: false`** — только базовое дыхание, без оживителей.
- **`lookFollow: false`** — не слушать mousemove вообще.
- **`setPaused(true/false)`** — ручная пауза, если модель гарантированно не
  видна (движок сам никогда не останавливается).
- В скрытой вкладке браузер сам троттлит requestAnimationFrame — движок
  корректно переживает большие паузы (dt зажимается).

---

## Как устроен движок

- **Риг.** Верх тела (корпус + голова + руки) живёт в pivot-группе на уровне
  бёдер — корпус гнётся в поясе; ноги независимы. Плащ/элитры жёстко
  привязаны к pivot-у по позе покоя.
- **Сгибы.** Каждая рука/нога разрезана пополам; нижняя половина — в суставе,
  UV восстановлены аффинной картой по граням. В каждом суставе —
  вставка-заглушка, повёрнутая на половину угла сгиба: клиновая щель закрыта
  при любом угле. Такая же вставка в поясе.
- **Микшер.** Режимы — «источники поз» в смещениях от стойки покоя; движок
  кроссфейдит между источником и снимком предыдущей позы — конечности никогда
  не телепортируются.
- **Slim.** Тип модели определяется skinview3d по альфе текстуры; при смене
  типа движок пересобирает сгибы рук под новую геометрию.
- **Плащ.** Цепочка из 8 сегментов: гравитация, следование, демпфирование,
  ветер с порывами; сабстепы физики ограничены — стабильно при любом FPS.
- **Анимации.** Пак `skin-engine.anims.js` (GPL-3.0, портирован из ассетов
  Modrinth App) — базовый idle + 3 оживителя + interact; без пака движок
  использует встроенное простое дыхание (MIT).
