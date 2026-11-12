// =====================================================================
//  АЛМА — ночь во дворе
//  Маленькая хоррор-игра на Three.js. Весь мир нарисован кодом.
//
//  Как устроен файл (сверху вниз):
//   1. НАСТРОЙКИ — числа, которые легко менять (скорость, сложность…)
//   2. Сцена, камера, свет
//   3. Текстуры (рисуем на <canvas>)
//   4. Двор: дома, гаражи, ворота, машина, качели, деревья, фонари
//   5. Предметы: листья табака и батарейки
//   6. Нечто (монстр)
//   7. Звук
//   8. Игрок и управление
//   9. Игровая логика и главный цикл
// =====================================================================

import * as THREE from 'three';

// ---------------------------------------------------------------------
// 1. НАСТРОЙКИ — поиграй с этими числами!
// ---------------------------------------------------------------------
const CONFIG = {
  leafCount: 5,              // сколько пачек денег на GTA 6 нужно собрать
  sushiEatTime: 6,           // сколько секунд Алина ест суши
  monsterHeight: 0.58,       // рост Алины: 0.58 × 2.6 м ≈ 1 м 50 см (злости)
  walkSpeed: 3.0,            // скорость шага (метров в секунду)
  runSpeed: 5.6,             // скорость бега
  staminaDrain: 26,          // как быстро кончается дыхалка при беге
  staminaRegen: 14,          // как быстро восстанавливается
  batteryDrain: 1.4,         // сколько % батареи тратится в секунду
  batteryPickup: 45,         // сколько % даёт одна батарейка
  monsterPatrolSpeed: 1.5,   // Нечто гуляет
  monsterChaseSpeed: 3.6,    // Нечто гонится
  monsterSpeedPerLeaf: 0.22, // насколько быстрее становится Нечто за каждый лист
  catchDistance: 1.1,        // на каком расстоянии Нечто тебя хватает
  fogDensity: 0.038,        // густота тумана (больше = страшнее и темнее)
  flashlightPower: 60,       // яркость фонарика
  mouseSensitivity: 0.0022,
  touchSensitivity: 0.006,   // как быстро поворачивается взгляд пальцем на телефоне
};

// ---------------------------------------------------------------------
// 2. Сцена, камера, свет
// ---------------------------------------------------------------------
const canvas = document.getElementById('game');

// Телефон или компьютер? Сенсорный экран без мыши = телефон/планшет.
// (Для проверки на компьютере можно открыть страницу с ?touch в адресе)
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
if (IS_TOUCH) document.body.classList.add('touch');

// На телефоне рисуем чуть проще, чтобы не тормозило и не грелось
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const FOG_COLOR = 0x0b1018;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG_COLOR);
scene.fog = new THREE.FogExp2(FOG_COLOR, CONFIG.fogDensity);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 600);
camera.rotation.order = 'YXZ'; // сначала поворот влево-вправо, потом вверх-вниз
scene.add(camera);

// Очень слабый общий свет: ночь, света нет
scene.add(new THREE.HemisphereLight(0x4a5a7a, 0x111111, 0.8));
const moonLight = new THREE.DirectionalLight(0x8fa6cc, 0.6);
moonLight.position.set(-30, 60, 80);
scene.add(moonLight);

// Фонарик: прожектор, прикреплённый к камере
const flashlight = new THREE.SpotLight(0xfff1d6, CONFIG.flashlightPower, 38, 0.42, 0.5, 1.3);
flashlight.position.set(0.25, -0.2, 0);
flashlight.castShadow = true;
flashlight.shadow.mapSize.setScalar(IS_TOUCH ? 512 : 1024);
flashlight.shadow.camera.near = 0.2;
flashlight.shadow.bias = -0.0005;
flashlight.target.position.set(0.05, -0.12, -1);
camera.add(flashlight);
camera.add(flashlight.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Маленькие помощники
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------
// 3. Текстуры — рисуем картинки прямо в коде на <canvas>
// ---------------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeatX = 1, repeatY = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeatX !== 1 || repeatY !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
  }
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

// Рассыпаем мелкие точки — получается «шум», как у бетона или снега
function sprinkle(g, w, h, count, colorFn, size = 2) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colorFn();
    g.fillRect(Math.random() * w, Math.random() * h, rand(1, size), rand(1, size));
  }
}

// Снег
function snowTexture() {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#c3cddb';
  g.fillRect(0, 0, 512, 512);
  sprinkle(g, 512, 512, 9000, () => {
    const v = (170 + Math.random() * 85) | 0;
    return `rgba(${v},${v + 4},${v + 14},${Math.random() * 0.6})`;
  }, 4);
  return toTexture(c, 40, 40);
}

// Бетон
function concreteTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#5e5c57';
  g.fillRect(0, 0, 256, 256);
  sprinkle(g, 256, 256, 4000, () => `rgba(${Math.random() > 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.08})`, 3);
  return toTexture(c);
}

// Фасад панельки: окна, балконы, подъезды. Возвращает [цвет, свечение]
function facadeTextures(cols, floors) {
  const cw = 64, fh = 96, W = cols * cw, H = floors * fh;
  const [c, g] = makeCanvas(W, H);       // обычная картинка
  const [ce, e] = makeCanvas(W, H);      // карта свечения (что светится в темноте)

  g.fillStyle = '#74716a';
  g.fillRect(0, 0, W, H);
  sprinkle(g, W, H, W * 3, () => `rgba(0,0,0,${Math.random() * 0.1})`, 3);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);

  // Подтёки от крыши
  for (let i = 0; i < cols * 2; i++) {
    const x = rand(0, W), len = rand(H * 0.2, H * 0.8);
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, 'rgba(20,18,15,0.35)');
    grd.addColorStop(1, 'rgba(20,18,15,0)');
    g.fillStyle = grd;
    g.fillRect(x, 0, rand(4, 14), len);
  }

  // Швы между панелями
  g.strokeStyle = 'rgba(25,25,25,0.55)';
  g.lineWidth = 2;
  for (let x = 0; x <= W; x += cw) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += fh) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  // Выбираем пару окон, в которых кто-то стоит со свечкой…
  const creepy = new Set();
  while (creepy.size < 2) creepy.add(`${(Math.random() * cols) | 0}-${1 + ((Math.random() * (floors - 1)) | 0)}`);

  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw, y = H - (f + 1) * fh;

      // Подъезд на первом этаже
      if (f === 0 && col % 5 === 2) {
        g.fillStyle = '#2a251f'; g.fillRect(x + 18, y + 30, 28, 66);
        g.fillStyle = '#4f4c45'; g.fillRect(x + 8, y + 22, 48, 8);
        g.fillStyle = '#16130f'; g.fillRect(x + 31, y + 32, 2, 62);
        continue;
      }

      const wx = x + 14, wy = y + 20, ww = 36, wh = 44;

      // Балкон на некоторых этажах
      if (f > 0 && (col + f) % 3 === 0) {
        g.fillStyle = '#625f58'; g.fillRect(x + 6, y + 62, 52, 26);
        g.strokeStyle = '#3d3b36'; g.lineWidth = 1;
        for (let bx = x + 9; bx < x + 58; bx += 5) { g.beginPath(); g.moveTo(bx, y + 62); g.lineTo(bx, y + 88); g.stroke(); }
      }

      if (creepy.has(`${col}-${f}`)) {
        // Тусклый тёплый свет свечи + чёрный силуэт человека
        for (const ctx of [g, e]) {
          const grd = ctx.createRadialGradient(wx + ww / 2, wy + wh * 0.7, 2, wx + ww / 2, wy + wh * 0.6, ww * 0.8);
          grd.addColorStop(0, '#ffb060');
          grd.addColorStop(1, '#3a1206');
          ctx.fillStyle = grd;
          ctx.fillRect(wx, wy, ww, wh);
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(wx + ww / 2, wy + 15, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(wx + ww / 2 - 9, wy + 22, 18, wh - 22);
        }
      } else {
        // Обычное тёмное окно с бликом
        g.fillStyle = '#0b0e14'; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(120,140,170,0.07)';
        g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx + ww * 0.6, wy); g.lineTo(wx + ww, wy); g.lineTo(wx + ww * 0.4, wy + wh); g.fill();
      }
      // Рама
      g.strokeStyle = '#3a3934'; g.lineWidth = 3;
      g.strokeRect(wx, wy, ww, wh);
      g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + 14); g.lineTo(wx + ww, wy + 14); g.stroke();
    }
  }
  return [toTexture(c), toTexture(ce)];
}

