// --- 1. Image Path Configuration ---
const imagePaths = {
  land1: "Assets/background.svg",
  land2: "Assets/background2.svg",
  land3: "",
  tree: "",
  lotus: "",
  palace: "Assets/casel.png",
  palace2: "Assets/casel2.png",
  palace3: "Assets/casel3.png",
  barracks: "Assets/barracks.png",
  elephantPen: "Assets/elephantpen.png",
  stables: "Assets/stables.png",
  wall: "Assets/wall.png",
  paddyField: "Assets/paddyfield.png",
  tower: "Assets/tower.png",
  villager: "Assets/villager.png",
  soldier: "Assets/soldier.png",
  elephant: "Assets/elephant.png",
  horse: "Assets/hourse.png",
  enemy: "Assets/enemy.png",
};

const GRID_IMAGE_CONFIG = {
  land1: { offsetX: -864, offsetY: -10, width: 1725, height: 1010 },
  land2: { offsetX: -970, offsetY: -60, width: 1950, height: 1270 },
  land3: { offsetX: -1280, offsetY: 0, width: 2560, height: 1430 },
};

const GameState = {
  gold: 1000,
  rice: 500,
  mode: "normal",
  selectedBuilding: null,
  buildings: [],
  villagers: [],
  soldiers: [],
  elephants: [],
  horses: [],
  enemies: [],
  floatingTexts: [],
  level: 1,
  phase: "build",
  timer: 6300,
  popupTimer: 0,
  enemiesSpawned: false,
  combatFrameCount: 0,
  midCombatAdviceGiven: false,
  selectedUnit: null,
  palaceLevel: 1,
  frameCount: 0,
  difficulty: "normal",
  currentLand: "land1",
  isPaused: false,
  tutorialState: "inactive",
};

// --- AUDIO SYSTEM ---
const sounds = {
  bgm: new Audio("Assets/bgm.mp3"),
  click: new Audio("Assets/click.mp3"),
  build: new Audio("Assets/build.mp3"),
  attack: new Audio("Assets/attack.mp3"),
  elephant_roar: new Audio("Assets/elephant_roar.mp3"),
  wall_build: new Audio("Assets/wall.mp3"),
  tower_build: new Audio("Assets/towerbuild.mp3"),
};

sounds.bgm.loop = true;

let isMuted = false;
let bgmStarted = false;
let globalBGMVolume = 0.3;
let globalSFXVolume = 0.8;
sounds.bgm.volume = globalBGMVolume;

function playSound(key) {
  if (isMuted || !sounds[key]) return;
  if (key !== "bgm") {
    let snd = sounds[key].cloneNode();
    snd.volume = globalSFXVolume;
    snd.play().catch((e) => console.log("Audio blocked"));
  } else {
    sounds.bgm.volume = globalBGMVolume;
    sounds.bgm.play().catch((e) => console.log("BGM blocked"));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const btnMute = document.getElementById("btn-mute");
  if (btnMute) {
    btnMute.addEventListener("click", () => {
      isMuted = !isMuted;
      btnMute.innerText = isMuted ? "🔇" : "🔊";
      if (isMuted) {
        sounds.bgm.pause();
      } else {
        sounds.bgm.play();
        bgmStarted = true;
      }
    });
  }
});

document.body.addEventListener(
  "click",
  () => {
    if (!bgmStarted && !isMuted) {
      playSound("bgm");
      bgmStarted = true;
    }
  },
  { once: true },
);

const TILE_W = 64;
const TILE_H = 32;
const MAP_COLS = 27;
const MAP_ROWS = 27;
const ROCK_HEIGHT = 150;

let camera = { x: 0, y: 0 };
let zoom = 1.0;
let MAX_ZOOM = 4.0;
let MIN_ZOOM = 0.2;

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let touchMoved = false;
let initialPinchDistance = null;
let advisorTimeouts = [];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const mouse = { x: 0, y: 0, gridX: -1, gridY: -1 };

function updateZoomLimits() {
  if (!canvas) return;
  const mapW = (MAP_COLS + MAP_ROWS) * (TILE_W / 2) + 20;
  const mapH = (MAP_COLS + MAP_ROWS) * (TILE_H / 2) + ROCK_HEIGHT + 300;
  MIN_ZOOM = Math.max(canvas.width / mapW, canvas.height / mapH);
  if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
}

function clampCamera() {
  if (!canvas) return;
  const mapLeft = -((MAP_ROWS * TILE_W) / 2);
  const mapRight = (MAP_COLS * TILE_W) / 2;
  const mapTop = -TILE_H * 2;
  const mapBottom = (MAP_ROWS + MAP_COLS) * (TILE_H / 2) + ROCK_HEIGHT;
  const pad = 10;
  let minCamX = canvas.width - mapRight * zoom - pad;
  let maxCamX = -mapLeft * zoom + pad;
  let minCamY = canvas.height - mapBottom * zoom - pad;
  let maxCamY = -mapTop * zoom + pad;

  if (minCamX > maxCamX) {
    camera.x = canvas.width / 2;
  } else {
    camera.x = Math.max(minCamX, Math.min(camera.x, maxCamX));
  }

  if (minCamY > maxCamY) {
    let mapCenterY = (mapTop + mapBottom) / 2;
    camera.y = canvas.height / 2 - mapCenterY * zoom;
  } else {
    camera.y = Math.max(minCamY, Math.min(camera.y, maxCamY));
  }
}

function centerCameraOnBase() {
  updateZoomLimits();
  let mapCenterY = ((MAP_ROWS + MAP_COLS) * (TILE_H / 2) + ROCK_HEIGHT) / 2;
  camera.x = canvas.width / 2;
  camera.y = canvas.height / 2 - mapCenterY * zoom;
  clampCamera();
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  updateZoomLimits();
  if (camera.x === 0 && camera.y === 0) {
    zoom = MIN_ZOOM;
    centerCameraOnBase();
  } else {
    if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
    clampCamera();
  }
}
window.addEventListener("resize", resizeCanvas);

function doZoom(amount, focusX = canvas.width / 2, focusY = canvas.height / 2) {
  updateZoomLimits();
  let oldZoom = zoom;
  zoom += amount;
  if (zoom > MAX_ZOOM) zoom = MAX_ZOOM;
  if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
  let isoX = (focusX - camera.x) / oldZoom;
  let isoY = (focusY - camera.y) / oldZoom;
  camera.x = focusX - isoX * zoom;
  camera.y = focusY - isoY * zoom;
  clampCamera();
}
document
  .getElementById("btn-zoom-in")
  ?.addEventListener("click", () => doZoom(0.1));
document
  .getElementById("btn-zoom-out")
  ?.addEventListener("click", () => doZoom(-0.1));
canvas.addEventListener("wheel", (e) => {
  if (e.deltaY < 0) doZoom(0.1, e.clientX, e.clientY);
  else doZoom(-0.1, e.clientX, e.clientY);
});