// Гаражи: ряд ржавых металлических ворот
function garageTexture(count) {
  const W = count * 128, H = 96;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#4a4d4f'; g.fillRect(0, 0, W, H);
  const colors = ['#3e5a49', '#6b3a2c', '#3d4f66', '#5d5a3a', '#4b4b4b'];
  for (let i = 0; i < count; i++) {
    const x = i * 128 + 10;
    g.fillStyle = colors[i % colors.length]; g.fillRect(x, 14, 108, 82);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    for (let rx = x + 6; rx < x + 108; rx += 8) { g.beginPath(); g.moveTo(rx, 14); g.lineTo(rx, 96); g.stroke(); }
    g.beginPath(); g.moveTo(x + 54, 14); g.lineTo(x + 54, 96); g.stroke();
    sprinkle(g, 108, 82, 300, () => `rgba(120,60,20,${Math.random() * 0.5})`, 4); // ржавчина
  }
  sprinkle(g, W, H, W * 2, () => `rgba(110,55,20,${Math.random() * 0.25})`, 3);
  // Граффити
  graffiti(g, 'НЕ ПОКУПАЙ GTA 6', 70, 52, '#e8e2d0', 17, -0.05);
  graffiti(g, 'АЛИНА', 330, 46, '#d94a8c', 22, 0.04);
  graffiti(g, '150 см злости', 335, 70, '#d94a8c', 13, 0.04);
  graffiti(g, 'игра детства!!!', 600, 58, '#7fd6ff', 15, -0.08);
  return toTexture(c);
}

// Надпись баллончиком: чуть наклонённая, с потёками краски
function graffiti(g, text, x, y, color, size, angle = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.font = `bold ${size}px "Arial Black", Impact, sans-serif`;
  g.fillStyle = color;
  g.shadowColor = color; g.shadowBlur = 3;
  g.fillText(text, 0, 0);
  g.shadowBlur = 0;
  const w = g.measureText(text).width;
  for (let i = 0; i < text.length / 2; i++) g.fillRect(rand(0, w), rand(0, 3), 1.5, rand(3, size * 0.9)); // потёки
  g.restore();
}

// Бетонный забор с ромбиками и граффити
function fenceTexture() {
  const [c, g] = makeCanvas(1536, 128);
  g.fillStyle = '#7b786f'; g.fillRect(0, 0, 1536, 128);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
  for (let x = 0; x < 1536; x += 32) {
    for (let y = 0; y < 128; y += 32) {
      g.beginPath(); g.moveTo(x + 16, y + 2); g.lineTo(x + 30, y + 16); g.lineTo(x + 16, y + 30); g.lineTo(x + 2, y + 16); g.closePath(); g.stroke();
    }
  }
  sprinkle(g, 1536, 128, 9000, () => `rgba(0,0,0,${Math.random() * 0.12})`, 3);
  graffiti(g, 'GTA 6 — ИГРА МОЕГО ДЕТСТВА', 120, 70, '#f2f0e6', 30, -0.03);
  graffiti(g, 'А.  +  🍣  =  ♥', 760, 62, '#ff7a59', 30, 0.05);
  graffiti(g, 'Я ВСЁ РАВНО КУПЛЮ', 1080, 80, '#7fd6ff', 26, -0.06);
  return toTexture(c);
}

// Решётка ворот (прозрачная между прутьями)
function gateTexture() {
  const [c, g] = makeCanvas(256, 160);
  g.clearRect(0, 0, 256, 160);
  g.fillStyle = '#2f4a3b';
  g.fillRect(0, 0, 256, 10); g.fillRect(0, 150, 256, 10); g.fillRect(0, 75, 256, 8);
  g.fillRect(0, 0, 10, 160); g.fillRect(246, 0, 10, 160);
  for (let x = 24; x < 246; x += 22) g.fillRect(x, 0, 6, 160);
  sprinkle(g, 256, 160, 600, () => `rgba(120,60,25,${Math.random()})`, 3);
  return toTexture(c);
}

// Пачка денег с бумажной лентой «НА GTA 6»
function moneyTexture() {
  const W = 384, H = 256;
  const [c, g] = makeCanvas(W, H);
  // Несколько купюр веером
  for (let i = 4; i >= 0; i--) {
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate((i - 2) * 0.06);
    const x = -150, y = -80, w = 300, h = 160;
    const grd = g.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, '#9be39a'); grd.addColorStop(1, '#4fa65a');
    g.fillStyle = grd; g.fillRect(x, y, w, h);
    g.strokeStyle = '#2d6b38'; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
    g.fillStyle = 'rgba(30,90,45,0.5)';
    g.beginPath(); g.arc(x + 70, y + 80, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1f5a2c';
    g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('₸', x + 70, y + 82);
    g.font = 'bold 30px Arial'; g.fillText('20 000', x + 205, y + 45);
    g.restore();
  }
  // Бумажная лента
  g.fillStyle = '#f5e7a8'; g.fillRect(W / 2 + 10, 40, 64, 176);
  g.save(); g.translate(W / 2 + 42, H / 2); g.rotate(-Math.PI / 2);
  g.fillStyle = '#a0100c'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('НА GTA 6', 0, 0);
  g.restore();
  return toTexture(c);
}

// Суши-ролл
function makeSushi(scale = 1) {
  const s = new THREE.Group();
  const nori = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0x1c2a1e, roughness: 0.8 }));
  const rice = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.125, 20), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, emissive: 0x332f2a, roughness: 1 }));
  const fish = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 12), new THREE.MeshStandardMaterial({ color: 0xff7a45, emissive: 0x401505, roughness: 0.5 }));
  s.add(nori, rice, fish);
  s.scale.setScalar(scale);
  return s;
}

// Мягкое круглое свечение (для ореолов)
function glowTexture() {
  const [c, g] = makeCanvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

const TEX = {
  snow: snowTexture(),
  concrete: concreteTexture(),
  leaf: moneyTexture(),
  glow: glowTexture(),
};

// ---------------------------------------------------------------------
// 4. Двор
// ---------------------------------------------------------------------
// Столкновения: каждый объект — прямоугольник на земле (вид сверху)
const colliders = [];
function addCollider(minX, maxX, minZ, maxZ) {
  const c = { minX, maxX, minZ, maxZ, active: true };
  colliders.push(c);
  return c;
}

const MAT = {
  concrete: new THREE.MeshStandardMaterial({ map: TEX.concrete, roughness: 1 }),
  snow: new THREE.MeshStandardMaterial({ map: TEX.snow, roughness: 0.95 }),
  roofSnow: new THREE.MeshStandardMaterial({ color: 0xc8d2df, roughness: 0.9 }),
  metalRed: new THREE.MeshStandardMaterial({ color: 0x7a2f2a, roughness: 0.7, metalness: 0.3 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.6, metalness: 0.5 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 1 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 1 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }),
};

function box(w, h, d, mat, x, y, z, { shadow = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// Земля в снегу
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), MAT.snow);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Пятиэтажка. face — какая сторона коробки смотрит во двор (0:+x 1:-x 4:+z 5:-z)
const facadeMaterials = [];
function addBuilding(minX, maxX, minZ, maxZ, face, cols) {
  const w = maxX - minX, d = maxZ - minZ, h = 15;
  const [map, glow] = facadeTextures(cols, 5);
  const facade = new THREE.MeshStandardMaterial({ map, emissiveMap: glow, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.95 });
  facadeMaterials.push(facade);
  const mats = [MAT.concrete, MAT.concrete, MAT.roofSnow, MAT.concrete, MAT.concrete, MAT.concrete];
  mats[face] = facade;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.position.set((minX + maxX) / 2, h / 2, (minZ + maxZ) / 2);
  m.receiveShadow = true;
  scene.add(m);
  addCollider(minX, maxX, minZ, maxZ);
}
addBuilding(-31, 31, -31, -21, 4, 20); // северный дом
addBuilding(-31, -21, -21, 24, 0, 14); // западный дом
addBuilding(21, 31, -21, 24, 1, 14);   // восточный дом

// Гаражи на юге
{
  const mats = Array(6).fill(MAT.darkMetal);
  mats[5] = new THREE.MeshStandardMaterial({ map: garageTexture(6), roughness: 0.8, metalness: 0.2 });
  mats[2] = MAT.roofSnow;
  const g = new THREE.Mesh(new THREE.BoxGeometry(17, 2.6, 4), mats);
  g.position.set(-12.5, 1.3, 26);
  g.castShadow = g.receiveShadow = true;
  scene.add(g);
  addCollider(-21, -4, 24, 28);
}

// Бетонный забор
{
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTexture(), roughness: 1 });
  box(17, 2.3, 0.6, fenceMat, 12.5, 1.15, 24.5);
  addCollider(4, 21, 24, 25);
}

// Ворота: две створки на петлях. Откроются, когда соберёшь все листья
const gate = { left: new THREE.Group(), right: new THREE.Group(), open: 0, opening: false, collider: addCollider(-4, 4, 24, 25) };
{
  const gateMat = new THREE.MeshStandardMaterial({ map: gateTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
  for (const [pivot, hingeX, dir] of [[gate.left, -4, 1], [gate.right, 4, -1]]) {
    pivot.position.set(hingeX, 0, 24.5);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5), gateMat);
    leaf.position.set(dir * 2, 1.25, 0);
    leaf.castShadow = true;
    pivot.add(leaf);
    scene.add(pivot);
  }
  // Столбы
  box(0.35, 2.8, 0.35, MAT.darkMetal, -4.1, 1.4, 24.5);
  box(0.35, 2.8, 0.35, MAT.darkMetal, 4.1, 1.4, 24.5);
}

// Горы на юге (Алматы!) — силуэты в тумане со снежными шапками
{
  const mountMat = new THREE.MeshBasicMaterial({ color: 0x141b27, fog: false });
  const capMat = new THREE.MeshBasicMaterial({ color: 0x4d5a70, fog: false });
  for (let i = 0; i < 11; i++) {
    const h = rand(70, 140), r = rand(55, 90);
    const x = -260 + i * 52 + rand(-15, 15), z = rand(230, 300);
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mountMat);
    m.position.set(x, h / 2 - 5, z);
    m.rotation.y = rand(0, Math.PI);
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.33, h * 0.32, 7), capMat);
    cap.position.set(x, h - 5 - h * 0.16 + 0.5, z);
    cap.rotation.y = m.rotation.y;
    scene.add(cap);
  }
  // Луна
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xdfe6f0, fog: false }));
  moon.position.set(70, 120, 360);
  moon.lookAt(0, 0, 0);
  scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x8899bb, fog: false, transparent: true, opacity: 0.5, depthWrite: false }));
  halo.scale.set(70, 70, 1);
  halo.position.copy(moon.position);
  scene.add(halo);
  // Звёзды
  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const th = rand(0, Math.PI * 2), ph = rand(0.05, 1.3);
    starPos.push(Math.cos(th) * Math.cos(ph) * 450, Math.sin(ph) * 450, Math.sin(th) * Math.cos(ph) * 450);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9aa8c0, size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 })));
}

// Качели, которые качаются сами по себе…
const swing = { pivot: new THREE.Group(), lastSide: 0 };
{
  const x = -8, z = -8;
  for (const sx of [-1.5, 1.5]) {
    for (const sz of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.7), MAT.metalRed);
      leg.position.set(x + sx, 1.3, z + sz / 2);
      leg.rotation.x = sz > 0 ? -0.22 : 0.22;
      leg.castShadow = true;
      scene.add(leg);
    }
    addCollider(x + sx - 0.2, x + sx + 0.2, z - 0.4, z + 0.4);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.1), MAT.metalRed);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(x, 2.6, z);
  scene.add(bar);
  swing.pivot.position.set(x, 2.6, z);
  for (const cx of [-0.35, 0.35]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.0), MAT.darkMetal);
    chain.position.set(cx, -1.0, 0);
    swing.pivot.add(chain);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.3), MAT.wood);
  seat.position.y = -2.0;
  seat.castShadow = true;
  swing.pivot.add(seat);
  scene.add(swing.pivot);
}

// Старые «Жигули» под снегом
{
  const x = 9, z = 10;
  const paint = new THREE.MeshStandardMaterial({ color: 0x5f6e63, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.15, metalness: 0.8 });
  box(4.1, 0.7, 1.65, paint, x, 0.6, z);
  box(2.1, 0.6, 1.5, glass, x - 0.25, 1.25, z);
  box(2.2, 0.14, 1.58, MAT.roofSnow, x - 0.25, 1.6, z);
  box(1.0, 0.1, 1.6, MAT.roofSnow, x + 1.5, 1.0, z);
  box(0.9, 0.1, 1.6, MAT.roofSnow, x - 1.7, 1.0, z);
  for (const [wx, wz] of [[1.3, 0.8], [1.3, -0.8], [-1.3, 0.8], [-1.3, -0.8]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), MAT.rubber);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x + wx, 0.25, z + wz);
    scene.add(wheel);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x777766 });
  box(0.05, 0.16, 0.3, lampMat, x + 2.06, 0.7, z + 0.55, { shadow: false });
  box(0.05, 0.16, 0.3, lampMat, x + 2.06, 0.7, z - 0.55, { shadow: false });
  addCollider(x - 2.15, x + 2.15, z - 0.9, z + 0.9);
}

// Мусорные баки
{
  const binMat = new THREE.MeshStandardMaterial({ color: 0x2f4d3b, roughness: 0.7, metalness: 0.3 });
  for (let i = 0; i < 3; i++) {
    const x = 16.6 + i * 1.3;
    box(1.15, 1.2, 0.9, binMat, x, 0.6, -12);
    box(1.15, 0.1, 0.9, MAT.roofSnow, x, 1.25, -12);
  }
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const bag = new THREE.Mesh(new THREE.SphereGeometry(rand(0.25, 0.4), 10, 8), bagMat);
    bag.position.set(rand(16, 19.5), 0.2, rand(-11.2, -10.6));
    bag.castShadow = true;
    scene.add(bag);
  }
  addCollider(16, 20, -12.5, -11.5);
}

// Скамейки
for (const x of [-3, 3]) {
  box(1.8, 0.08, 0.45, MAT.wood, x, 0.5, -17);
  box(1.8, 0.4, 0.06, MAT.wood, x, 0.8, -17.22);
  box(1.8, 0.06, 0.45, MAT.roofSnow, x, 0.57, -17, { shadow: false });
  for (const lx of [-0.8, 0.8]) box(0.08, 0.5, 0.4, MAT.darkMetal, x + lx, 0.25, -17);
  addCollider(x - 0.9, x + 0.9, -17.3, -16.75);
}

// Голые деревья
function addTree(x, z) {
  const tree = new THREE.Group();
  const h = rand(4.5, 6.5);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, h, 7), MAT.bark);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  tree.add(trunk);
  for (let i = 0; i < 9; i++) {
    const len = rand(1.2, 2.6);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, len, 5), MAT.bark);
    const y = rand(h * 0.45, h * 0.95), ang = rand(0, Math.PI * 2), tilt = rand(0.5, 1.1);
    b.position.set(Math.cos(ang) * Math.sin(tilt) * len / 2, y + Math.cos(tilt) * len / 2, Math.sin(ang) * Math.sin(tilt) * len / 2);
    b.rotation.set(0, -ang, 0);
    b.rotateZ(-tilt);
    b.castShadow = true;
    tree.add(b);
  }
  tree.position.set(x, 0, z);
  tree.rotation.y = rand(0, Math.PI * 2);
  scene.add(tree);
  addCollider(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
}
[[-16, -2], [6, -17], [-4, 10], [16, 15], [-18, 17], [14, -19]].forEach(([x, z]) => addTree(x, z));

// Фонари: один горит, один мигает, один мёртвый
const lamps = [];
function addLamp(x, z, mode) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5), MAT.darkMetal);
  pole.position.set(x, 2.5, z);
  pole.castShadow = true;
  scene.add(pole);
  box(0.9, 0.06, 0.06, MAT.darkMetal, x + 0.45, 4.95, z, { shadow: false });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x332a20, emissive: 0xffa860, emissiveIntensity: mode === 'dead' ? 0 : 1 });
  box(0.4, 0.15, 0.25, headMat, x + 0.85, 4.85, z, { shadow: false });
  const light = new THREE.PointLight(0xffa860, mode === 'dead' ? 0 : 9, 16, 1.6);
  light.position.set(x + 0.85, 4.6, z);
  scene.add(light);
  addCollider(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
  lamps.push({ light, headMat, mode, on: true, timer: 0 });
}
addLamp(-12, 12, 'steady');
addLamp(12, -6, 'flicker');
addLamp(0, 0, 'dead');

// Падающий снег
const snow = (() => {
  const N = IS_TOUCH ? 900 : 2200, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-25, 25); pos[i * 3 + 1] = rand(0, 18); pos[i * 3 + 2] = rand(-25, 25);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdde6f2, size: 0.06, transparent: true, opacity: 0.85, depthWrite: false }));
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts, pos, N };
})();