const svgs = {
  palaceIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="40" width="60" height="40" fill="%23DAA520" stroke="%23000" stroke-width="2"/><polygon points="20,40 50,10 80,40" fill="%23FFD700" stroke="%23000" stroke-width="2"/><rect x="40" y="60" width="20" height="20" fill="%234a3525"/></svg>`,
  barracksIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="50" width="70" height="30" fill="%23B22222" stroke="%23000" stroke-width="2"/><polygon points="15,50 35,30 65,30 85,50" fill="%23CD5C5C" stroke="%23000" stroke-width="2"/><rect x="40" y="65" width="20" height="15" fill="%234a3525"/><rect x="50" y="40" width="10" height="10" fill="%23FFD700"/></svg>`,
  wallIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="20" width="40" height="60" fill="%23696969" stroke="%23000" stroke-width="2"/><rect x="30" y="20" width="10" height="10" fill="%23505050"/><rect x="60" y="20" width="10" height="10" fill="%23505050"/></svg>`,
  elephantPenIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="50" width="60" height="20" fill="%238B4513" stroke="%23000" stroke-width="2"/><path d="M10 50 L50 20 L90 50 Z" fill="%23CD853F" stroke="%23000" stroke-width="2"/><circle cx="50" cy="60" r="8" fill="%23696969"/></svg>`,
  stablesIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="40" width="80" height="40" fill="%23A0522D" stroke="%23000" stroke-width="2"/><path d="M5 40 L50 15 L95 40 Z" fill="%238B4513" stroke="%23000" stroke-width="2"/><rect x="30" y="50" width="15" height="30" fill="%235C3A21"/><rect x="55" y="50" width="15" height="30" fill="%235C3A21"/></svg>`,
  paddyFieldIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="80" height="60" fill="%239ACD32" stroke="%23000" stroke-width="2"/><line x1="10" y1="40" x2="90" y2="40" stroke="%23556B2F" stroke-width="2"/><line x1="10" y1="60" x2="90" y2="60" stroke="%23556B2F" stroke-width="2"/></svg>`,
  towerIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="10" width="40" height="80" fill="%238B4513" stroke="%23000" stroke-width="2"/><rect x="25" y="10" width="50" height="15" fill="%23CD853F" stroke="%23000" stroke-width="2"/></svg>`,
};

const images = {};
let totalAssets = 0;
let loadedAssets = 0;

function initImages() {
  let imageKeys = Object.keys(imagePaths);
  totalAssets = imageKeys.length;

  imageKeys.forEach((key) => {
    images[key] = new Image();
    images[key].onload = () => {
      assetLoaded();
    };
    images[key].onerror = () => {
      assetLoaded();
    };

    if (imagePaths[key]) {
      images[key].src = imagePaths[key];
    } else {
      const svgKey =
        key === "elephantPen"
          ? "elephantPenIcon"
          : key === "paddyField"
            ? "paddyFieldIcon"
            : key === "palace"
              ? "palaceIcon"
              : key === "barracks"
                ? "barracksIcon"
                : key === "stables"
                  ? "stablesIcon"
                  : key === "tower"
                    ? "towerIcon"
                    : key === "wall"
                      ? "wallIcon"
                      : key;
      if (svgs[svgKey] || svgs[key]) {
        images[key].src = svgs[svgKey] || svgs[key];
      } else {
        assetLoaded();
      }
    }
  });
}

function assetLoaded() {
  loadedAssets++;
  let progress = Math.floor((loadedAssets / totalAssets) * 100);

  const progressBar = document.getElementById("progress-bar");
  const loadingText = document.getElementById("loading-text");

  if (progressBar) progressBar.style.width = progress + "%";
  if (loadingText) loadingText.innerText = progress + "%";

  if (loadedAssets >= totalAssets) {
    setTimeout(() => {
      const loadingScreen = document.getElementById("loading-screen");
      if (loadingScreen) {
        loadingScreen.style.opacity = "0";
        loadingScreen.style.transition = "opacity 0.5s ease";
        setTimeout(() => {
          loadingScreen.style.display = "none";
        }, 500);
      }
    }, 500);
  }
}

initImages();

function isoToScreen(gridX, gridY) {
  return {
    x: (gridX - gridY) * (TILE_W / 2),
    y: (gridX + gridY) * (TILE_H / 2),
  };
}
function screenToIso(screenX, screenY) {
  if (zoom === 0) zoom = MIN_ZOOM;
  let adjX = (screenX - camera.x) / zoom;
  let adjY = (screenY - camera.y) / zoom;
  return { x: adjY / TILE_H + adjX / TILE_W, y: adjY / TILE_H - adjX / TILE_W };
}

function isBuildingBlocked(gx, gy, ignoreWalls = false) {
  if (gx < 0 || gx >= MAP_COLS || gy < 0 || gy >= MAP_ROWS) return true;
  for (let b of GameState.buildings) {
    if (b.type !== "Paddy Field" && !(ignoreWalls && b.type === "Wall")) {
      if (
        gx >= b.gridX &&
        gx < b.gridX + b.size &&
        gy >= b.gridY &&
        gy < b.gridY + b.size
      )
        return true;
    }
  }
  return false;
}

function isTileBlocked(gx, gy, selfObj, ignoreWalls = false) {
  try {
    if (gx < 0 || gx >= MAP_COLS || gy < 0 || gy >= MAP_ROWS) return true;
    const buildings = GameState.buildings || [];
    for (let b of buildings) {
      if (b.type !== "Paddy Field" && !(ignoreWalls && b.type === "Wall")) {
        if (
          gx >= b.gridX &&
          gx < b.gridX + b.size &&
          gy >= b.gridY &&
          gy < b.gridY + b.size
        )
          return true;
      }
    }
    const allEntities = [
      ...(GameState.villagers || []),
      ...(GameState.soldiers || []),
      ...(GameState.elephants || []),
      ...(GameState.horses || []),
      ...(GameState.enemies || []),
    ];
    for (let ent of allEntities) {
      if (!ent || ent === selfObj) continue;
      if (Math.round(ent.targetX) === gx && Math.round(ent.targetY) === gy)
        return true;
      if (Math.round(ent.x) === gx && Math.round(ent.y) === gy) return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

function getDistance(obj1, obj2) {
  let x1 = obj1.x !== undefined ? obj1.x : obj1.gridX;
  let y1 = obj1.y !== undefined ? obj1.y : obj1.gridY;
  let x2 = obj2.x !== undefined ? obj2.x : obj2.gridX;
  let y2 = obj2.y !== undefined ? obj2.y : obj2.gridY;
  return Math.hypot(x1 - x2, y1 - y2);
}

function drawHealthBar(ctx, x, y, hp, maxHp) {
  if (hp >= maxHp) return;
  const width = 30;
  const height = 4;
  ctx.fillStyle = "red";
  ctx.fillRect(x - width / 2, y - 10, width, height);
  ctx.fillStyle = "#00FF00";
  ctx.fillRect(x - width / 2, y - 10, width * Math.max(0, hp / maxHp), height);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - width / 2, y - 10, width, height);
}

class FloatingText {
  constructor(gridX, gridY, text, color) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.text = text;
    this.color = color;
    this.life = 90;
    this.maxLife = 90;
  }
  draw(ctx) {
    if (!GameState.isPaused) this.life--;
    const progress = 1 - this.life / this.maxLife;
    const pos = isoToScreen(this.gridX, this.gridY);
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / (this.maxLife * 0.5));
    ctx.font = 'bold 24px "Poppins", sans-serif';
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "black";
    ctx.strokeText(this.text, pos.x, pos.y - 50 - progress * 60);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, pos.x, pos.y - 50 - progress * 60);
    ctx.restore();
  }
}

function drawIsoBlock(
  ctx,
  cx,
  cy,
  sizeX,
  sizeY,
  height,
  cTop,
  cLeft,
  cRight,
  zOffset = 0,
) {
  const anchorY = cy - TILE_H / 2;
  const top = { x: cx, y: anchorY - zOffset - height };
  const right = {
    x: cx + sizeX * (TILE_W / 2),
    y: anchorY + sizeX * (TILE_H / 2) - zOffset - height,
  };
  const left = {
    x: cx - sizeY * (TILE_W / 2),
    y: anchorY + sizeY * (TILE_H / 2) - zOffset - height,
  };
  const bottom = {
    x: cx + (sizeX - sizeY) * (TILE_W / 2),
    y: anchorY + (sizeX + sizeY) * (TILE_H / 2) - zOffset - height,
  };

  ctx.fillStyle = cTop;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (height > 0) {
    const bL = { x: left.x, y: left.y + height },
      bB = { x: bottom.x, y: bottom.y + height },
      bR = { x: right.x, y: right.y + height };
    ctx.fillStyle = cLeft;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bB.x, bB.y);
    ctx.lineTo(bL.x, bL.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = cRight;
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bR.x, bR.y);
    ctx.lineTo(bB.x, bB.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
function drawBlockCenter(
  ctx,
  cx,
  cy,
  baseSize,
  size,
  h,
  topC,
  leftC,
  rightC,
  z,
) {
  let offsetY = (baseSize - size) * (TILE_H / 2);
  drawIsoBlock(ctx, cx, cy + offsetY, size, size, h, topC, leftC, rightC, z);
}

class Building {
  constructor(gridX, gridY, type) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.type = type;
    this.size = type === "Wall" ? 1 : type === "Tower" ? 2 : 3;
    this.imgKey =
      type === "Elephant Pen"
        ? "elephantPen"
        : type === "Paddy Field"
          ? "paddyField"
          : type.toLowerCase();

    if (type === "Wall") this.maxHp = 500;
    else if (type === "Palace") this.maxHp = 2000 * GameState.palaceLevel;
    else if (type === "Tower") this.maxHp = 800;
    else this.maxHp = 300;
    this.hp = this.maxHp;
    this.actionTimer = 0;
  }

  update() {
    if (this.hp <= 0) return;
    if (this.type === "Tower") {
      if (this.actionTimer > 0) this.actionTimer--;
      if (this.actionTimer <= 0) {
        let nearest = null;
        let minDist = 4;
        GameState.enemies.forEach((e) => {
          let d = getDistance(this, e);
          if (d < minDist) {
            minDist = d;
            nearest = e;
          }
        });
        if (nearest) {
          this.actionTimer = 50;
          nearest.hp -= 20;
          GameState.floatingTexts.push(
            new FloatingText(nearest.x, nearest.y, `-20`, "#FFA500"),
          );
        }
      }
    }
  }

  draw(ctx, screenX, screenY) {
    let currentImgKey = this.imgKey;
    if (this.type === "Palace") {
      if (GameState.palaceLevel === 2) currentImgKey = "palace2";
      else if (GameState.palaceLevel >= 3) currentImgKey = "palace3";
    }

    const img = images[currentImgKey];
    if (
      imagePaths[this.imgKey] &&
      img &&
      img.complete &&
      img.naturalWidth > 0
    ) {
      let imageScale = 1.0;
      let imgW = this.size * TILE_W * imageScale;
      let imgH = imgW * (img.naturalHeight / img.naturalWidth);

      if (this.type === "Wall") {
        imgW = 60;
        imgH = imgW * (img.naturalHeight / img.naturalWidth);
      }
      const bottomY = screenY - TILE_H / 2 + this.size * TILE_H;
      let finalY = bottomY - imgH;
      ctx.drawImage(img, screenX - imgW / 2, finalY, imgW, imgH);
    } else {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      if (this.type === "Palace") {
        let pColor = GameState.palaceLevel > 1 ? "#DAA520" : "#e8e8e8";
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          2,
          2,
          10,
          pColor,
          "#c0c0c0",
          "#a0a0a0",
          0,
        );
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          2,
          1.4,
          25,
          "#fff",
          "#e0e0e0",
          "#cccccc",
          10,
        );
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          2,
          0.8,
          15,
          "#FFD700",
          "#DAA520",
          "#B8860B",
          35,
        );
      } else if (this.type === "Barracks") {
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          2,
          2,
          5,
          "#8B4513",
          "#5C3A21",
          "#3E2723",
          0,
        );
        drawIsoBlock(
          ctx,
          screenX,
          screenY,
          2,
          0.8,
          20,
          "#CD5C5C",
          "#8B0000",
          "#800000",
          5,
        );
        drawIsoBlock(
          ctx,
          screenX,
          screenY,
          0.8,
          2,
          15,
          "#F08080",
          "#A52A2A",
          "#800000",
          5,
        );
      } else if (this.type === "Elephant Pen") {
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          2,
          2,
          2,
          "#D2B48C",
          "#A0522D",
          "#8B4513",
          0,
        );
        drawIsoBlock(
          ctx,
          screenX,
          screenY,
          2,
          0.1,
          10,
          "#DEB887",
          "#8B4513",
          "#5C3A21",
          2,
        );
        drawIsoBlock(
          ctx,
          screenX,
          screenY,
          0.1,
          2,
          10,
          "#DEB887",
          "#8B4513",
          "#5C3A21",
          2,
        );
        drawIsoBlock(
          ctx,
          screenX,
          screenY,
          1.2,
          1.2,
          25,
          "#8B4513",
          "#5C3A21",
          "#3E2723",
          2,
        );
      } else if (this.type === "Stables") {
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          2,
          2,
          2,
          "#D2B48C",
          "#A0522D",
          "#8B4513",
          0,
        );
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          2,
          1.6,
          18,
          "#CD853F",
          "#8B4513",
          "#5C3A21",
          2,
        );
      } else if (this.type === "Paddy Field") {
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          2,
          2,
          1,
          "#9ACD32",
          "#6B8E23",
          "#556B2F",
          0,
        );
        ctx.strokeStyle = "rgba(85, 107, 47, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const anchorY = screenY - TILE_H / 2;
        ctx.moveTo(screenX - TILE_W / 2, anchorY + TILE_H / 2);
        ctx.lineTo(screenX + TILE_W / 2, anchorY + 1.5 * TILE_H);
        ctx.moveTo(screenX + TILE_W / 2, anchorY + TILE_H / 2);
        ctx.lineTo(screenX - TILE_W / 2, anchorY + 1.5 * TILE_H);
        ctx.stroke();
      } else if (this.type === "Wall") {
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          1,
          1,
          30,
          "#A9A9A9",
          "#696969",
          "#505050",
          0,
        );
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          1,
          0.4,
          8,
          "#D3D3D3",
          "#808080",
          "#606060",
          30,
        );
      } else if (this.type === "Tower") {
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          1,
          1,
          50,
          "#8B4513",
          "#5C3A21",
          "#3E2723",
          0,
        );
        drawBlockCenter(
          ctx,
          screenX,
          screenY,
          1,
          1.2,
          10,
          "#CD853F",
          "#8B4513",
          "#5C3A21",
          50,
        );
      }
    }
    drawHealthBar(
      ctx,
      screenX,
      screenY - this.size * TILE_H,
      this.hp,
      this.maxHp,
    );
  }
}

class CombatEntity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.actionTimer = 0;
    this.facingRight = true;
    this.isMoving = false;
    this.manualTargetEnemy = null;
    this.manualTargetPos = null;
  }

  drawSelectionRing(ctx, sx, sy) {
    if (GameState.selectedUnit === this) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(sx, sy, 22, 11, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#D4AF37";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#D4AF37";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    }
  }

  combatUpdate(enemiesArray) {
    if (this.actionTimer > 0) this.actionTimer--;

    if (this.manualTargetEnemy) {
      if (this.manualTargetEnemy.hp <= 0) {
        this.manualTargetEnemy = null;
      } else {
        let d = getDistance(this, this.manualTargetEnemy);
        if (d <= this.attackRange) {
          this.isMoving = false;
          this.facingRight = this.manualTargetEnemy.x > this.x;
          if (this.actionTimer <= 0) {
            this.actionTimer = this.attackSpeed;
            this.manualTargetEnemy.hp -= this.damage;
            GameState.floatingTexts.push(
              new FloatingText(
                this.manualTargetEnemy.x,
                this.manualTargetEnemy.y,
                `-${this.damage}`,
                "#FF0000",
              ),
            );
          }
          return true;
        } else {
          this.targetX = this.manualTargetEnemy.x;
          this.targetY = this.manualTargetEnemy.y;
        }
      }
    }

    if (this.manualTargetPos) {
      this.targetX = this.manualTargetPos.x;
      this.targetY = this.manualTargetPos.y;
      return false;
    }

    let nearest = null;
    let minDist = this.attackRange || 1.5;
    enemiesArray.forEach((e) => {
      let d = getDistance(this, e);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    });

    if (nearest) {
      this.targetX = this.x;
      this.targetY = this.y;
      this.isMoving = false;
      this.facingRight = nearest.x > this.x;
      if (this.actionTimer <= 0) {
        this.actionTimer = this.attackSpeed;
        nearest.hp -= this.damage;
        GameState.floatingTexts.push(
          new FloatingText(nearest.x, nearest.y, `-${this.damage}`, "#FF0000"),
        );
        playSound("attack");
      }
      return true;
    }
    return false;
  }

  moveUpdate(ignoreWalls = false) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.1) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
      if (this.manualTargetPos) this.manualTargetPos = null;

      if (Math.random() < 0.05 && !this.manualTargetEnemy) {
        const moves = [
          { dx: 0, dy: 1 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: -1, dy: 0 },
        ];
        const move = moves[Math.floor(Math.random() * moves.length)];
        const nx = Math.floor(this.x) + move.dx;
        const ny = Math.floor(this.y) + move.dy;
        if (
          !isTileBlocked(nx, ny, this, ignoreWalls) &&
          !isBuildingBlocked(nx, ny, ignoreWalls)
        ) {
          this.targetX = nx;
          this.targetY = ny;
        }
      }
    } else {
      this.isMoving = true;
      this.facingRight = dx - dy > 0.01;
      let moveX = (dx / dist) * this.speed;
      let moveY = (dy / dist) * this.speed;
      if (
        !isBuildingBlocked(
          Math.floor(this.x + moveX),
          Math.floor(this.y),
          ignoreWalls,
        )
      ) {
        this.x += moveX;
      }
      if (
        !isBuildingBlocked(
          Math.floor(this.x),
          Math.floor(this.y + moveY),
          ignoreWalls,
        )
      ) {
        this.y += moveY;
      }
    }
  }
}

class Villager extends CombatEntity {
  constructor(x, y) {
    super(x, y);
    this.speed = 0.02 + Math.random() * 0.015;
    this.color = ["#FFD700", "#FF4500", "#1E90FF", "#FFF"][
      Math.floor(Math.random() * 4)
    ];
    this.state = "wandering";
    this.hp = 20;
    this.maxHp = 20;
  }
  update() {
    if (this.hp <= 0) return;
    if (this.state === "farming") {
      this.actionTimer--;
      this.isMoving = false;
      if (this.actionTimer <= 0) {
        this.state = "wandering";
        GameState.rice += 5;
        updateDOM();
        GameState.floatingTexts.push(
          new FloatingText(this.x, this.y, "+5 Rice", "#00FA9A"),
        );
      }
      return;
    }

    if (!this.manualTargetPos && !this.manualTargetEnemy) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.05) {
        this.x = this.targetX;
        this.y = this.targetY;
        let onField = GameState.buildings.find(
          (b) =>
            b.type === "Paddy Field" &&
            this.x >= b.gridX &&
            this.x < b.gridX + b.size &&
            this.y >= b.gridY &&
            this.y < b.gridY + b.size,
        );
        if (onField && Math.random() < 0.8) {
          this.state = "farming";
          this.actionTimer = 120 + Math.random() * 60;
          return;
        }
        if (Math.random() < 0.02) {
          let fields = GameState.buildings.filter(
            (b) => b.type === "Paddy Field",
          );
          if (fields.length > 0 && Math.random() < 0.5) {
            let f = fields[Math.floor(Math.random() * fields.length)];
            this.targetX = f.gridX + Math.floor(Math.random() * f.size);
            this.targetY = f.gridY + Math.floor(Math.random() * f.size);
          } else {
            const moves = [
              { dx: 0, dy: 1 },
              { dx: 1, dy: 0 },
              { dx: 0, dy: -1 },
              { dx: -1, dy: 0 },
            ];
            const move = moves[Math.floor(Math.random() * moves.length)];
            const nx = Math.floor(this.x) + move.dx;
            const ny = Math.floor(this.y) + move.dy;
            if (!isTileBlocked(nx, ny, this) && !isBuildingBlocked(nx, ny)) {
              this.targetX = nx;
              this.targetY = ny;
            }
          }
        }
      } else {
        let moveX = (dx / dist) * this.speed;
        let moveY = (dy / dist) * this.speed;
        if (!isBuildingBlocked(Math.floor(this.x + moveX), Math.floor(this.y)))
          this.x += moveX;
        if (!isBuildingBlocked(Math.floor(this.x), Math.floor(this.y + moveY)))
          this.y += moveY;
        this.isMoving = true;
        this.facingRight = dx - dy > 0.01;
      }
    } else {
      this.moveUpdate();
    }
  }
  draw(ctx, sx, sy) {
    const bob =
      !GameState.isPaused && this.isMoving
        ? Math.abs(Math.sin(Date.now() * 0.01)) * 6
        : 0;
    let rY =
      sy -
      bob -
      (!GameState.isPaused && this.state === "farming"
        ? Math.abs(Math.sin(Date.now() / 150)) * 5
        : 0);
    this.drawSelectionRing(ctx, sx, sy);
    ctx.save();
    if (!this.facingRight) {
      ctx.translate(sx, sy);
      ctx.scale(-1, 1);
      ctx.translate(-sx, -sy);
    }
    const img = images.villager;
    if (imagePaths.villager && img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, sx - 16, rY - 38, 32, 48);
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.fillStyle = this.color;
      ctx.fillRect(sx - 4, rY - 18, 8, 12);
      ctx.strokeRect(sx - 4, rY - 18, 8, 12);
      ctx.beginPath();
      ctx.arc(sx, rY - 22, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    drawHealthBar(ctx, sx, sy - 30, this.hp, this.maxHp);
  }
}

class Soldier extends CombatEntity {
  constructor(x, y) {
    super(x, y);
    this.speed = 0.035;
    this.hp = 50;
    this.maxHp = 50;
    this.damage = 10;
    this.attackRange = 1.2;
    this.attackSpeed = 40;
  }
  update() {
    if (this.hp <= 0) return;
    if (!this.combatUpdate(GameState.enemies)) this.moveUpdate(true);
  }
  draw(ctx, sx, sy) {
    const bob =
      !GameState.isPaused && this.isMoving
        ? Math.abs(Math.sin(Date.now() * 0.012)) * 5
        : 0;
    let isOnWall = false;
    for (let b of GameState.buildings) {
      if (
        b.type === "Wall" &&
        Math.floor(this.x) === b.gridX &&
        Math.floor(this.y) === b.gridY
      ) {
        isOnWall = true;
        break;
      }
    }
    let jumpOffset = 0;
    if (isOnWall && this.isMoving) {
      let arcX = Math.sin((this.x % 1) * Math.PI);
      let arcY = Math.sin((this.y % 1) * Math.PI);
      jumpOffset = Math.max(arcX, arcY) * 60;
    }
    let finalY = sy - bob - jumpOffset;
    this.drawSelectionRing(ctx, sx, sy);
    ctx.save();
    if (!this.facingRight) {
      ctx.translate(sx, finalY);
      ctx.scale(-1, 1);
      ctx.translate(-sx, -finalY);
    }
    const img = images.soldier;
    if (imagePaths.soldier && img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, sx - 16, finalY - 38, 32, 48);
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#C0C0C0";
      ctx.fillRect(sx - 4, finalY - 18, 8, 12);
      ctx.strokeRect(sx - 4, finalY - 18, 8, 12);
      ctx.fillStyle = "#FF0000";
      ctx.beginPath();
      ctx.arc(sx, finalY - 22, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    drawHealthBar(ctx, sx, finalY - 30, this.hp, this.maxHp);
  }
}

class Elephant extends CombatEntity {
  constructor(x, y) {
    super(x, y);
    this.speed = 0.02;
    this.hp = 300;
    this.maxHp = 300;
    this.damage = 40;
    this.attackRange = 1.5;
    this.attackSpeed = 60;
  }
  update() {
    if (this.hp <= 0) return;
    if (!this.combatUpdate(GameState.enemies)) this.moveUpdate();
    if (Math.random() < 0.002) playSound("elephant_roar");
  }
  draw(ctx, sx, sy) {
    const bob =
      !GameState.isPaused && this.isMoving
        ? Math.abs(Math.sin(Date.now() * 0.005)) * 4
        : 0;
    this.drawSelectionRing(ctx, sx, sy);
    ctx.save();
    ctx.translate(sx, sy - bob);
    if (!this.facingRight) ctx.scale(-1, 1);
    const img = images.elephant;
    if (imagePaths.elephant && img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -32, -49, 64, 64);
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#696969";
      ctx.beginPath();
      ctx.ellipse(0, -15, 14, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    drawHealthBar(ctx, sx, sy - 40, this.hp, this.maxHp);
  }
}

class Horse extends CombatEntity {
  constructor(x, y) {
    super(x, y);
    this.speed = 0.05;
    this.hp = 100;
    this.maxHp = 100;
    this.damage = 15;
    this.attackRange = 1.2;
    this.attackSpeed = 30;
  }
  update() {
    if (this.hp <= 0) return;
    if (!this.combatUpdate(GameState.enemies)) this.moveUpdate();
  }
  draw(ctx, sx, sy) {
    const bob =
      !GameState.isPaused && this.isMoving
        ? Math.abs(Math.sin(Date.now() * 0.02)) * 7
        : 0;
    this.drawSelectionRing(ctx, sx, sy);
    ctx.save();
    ctx.translate(sx, sy - bob);
    if (!this.facingRight) ctx.scale(-1, 1);
    const img = images.horse;
    if (imagePaths.horse && img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -24, -38, 48, 48);
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8B4513";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -10, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    drawHealthBar(ctx, sx, sy - 35, this.hp, this.maxHp);
  }
}

function findPathToTarget(startX, startY, target) {
  let sx = Math.floor(startX),
    sy = Math.floor(startY);
  let tx = target.gridX !== undefined ? target.gridX : Math.floor(target.x);
  let ty = target.gridY !== undefined ? target.gridY : Math.floor(target.y);

  let open = [{ x: sx, y: sy, g: 0, f: 0, p: null }];
  let closed = new Set();
  let dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  let iters = 0;
  while (open.length > 0 && iters < 400) {
    iters++;
    open.sort((a, b) => a.f - b.f);
    let curr = open.shift();
    let key = curr.x + "," + curr.y;

    if (closed.has(key)) continue;
    closed.add(key);

    let tSize = target.size || 1;
    if (
      curr.x >= tx - 1 &&
      curr.x <= tx + tSize &&
      curr.y >= ty - 1 &&
      curr.y <= ty + tSize
    ) {
      let path = [];
      let temp = curr;
      while (temp.p) {
        path.push({ x: temp.x, y: temp.y });
        temp = temp.p;
      }
      return path.reverse();
    }

    for (let d of dirs) {
      let nx = curr.x + d.x,
        ny = curr.y + d.y;
      if (nx >= 0 && nx < MAP_COLS && ny >= 0 && ny < MAP_ROWS) {
        if (closed.has(nx + "," + ny)) continue;
        let blocked = false;
        for (let b of GameState.buildings) {
          if (b.type !== "Paddy Field") {
            if (
              nx >= b.gridX &&
              nx < b.gridX + b.size &&
              ny >= b.gridY &&
              ny < b.gridY + b.size
            ) {
              if (b !== target) blocked = true;
            }
          }
        }
        if (!blocked) {
          let g = curr.g + 1;
          let h = Math.abs(tx - nx) + Math.abs(ty - ny);
          open.push({ x: nx, y: ny, g: g, f: g + h, p: curr });
        }
      }
    }
  }
  return null;
}

class Enemy extends CombatEntity {
  constructor(x, y, hpMult) {
    super(x, y);
    this.speed = 0.02;
    this.hp = 40 * hpMult;
    this.maxHp = 40 * hpMult;
    this.damage = 10 * hpMult;
    this.attackRange = 1.2;
    this.attackSpeed = 50;
    this.path = [];
    this.pathTimer = Math.floor(Math.random() * 30);
    this.currentTarget = null;
  }

  update() {
    if (this.hp <= 0) return;
    if (this.actionTimer > 0) this.actionTimer--;

    let defenders = [
      ...GameState.soldiers,
      ...GameState.elephants,
      ...GameState.horses,
      ...GameState.villagers,
    ];
    let importantTargets = [
      ...defenders,
      ...GameState.buildings.filter((b) => b.type !== "Wall"),
    ];
    let walls = GameState.buildings.filter((b) => b.type === "Wall");

    if (importantTargets.length === 0 && walls.length > 0) {
      importantTargets = walls;
    }

    this.pathTimer--;
    if (
      this.pathTimer <= 0 ||
      !this.currentTarget ||
      this.currentTarget.hp <= 0
    ) {
      this.pathTimer = 30;
      let nearestImp = null;
      let minDistImp = 9999;
      importantTargets.forEach((t) => {
        let d = getDistance(this, t);
        if (d < minDistImp) {
          minDistImp = d;
          nearestImp = t;
        }
      });

      if (nearestImp) {
        let newPath = findPathToTarget(this.x, this.y, nearestImp);
        if (newPath !== null) {
          this.currentTarget = nearestImp;
          this.path = newPath;
        } else {
          let nearestWall = null;
          let minW = 9999;
          walls.forEach((w) => {
            let d = getDistance(this, w);
            if (d < minW) {
              minW = d;
              nearestWall = w;
            }
          });
          if (nearestWall) {
            this.currentTarget = nearestWall;
            this.path = [];
          } else {
            this.currentTarget = nearestImp;
            this.path = [];
          }
        }
      } else {
        this.currentTarget = null;
      }
    }

    if (this.currentTarget) {
      let range =
        this.currentTarget instanceof Building
          ? this.currentTarget.size + 0.5
          : this.attackRange;
      let dToTarget = getDistance(this, this.currentTarget);

      if (dToTarget <= range) {
        this.isMoving = false;
        this.facingRight =
          (this.currentTarget.gridX || this.currentTarget.x) > this.x;
        if (this.actionTimer <= 0) {
          this.actionTimer = this.attackSpeed;
          this.currentTarget.hp -= this.damage;
          GameState.floatingTexts.push(
            new FloatingText(
              this.currentTarget.gridX || this.currentTarget.x,
              this.currentTarget.gridY || this.currentTarget.y,
              `-${this.damage}`,
              "#FF0000",
            ),
          );
          playSound("attack");
        }
      } else {
        this.isMoving = true;
        let tx, ty;

        if (this.path.length > 0) {
          tx = this.path[0].x + 0.5;
          ty = this.path[0].y + 0.5;
          let distToNode = Math.hypot(tx - this.x, ty - this.y);
          if (distToNode < 0.2) this.path.shift();
        } else {
          tx =
            this.currentTarget.gridX !== undefined
              ? this.currentTarget.gridX + this.currentTarget.size / 2
              : this.currentTarget.x;
          ty =
            this.currentTarget.gridY !== undefined
              ? this.currentTarget.gridY + this.currentTarget.size / 2
              : this.currentTarget.y;
        }

        let dx = tx - this.x;
        let dy = ty - this.y;
        let dist = Math.hypot(dx, dy);
        if (dist > 0) {
          let moveX = (dx / dist) * this.speed;
          let moveY = (dy / dist) * this.speed;
          if (
            !isBuildingBlocked(Math.floor(this.x + moveX), Math.floor(this.y))
          )
            this.x += moveX;
          if (
            !isBuildingBlocked(Math.floor(this.x), Math.floor(this.y + moveY))
          )
            this.y += moveY;
          this.facingRight = dx - dy > 0.01;
        }
      }
    } else {
      this.isMoving = false;
    }
  }

  draw(ctx, sx, sy) {
    const bob =
      !GameState.isPaused && this.isMoving
        ? Math.abs(Math.sin(Date.now() * 0.015)) * 6
        : 0;
    ctx.save();
    if (!this.facingRight) {
      ctx.translate(sx, sy);
      ctx.scale(-1, 1);
      ctx.translate(-sx, -sy);
    }
    const img = images.enemy;
    if (imagePaths.enemy && img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, sx - 16, sy - 38 - bob, 32, 48);
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#800000";
      ctx.fillRect(sx - 4, sy - 18 - bob, 8, 12);
      ctx.strokeRect(sx - 4, sy - 18 - bob, 8, 12);
    }
    ctx.restore();
    drawHealthBar(ctx, sx, sy - 30, this.hp, this.maxHp);
  }
}

// --- DYNAMIC ROYAL ADVISOR ---
function showRoyalAdvisor(messages) {
  advisorTimeouts.forEach((t) => clearTimeout(t));
  advisorTimeouts = [];

  let aiPanel = document.getElementById("ai-guide-panel");
  if (!aiPanel) return;

  aiPanel.style.opacity = "1";
  let aiText = document.getElementById("ai-chat-text");
  aiText.innerHTML = "";

  let msgIndex = 0;
  let charIndex = 0;

  function typeWriter() {
    if (GameState.isPaused) {
      let tWait = setTimeout(typeWriter, 500);
      advisorTimeouts.push(tWait);
      return;
    }

    if (msgIndex < messages.length) {
      if (charIndex < messages[msgIndex].length) {
        aiText.innerHTML += messages[msgIndex].charAt(charIndex);
        charIndex++;
        let t1 = setTimeout(typeWriter, 35);
        advisorTimeouts.push(t1);
      } else {
        let t2 = setTimeout(() => {
          aiText.innerHTML += "<br><br>";
          msgIndex++;
          charIndex = 0;
          typeWriter();
        }, 3000);
        advisorTimeouts.push(t2);
      }
    } else {
      aiText.innerHTML += '<span class="advisor-goodluck">Good Luck! ⚔️</span>';
      let t3 = setTimeout(() => {
        aiPanel.style.opacity = "0";
      }, 6000);
      advisorTimeouts.push(t3);
    }
  }

  let tInit = setTimeout(typeWriter, 500);
  advisorTimeouts.push(tInit);
}

// --- GAME LOGIC ---
function handleGameLogic() {
  if (GameState.isPaused) return;

  GameState.frameCount++;

  if (GameState.phase === "build" && GameState.frameCount % 300 === 0) {
    let palaceCount = GameState.buildings.filter(
      (b) => b.type === "Palace",
    ).length;
    if (palaceCount > 0) {
      let goldEarned = 10 * GameState.palaceLevel;
      GameState.gold += goldEarned;
      updateDOM();
      let palace = GameState.buildings.find((b) => b.type === "Palace");
      GameState.floatingTexts.push(
        new FloatingText(
          palace.gridX + 1,
          palace.gridY + 1,
          `+${goldEarned} Gold`,
          "#FFD700",
        ),
      );
    }
  }

  if (GameState.phase === "build") {
    GameState.timer--;
    if (GameState.timer <= 0) {
      GameState.phase = "combat";
      GameState.enemiesSpawned = false;
      GameState.combatFrameCount = 0;
    }
  } else if (GameState.phase === "combat") {
    GameState.combatFrameCount++;

    if (
      GameState.level === 1 &&
      GameState.combatFrameCount === 180 &&
      !GameState.midCombatAdviceGiven
    ) {
      GameState.midCombatAdviceGiven = true;
      let combatUnits = [
        ...GameState.soldiers,
        ...GameState.elephants,
        ...GameState.horses,
      ];

      if (combatUnits.length > 0 && GameState.tutorialState === "inactive") {
        GameState.tutorialState = "select_troop";
        showRoyalAdvisor([
          "Your Majesty, the enemies are here!",
          "Let me show you how to command your troops.",
          "First, CLICK on one of your Soldiers to select them.",
        ]);
      } else {
        let combatAdvice = [];
        if (GameState.gold >= 150) {
          combatAdvice.push(
            "Your Majesty, the enemy attacks! You have ample Gold.",
          );
          combatAdvice.push("Quickly build a Barracks to deploy Soldiers.");
        } else if (GameState.gold >= 50) {
          combatAdvice.push(
            "They approach fast! Use your remaining Gold to build Fortified Walls.",
          );
          combatAdvice.push(
            "Walls will delay them while our Palace guards strike from afar!",
          );
        } else {
          combatAdvice.push(
            "Our treasury is low! Trust in the strength of our Palace for this wave.",
          );
          combatAdvice.push(
            "Next time, build Paddy Fields early to strengthen our economy.",
          );
        }
        showRoyalAdvisor(combatAdvice);
      }
    }

    if (!GameState.enemiesSpawned) {
      let multiplier =
        GameState.difficulty === "hard"
          ? 5
          : GameState.difficulty === "easy"
            ? 2
            : 3;
      let enemyCount = GameState.level * multiplier;
      for (let i = 0; i < enemyCount; i++) {
        let ex =
          Math.random() > 0.5
            ? Math.random() > 0.5
              ? 0
              : MAP_COLS - 1
            : Math.random() * MAP_COLS;
        let ey =
          ex === 0 || ex === MAP_COLS - 1
            ? Math.random() * MAP_ROWS
            : Math.random() > 0.5
              ? 0
              : MAP_ROWS - 1;
        GameState.enemies.push(new Enemy(ex, ey, 1 + GameState.level * 0.2));
      }
      GameState.enemiesSpawned = true;
    } else {
      if (
        GameState.phase !== "game_over" &&
        GameState.phase !== "game_over_delay"
      ) {
        let anyImportantBuildingExists = GameState.buildings.some(
          (b) => b.type !== "Wall",
        );
        if (!anyImportantBuildingExists) {
          GameState.phase = "game_over_delay";
          let bestScore =
            parseInt(localStorage.getItem("apexLionHighScore")) || 1;
          let isNewRecord = false;

          if (GameState.level > bestScore) {
            localStorage.setItem("apexLionHighScore", GameState.level);
            bestScore = GameState.level;
            isNewRecord = true;
          }

          setTimeout(() => {
            GameState.phase = "game_over";
            GameState.isPaused = true;
            let goPopup = document.getElementById("game-over-popup");
            if (goPopup) {
              let lvlText = document.getElementById("game-over-level-text");
              if (lvlText) {
                lvlText.innerHTML = `You survived until Level ${GameState.level}.<br><br>
                                <span class="go-best-record">🏆 Best Record: Level ${bestScore}</span>
                                ${isNewRecord ? '<br><span class="go-new-high">🎉 NEW HIGH SCORE! 🎉</span>' : ""}`;
              }
              goPopup.style.display = "block";
            }
          }, 3000);
          return;
        }
      }

      if (
        GameState.enemies.length === 0 &&
        GameState.phase !== "game_over_delay" &&
        GameState.phase !== "game_over"
      ) {
        let rewardMult =
          GameState.difficulty === "hard"
            ? 1.5
            : GameState.difficulty === "easy"
              ? 0.5
              : 1;
        let goldBonus = Math.floor(GameState.level * 150 * rewardMult);
        let riceBonus = Math.floor(GameState.level * 50 * rewardMult);

        GameState.gold += goldBonus;
        GameState.rice += riceBonus;
        updateDOM();
        GameState.phase = "level_cleared";
        GameState.popupTimer = 180;

        let popup = document.getElementById("level-popup");
        if (popup) {
          document.getElementById("level-popup-title").innerText =
            `🎉 Level ${GameState.level} Cleared! 🎉`;
          document.getElementById("level-popup-reward").innerText =
            `Reward: +${goldBonus} 🪙 | +${riceBonus} 🌾`;
          popup.style.display = "block";
        }
      }
    }
  } else if (GameState.phase === "level_cleared") {
    GameState.popupTimer--;
    if (GameState.popupTimer <= 0) {
      let popup = document.getElementById("level-popup");
      if (popup) popup.style.display = "none";

      GameState.level++;
      GameState.phase = "build";
      GameState.timer = 3600;
      GameState.enemiesSpawned = false;
      let nextLevelAdvice = [
        `Excellent victory! But beware, Level ${GameState.level} brings stronger foes.`,
        "Expand your Paddy Fields to increase Rice production.",
        "I highly advise constructing a Tower or an Elephant Pen for better defence.",
      ];
      showRoyalAdvisor(nextLevelAdvice);
    }
  }
}

// --- UI SETUP & INJECTIONS ---
const uiGold = document.getElementById("gold-count");
const uiRice = document.getElementById("rice-count");
const uiMessage = document.getElementById("system-message");
const btnCancel = document.getElementById("btn-cancel");

const getBtnHTML = (id, type, costGold, costRice, extraClass = "") => `
    <button id="${id}" class="build-btn ${extraClass}" data-type="${type}" data-cost-gold="${costGold}" data-cost-rice="${costRice}">
        <span class="btn-title">${type.toUpperCase()}</span>
        <div class="btn-cost">
            ${costGold > 0 ? `<span class="icon">🪙</span> ${costGold} G ` : ""}
            ${costRice > 0 ? `<span class="icon">🌾</span> ${costRice} R ` : ""}
        </div>
    </button>
`;

function setupUIButtons() {
  const uiBottom = document.getElementById("ui-bottom");
  if (uiBottom) {
    uiBottom.innerHTML = "";
    uiBottom.insertAdjacentHTML(
      "beforeend",
      getBtnHTML("btn-paddy", "Paddy Field", 50, 0),
    );
    uiBottom.insertAdjacentHTML(
      "beforeend",
      getBtnHTML("btn-palace", "Palace", 200, 0),
    );
    uiBottom.insertAdjacentHTML(
      "beforeend",
      getBtnHTML("btn-barracks", "Barracks", 150, 0),
    );
    uiBottom.insertAdjacentHTML(
      "beforeend",
      getBtnHTML("btn-elephant", "Elephant Pen", 300, 0),
    );
    uiBottom.insertAdjacentHTML(
      "beforeend",
      getBtnHTML("btn-stables", "Stables", 200, 0),
    );
    uiBottom.insertAdjacentHTML(
      "beforeend",
      getBtnHTML("btn-wall", "Wall", 0, 50),
    );
    uiBottom.insertAdjacentHTML(
      "beforeend",
      getBtnHTML("btn-tower", "Tower", 100, 50),
    );
    uiBottom.insertAdjacentHTML(
      "beforeend",
      `<button id="btn-cancel" class="build-btn hidden">CANCEL</button>`,
    );
  }

  const pairs = [
    { id: "btn-palace", img: imagePaths.palace, svg: svgs.palaceIcon },
    { id: "btn-barracks", img: imagePaths.barracks, svg: svgs.barracksIcon },
    {
      id: "btn-elephant",
      img: imagePaths.elephantPen,
      svg: svgs.elephantPenIcon,
    },
    { id: "btn-stables", img: imagePaths.stables, svg: svgs.stablesIcon },
    { id: "btn-wall", img: imagePaths.wall, svg: svgs.wallIcon },
    { id: "btn-paddy", img: imagePaths.paddyField, svg: svgs.paddyFieldIcon },
    { id: "btn-tower", img: imagePaths.tower, svg: svgs.towerIcon },
  ];
  pairs.forEach((p) => {
    const btn = document.getElementById(p.id);
    if (btn) {
      btn.style.backgroundImage = p.img
        ? `url("${p.img}"), url('data:image/svg+xml;utf8,${encodeURIComponent(p.svg.replace("data:image/svg+xml;utf8,", ""))}')`
        : `url('data:image/svg+xml;utf8,${encodeURIComponent(p.svg.replace("data:image/svg+xml;utf8,", ""))}')`;
    }
  });

  const btnEarly = document.getElementById("btn-early-wave");
  if (btnEarly) {
    btnEarly.onpointerdown = function (e) {
      e.stopPropagation();
      if (GameState.phase === "build" && !GameState.isPaused) {
        GameState.gold += 100;
        GameState.timer = 0;
        updateDOM();
        let palace = GameState.buildings.find((b) => b.type === "Palace");
        if (palace)
          GameState.floatingTexts.push(
            new FloatingText(
              palace.gridX + 1,
              palace.gridY + 1,
              "+100 Gold!",
              "#D4AF37",
            ),
          );
      }
    };
  }

  const wrapper = document.getElementById("bottom-dock-wrapper");
  const toggleBtn = document.getElementById("panel-toggle-btn");
  if (wrapper && toggleBtn) {
    toggleBtn.onpointerdown = function (e) {
      e.stopPropagation();
      if (wrapper.classList.contains("dock-hidden")) {
        wrapper.classList.remove("dock-hidden");
        toggleBtn.innerHTML = "▼";
      } else {
        wrapper.classList.add("dock-hidden");
        toggleBtn.innerHTML = "▲";
      }
    };
  }
}

window.addEventListener("DOMContentLoaded", () => {
  setupUIButtons();
  updateDOM();

  const btnSettings = document.getElementById("btn-settings");
  const btnPause = document.getElementById("btn-pause");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const settingsModal = document.getElementById("settings-modal");
  const pauseOverlay = document.getElementById("pause-overlay");

  if (btnSettings && settingsModal) {
    document.getElementById("bgm-slider").addEventListener("input", (e) => {
      globalBGMVolume = e.target.value / 100;
      document.getElementById("bgm-vol-text").innerText = e.target.value + "%";
      sounds.bgm.volume = globalBGMVolume;
      if (globalBGMVolume > 0 && isMuted) {
        isMuted = false;
        let btnMute = document.getElementById("btn-mute");
        if (btnMute) btnMute.innerText = "🔊";
        sounds.bgm.play();
      }
    });

    document.getElementById("sfx-slider").addEventListener("input", (e) => {
      globalSFXVolume = e.target.value / 100;
      document.getElementById("sfx-vol-text").innerText = e.target.value + "%";
    });

    btnSettings.addEventListener("click", () => {
      settingsModal.style.display =
        settingsModal.style.display === "none" ? "block" : "none";
    });

    document.getElementById("land-select").addEventListener("change", (e) => {
      GameState.currentLand = e.target.value;
    });
    document
      .getElementById("difficulty-select")
      .addEventListener("change", (e) => {
        GameState.difficulty = e.target.value;
      });
    document
      .getElementById("btn-close-settings")
      .addEventListener("click", () => {
        settingsModal.style.display = "none";
      });

    document
      .getElementById("btn-force-restart")
      .addEventListener("click", () => {
        let confirmRestart = confirm(
          "Are you sure you want to restart? All your progress and current base will be lost!",
        );
        if (confirmRestart) {
          GameState.isRestarting = true;
          localStorage.removeItem("apexLionSave");
          location.reload();
        }
      });
  }

  if (btnPause && pauseOverlay) {
    btnPause.addEventListener("click", () => {
      GameState.isPaused = true;
      pauseOverlay.style.display = "flex";
    });
    document.getElementById("btn-resume-game").addEventListener("click", () => {
      GameState.isPaused = false;
      pauseOverlay.style.display = "none";
    });
  }

  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      let doc = window.document;
      let docEl = doc.documentElement;
      let requestFullScreen =
        docEl.requestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.webkitRequestFullScreen ||
        docEl.msRequestFullscreen;
      let cancelFullScreen =
        doc.exitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.webkitExitFullscreen ||
        doc.msExitFullscreen;

      if (
        !doc.fullscreenElement &&
        !doc.mozFullScreenElement &&
        !doc.webkitFullscreenElement &&
        !doc.msFullscreenElement
      ) {
        if (requestFullScreen) {
          requestFullScreen.call(docEl).catch((err) => {
            showMessage("Fullscreen not supported on this device.", true);
          });
        } else {
          showMessage("Fullscreen not supported on iOS Safari.", true);
        }
      } else {
        if (cancelFullScreen) {
          cancelFullScreen.call(doc);
        }
      }
    });
  }

  document.getElementById("btn-restart-game")?.addEventListener("click", () => {
    localStorage.removeItem("apexLionSave");
    location.reload();
  });

  showRoyalAdvisor([
    "Greetings, Your Majesty! I am your Royal Advisor. I shall guide you in building this kingdom.",
    "Firstly, select a 'Paddy Field' from the menu below and place it upon the rock. This shall yield 'Rice'.",
    "Both Gold and Rice are required to train soldiers and breed war elephants.",
    "When you are ready, press 'START NOW' above to summon the enemy forces!",
  ]);
});

function updateDOM() {
  if (uiGold) uiGold.innerText = GameState.gold;
  if (uiRice) uiRice.innerText = GameState.rice;

  const palaceBtn = document.getElementById("btn-palace");
  if (palaceBtn) {
    let hasPalace = GameState.buildings.some((b) => b.type === "Palace");
    let titleSpan = palaceBtn.querySelector(".btn-title");
    let costDiv = palaceBtn.querySelector(".btn-cost");

    if (hasPalace) {
      let nextImg =
        GameState.palaceLevel === 1 ? imagePaths.palace2 : imagePaths.palace3;

      if (
        GameState.level > GameState.palaceLevel &&
        GameState.palaceLevel < 3
      ) {
        palaceBtn.style.opacity = "1";
        palaceBtn.style.pointerEvents = "auto";
        palaceBtn.style.filter = "none";
        palaceBtn.classList.add("bounce-active");
        if (titleSpan) titleSpan.innerText = "UPGRADE";
        if (costDiv) costDiv.innerHTML = '<span class="icon">🪙</span> 500 G';
        if (nextImg) palaceBtn.style.backgroundImage = `url("${nextImg}")`;
      } else {
        palaceBtn.style.opacity = "0.4";
        palaceBtn.style.pointerEvents = "none";
        palaceBtn.style.filter = "grayscale(100%)";
        palaceBtn.classList.remove("bounce-active");
        if (GameState.palaceLevel < 3) {
          if (titleSpan) titleSpan.innerText = "LOCKED";
          if (costDiv) costDiv.innerHTML = '<span class="icon">🪙</span> 500 G';
          if (nextImg) palaceBtn.style.backgroundImage = `url("${nextImg}")`;
        } else {
          if (titleSpan) titleSpan.innerText = "MAX LEVEL";
          if (costDiv) costDiv.innerHTML = "";
          if (imagePaths.palace3)
            palaceBtn.style.backgroundImage = `url("${imagePaths.palace3}")`;
        }
      }
    } else {
      palaceBtn.style.opacity = "1";
      palaceBtn.style.pointerEvents = "auto";
      palaceBtn.style.filter = "none";
      palaceBtn.classList.remove("bounce-active");
      if (titleSpan) titleSpan.innerText = "PALACE";
      if (costDiv) costDiv.innerHTML = '<span class="icon">🪙</span> 200 G';
      let svgData = svgs.palaceIcon
        ? `url('data:image/svg+xml;utf8,${encodeURIComponent(svgs.palaceIcon.replace("data:image/svg+xml;utf8,", ""))}')`
        : "";
      palaceBtn.style.backgroundImage = imagePaths.palace
        ? `url("${imagePaths.palace}"), ${svgData}`
        : svgData;
    }
  }
}

function showMessage(msg, isError = false) {
  if (uiMessage) {
    uiMessage.innerText = msg;
    uiMessage.style.color = isError ? "#FF6347" : "#00FA9A";
    uiMessage.style.borderLeftColor = isError ? "#FF6347" : "#00FA9A";
  }
}

function setPlacementMode(type, goldCost, riceCost) {
  if (GameState.isPaused) return;
  const size = type === "Wall" ? 1 : type === "Tower" ? 2 : 3;
  GameState.mode = "placement_mode";
  GameState.selectedBuilding = { type, goldCost, riceCost, size };
  const btnCancel = document.getElementById("btn-cancel");
  if (btnCancel) btnCancel.classList.remove("hidden");
  canvas.style.cursor = "crosshair";
  showMessage(`Placing ${type}...`);
}

function cancelPlacement() {
  GameState.mode = "normal";
  GameState.selectedBuilding = null;
  const btnCancel = document.getElementById("btn-cancel");
  if (btnCancel) btnCancel.classList.add("hidden");
  canvas.style.cursor = "grab";
  showMessage("Pan the map to explore!");
}

document.body.addEventListener("click", (e) => {
  if (e.target.closest("button")) playSound("click");

  if (e.target.closest(".build-btn")) {
    const btn = e.target.closest(".build-btn");
    if (btn.id === "btn-cancel") {
      cancelPlacement();
      return;
    }
    if (btn.id === "btn-palace") {
      let palace = GameState.buildings.find((b) => b.type === "Palace");
      if (palace) {
        if (GameState.isPaused) return;
        if (GameState.gold >= 500) {
          GameState.gold -= 500;
          GameState.palaceLevel++;
          palace.maxHp += 2000;
          palace.hp = palace.maxHp;
          updateDOM();
          playSound("build");
          showMessage(`Palace Upgraded to Level ${GameState.palaceLevel}!`);
          GameState.floatingTexts.push(
            new FloatingText(
              palace.gridX + 1,
              palace.gridY + 1,
              `LEVEL UP!`,
              "#FFD700",
            ),
          );
        } else {
          showMessage("Need 500 Gold to upgrade!", true);
        }
        return;
      }
    }
    setPlacementMode(
      btn.dataset.type,
      parseInt(btn.dataset.costGold),
      parseInt(btn.dataset.costRice),
    );
  }
});

// ==========================================
// --- ADVANCED MOUSE & TOUCH CONTROLS ---
// ==========================================
let isTouchInteraction = false;

// --- MOUSE EVENTS (For Desktop) ---
canvas.addEventListener("mousedown", (e) => {
  if (isTouchInteraction) return;
  if (e.button === 0 && GameState.mode === "normal") {
    isDragging = true;
    dragStart.x = e.clientX - camera.x;
    dragStart.y = e.clientY - camera.y;
    canvas.style.cursor = "grabbing";
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (isTouchInteraction) return;
  if (isDragging) {
    camera.x = e.clientX - dragStart.x;
    camera.y = e.clientY - dragStart.y;
    let oldX = camera.x;
    let oldY = camera.y;
    clampCamera();
    if (camera.x !== oldX) dragStart.x = e.clientX - camera.x;
    if (camera.y !== oldY) dragStart.y = e.clientY - camera.y;
    return;
  }
  if (GameState.mode === "placement_mode") {
    const gridPos = screenToIso(e.clientX, e.clientY);
    mouse.gridX = Math.floor(gridPos.x);
    mouse.gridY = Math.floor(gridPos.y);
  }
});

window.addEventListener("mouseup", (e) => {
  if (isTouchInteraction) return;
  isDragging = false;
  if (GameState.mode === "normal") canvas.style.cursor = "grab";
});

// --- TOUCH EVENTS (For Mobile) ---
canvas.addEventListener(
  "touchstart",
  (e) => {
    isTouchInteraction = true;
    if (e.touches.length === 2) {
      e.preventDefault();
      initialPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      return;
    }
    touchMoved = false;

    if (GameState.mode === "normal") {
      isDragging = true;
      dragStart.x = e.touches[0].clientX - camera.x;
      dragStart.y = e.touches[0].clientY - camera.y;
    } else if (GameState.mode === "placement_mode") {
      const gridPos = screenToIso(
        e.touches[0].clientX,
        e.touches[0].clientY - 70,
      );
      mouse.gridX = Math.floor(gridPos.x);
      mouse.gridY = Math.floor(gridPos.y);
    }
  },
  { passive: false },
);

// Throttle කිරීම සඳහා variable එකක් (මේක event එකට උඩින් තියෙන්න ඕනේ)
let lastTouchMoveTime = 0;

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    touchMoved = true;

    // Zoom Logic එක
    if (e.touches.length === 2 && initialPinchDistance !== null) {
      let currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      let diff = currentDistance - initialPinchDistance;
      let centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      let centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      doZoom(diff * 0.005, centerX, centerY);
      initialPinchDistance = currentDistance;
      return;
    }

    // Drag Logic එක Throttle කිරීම
    let now = Date.now();
    if (now - lastTouchMoveTime < 15) return;
    lastTouchMoveTime = now;

    if (e.touches.length === 1) {
      if (GameState.mode === "normal" && isDragging) {
        camera.x = e.touches[0].clientX - dragStart.x;
        camera.y = e.touches[0].clientY - dragStart.y;
        let oldX = camera.x;
        let oldY = camera.y;
        clampCamera();
        if (camera.x !== oldX) dragStart.x = e.touches[0].clientX - camera.x;
        if (camera.y !== oldY) dragStart.y = e.touches[0].clientY - camera.y;
      } else if (GameState.mode === "placement_mode") {
        const gridPos = screenToIso(
          e.touches[0].clientX,
          e.touches[0].clientY - 70,
        );
        mouse.gridX = Math.floor(gridPos.x);
        mouse.gridY = Math.floor(gridPos.y);
      }
    }
  },
  { passive: false },
);

window.addEventListener("touchend", (e) => {
  isDragging = false;
  if (e.touches.length < 2) {
    initialPinchDistance = null;
  }

  if (GameState.mode === "placement_mode") {
    attemptPlacement();
  }

  setTimeout(() => {
    isTouchInteraction = false;
  }, 500);
});

// --- CLICK EVENT (For Desktop & Normal Interactions) ---
canvas.addEventListener("click", (e) => {
  if (isTouchInteraction) return;

  if (GameState.isPaused) return;
  if (e.target && e.target.tagName === "BUTTON") return;

  if (GameState.mode === "normal") {
    let clientX = e.clientX;
    let clientY = e.clientY;
    let exactIso = screenToIso(clientX, clientY);
    let ex = exactIso.x;
    let ey = exactIso.y;
    let clickedFriendly = null;
    let myTroops = [
      ...GameState.soldiers,
      ...GameState.elephants,
      ...GameState.horses,
      ...GameState.villagers,
    ];
    for (let u of myTroops) {
      if (getDistance({ x: ex, y: ey }, u) < 0.8) {
        clickedFriendly = u;
        break;
      }
    }

    if (clickedFriendly) {
      if (GameState.tutorialState === "select_troop") {
        GameState.tutorialState = "command_attack";
        showRoyalAdvisor([
          "Excellent! The soldier is ready for your command.",
          "Now, CLICK on an Enemy to order the attack!",
        ]);
      }
      GameState.selectedUnit = clickedFriendly;
      GameState.floatingTexts.push(
        new FloatingText(
          clickedFriendly.x,
          clickedFriendly.y,
          "Ready!",
          "#00FF00",
        ),
      );
      return;
    }

    if (GameState.selectedUnit) {
      let clickedEnemy = null;
      for (let en of GameState.enemies) {
        if (getDistance({ x: ex, y: ey }, en) < 0.8) {
          clickedEnemy = en;
          break;
        }
      }
      if (GameState.tutorialState === "command_attack") {
        GameState.tutorialState = "done";
        showRoyalAdvisor([
          "Brilliant strategy, My Lord!",
          "Your troops will now engage the target.",
          "Defend the Palace at all costs!",
        ]);
      }
      if (clickedEnemy) {
        GameState.selectedUnit.manualTargetEnemy = clickedEnemy;
        GameState.selectedUnit.manualTargetPos = null;
        GameState.floatingTexts.push(
          new FloatingText(ex, ey, "⚔️ Attack!", "#FF0000"),
        );
      } else {
        GameState.selectedUnit.manualTargetPos = { x: ex, y: ey };
        GameState.selectedUnit.manualTargetEnemy = null;
        GameState.floatingTexts.push(
          new FloatingText(ex, ey, "🚩 Move", "#00FA9A"),
        );
      }
      GameState.selectedUnit = null;
      return;
    }
  } else if (GameState.mode === "placement_mode") {
    const gridPos = screenToIso(e.clientX, e.clientY);
    mouse.gridX = Math.floor(gridPos.x);
    mouse.gridY = Math.floor(gridPos.y);
    attemptPlacement();
  }
});

// --- REUSABLE PLACEMENT FUNCTION ---
function attemptPlacement() {
  const { gridX: gx, gridY: gy } = mouse;
  if (gx < 0 || gy < 0 || !GameState.selectedBuilding) return;

  const { type, goldCost, riceCost, size } = GameState.selectedBuilding;

  if (
    type === "Palace" &&
    GameState.buildings.some((b) => b.type === "Palace")
  ) {
    return showMessage(
      "Your Majesty, a kingdom can only have one Palace!",
      true,
    );
  }

  let isBlocked = false;
  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) {
      if (isTileBlocked(gx + dx, gy + dy, null)) isBlocked = true;
    }
  }
  if (isBlocked) return showMessage("Area blocked or outside bounds!", true);

  if (GameState.gold >= goldCost && GameState.rice >= riceCost) {
    GameState.gold -= goldCost;
    GameState.rice -= riceCost;
    updateDOM();
    GameState.buildings.push(new Building(gx, gy, type));

    if (type === "Wall") {
      playSound("wall_build");
    } else if (type === "Tower") {
      playSound("tower_build");
    } else {
      playSound("build");
    }

    let spawnX = gx + size;
    let spawnY = gy + size;
    if (spawnX >= MAP_COLS) spawnX = gx - 1;
    if (spawnY >= MAP_ROWS) spawnY = gy - 1;

    if (type === "Paddy Field") {
      GameState.villagers.push(new Villager(spawnX, spawnY));
    } else if (type === "Palace") {
      for (let i = 0; i < 3; i++)
        GameState.villagers.push(new Villager(spawnX, spawnY));
    } else if (type === "Barracks") {
      for (let i = 0; i < 2; i++)
        GameState.soldiers.push(new Soldier(spawnX, spawnY));
    } else if (type === "Elephant Pen") {
      for (let i = 0; i < 2; i++)
        GameState.elephants.push(new Elephant(spawnX, spawnY));
    } else if (type === "Stables") {
      for (let i = 0; i < 3; i++)
        GameState.horses.push(new Horse(spawnX, spawnY));
    }

    showMessage(`${type} constructed!`);
    if (type !== "Wall") {
      cancelPlacement();
    }
  } else {
    showMessage("Not enough resources!", true);
  }
}

function drawDiamond(ctx, screenX, screenY, colorTop, colorBorder) {
  ctx.beginPath();
  ctx.moveTo(screenX, screenY - TILE_H / 2);
  ctx.lineTo(screenX + TILE_W / 2, screenY);
  ctx.lineTo(screenX, screenY + TILE_H / 2);
  ctx.lineTo(screenX - TILE_W / 2, screenY);
  ctx.closePath();
  ctx.fillStyle = colorTop;
  ctx.fill();
  ctx.strokeStyle = colorBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSigiriyaRockBase() {
  const left = isoToScreen(0, MAP_ROWS);
  const right = isoToScreen(MAP_COLS, 0);
  const bottom = isoToScreen(MAP_COLS, MAP_ROWS);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#050a12";
  ctx.fillStyle = "#3a2b1f";
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(bottom.x, bottom.y + ROCK_HEIGHT);
  ctx.lineTo(left.x, left.y + ROCK_HEIGHT);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2b1f15";
  ctx.beginPath();
  ctx.moveTo(bottom.x, bottom.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(right.x, right.y + ROCK_HEIGHT);
  ctx.lineTo(bottom.x, bottom.y + ROCK_HEIGHT);
  ctx.fill();
  ctx.stroke();
}

function drawGame() {
  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(zoom, zoom);
    handleGameLogic();

    GameState.buildings = GameState.buildings.filter((b) => b.hp > 0);
    GameState.villagers = GameState.villagers.filter((v) => v.hp > 0);
    GameState.soldiers = GameState.soldiers.filter((s) => s.hp > 0);
    GameState.elephants = GameState.elephants.filter((e) => e.hp > 0);
    GameState.horses = GameState.horses.filter((h) => h.hp > 0);
    GameState.enemies = GameState.enemies.filter((e) => e.hp > 0);

    const currentLandKey = GameState.currentLand;
    const gridImg = images[currentLandKey];
    const config = GRID_IMAGE_CONFIG[currentLandKey];
    let useImageGrid =
      imagePaths[currentLandKey] &&
      imagePaths[currentLandKey] !== "" &&
      gridImg &&
      gridImg.complete &&
      gridImg.naturalWidth > 0;

    if (useImageGrid) {
      ctx.drawImage(
        gridImg,
        config.offsetX,
        config.offsetY,
        config.width,
        config.height,
      );
      ctx.save();
      for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLS; x++) {
          const pos = isoToScreen(x, y);
          drawDiamond(
            ctx,
            pos.x,
            pos.y,
            "rgba(0,0,0,0)",
            "rgba(255, 255, 255, 0.2)",
          );
        }
      }
      ctx.restore();

      if (GameState.mode === "placement_mode") {
        for (let y = 0; y < MAP_ROWS; y++) {
          for (let x = 0; x < MAP_COLS; x++) {
            const size = GameState.selectedBuilding.size;
            const bx = mouse.gridX;
            const by = mouse.gridY;
            if (x >= bx && x < bx + size && y >= by && y < by + size) {
              const pos = isoToScreen(x, y);
              let isBlocked = false;
              for (let dx = 0; dx < size; dx++)
                for (let dy = 0; dy < size; dy++)
                  if (isTileBlocked(bx + dx, by + dy, null)) isBlocked = true;
              drawDiamond(
                ctx,
                pos.x,
                pos.y,
                isBlocked ? "rgba(255, 0, 0, 0.6)" : "rgba(0, 255, 0, 0.6)",
                "#fff",
              );
            }
          }
        }
      }
    } else {
      drawSigiriyaRockBase();
      for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLS; x++) {
          const pos = isoToScreen(x, y);
          drawDiamond(
            ctx,
            pos.x,
            pos.y,
            (x + y) % 2 === 0 ? "#5A9E24" : "#4E8D1E",
            "#3E7017",
          );
          if (GameState.mode === "placement_mode") {
            const size = GameState.selectedBuilding.size;
            const bx = mouse.gridX;
            const by = mouse.gridY;
            if (x >= bx && x < bx + size && y >= by && y < by + size) {
              let isBlocked = false;
              for (let dx = 0; dx < size; dx++)
                for (let dy = 0; dy < size; dy++)
                  if (isTileBlocked(bx + dx, by + dy, null)) isBlocked = true;
              drawDiamond(
                ctx,
                pos.x,
                pos.y,
                isBlocked ? "rgba(255, 0, 0, 0.6)" : "rgba(0, 255, 0, 0.6)",
                "#fff",
              );
            }
          }
        }
      }
    }

    let renderQueue = [];
    GameState.buildings.forEach((b) => {
      if (!GameState.isPaused) b.update();
      let d =
        b.gridX + b.gridY + (b.type === "Paddy Field" ? -0.1 : b.size * 0.8);
      renderQueue.push({ obj: b, type: "building", depth: d });
    });
    GameState.villagers.forEach((v) => {
      if (!GameState.isPaused) v.update();
      renderQueue.push({ obj: v, type: "villager", depth: v.x + v.y });
    });
    GameState.soldiers.forEach((s) => {
      if (!GameState.isPaused) s.update();
      renderQueue.push({ obj: s, type: "soldier", depth: s.x + s.y });
    });
    GameState.elephants.forEach((el) => {
      if (!GameState.isPaused) el.update();
      renderQueue.push({ obj: el, type: "elephant", depth: el.x + el.y });
    });
    GameState.horses.forEach((h) => {
      if (!GameState.isPaused) h.update();
      renderQueue.push({ obj: h, type: "horse", depth: h.x + h.y });
    });
    GameState.enemies.forEach((e) => {
      if (!GameState.isPaused) e.update();
      renderQueue.push({ obj: e, type: "enemy", depth: e.x + e.y });
    });

    renderQueue.sort((a, b) => a.depth - b.depth);
    renderQueue.forEach((item) => {
      const pos = isoToScreen(
        item.type === "building" ? item.obj.gridX : item.obj.x,
        item.type === "building" ? item.obj.gridY : item.obj.y,
      );
      item.obj.draw(ctx, pos.x, pos.y);
    });

    if (
      GameState.mode === "placement_mode" &&
      mouse.gridX >= 0 &&
      mouse.gridY >= 0
    ) {
      const { type, size } = GameState.selectedBuilding;
      const bx = mouse.gridX;
      const by = mouse.gridY;
      const pos = isoToScreen(bx, by);

      ctx.save();
      ctx.globalAlpha = 0.6;
      let imgKey =
        type === "Elephant Pen"
          ? "elephantPen"
          : type === "Paddy Field"
            ? "paddyField"
            : type.toLowerCase();
      let img = images[imgKey];

      if (img && img.complete && img.naturalWidth > 0) {
        let imageScale = 1.0;
        let imgW = size * TILE_W * imageScale;
        let imgH = imgW * (img.naturalHeight / img.naturalWidth);
        if (type === "Wall") {
          imgW = 60;
          imgH = imgW * (img.naturalHeight / img.naturalWidth);
        }
        const bottomY = pos.y - TILE_H / 2 + size * TILE_H;
        let finalY = bottomY - imgH + (size * TILE_H * (imageScale - 1)) / 2;
        ctx.drawImage(img, pos.x - imgW / 2, finalY, imgW, imgH);
      }
      ctx.restore();
    }

    for (let i = GameState.floatingTexts.length - 1; i >= 0; i--) {
      let ft = GameState.floatingTexts[i];
      ft.draw(ctx);
      if (ft.life <= 0) GameState.floatingTexts.splice(i, 1);
    }

    if (
      GameState.phase === "combat" &&
      GameState.level === 1 &&
      !GameState.isPaused
    ) {
      if (GameState.tutorialState === "select_troop") {
        let troops = [
          ...GameState.soldiers,
          ...GameState.elephants,
          ...GameState.horses,
          ...GameState.villagers,
        ];
        let target = troops[0];
        if (target) {
          let pos = isoToScreen(target.x, target.y);
          let bob = Math.abs(Math.sin(Date.now() * 0.005)) * 15;
          ctx.save();
          ctx.font = '50px "Poppins", sans-serif';
          ctx.textAlign = "center";
          ctx.fillText("👇", pos.x, pos.y - 50 - bob);
          let pulse = 20 + Math.abs(Math.sin(Date.now() * 0.005)) * 10;
          ctx.beginPath();
          ctx.ellipse(pos.x, pos.y, pulse * 2, pulse, 0, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }
      } else if (
        GameState.tutorialState === "command_attack" &&
        GameState.selectedUnit
      ) {
        let targetEnemy = GameState.enemies[0];
        if (targetEnemy) {
          let pos = isoToScreen(targetEnemy.x, targetEnemy.y);
          let bob = Math.abs(Math.sin(Date.now() * 0.005)) * 15;
          ctx.save();
          ctx.font = '50px "Poppins", sans-serif';
          ctx.textAlign = "center";
          ctx.fillText("👇", pos.x, pos.y - 50 - bob);
          let pulse = 20 + Math.abs(Math.sin(Date.now() * 0.005)) * 10;
          ctx.beginPath();
          ctx.ellipse(pos.x, pos.y, pulse * 2, pulse, 0, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    ctx.restore();

    let statusTextDiv = document.getElementById("level-status-text");
    let btnEarly = document.getElementById("btn-early-wave");

    if (GameState.phase === "build") {
      let secs = Math.ceil(GameState.timer / 60);
      if (statusTextDiv) {
        statusTextDiv.innerHTML = `<span class="status-lvl-build">👑 LEVEL ${GameState.level}</span> <span class="status-desc-build"> | ⏳ Starts In: ${secs}s</span>`;
      }
      if (btnEarly) {
        btnEarly.style.display = "block";
        btnEarly.innerHTML = `⚔️ START NOW (+100 Gold)`;
      }
    } else if (GameState.phase === "combat") {
      if (statusTextDiv) {
        statusTextDiv.innerHTML = `<span class="status-lvl-combat">⚔️ LEVEL ${GameState.level}</span> <span class="status-desc-combat"> | Defeat ${GameState.enemies.length} Enemies!</span>`;
      }
      if (btnEarly) btnEarly.style.display = "none";
    } else {
      if (statusTextDiv) statusTextDiv.innerHTML = "";
      if (btnEarly) btnEarly.style.display = "none";
    }
  } catch (err) {
    console.error("Game Loop Render Error:", err);
  }
}

resizeCanvas();
updateDOM();

// ==========================================
// --- GAME SAVE & LOAD SYSTEM ---
// ==========================================

function saveGame() {
  if (
    GameState.phase === "game_over" ||
    GameState.phase === "game_over_delay" ||
    GameState.isRestarting
  )
    return;

  const saveData = {
    gold: GameState.gold,
    rice: GameState.rice,
    level: GameState.level,
    phase: GameState.phase,
    timer: GameState.timer,
    palaceLevel: GameState.palaceLevel,
    difficulty: GameState.difficulty,
    currentLand: GameState.currentLand,
    buildings: GameState.buildings,
    villagers: GameState.villagers,
    soldiers: GameState.soldiers,
    elephants: GameState.elephants,
    horses: GameState.horses,
    enemies: GameState.enemies,
  };
  localStorage.setItem("apexLionSave", JSON.stringify(saveData));
}

function loadGame() {
  const savedStr = localStorage.getItem("apexLionSave");
  if (!savedStr) return;
  try {
    const saved = JSON.parse(savedStr);
    GameState.gold = saved.gold || 1000;
    GameState.rice = saved.rice || 500;
    GameState.level = saved.level || 1;
    GameState.phase = saved.phase || "build";
    GameState.timer = saved.timer || 6300;
    GameState.palaceLevel = saved.palaceLevel || 1;
    GameState.difficulty = saved.difficulty || "normal";
    GameState.currentLand = saved.currentLand || "land1";

    GameState.buildings = (saved.buildings || []).map((b) => {
      let obj = new Building(b.gridX, b.gridY, b.type);
      obj.hp = b.hp;
      obj.maxHp = b.maxHp;
      return obj;
    });
    GameState.villagers = (saved.villagers || []).map((v) => {
      let obj = new Villager(v.x, v.y);
      obj.hp = v.hp;
      obj.state = v.state;
      return obj;
    });
    GameState.soldiers = (saved.soldiers || []).map((s) => {
      let obj = new Soldier(s.x, s.y);
      obj.hp = s.hp;
      return obj;
    });
    GameState.elephants = (saved.elephants || []).map((e) => {
      let obj = new Elephant(e.x, e.y);
      obj.hp = e.hp;
      return obj;
    });
    GameState.horses = (saved.horses || []).map((h) => {
      let obj = new Horse(h.x, h.y);
      obj.hp = h.hp;
      return obj;
    });
    GameState.enemies = (saved.enemies || []).map((e) => {
      let obj = new Enemy(e.x, e.y, 1);
      obj.hp = e.hp;
      obj.maxHp = e.maxHp;
      return obj;
    });

    updateDOM();
    console.log("Game Loaded Successfully!");
  } catch (e) {
    console.error("Save file corrupted. Starting new game.", e);
  }
}

window.addEventListener("beforeunload", saveGame);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame();
});
setInterval(saveGame, 10000);
loadGame();

function gameLoop() {
  drawGame();
  requestAnimationFrame(gameLoop);
}
gameLoop();

window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get("action");
  if (action === "settings") {
    setTimeout(() => {
      const settingsBtn = document.getElementById("btn-settings");
      if (settingsBtn) {
        settingsBtn.click();
      }
    }, 100);
  }
});

// ==========================================
// --- LANDING PAGE SCRIPTS ---
// ==========================================
(function () {
  const c = document.getElementById("grain");
  if (!c) return;
  const ctx = c.getContext("2d");
  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);
  let frame = 0;
  function drawGrain() {
    const w = c.width,
      h = c.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 28;
    }
    ctx.putImageData(img, 0, 0);
    frame++;
    if (frame % 3 === 0) requestAnimationFrame(drawGrain);
    else requestAnimationFrame(drawGrain);
  }
  //drawGrain();
})();

document.querySelectorAll(".btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.style.transition = "none";
    btn.style.transform = "translateY(3px) scale(.97)";
    setTimeout(() => {
      btn.style.transition = "";
      btn.style.transform = "";
    }, 130);
  });
});

function checkPortraitWarning() {
  let warning = document.getElementById("portrait-warning");
  if (warning) {
    if (
      window.innerHeight > window.innerWidth &&
      /Mobi|Android/i.test(navigator.userAgent)
    ) {
      warning.style.display = "flex";
    } else {
      warning.style.display = "none";
    }
  }
}
window.addEventListener("resize", checkPortraitWarning);

document.getElementById("btn-play")?.addEventListener("click", () => {
  let docEl = document.documentElement;
  let requestFS =
    docEl.requestFullscreen ||
    docEl.webkitRequestFullScreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen;

  const landingWrapper = document.getElementById("landing-wrapper");
  if (landingWrapper) {
    landingWrapper.style.opacity = "0";
    setTimeout(() => {
      landingWrapper.style.display = "none";
    }, 500);
  }

  if (requestFS) {
    requestFS
      .call(docEl)
      .then(() => {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock("landscape").catch((e) => {
            checkPortraitWarning();
          });
        } else {
          checkPortraitWarning();
        }
      })
      .catch((err) => {
        checkPortraitWarning();
      });
  } else {
    checkPortraitWarning();
  }
});

document.getElementById("btn-open-settings")?.addEventListener("click", () => {
  let docEl = document.documentElement;
  let requestFS =
    docEl.requestFullscreen ||
    docEl.webkitRequestFullScreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen;
  if (requestFS)
    requestFS.call(docEl).catch((err) => console.log("FS Error", err));

  const landingWrapper = document.getElementById("landing-wrapper");
  if (landingWrapper) {
    landingWrapper.style.opacity = "0";
    setTimeout(() => {
      landingWrapper.style.display = "none";
      let gameSettingsBtn = document.getElementById("btn-settings");
      if (gameSettingsBtn) gameSettingsBtn.click();
    }, 500);
  }
});

document.getElementById("btn-exit")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to exit?")) {
    window.close();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  let savedScore = localStorage.getItem("apexLionHighScore");
  let bestLvl = document.getElementById("best-level-text");
  if (bestLvl) bestLvl.innerText = savedScore ? savedScore : "0";
});

// ==========================================
// --- PREVENT BROWSER DEFAULT ZOOM ON MOBILE ---
// ==========================================

// ඇඟිලි දෙකෙන් Pinch කරද්දි මුළු page එකම zoom වෙන එක නවත්වන්න
document.addEventListener(
  "touchmove",
  function (e) {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  },
  { passive: false },
);

// ඩබල් ටැප් (Double-tap) කරද්දි page එක zoom වෙන එක නවත්වන්න
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  function (e) {
    let now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false },
);

// Gesture events (විශේෂයෙන් iOS Safari වල එන) නවත්වන්න
document.addEventListener("gesturestart", function (e) {
  e.preventDefault();
});
document.addEventListener("gesturechange", function (e) {
  e.preventDefault();
});
document.addEventListener("gestureend", function (e) {
  e.preventDefault();
});