// ---------------------------------------------------------------------
// 5. Предметы: листья табака и батарейки
// ---------------------------------------------------------------------
const TUTORIAL_LEAF = [0, 12];  // первый лист всегда виден со старта
const LEAF_SPOTS = [[-15, -15], [15, -16], [0, -11], [-17, 5], [17, 7], [-8, 18], [10, 19], [5, 3], [-6, -3], [14, -2], [-12, -9], [-2, 4]];
const BATTERY_SPOTS = [[-19, -19], [19, -18], [-19, 12], [19, 3], [3, 8], [-10, 0]];

const leafMat = new THREE.MeshBasicMaterial({ map: TEX.leaf, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
const leaves = [];
for (let i = 0; i < CONFIG.leafCount; i++) {
  const group = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), leafMat);
  group.add(leaf);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x8cff8a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(2.2, 2.2, 1);
  group.add(halo);
  const light = new THREE.PointLight(0x8cff8a, 3, 6, 1.5);
  light.position.y = -0.3;
  group.add(light);
  scene.add(group);
  leaves.push({ group, leaf, light, taken: false, phase: rand(0, 6) });
}

const batteryBody = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4, metalness: 0.6 });
const batteryRing = new THREE.MeshStandardMaterial({ color: 0x1a5f33, emissive: 0x3cff7a, emissiveIntensity: 0.9 });
const batteries = BATTERY_SPOTS.map(([x, z]) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 14), batteryBody);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.093, 0.093, 0.08, 14), batteryRing);
  ring.position.y = 0.1;
  group.add(body, ring);
  group.rotation.z = Math.PI / 2;
  group.position.set(x, 0.15, z);
  scene.add(group);
  return { group, x, z, taken: false };
});

// Суши на земле — можно подобрать
const SUSHI_SPOTS = [[-19, 0], [12, 18], [1, -19], [19, -8]];
const sushiPickups = SUSHI_SPOTS.map(([x, z]) => {
  const group = makeSushi(1.6);
  group.position.set(x, 0.12, z);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff9a6a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(1.1, 1.1, 1);
  halo.position.y = 0.1;
  group.add(halo);
  scene.add(group);
  return { group, x, z, taken: false };
});

// Брошенный суши-приманка (один на всех)
const bait = { mesh: makeSushi(1.6), active: false, eating: false, timer: 0 };
bait.mesh.visible = false;
scene.add(bait.mesh);

// ---------------------------------------------------------------------
// 6. Нечто
// ---------------------------------------------------------------------
const monster = (() => {
  const group = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 6, 12), black);
  body.position.y = 1.5;
  body.scale.set(0.85, 1, 0.6);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), black);
  head.position.set(0, 2.55, 0.06);
  head.scale.set(1, 1.3, 1);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35), black);
  neck.position.y = 2.3;
  group.add(body, head, neck);

  // Длинные руки до колен
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.32, 2.15, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.6), black);
    arm.position.y = -0.8;
    shoulder.add(arm);
    for (let f = -1; f <= 1; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.018, 0.35), black);
      finger.position.set(f * 0.03, -1.75, 0.02);
      finger.rotation.x = f * 0.15;
      shoulder.add(finger);
    }
    shoulder.rotation.z = s * 0.08;
    group.add(shoulder);
    arms.push(shoulder);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.13, 1.05, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.05), black);
    leg.position.y = -0.52;
    hip.add(leg);
    group.add(hip);
    legs.push(hip);
  }
  // Длинные тёмные волосы и чёлка
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x0d0805, roughness: 0.6 });
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 0.14), hairMat);
  hair.position.set(0, 2.25, -0.14);
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), hairMat);
  hairTop.position.set(0, 2.6, 0.0);
  hairTop.scale.set(1.05, 1.25, 1.1);
  group.add(hair, hairTop);

  // Злые красные глаза светятся сквозь туман
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, fog: false });
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMat);
    eye.position.set(s * 0.075, 2.6, 0.26);
    group.add(eye);
    eyes.push(eye);
  }
  // Разинутый рот — тёмная дыра, которая растягивается при скримере
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: 0x1a0000 }));
  mouth.position.set(0, 2.43, 0.22);
  mouth.scale.set(1, 1.6, 0.5);
  group.add(mouth);

  // Красный свет для скримера (пока выключен)
  const scareLight = new THREE.PointLight(0xff2a1a, 0, 4, 1.5);
  scareLight.position.set(0, 2.5, 0.8);
  group.add(scareLight);

  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(group);

  return {
    group, head, arms, legs, eyes, mouth, scareLight,
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    lastSeen: new THREE.Vector3(),
    state: 'patrol', lostTimer: 0, waitTimer: 0, stuckTimer: 0, stuckFrom: new THREE.Vector3(),
    walkT: 0, stepTimer: 0, groanTimer: 15, heading: 0, moving: false, avoidTimer: 0, avoidDir: 1,
  };
})();

// ---------------------------------------------------------------------
// 7. Звук — всё синтезируем, никаких файлов
// ---------------------------------------------------------------------
const sound = {
  ctx: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // Белый шум — основа для ветра, шагов и криков
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Ветер: шум через фильтр, частота которого медленно «гуляет»
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise; wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 450; bp.Q.value = 0.8;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 280;
    lfo.connect(lfoGain); lfoGain.connect(bp.frequency); lfo.start();
    const wg = ctx.createGain(); wg.gain.value = 0.13;
    wind.connect(bp); bp.connect(wg); wg.connect(this.master); wind.start();

    // Тревожный гул: громче, когда Нечто рядом
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass'; this.droneFilter.frequency.value = 160;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0.02;
    for (const f of [55, 58.3, 82.4]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(this.droneFilter); o.start();
    }
    this.droneFilter.connect(this.droneGain); this.droneGain.connect(this.master);
  },

  // Общая «кнопка» для короткого звука с затуханием
  _out(gain, pan, t, attack, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (pan) {
      const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
    return g;
  },
  noiseBurst({ dur = 0.1, freq = 1000, type = 'bandpass', q = 1, gain = 0.3, pan = 0, delay = 0, attack = 0.005 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    src.connect(f); f.connect(this._out(gain, pan, t, attack, dur));
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  tone({ freq = 440, freqEnd = null, dur = 0.3, type = 'sine', gain = 0.2, pan = 0, delay = 0, attack = 0.01, filter = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    let node = o;
    if (filter) {
      const f = this.ctx.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.q || 1;
      o.connect(f); node = f;
    }
    node.connect(this._out(gain, pan, t, attack, dur));
    o.start(t); o.stop(t + dur + 0.05);
  },

  setDanger(p) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(0.015 + p * 0.2, t, 0.4);
    this.droneFilter.frequency.setTargetAtTime(150 + p * 550, t, 0.4);
  },
  step(v) { this.noiseBurst({ dur: 0.13, freq: rand(800, 1400), q: 0.9, gain: v }); },           // хруст снега
  monsterStep(v, pan) { this.noiseBurst({ dur: 0.22, freq: 260, type: 'lowpass', gain: v, pan }); },
  heartbeat(v) {
    this.tone({ freq: 62, dur: 0.16, gain: v });
    this.tone({ freq: 55, dur: 0.16, gain: v * 0.7, delay: 0.2 });
  },
  chime() {
    this.tone({ freq: 784, dur: 0.9, gain: 0.12 });
    this.tone({ freq: 1175, dur: 1.1, gain: 0.09, delay: 0.12 });
    this.tone({ freq: 1568, dur: 1.3, gain: 0.05, delay: 0.24 });
  },
  battery() { this.tone({ freq: 520, freqEnd: 900, dur: 0.25, type: 'triangle', gain: 0.12 }); },
  whoosh() { this.noiseBurst({ dur: 0.35, freq: 1200, q: 0.5, gain: 0.25, attack: 0.08 }); },
  nom() { for (let i = 0; i < 6; i++) this.noiseBurst({ dur: 0.07, freq: rand(500, 900), q: 2, gain: 0.25, delay: i * 0.22 }); },
  click() { this.noiseBurst({ dur: 0.03, freq: 3500, type: 'highpass', gain: 0.25 }); },
  groan(v, pan) {
    this.tone({ freq: 95, freqEnd: 52, dur: 2.2, type: 'sawtooth', gain: v, pan, attack: 0.4, filter: { type: 'lowpass', freq: 380 } });
    this.tone({ freq: 101, freqEnd: 57, dur: 2.0, type: 'sawtooth', gain: v * 0.6, pan, attack: 0.5, filter: { type: 'lowpass', freq: 300 } });
  },
  creak(v) { this.tone({ freq: rand(380, 460), freqEnd: rand(280, 330), dur: 0.5, type: 'sawtooth', gain: v, filter: { type: 'bandpass', freq: 1300, q: 9 } }); },
  gate() {
    this.tone({ freq: 210, freqEnd: 120, dur: 2.2, type: 'sawtooth', gain: 0.35, filter: { type: 'bandpass', freq: 900, q: 10 } });
    this.noiseBurst({ dur: 0.5, freq: 200, type: 'lowpass', gain: 0.4, delay: 2.0 });
  },
  scream() {
    this.noiseBurst({ dur: 1.5, freq: 1800, q: 0.6, gain: 0.9, attack: 0.01 });
    this.tone({ freq: 950, freqEnd: 180, dur: 1.5, type: 'sawtooth', gain: 0.5 });
    this.tone({ freq: 1400, freqEnd: 260, dur: 1.2, type: 'square', gain: 0.25 });
    this.tone({ freq: 60, freqEnd: 30, dur: 1.5, type: 'sine', gain: 0.8 });
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 1.4, gain: 0.1, delay: i * 0.18 }));
  },
};

// ---------------------------------------------------------------------
// 8. Игрок и управление
// ---------------------------------------------------------------------
const player = {
  pos: new THREE.Vector3(), yaw: 0, pitch: 0,
  stamina: 100, battery: 100, lightOn: true, sushi: 0,
  moving: false, running: false, tired: false,
  bobT: 0, stepDist: 0, radius: 0.4,
};

const keys = {};
// e.code не зависит от раскладки — WASD работает и на русской клавиатуре
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyF' && state === 'playing') toggleFlashlight();
  if (e.code === 'KeyQ' && state === 'playing') throwSushi();
});

// Кидаем суши на 4 метра вперёд — Алина пойдёт его есть
function throwSushi() {
  if (player.sushi <= 0) { showMessage('Суши нет 😢 Поищи во дворе', 2); return; }
  if (bait.active) { showMessage('Она ещё прошлый не доела', 2); return; }
  player.sushi--;
  updateSushiUI();
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const p = new THREE.Vector3(player.pos.x + fx * 4, 0, player.pos.z + fz * 4);
  if (colliders.some(c => c.active && overlaps(p, 0.3, c))) p.set(player.pos.x + fx * 1.2, 0, player.pos.z + fz * 1.2);
  bait.mesh.position.set(p.x, 0.12, p.z);
  bait.mesh.visible = true;
  bait.active = true;
  bait.eating = false;
  sound.whoosh();
  showMessage('Суши брошен! 🍣', 2);
}
window.addEventListener('keyup', e => { keys[e.code] = false; });

window.addEventListener('mousemove', e => {
  if (state !== 'playing') return;
  if (document.pointerLockElement !== canvas && e.buttons !== 1) return;
  player.yaw -= e.movementX * CONFIG.mouseSensitivity;
  player.pitch = clamp(player.pitch - e.movementY * CONFIG.mouseSensitivity, -1.4, 1.4);
});

// --- Сенсорное управление (телефон) ---
// Слева: джойстик появляется там, куда поставил палец. Справа: водишь пальцем — смотришь.
const touch = { stickId: null, sx: 0, sy: 0, jx: 0, jy: 0, lookId: null, lx: 0, ly: 0, runHeld: false };
const STICK_R = 55; // радиус джойстика в пикселях
// «Захватить» палец, чтобы элемент получал его движения, даже если палец съехал
function capture(el, id) { try { el.setPointerCapture(id); } catch (e) { /* не страшно */ } }
const stickZone = document.getElementById('stickZone');
const stickEl = document.getElementById('stick');
const knobEl = document.getElementById('stickKnob');
const lookZone = document.getElementById('lookZone');
const btnLight = document.getElementById('btnLight');

stickZone.addEventListener('pointerdown', e => {
  if (touch.stickId !== null) return;
  touch.stickId = e.pointerId;
  touch.sx = e.clientX; touch.sy = e.clientY;
  touch.jx = touch.jy = 0;
  capture(stickZone, e.pointerId);
  stickEl.style.display = 'block';
  stickEl.style.left = `${e.clientX}px`;
  stickEl.style.top = `${e.clientY}px`;
  knobEl.style.transform = '';
  e.preventDefault();
});
stickZone.addEventListener('pointermove', e => {
  if (e.pointerId !== touch.stickId) return;
  let dx = e.clientX - touch.sx, dy = e.clientY - touch.sy;
  const len = Math.hypot(dx, dy);
  if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
  touch.jx = dx / STICK_R;
  touch.jy = dy / STICK_R;
  knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
});
function endStick(e) {
  if (e.pointerId !== touch.stickId) return;
  touch.stickId = null;
  touch.jx = touch.jy = 0;
  stickEl.style.display = 'none';
}
stickZone.addEventListener('pointerup', endStick);
stickZone.addEventListener('pointercancel', endStick);

lookZone.addEventListener('pointerdown', e => {
  if (touch.lookId !== null) return;
  touch.lookId = e.pointerId;
  touch.lx = e.clientX; touch.ly = e.clientY;
  capture(lookZone, e.pointerId);
  e.preventDefault();
});
lookZone.addEventListener('pointermove', e => {
  if (e.pointerId !== touch.lookId) return;
  if (state === 'playing') {
    player.yaw -= (e.clientX - touch.lx) * CONFIG.touchSensitivity;
    player.pitch = clamp(player.pitch - (e.clientY - touch.ly) * CONFIG.touchSensitivity, -1.4, 1.4);
  }
  touch.lx = e.clientX; touch.ly = e.clientY;
});
const endLook = e => { if (e.pointerId === touch.lookId) touch.lookId = null; };
lookZone.addEventListener('pointerup', endLook);
lookZone.addEventListener('pointercancel', endLook);

// Кнопки
const btnRun = document.getElementById('btnRun');
btnRun.addEventListener('pointerdown', e => { touch.runHeld = true; btnRun.classList.add('held'); capture(btnRun, e.pointerId); e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel']) btnRun.addEventListener(ev, () => { touch.runHeld = false; btnRun.classList.remove('held'); });
btnLight.addEventListener('pointerdown', e => { if (state === 'playing') toggleFlashlight(); e.preventDefault(); });
document.getElementById('btnSushi').addEventListener('pointerdown', e => { if (state === 'playing') throwSushi(); e.preventDefault(); });
document.getElementById('btnPause').addEventListener('pointerdown', e => { pauseGame(); e.preventDefault(); });

function toggleFlashlight() {
  if (player.battery <= 0) { showMessage('Батарейка села…'); return; }
  player.lightOn = !player.lightOn;
  sound.click();
}

// Движение с учётом столкновений: двигаемся по X, потом по Z, и «выталкиваемся» из препятствий
function moveWithCollision(pos, dx, dz, r) {
  pos.x += dx;
  for (const c of colliders) {
    if (!c.active || !overlaps(pos, r, c)) continue;
    if (dx > 0) pos.x = c.minX - r - 0.001; else if (dx < 0) pos.x = c.maxX + r + 0.001;
  }
  pos.z += dz;
  for (const c of colliders) {
    if (!c.active || !overlaps(pos, r, c)) continue;
    if (dz > 0) pos.z = c.minZ - r - 0.001; else if (dz < 0) pos.z = c.maxZ + r + 0.001;
  }
  pos.x = clamp(pos.x, -30, 30);
  pos.z = clamp(pos.z, -30, 45);
}
function overlaps(pos, r, c) {
  return pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ;
}

function updatePlayer(dt) {
  let fx = 0, fz = 0;
  if (keys.KeyW || keys.ArrowUp) fz -= 1;
  if (keys.KeyS || keys.ArrowDown) fz += 1;
  if (keys.KeyA || keys.ArrowLeft) fx -= 1;
  if (keys.KeyD || keys.ArrowRight) fx += 1;

  // Джойстик на телефоне: чем дальше отвёл палец, тем быстрее идёшь; до края — бег
  let analog = 1, stickRun = false;
  if (touch.stickId !== null) {
    const m = Math.hypot(touch.jx, touch.jy);
    if (m > 0.15) {
      fx += touch.jx; fz += touch.jy;
      analog = Math.min(1, m);
      stickRun = m > 0.97;
    }
  }
  player.moving = fx !== 0 || fz !== 0;

  // Бег и дыхалка
  const wantRun = (keys.ShiftLeft || keys.ShiftRight || touch.runHeld || stickRun) && player.moving;
  if (player.stamina <= 0) player.tired = true;
  if (player.tired && player.stamina > 35) player.tired = false;
  player.running = wantRun && !player.tired;
  player.stamina = clamp(player.stamina + (player.running ? -CONFIG.staminaDrain : CONFIG.staminaRegen) * dt, 0, 100);

  if (player.moving) {
    const len = Math.hypot(fx, fz);
    fx /= len; fz /= len;
    const speed = player.running ? CONFIG.runSpeed : CONFIG.walkSpeed * Math.max(0.35, analog);
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    // Поворачиваем направление вместе с камерой
    const dx = (fx * cos + fz * sin) * speed * dt;
    const dz = (-fx * sin + fz * cos) * speed * dt;
    moveWithCollision(player.pos, dx, dz, player.radius);

    player.bobT += dt * speed * 2.3;
    player.stepDist += speed * dt;
    if (player.stepDist > (player.running ? 1.5 : 1.15)) {
      player.stepDist = 0;
      sound.step(player.running ? 0.35 : 0.18);
    }
  }

  // Батарейка фонарика
  if (player.lightOn) {
    player.battery = Math.max(0, player.battery - CONFIG.batteryDrain * dt);
    if (player.battery <= 0) { player.lightOn = false; showMessage('Батарейка села… Ищи новую'); sound.click(); }
  }

  // Камера = глаза игрока (с лёгким покачиванием при ходьбе)
  const bob = player.moving ? Math.sin(player.bobT) * (player.running ? 0.07 : 0.04) : 0;
  camera.position.set(player.pos.x, 1.65 + bob, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

// ---------------------------------------------------------------------
// 9. Игровая логика
// ---------------------------------------------------------------------
let state = 'menu';    // menu → playing → caught → over / win; paused
let collected = 0;
let elapsed = 0;
let caughtTimer = 0;
let time = 0;
let danger = 0;        // 0…1 — насколько близко Нечто
let heartTimer = 0;
let alertMsgCooldown = 0;

const ui = {
  hud: document.getElementById('hud'),
  leaves: document.getElementById('leaves'),
  sushi: document.getElementById('sushi'),
  shout: document.getElementById('shout'),
  battery: document.getElementById('battery'),
  stamina: document.getElementById('stamina'),
  message: document.getElementById('message'),
  danger: document.getElementById('danger'),
  flash: document.getElementById('flash'),
  grain: document.getElementById('grain'),
  screens: {
    start: document.getElementById('start'),
    pause: document.getElementById('pause'),
    over: document.getElementById('over'),
    win: document.getElementById('win'),
  },
};

let msgTimeout = null;
function showMessage(text, seconds = 3) {
  ui.message.textContent = text;
  ui.message.style.opacity = 1;
  clearTimeout(msgTimeout);
  msgTimeout = setTimeout(() => { ui.message.style.opacity = 0; }, seconds * 1000);
}

function showScreen(name) {
  for (const [k, el] of Object.entries(ui.screens)) el.classList.toggle('show', k === name);
  ui.hud.style.display = name ? 'none' : 'block';
}

function randomYardPoint() {
  for (let i = 0; i < 30; i++) {
    const p = new THREE.Vector3(rand(-19, 19), 0, rand(-19, 22));
    if (!colliders.some(c => c.active && overlaps(p, 0.8, c))) return p;
  }
  return new THREE.Vector3(0, 0, 0);
}

function pickPatrolTarget() {
  // Иногда Нечто «чувствует» игрока и бредёт в его сторону
  if (Math.random() < 0.35) {
    const p = player.pos.clone().add(new THREE.Vector3(rand(-8, 8), 0, rand(-8, 8)));
    p.x = clamp(p.x, -19, 19); p.z = clamp(p.z, -19, 22);
    monster.target.copy(p);
  } else monster.target.copy(randomYardPoint());
}

function resetGame() {
  collected = 0; elapsed = 0; danger = 0;
  Object.assign(player, { yaw: 0, pitch: 0, stamina: 100, battery: 100, lightOn: true, tired: false, stepDist: 0 });
  player.pos.set(0, 0, 19);

  // Раскладываем листья: первый — обучающий, остальные — случайно
  const spots = [...LEAF_SPOTS].sort(() => Math.random() - 0.5);
  leaves.forEach((l, i) => {
    const [x, z] = i === 0 ? TUTORIAL_LEAF : spots[i - 1];
    l.group.position.set(x, 1.0, z);
    l.group.visible = true;
    l.light.intensity = 3;
    l.taken = false;
  });
  batteries.forEach(b => { b.taken = false; b.group.visible = true; });

  // Ворота закрыты
  gate.open = 0; gate.opening = false; gate.collider.active = true;
  gate.left.rotation.y = 0; gate.right.rotation.y = 0;

  // Нечто в дальнем конце двора
  monster.pos.set(rand(-6, 6), 0, -17);
  monster.state = 'patrol';
  monster.lostTimer = 0; monster.waitTimer = 2; monster.groanTimer = rand(8, 14);
  monster.scareLight.intensity = 0;
  monster.eyes.forEach(e => e.scale.setScalar(1));
  monster.mouth.scale.set(1, 1.6, 0.5);
  monster.group.scale.setScalar(CONFIG.monsterHeight);
  monster.target.copy(monster.pos);
  monster.shoutTimer = 4;
  player.sushi = 0;
  sushiPickups.forEach(s => { s.taken = false; s.group.visible = true; });
  bait.active = bait.eating = false;
  bait.mesh.visible = false;
  ui.shout.style.display = 'none';
  updateSushiUI();
  ui.flash.style.opacity = 0;
  updateLeafUI();
}

function updateLeafUI() {
  ui.leaves.textContent = `💵 ${collected} / ${CONFIG.leafCount}`;
}
function updateSushiUI() {
  ui.sushi.textContent = player.sushi > 0 ? `🍣 ${player.sushi}  (${IS_TOUCH ? 'жми 🍣' : 'Q'} — кинуть)` : '🍣 0';
}

function startPlaying() {
  sound.init();
  showScreen(null);
  state = 'playing';
  if (IS_TOUCH) {
    // На телефоне: на весь экран и горизонтально (где браузер это разрешает)
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation?.lock?.('landscape'))
        .catch(() => {});
    }
  } else {
    // Прячем курсор. Если браузер не разрешит — можно смотреть, зажав левую кнопку мыши
    try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch (e) { /* ничего страшного */ }
  }
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  showScreen('pause');
}
// Свернул браузер или пришёл звонок — пауза
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

document.getElementById('startBtn').onclick = () => {
  resetGame();
  startPlaying();
  setTimeout(() => showMessage('Собери 5 пачек денег на GTA 6. Одна прямо перед тобой. Тихо… Алина рядом.', 5), 600);
};
document.getElementById('resumeBtn').onclick = startPlaying;
document.getElementById('againBtn1').onclick = document.getElementById('againBtn2').onclick = () => { resetGame(); startPlaying(); };

// Вышел курсор из игры (Esc) — пауза
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) pauseGame();
});

// --- Предметы ---
function updatePickups(dt) {
  for (const l of leaves) {
    if (l.taken) continue;
    l.group.position.y = 1.0 + Math.sin(time * 1.6 + l.phase) * 0.12;
    // Лист смотрит на игрока и чуть покачивается — так его лучше видно
    l.leaf.rotation.y = Math.atan2(player.pos.x - l.group.position.x, player.pos.z - l.group.position.z) + Math.sin(time * 1.2 + l.phase) * 0.5;
    l.light.intensity = 2.6 + Math.sin(time * 3 + l.phase) * 0.6;
    const d = Math.hypot(l.group.position.x - player.pos.x, l.group.position.z - player.pos.z);
    if (d < 1.3) {
      l.taken = true;
      l.group.visible = false;
      l.light.intensity = 0;
      collected++;
      updateLeafUI();
      sound.chime();
      if (collected >= CONFIG.leafCount) openGate();
      else showMessage(`Деньги на GTA 6: ${collected} / ${CONFIG.leafCount} 💵`, 2.5);
    }
  }
  for (const s of sushiPickups) {
    if (s.taken) continue;
    s.group.rotation.y = time;
    if (Math.hypot(s.x - player.pos.x, s.z - player.pos.z) < 1.2) {
      s.taken = true;
      s.group.visible = false;
      player.sushi++;
      updateSushiUI();
      sound.battery();
      showMessage(`Суши! 🍣 ${IS_TOUCH ? 'Жми кнопку 🍣' : 'Нажми Q'}, чтобы кинуть его Алине`, 3);
    }
  }
  for (const b of batteries) {
    if (b.taken) continue;
    b.group.rotation.y = time * 1.5;
    if (Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < 1.2) {
      b.taken = true;
      b.group.visible = false;
      player.battery = Math.min(100, player.battery + CONFIG.batteryPickup);
      sound.battery();
      showMessage(`Батарейка +${CONFIG.batteryPickup}%`, 2);
    }
  }
}

function openGate() {
  gate.opening = true;
  gate.collider.active = false;
  sound.gate();
  showMessage('Все деньги собраны! Ворота открыты — беги в магазин за GTA 6!', 5);
  // Финал: Нечто знает, где ты
  monster.state = 'chase';
}

// --- Нечто ---
function updateMonster(dt) {
  const dx = player.pos.x - monster.pos.x, dz = player.pos.z - monster.pos.z;
  const d = Math.hypot(dx, dz);
  const bonus = collected * CONFIG.monsterSpeedPerLeaf;
  updateShout(dt, d);

  // Суши! Алина не может устоять
  if (bait.active) {
    const bd = Math.hypot(bait.mesh.position.x - monster.pos.x, bait.mesh.position.z - monster.pos.z);
    if (bd < 0.9 || bait.eating) {
      if (!bait.eating) {
        bait.eating = true;
        bait.timer = CONFIG.sushiEatTime;
        monster.shoutTimer = 0;
        sound.nom();
        showMessage('Алина ест суши 🍣 Тихо уходи…', 3);
      }
      bait.timer -= dt;
      monster.moving = false;
      if (bait.timer <= 0) {
        bait.active = bait.eating = false;
        bait.mesh.visible = false;
        monster.state = 'patrol';
        monster.waitTimer = 0.5;
        showMessage('Суши закончились. Она снова злая.', 2.5);
      }
      danger = clamp(1 - d / 16, 0, 1) * 0.4;
      return;
    }
    if (bd < 30) {
      if (monster.state !== 'bait') monster.shoutTimer = 0;
      monster.state = 'bait';
      monster.target.copy(bait.mesh.position);
    }
  } else if (monster.state === 'bait') {
    monster.state = 'patrol';
  }

  // Замечает ли она игрока?
  let noticed = d < 4;
  if (player.running && d < 18) noticed = true;
  if (player.moving && !player.running && d < 7) noticed = true;
  if (player.lightOn && d < 22) {
    // Светишь фонариком прямо на него — оно видит
    const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
    if ((-dx * fwdX + -dz * fwdZ) / d > Math.cos(0.42)) noticed = true;
  }
  if (monster.state === 'chase' && d < 11) noticed = true;
  if (collected >= CONFIG.leafCount) noticed = true;

  if (monster.state === 'bait') noticed = false; // ничего не видит, кроме суши
  if (noticed) {
    if (monster.state !== 'chase' && alertMsgCooldown <= 0) {
      sound.groan(0.35, panTo(monster.pos));
      showMessage('Алина тебя заметила!', 2);
      monster.shoutTimer = 0;
      alertMsgCooldown = 12;
    }
    monster.state = 'chase';
    monster.lastSeen.copy(player.pos);
    monster.lostTimer = 0;
  }
  alertMsgCooldown -= dt;

  let speed = 0;
  if (monster.state === 'bait') {
    speed = CONFIG.monsterChaseSpeed + bonus; // за суши — бегом
  } else if (monster.state === 'chase') {
    monster.target.copy(noticed ? player.pos : monster.lastSeen);
    speed = CONFIG.monsterChaseSpeed + bonus;
    if (!noticed) {
      monster.lostTimer += dt;
      if (monster.lostTimer > 3) { monster.state = 'search'; monster.target.copy(monster.lastSeen); }
    }
  } else if (monster.state === 'search') {
    speed = CONFIG.monsterPatrolSpeed * 1.4 + bonus * 0.5;
    if (monster.pos.distanceTo(monster.target) < 1) {
      monster.state = 'patrol'; monster.waitTimer = rand(2, 4); speed = 0;
    }
  } else { // patrol
    if (monster.waitTimer > 0) { monster.waitTimer -= dt; if (monster.waitTimer <= 0) pickPatrolTarget(); }
    else {
      speed = CONFIG.monsterPatrolSpeed + bonus * 0.5;
      if (monster.pos.distanceTo(monster.target) < 1) { monster.waitTimer = rand(1.5, 4); speed = 0; }
    }
  }

  // Шагаем к цели
  monster.moving = speed > 0;
  if (monster.moving) {
    let tx = monster.target.x - monster.pos.x, tz = monster.target.z - monster.pos.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    // Обход препятствия: если упёрлось, какое-то время идёт вбок
    if (monster.avoidTimer > 0) {
      monster.avoidTimer -= dt;
      const a = monster.avoidDir * 1.3, c = Math.cos(a), s = Math.sin(a);
      [tx, tz] = [tx * c - tz * s, tx * s + tz * c];
    }
    moveWithCollision(monster.pos, tx * speed * dt, tz * speed * dt, 0.45);
    const want = Math.atan2(tx, tz);
    let diff = want - monster.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    monster.heading += diff * Math.min(1, dt * 6);
    monster.walkT += dt * speed * 2.2;

    // Застрял? Пробуем обойти, а на прогулке — выбираем новую цель
    monster.stuckTimer += dt;
    if (monster.stuckTimer > 0.4) {
      if (monster.pos.distanceTo(monster.stuckFrom) < speed * 0.4 * 0.4) {
        monster.avoidTimer = 0.9;
        monster.avoidDir = Math.random() < 0.5 ? -1 : 1;
        if (monster.state === 'patrol' && Math.random() < 0.3) pickPatrolTarget();
      }
      monster.stuckFrom.copy(monster.pos);
      monster.stuckTimer = 0;
    }

    // Его шаги слышно, если близко
    monster.stepTimer -= dt;
    if (monster.stepTimer <= 0 && d < 20) {
      monster.stepTimer = monster.state === 'chase' ? 0.38 : 0.75;
      sound.monsterStep(0.5 * (1 - d / 20), panTo(monster.pos));
    }
  }

  // Иногда стонет где-то во дворе
  monster.groanTimer -= dt;
  if (monster.groanTimer <= 0) {
    monster.groanTimer = rand(18, 35);
    sound.groan(clamp(0.3 * (1 - d / 40), 0.05, 0.3), panTo(monster.pos));
  }

  // Поймал!
  if (d < CONFIG.catchDistance) caught();

  danger = clamp(1 - d / 16, 0, 1);
}

// Слева или справа звук (для наушников)
function panTo(p) {
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const dx = p.x - player.pos.x, dz = p.z - player.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  return (dx * rx + dz * rz) / len;
}

function animateMonster() {
  const g = monster.group;
  g.position.copy(monster.pos);
  g.rotation.y = monster.heading;
  const w = monster.moving ? Math.sin(monster.walkT) : 0;
  monster.legs[0].rotation.x = w * 0.45;
  monster.legs[1].rotation.x = -w * 0.45;
  monster.arms[0].rotation.x = -w * 0.3 + Math.sin(time * 0.7) * 0.05;
  monster.arms[1].rotation.x = w * 0.3 + Math.sin(time * 0.8) * 0.05;
  g.position.y = Math.abs(w) * 0.05;
  // Голова дёргается, неестественно
  monster.head.rotation.z = Math.sin(time * 0.9) * 0.15 + (Math.random() < 0.01 ? rand(-0.5, 0.5) : 0);
  // Ест суши — довольно качает головой и машет руками
  if (bait.eating) {
    g.position.y = Math.abs(Math.sin(time * 8)) * 0.06;
    monster.arms[0].rotation.x = -1.2 + Math.sin(time * 10) * 0.3;
    monster.arms[1].rotation.x = -1.2 - Math.sin(time * 10) * 0.3;
  }
}

// Реплики Алины — облачко над головой
const SHOUTS_CHASE = ['НЕ ПОКУПАЙ!!!', 'ОПЯТЬ ТВОЯ GTA?!', 'ТЕБЕ СКОЛЬКО ЛЕТ?!', 'ИГРА ДЕТСТВА, ДА?!', 'Я ВСЁ ВИЖУ!', 'А МНЕ СУШИ КУПИЛ?!', 'СТОЯТЬ!!!', 'ВЕРНИ ДЕНЬГИ!'];
const SHOUTS_IDLE = ['…GTA 6…', 'где он…', 'я слышу тебя…', 'мм, суши бы…', 'выходи…'];
const SHOUTS_EAT = ['ням 🍣', 'ладно, 5 минут…', 'вкусно…', 'я всё равно злая'];
const SHOUTS_BAIT = ['СУШИ?!', 'ЭТО МНЕ?!', 'МОЁ!!!', 'филадельфия?!'];
function updateShout(dt, d) {
  monster.shoutTimer -= dt;
  if (monster.shoutTimer <= 0 && d < 22) {
    const list = bait.eating ? SHOUTS_EAT
      : monster.state === 'bait' ? SHOUTS_BAIT
      : monster.state === 'chase' ? SHOUTS_CHASE : SHOUTS_IDLE;
    ui.shout.textContent = list[(Math.random() * list.length) | 0];
    ui.shout.style.fontSize = monster.state === 'chase' && !bait.eating ? '20px' : '14px';
    monster.shownUntil = time + 2.2;
    monster.shoutTimer = monster.state === 'chase' ? rand(2.5, 4) : rand(6, 10);
  }
  // Ставим облачко над головой Алины на экране
  const p = new THREE.Vector3(monster.pos.x, 1.9, monster.pos.z).project(camera);
  const visible = time < (monster.shownUntil || 0) && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
  ui.shout.style.display = visible ? 'block' : 'none';
  if (visible) {
    ui.shout.style.left = `${(p.x + 1) / 2 * window.innerWidth}px`;
    ui.shout.style.top = `${(1 - p.y) / 2 * window.innerHeight}px`;
  }
}

function caught() {
  state = 'caught';
  caughtTimer = 0;
  sound.scream();
  document.exitPointerLock?.();
  monster.scareLight.intensity = 4;
  monster.eyes.forEach(e => e.scale.setScalar(0.7));
}

function updateJumpscare(dt) {
  caughtTimer += dt;
  // Нечто резко оказывается прямо перед лицом
  const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
  monster.pos.set(player.pos.x + fwdX * 0.7, 0, player.pos.z + fwdZ * 0.7);
  ui.shout.style.display = 'none';
  // Рот раскрывается всё шире
  monster.mouth.scale.set(1.1 + caughtTimer * 0.3, 1.6 + Math.min(caughtTimer, 0.6) * 2.2, 0.5);
  monster.head.rotation.z = rand(-0.12, 0.12);
  monster.heading = Math.atan2(-fwdX, -fwdZ);
  monster.moving = false;
  // Алина маленькая — она подпрыгивает прямо к твоему лицу
  monster.group.scale.setScalar(CONFIG.monsterHeight);
  monster.group.position.set(monster.pos.x, 1.65 - 2.58 * CONFIG.monsterHeight, monster.pos.z);
  monster.group.rotation.y = monster.heading;
  // Тряска камеры
  const shake = Math.max(0, 1 - caughtTimer / 1.4) * 0.06;
  camera.position.set(player.pos.x + rand(-shake, shake), 1.65 + rand(-shake, shake), player.pos.z);
  camera.rotation.set(rand(-shake, shake), player.yaw + rand(-shake, shake), rand(-shake, shake));
  ui.flash.style.opacity = caughtTimer < 1.2 ? (Math.random() < 0.5 ? 0.55 : 0.1) : Math.max(0, 0.6 - (caughtTimer - 1.2));
  if (caughtTimer > 1.8) {
    state = 'over';
    ui.flash.style.opacity = 0;
    document.getElementById('overStats').innerHTML =
      `Денег собрано: ${collected} / ${CONFIG.leafCount} · Продержался: ${formatTime(elapsed)}<br>GTA 6 откладывается. Опять.`;
    showScreen('over');
  }
}

function formatTime(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function checkWin() {
  if (gate.opening && player.pos.z > 27 && Math.abs(player.pos.x) < 4.5) {
    state = 'win';
    document.exitPointerLock?.();
    sound.win();
    document.getElementById('winStats').innerHTML =
      `Время: ${formatTime(elapsed)}<br>Игра твоего детства — твоя. Алина узнает об этом утром…<br>Купи ей суши на сдачу 🍣`;
    showScreen('win');
  }
}

// --- Окружение: качели, фонари, снег, ворота ---
function updateWorld(dt) {
  // Качели качаются сами… и скрипят, если ты рядом
  const s = Math.sin(time * 1.25);
  swing.pivot.rotation.x = s * 0.38;
  const side = Math.sign(s);
  if (side !== swing.lastSide) {
    swing.lastSide = side;
    const d = Math.hypot(player.pos.x + 8, player.pos.z + 8);
    if (d < 12 && state === 'playing') sound.creak(0.12 * (1 - d / 12));
  }

  // Фонари
  for (const l of lamps) {
    if (l.mode !== 'flicker') continue;
    l.timer -= dt;
    if (l.timer <= 0) {
      l.on = !l.on;
      l.timer = l.on ? rand(0.05, 2.5) : rand(0.03, 0.5);
    }
    l.light.intensity = l.on ? 9 : 0;
    l.headMat.emissiveIntensity = l.on ? 1 : 0;
  }

  // Силуэты в окнах иногда «моргают»
  for (const m of facadeMaterials) {
    if (Math.random() < 0.002) m.emissiveIntensity = 0;
    else if (m.emissiveIntensity === 0 && Math.random() < 0.05) m.emissiveIntensity = 1.6;
  }

  // Снег падает вокруг игрока
  const p = snow.pos;
  for (let i = 0; i < snow.N; i++) {
    p[i * 3 + 1] -= dt * (0.8 + (i % 7) * 0.08);
    p[i * 3] += Math.sin(time + i) * dt * 0.15;
    if (p[i * 3 + 1] < 0) {
      p[i * 3 + 1] = 18;
      p[i * 3] = player.pos.x + rand(-25, 25);
      p[i * 3 + 2] = player.pos.z + rand(-25, 25);
    }
  }
  snow.pts.geometry.attributes.position.needsUpdate = true;

  // Ворота открываются плавно
  if (gate.opening && gate.open < 1) {
    gate.open = Math.min(1, gate.open + dt * 0.45);
    const a = (1 - Math.pow(1 - gate.open, 3)) * 1.35;
    gate.left.rotation.y = -a;
    gate.right.rotation.y = a;
  }
}

// --- Фонарик, страх, интерфейс ---
function updateEffects(dt) {
  // Фонарик мигает при низком заряде и когда Нечто рядом
  let power = player.lightOn ? CONFIG.flashlightPower : 0;
  if (player.lightOn) {
    if (player.battery < 15 && Math.random() < 0.08) power *= 0.15;
    if (danger > 0.3 && Math.random() < danger * 0.25) power *= rand(0, 0.3);
    power *= 0.55 + 0.45 * Math.min(1, player.battery / 30);
  }
  flashlight.intensity = power;

  sound.setDanger(danger);
  heartTimer -= dt;
  if (danger > 0.12 && heartTimer <= 0) {
    heartTimer = 1.15 - danger * 0.7;
    sound.heartbeat(0.15 + danger * 0.45);
  }

  ui.danger.style.opacity = danger * 0.7;
  ui.grain.style.opacity = 0.035 + danger * 0.12;
  ui.battery.style.width = `${player.battery}%`;
  ui.battery.style.background = player.battery < 20 ? '#e0574f' : '#f3e3b0';
  ui.stamina.style.width = `${player.stamina}%`;
  ui.stamina.style.background = player.tired ? '#6a7380' : '#8fb3d9';
  btnLight.classList.toggle('on', player.lightOn);
}

// Плёночное «зерно» поверх картинки
const grainCtx = ui.grain.getContext('2d');
const grainImg = grainCtx.createImageData(ui.grain.width, ui.grain.height);
let frameCount = 0;
function drawGrain() {
  const d = grainImg.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random() * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  grainCtx.putImageData(grainImg, 0, 0);
}

// --- Главный цикл: ~60 раз в секунду ---
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  if (state === 'playing') {
    elapsed += dt;
    updatePlayer(dt);
    updateMonster(dt);
    updatePickups(dt);
    updateEffects(dt);
    checkWin();
  } else if (state === 'caught') {
    updateJumpscare(dt);
  }
  if (state !== 'caught') animateMonster();
  updateWorld(dt);
  if (!IS_TOUCH || (frameCount++ & 1)) drawGrain(); // на телефоне — через кадр
  renderer.render(scene, camera);
}

// На стартовом экране камера медленно смотрит на двор
resetGame();
camera.position.set(0, 1.65, 19);
loop();

// Для отладки и экспериментов: в консоли браузера доступно window.game
window.game = { CONFIG, player, monster, leaves, scene, camera, resetGame };
