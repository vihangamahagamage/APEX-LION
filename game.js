// --- 1. Image Path Configuration ---

const imagePaths = {
    land1: "Assets/background.svg", 
    land2: "Assets/background2.png", 
    land3: "", 
    
    tree: "", 
    lotus: "",
    palace: "Assets/casel.png", 
    barracks: "Assets/barracks.png",
    elephantPen: "Assets/elephantpen.png",
    stables: "Assets/stables.png",
    wall: "Assets/wall.svg",
    paddyField: "Assets/paddyfield.png", 
    tower: "Assets/tower.png",     
    villager: "Assets/villager.png", 
    soldier: "Assets/soldier.png",   
    elephant: "Assets/elephant.png", 
    horse: "Assets/hourse.png",     
    enemy: "Assets/enemy.png"      
};

// --- එක එක Land එකට අදාල Size සහ Position වෙන වෙනම හදාගන්න තැන ---
const GRID_IMAGE_CONFIG = {
    land1: { offsetX: -1280, offsetY: 0, width: 2560, height: 1430 },
    land2: { offsetX: -1280, offsetY: 0, width: 2560, height: 1430 }, 
    land3: { offsetX: -1280, offsetY: 0, width: 2560, height: 1430 }  
};

// --- Game State & Constants ---

const GameState = {
    gold: 1000, rice: 500, mode: 'normal', selectedBuilding: null,
    buildings: [], villagers: [], soldiers: [], elephants: [], horses: [], enemies: [],   
    floatingTexts: [], 
    level: 1,               
    phase: 'build',         
    timer: 6300,        
    popupTimer: 0,          
    enemiesSpawned: false,
    combatFrameCount: 0,         
    midCombatAdviceGiven: false, 
    selectedUnit: null,
    palaceLevel: 1, frameCount: 0,
    difficulty: 'normal', 
    currentLand: 'land1', 
    isPaused: false,
    tutorialState: 'inactive' 
};

// --- AUDIO SYSTEM ---

// if adding new sounds, should post it here
const sounds = {
    bgm: new Audio('Assets/bgm.mp3'),
    click: new Audio('Assets/click.mp3'),
    build: new Audio('Assets/build.mp3'),
    attack: new Audio('Assets/attack.mp3'),
	elephant_roar: new Audio('Assets/elephant_roar.mp3')
};

sounds.bgm.loop = true;

let isMuted = false;
let bgmStarted = false;

// අලුතින් දාපු Volume පාලනය කරන Variables
let globalBGMVolume = 0.3;  // Music සද්දෙ (මුලින් 30%)
let globalSFXVolume = 0.8;  // අනිත් සද්ද (මුලින් 80%)
sounds.bgm.volume = globalBGMVolume;

function playSound(key) {
    if (isMuted || !sounds[key]) return;
    
    if (key !== 'bgm') {
        let snd = sounds[key].cloneNode();
        snd.volume = globalSFXVolume; // Slider එකේ ගාණට සද්දෙ හැදෙනවා
        snd.play().catch(e => console.log("Audio blocked"));
    } else {
        sounds.bgm.volume = globalBGMVolume; 
        sounds.bgm.play().catch(e => console.log("BGM blocked"));
    }
}

// Mute Button 

window.addEventListener('DOMContentLoaded', () => {
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
        btnMute.addEventListener('click', () => {
            isMuted = !isMuted;
            btnMute.innerText = isMuted ? '🔇' : '🔊';
            
            if (isMuted) {
                sounds.bgm.pause();
            } else {
                sounds.bgm.play();
                bgmStarted = true;
            }
        });
    }
});

document.body.addEventListener('click', () => {
    if (!bgmStarted && !isMuted) {
        playSound('bgm');
        bgmStarted = true;
    }
}, { once: true });

const TILE_W = 64; const TILE_H = 32;  
const MAP_COLS = 40; const MAP_ROWS = 40; const ROCK_HEIGHT = 150; 

let camera = { x: 0, y: 0 }; 
let zoom = 1.0; 
let MAX_ZOOM = 4.0; 
let MIN_ZOOM = 0.2; 

let isDragging = false; let dragStart = { x: 0, y: 0 }; let touchMoved = false; 
let initialPinchDistance = null; 
let advisorTimeouts = []; 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const mouse = { x: 0, y: 0, gridX: -1, gridY: -1 };


// --- FIXED CAMERA CLAMPING & CENTERING ---


function updateZoomLimits() {
    if (!canvas) return;
    const mapW = (MAP_COLS + MAP_ROWS) * (TILE_W / 2) + 20; 
    const mapH = (MAP_COLS + MAP_ROWS) * (TILE_H / 2) + ROCK_HEIGHT + 300; 
    MIN_ZOOM = Math.max(canvas.width / mapW, canvas.height / mapH);
    if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
}

function clampCamera() {
    if (!canvas) return;
    const mapLeft = -(MAP_ROWS * TILE_W / 2);
    const mapRight = (MAP_COLS * TILE_W / 2);
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
        camera.y = canvas.height / 2 - (mapCenterY * zoom);
    } else {
        camera.y = Math.max(minCamY, Math.min(camera.y, maxCamY));
    }
}

function centerCameraOnBase() {
    updateZoomLimits();
    let mapCenterY = ((MAP_ROWS + MAP_COLS) * (TILE_H / 2) + ROCK_HEIGHT) / 2;
    camera.x = canvas.width / 2;
    camera.y = canvas.height / 2 - (mapCenterY * zoom);
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
window.addEventListener('resize', resizeCanvas);

function doZoom(amount, focusX = canvas.width/2, focusY = canvas.height/2) {
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
document.getElementById('btn-zoom-in')?.addEventListener('click', () => doZoom(0.1));
document.getElementById('btn-zoom-out')?.addEventListener('click', () => doZoom(-0.1));
canvas.addEventListener('wheel', (e) => { if(e.deltaY < 0) doZoom(0.1, e.clientX, e.clientY); else doZoom(-0.1, e.clientX, e.clientY); });

// --- SVG Assets & Image Loading ---
const svgs = {
    palaceIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="40" width="60" height="40" fill="%23DAA520" stroke="%23000" stroke-width="2"/><polygon points="20,40 50,10 80,40" fill="%23FFD700" stroke="%23000" stroke-width="2"/><rect x="40" y="60" width="20" height="20" fill="%234a3525"/></svg>`,
    barracksIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="50" width="70" height="30" fill="%23B22222" stroke="%23000" stroke-width="2"/><polygon points="15,50 35,30 65,30 85,50" fill="%23CD5C5C" stroke="%23000" stroke-width="2"/><rect x="40" y="65" width="20" height="15" fill="%234a3525"/><rect x="50" y="40" width="10" height="10" fill="%23FFD700"/></svg>`,
    wallIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="20" width="40" height="60" fill="%23696969" stroke="%23000" stroke-width="2"/><rect x="30" y="20" width="10" height="10" fill="%23505050"/><rect x="60" y="20" width="10" height="10" fill="%23505050"/></svg>`,
    elephantPenIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="50" width="60" height="20" fill="%238B4513" stroke="%23000" stroke-width="2"/><path d="M10 50 L50 20 L90 50 Z" fill="%23CD853F" stroke="%23000" stroke-width="2"/><circle cx="50" cy="60" r="8" fill="%23696969"/></svg>`,
    stablesIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="40" width="80" height="40" fill="%23A0522D" stroke="%23000" stroke-width="2"/><path d="M5 40 L50 15 L95 40 Z" fill="%238B4513" stroke="%23000" stroke-width="2"/><rect x="30" y="50" width="15" height="30" fill="%235C3A21"/><rect x="55" y="50" width="15" height="30" fill="%235C3A21"/></svg>`,
    paddyFieldIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="80" height="60" fill="%239ACD32" stroke="%23000" stroke-width="2"/><line x1="10" y1="40" x2="90" y2="40" stroke="%23556B2F" stroke-width="2"/><line x1="10" y1="60" x2="90" y2="60" stroke="%23556B2F" stroke-width="2"/></svg>`,
    towerIcon: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="10" width="40" height="80" fill="%238B4513" stroke="%23000" stroke-width="2"/><rect x="25" y="10" width="50" height="15" fill="%23CD853F" stroke="%23000" stroke-width="2"/></svg>`
};

const images = {};
let totalAssets = 0;
let loadedAssets = 0;

function initImages() {
    let imageKeys = Object.keys(imagePaths);
    totalAssets = imageKeys.length;
    
    imageKeys.forEach(key => {
        images[key] = new Image();
        
        // Progress is incremented when an image loads successfully or fails.
        images[key].onload = () => { assetLoaded(); };
        images[key].onerror = () => { assetLoaded(); }; 

        if (imagePaths[key]) {
            images[key].src = imagePaths[key];
        } else {
            const svgKey = key === 'elephantPen' ? 'elephantPenIcon' : 
                         key === 'paddyField' ? 'paddyFieldIcon' :
                         key === 'palace' ? 'palaceIcon' :
                         key === 'barracks' ? 'barracksIcon' :
                         key === 'stables' ? 'stablesIcon' :
                         key === 'tower' ? 'towerIcon' :
                         key === 'wall' ? 'wallIcon' : key;
            if (svgs[svgKey] || svgs[key]) {
                images[key].src = svgs[svgKey] || svgs[key];
            } else {
                assetLoaded(); // If there is no picture, move on.
            }
        }
    });
}

function assetLoaded() {
    loadedAssets++;
    let progress = Math.floor((loadedAssets / totalAssets) * 100);
    
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');
    
    if (progressBar) progressBar.style.width = progress + '%';
    if (loadingText) loadingText.innerText = progress + '%';

    // After reaching 100%, wait half a second and then remove the loading screen.
    if (loadedAssets >= totalAssets) {
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.transition = 'opacity 0.5s ease';
                setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
            }
        }, 500); 
    }
}

initImages();

function isoToScreen(gridX, gridY) { return { x: (gridX - gridY) * (TILE_W / 2), y: (gridX + gridY) * (TILE_H / 2) }; }
function screenToIso(screenX, screenY) {
    if (zoom === 0) zoom = MIN_ZOOM; 
    let adjX = (screenX - camera.x) / zoom; let adjY = (screenY - camera.y) / zoom;
    return { x: (adjY / TILE_H) + (adjX / TILE_W), y: (adjY / TILE_H) - (adjX / TILE_W) };
}

// --- Function that stops you from going near buildings ---
function isBuildingBlocked(gx, gy) {
    if (gx < 0 || gx >= MAP_COLS || gy < 0 || gy >= MAP_ROWS) return true; 
    for (let b of GameState.buildings) {
        if (b.type !== 'Paddy Field') { 
            if (gx >= b.gridX && gx < b.gridX + b.size && gy >= b.gridY && gy < b.gridY + b.size) return true;
        }
    }
    return false;
}

function isTileBlocked(gx, gy, selfObj) {
    try {
        if (gx < 0 || gx >= MAP_COLS || gy < 0 || gy >= MAP_ROWS) return true;
        const buildings = GameState.buildings || [];
        for (let b of buildings) {
            if (b.type !== 'Paddy Field') {
                if (gx >= b.gridX && gx < b.gridX + b.size && gy >= b.gridY && gy < b.gridY + b.size) return true;
            }
        }
        const allEntities = [...(GameState.villagers||[]), ...(GameState.soldiers||[]), ...(GameState.elephants||[]), ...(GameState.horses||[]), ...(GameState.enemies||[])];
        for (let ent of allEntities) {
            if (!ent || ent === selfObj) continue; 
            if (Math.round(ent.targetX) === gx && Math.round(ent.targetY) === gy) return true;
            if (Math.round(ent.x) === gx && Math.round(ent.y) === gy) return true;
        }
        return false;
    } catch (err) { return false; }
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
    const width = 30; const height = 4;
    ctx.fillStyle = 'red'; ctx.fillRect(x - width/2, y - 10, width, height);
    ctx.fillStyle = '#00FF00'; ctx.fillRect(x - width/2, y - 10, width * Math.max(0, hp/maxHp), height);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(x - width/2, y - 10, width, height);
}

class FloatingText {
    constructor(gridX, gridY, text, color) {
        this.gridX = gridX; this.gridY = gridY; this.text = text; this.color = color;
        this.life = 90; this.maxLife = 90; 
    }
    draw(ctx) {
        if (!GameState.isPaused) this.life--; 
        const progress = 1 - (this.life / this.maxLife);
        const pos = isoToScreen(this.gridX, this.gridY);
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life / (this.maxLife * 0.5));
        ctx.font = 'bold 24px "Poppins", sans-serif'; 
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'black'; ctx.strokeText(this.text, pos.x, pos.y - 50 - (progress * 60));
        ctx.fillStyle = this.color; ctx.fillText(this.text, pos.x, pos.y - 50 - (progress * 60));
        ctx.restore();
    }
}

function drawIsoBlock(ctx, cx, cy, sizeX, sizeY, height, cTop, cLeft, cRight, zOffset = 0) {
    const anchorY = cy - TILE_H / 2; 
    const top = { x: cx, y: anchorY - zOffset - height };
    const right = { x: cx + sizeX * (TILE_W/2), y: anchorY + sizeX * (TILE_H/2) - zOffset - height };
    const left = { x: cx - sizeY * (TILE_W/2), y: anchorY + sizeY * (TILE_H/2) - zOffset - height };
    const bottom = { x: cx + (sizeX - sizeY) * (TILE_W/2), y: anchorY + (sizeX + sizeY) * (TILE_H/2) - zOffset - height };

    ctx.fillStyle = cTop; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (height > 0) {
        const bL = { x: left.x, y: left.y + height }, bB = { x: bottom.x, y: bottom.y + height }, bR = { x: right.x, y: right.y + height };
        ctx.fillStyle = cLeft; ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(bB.x, bB.y); ctx.lineTo(bL.x, bL.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = cRight; ctx.beginPath(); ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(right.x, right.y); ctx.lineTo(bR.x, bR.y); ctx.lineTo(bB.x, bB.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
}
function drawBlockCenter(ctx, cx, cy, baseSize, size, h, topC, leftC, rightC, z) {
    let offsetY = (baseSize - size) * (TILE_H / 2); drawIsoBlock(ctx, cx, cy + offsetY, size, size, h, topC, leftC, rightC, z);
}

// --- Classes ---
class Building {
    constructor(gridX, gridY, type) {
        this.gridX = gridX; this.gridY = gridY; this.type = type;
        this.size = (type === 'Wall' || type === 'Tower') ? 1 : 2;
        this.imgKey = type === 'Elephant Pen' ? 'elephantPen' : type === 'Paddy Field' ? 'paddyField' : type.toLowerCase();
        
        if(type === 'Wall') this.maxHp = 500;
        else if(type === 'Palace') this.maxHp = 2000 * GameState.palaceLevel;
        else if(type === 'Tower') this.maxHp = 800;
        else this.maxHp = 300;
        this.hp = this.maxHp;
        this.actionTimer = 0;
    }

    update() {
        if (this.hp <= 0) return;
        if (this.type === 'Tower') {
            if (this.actionTimer > 0) this.actionTimer--;
            if (this.actionTimer <= 0) {
                let nearest = null; let minDist = 4; 
                GameState.enemies.forEach(e => {
                    let d = getDistance(this, e);
                    if (d < minDist) { minDist = d; nearest = e; }
                });
                if (nearest) {
                    this.actionTimer = 50; nearest.hp -= 20; 
                    GameState.floatingTexts.push(new FloatingText(nearest.x, nearest.y, `-20`, '#FFA500')); 
                }
            }
        }
    }
    
    draw(ctx, screenX, screenY) {
        const img = images[this.imgKey];
        if (imagePaths[this.imgKey] && img && img.complete && img.naturalWidth > 0) {
            const imgW = this.size * TILE_W; const imgH = imgW * (img.naturalHeight / img.naturalWidth);
            const bottomY = screenY - TILE_H / 2 + this.size * TILE_H;
            ctx.drawImage(img, screenX - imgW/2, bottomY - imgH, imgW, imgH);
        } else {
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
            if (this.type === 'Palace') {
                let pColor = GameState.palaceLevel > 1 ? '#DAA520' : '#e8e8e8'; 
                drawBlockCenter(ctx, screenX, screenY, 2, 2, 10, pColor, '#c0c0c0', '#a0a0a0', 0);
                drawBlockCenter(ctx, screenX, screenY, 2, 1.4, 25, '#fff', '#e0e0e0', '#cccccc', 10);
                drawBlockCenter(ctx, screenX, screenY, 2, 0.8, 15, '#FFD700', '#DAA520', '#B8860B', 35);
            } 
            else if (this.type === 'Barracks') {
                drawBlockCenter(ctx, screenX, screenY, 2, 2, 5, '#8B4513', '#5C3A21', '#3E2723', 0);
                drawIsoBlock(ctx, screenX, screenY, 2, 0.8, 20, '#CD5C5C', '#8B0000', '#800000', 5);
                drawIsoBlock(ctx, screenX, screenY, 0.8, 2, 15, '#F08080', '#A52A2A', '#800000', 5);
            } 
            else if (this.type === 'Elephant Pen') {
                drawBlockCenter(ctx, screenX, screenY, 2, 2, 2, '#D2B48C', '#A0522D', '#8B4513', 0);
                drawIsoBlock(ctx, screenX, screenY, 2, 0.1, 10, '#DEB887', '#8B4513', '#5C3A21', 2);
                drawIsoBlock(ctx, screenX, screenY, 0.1, 2, 10, '#DEB887', '#8B4513', '#5C3A21', 2);
                drawIsoBlock(ctx, screenX, screenY, 1.2, 1.2, 25, '#8B4513', '#5C3A21', '#3E2723', 2);
            } 
            else if (this.type === 'Stables') {
                drawBlockCenter(ctx, screenX, screenY, 2, 2, 2, '#D2B48C', '#A0522D', '#8B4513', 0);
                drawBlockCenter(ctx, screenX, screenY, 2, 1.6, 18, '#CD853F', '#8B4513', '#5C3A21', 2);
            } 
            else if (this.type === 'Paddy Field') {
                drawBlockCenter(ctx, screenX, screenY, 2, 2, 1, '#9ACD32', '#6B8E23', '#556B2F', 0);
                ctx.strokeStyle = 'rgba(85, 107, 47, 0.4)'; ctx.lineWidth = 2; ctx.beginPath();
                const anchorY = screenY - TILE_H / 2;
                ctx.moveTo(screenX - TILE_W/2, anchorY + TILE_H/2); ctx.lineTo(screenX + TILE_W/2, anchorY + 1.5*TILE_H);
                ctx.moveTo(screenX + TILE_W/2, anchorY + TILE_H/2); ctx.lineTo(screenX - TILE_W/2, anchorY + 1.5*TILE_H); ctx.stroke();
            }
            else if (this.type === 'Wall') {
                drawBlockCenter(ctx, screenX, screenY, 1, 1, 30, '#A9A9A9', '#696969', '#505050', 0);
                drawBlockCenter(ctx, screenX, screenY, 1, 0.4, 8, '#D3D3D3', '#808080', '#606060', 30);
            }
            else if (this.type === 'Tower') {
                drawBlockCenter(ctx, screenX, screenY, 1, 1, 50, '#8B4513', '#5C3A21', '#3E2723', 0);
                drawBlockCenter(ctx, screenX, screenY, 1, 1.2, 10, '#CD853F', '#8B4513', '#5C3A21', 50); 
            }
        }
        drawHealthBar(ctx, screenX, screenY - (this.size*TILE_H), this.hp, this.maxHp);
    }
}

class CombatEntity {
    constructor(x, y) {
        this.x = x; this.y = y; 
        this.targetX = x; this.targetY = y;
        this.actionTimer = 0; this.facingRight = true; this.isMoving = false;
        
        this.manualTargetEnemy = null; 
        this.manualTargetPos = null;
    }

    drawSelectionRing(ctx, sx, sy) {
        if (GameState.selectedUnit === this) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(sx, sy, 22, 11, 0, 0, Math.PI * 2);
            ctx.strokeStyle = '#D4AF37'; 
            ctx.lineWidth = 2;
            ctx.shadowColor = '#D4AF37';
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
                        GameState.floatingTexts.push(new FloatingText(this.manualTargetEnemy.x, this.manualTargetEnemy.y, `-${this.damage}`, '#FF0000'));
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

        let nearest = null; let minDist = this.attackRange || 1.5;
        enemiesArray.forEach(e => { let d = getDistance(this, e); if (d < minDist) { minDist = d; nearest = e; } });

        if (nearest) {
            this.targetX = this.x; this.targetY = this.y; this.isMoving = false;
            this.facingRight = nearest.x > this.x;
            if (this.actionTimer <= 0) {
                this.actionTimer = this.attackSpeed; nearest.hp -= this.damage;
                GameState.floatingTexts.push(new FloatingText(nearest.x, nearest.y, `-${this.damage}`, '#FF0000'));
				
				playSound('attack');
				
            }
            return true; 
        }
        return false; 
    }

    moveUpdate() {
        const dx = this.targetX - this.x; const dy = this.targetY - this.y; const dist = Math.hypot(dx, dy);
        if (dist < 0.1) {
            this.x = this.targetX; this.y = this.targetY; this.isMoving = false;
            if (this.manualTargetPos) this.manualTargetPos = null;

            if (Math.random() < 0.05 && !this.manualTargetEnemy) { 
                const moves = [{dx:0,dy:1}, {dx:1,dy:0}, {dx:0,dy:-1}, {dx:-1,dy:0}];
                const move = moves[Math.floor(Math.random() * moves.length)];
                const nx = Math.floor(this.x) + move.dx; const ny = Math.floor(this.y) + move.dy;
                if (!isTileBlocked(nx, ny, this) && !isBuildingBlocked(nx, ny)) { this.targetX = nx; this.targetY = ny; }
            }
        } else { 
            this.isMoving = true;
            this.facingRight = dx - dy > 0.01;
            
            let moveX = (dx / dist) * this.speed;
            let moveY = (dy / dist) * this.speed;
            
            if (!isBuildingBlocked(Math.floor(this.x + moveX), Math.floor(this.y))) {
                this.x += moveX;
            }
            if (!isBuildingBlocked(Math.floor(this.x), Math.floor(this.y + moveY))) {
                this.y += moveY;
            }
        }
    }
}

class Villager extends CombatEntity {
    constructor(x, y) {
        super(x,y); this.speed = 0.02 + Math.random() * 0.015;
        this.color = ['#FFD700', '#FF4500', '#1E90FF', '#FFF'][Math.floor(Math.random() * 4)];
        this.state = 'wandering'; this.hp = 20; this.maxHp = 20;
    }
    update() {
        if (this.hp <= 0) return;
        if (this.state === 'farming') {
            this.actionTimer--; this.isMoving = false;
            if (this.actionTimer <= 0) {
                this.state = 'wandering'; GameState.rice += 5; updateDOM();
                GameState.floatingTexts.push(new FloatingText(this.x, this.y, '+5 Rice', '#00FA9A'));
            } return; 
        }
        
        if (!this.manualTargetPos && !this.manualTargetEnemy) {
            const dx = this.targetX - this.x; const dy = this.targetY - this.y; const dist = Math.hypot(dx, dy);
            if (dist < 0.05) {
                this.x = this.targetX; this.y = this.targetY;
                let onField = GameState.buildings.find(b => b.type === 'Paddy Field' && this.x >= b.gridX && this.x < b.gridX + b.size && this.y >= b.gridY && this.y < b.gridY + b.size);
                if (onField && Math.random() < 0.8) { this.state = 'farming'; this.actionTimer = 120 + Math.random() * 60; return; }
                if (Math.random() < 0.02) {
                    let fields = GameState.buildings.filter(b => b.type === 'Paddy Field');
                    if (fields.length > 0 && Math.random() < 0.5) {
                        let f = fields[Math.floor(Math.random() * fields.length)];
                        this.targetX = f.gridX + Math.floor(Math.random() * f.size); this.targetY = f.gridY + Math.floor(Math.random() * f.size);
                    } else {
                        const moves = [{dx:0,dy:1}, {dx:1,dy:0}, {dx:0,dy:-1}, {dx:-1,dy:0}];
                        const move = moves[Math.floor(Math.random() * moves.length)];
                        const nx = Math.floor(this.x) + move.dx; const ny = Math.floor(this.y) + move.dy;
                        if (!isTileBlocked(nx, ny, this) && !isBuildingBlocked(nx, ny)) { this.targetX = nx; this.targetY = ny; }
                    }
                }
            } else { 
                let moveX = (dx / dist) * this.speed; 
                let moveY = (dy / dist) * this.speed; 
                if (!isBuildingBlocked(Math.floor(this.x + moveX), Math.floor(this.y))) this.x += moveX;
                if (!isBuildingBlocked(Math.floor(this.x), Math.floor(this.y + moveY))) this.y += moveY;
                this.isMoving = true; 
                this.facingRight = dx - dy > 0.01; 
            }
        } else {
            this.moveUpdate(); 
        }
    }
    draw(ctx, sx, sy) {
        const bob = (!GameState.isPaused && this.isMoving) ? Math.abs(Math.sin(Date.now() * 0.01)) * 6 : 0;
        let rY = sy - bob - ((!GameState.isPaused && this.state === 'farming') ? Math.abs(Math.sin(Date.now() / 150)) * 5 : 0);
        this.drawSelectionRing(ctx, sx, sy);
        ctx.save(); if(!this.facingRight) { ctx.translate(sx, sy); ctx.scale(-1, 1); ctx.translate(-sx, -sy); }
        const img = images.villager;
        if (imagePaths.villager && img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, sx - 16, rY - 38, 32, 48);
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.beginPath(); ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.fillStyle = this.color;
            ctx.fillRect(sx - 4, rY - 18, 8, 12); ctx.strokeRect(sx - 4, rY - 18, 8, 12);
            ctx.beginPath(); ctx.arc(sx, rY - 22, 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore(); drawHealthBar(ctx, sx, sy - 30, this.hp, this.maxHp);
    }
}

class Soldier extends CombatEntity {
    constructor(x, y) { super(x,y); this.speed = 0.035; this.hp = 50; this.maxHp = 50; this.damage = 10; this.attackRange = 1.2; this.attackSpeed = 40; }
    update() { if (this.hp <= 0) return; if (!this.combatUpdate(GameState.enemies)) this.moveUpdate(); }
    draw(ctx, sx, sy) {
        const bob = (!GameState.isPaused && this.isMoving) ? Math.abs(Math.sin(Date.now() * 0.012)) * 5 : 0;
        this.drawSelectionRing(ctx, sx, sy);
        ctx.save(); if(!this.facingRight) { ctx.translate(sx, sy); ctx.scale(-1, 1); ctx.translate(-sx, -sy); }
        const img = images.soldier;
        if (imagePaths.soldier && img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, sx - 16, sy - 38 - bob, 32, 48); } 
        else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.beginPath(); ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.fillStyle = '#C0C0C0'; ctx.fillRect(sx - 4, sy - 18 - bob, 8, 12); ctx.strokeRect(sx - 4, sy - 18 - bob, 8, 12);
            ctx.fillStyle = '#FF0000'; ctx.beginPath(); ctx.arc(sx, sy - 22 - bob, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); 
        }
        ctx.restore(); drawHealthBar(ctx, sx, sy - 30, this.hp, this.maxHp);
    }
}

class Elephant extends CombatEntity {
    constructor(x, y) { super(x,y); this.speed = 0.02; this.hp = 300; this.maxHp = 300; this.damage = 40; this.attackRange = 1.5; this.attackSpeed = 60; }
    update() { if (this.hp <= 0) return; if (!this.combatUpdate(GameState.enemies)) this.moveUpdate();

	if (Math.random() < 0.002) { 
            playSound('elephant_roar');
        }
	
	}
	
    draw(ctx, sx, sy) {
        const bob = (!GameState.isPaused && this.isMoving) ? Math.abs(Math.sin(Date.now() * 0.005)) * 4 : 0;
        this.drawSelectionRing(ctx, sx, sy);
        ctx.save(); ctx.translate(sx, sy - bob); if (!this.facingRight) ctx.scale(-1, 1); 
        const img = images.elephant;
        if (imagePaths.elephant && img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, -32, -49, 64, 64); } 
        else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#696969'; ctx.beginPath(); ctx.ellipse(0, -15, 14, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.restore(); drawHealthBar(ctx, sx, sy - 40, this.hp, this.maxHp);
    }
}

class Horse extends CombatEntity {
    constructor(x, y) { super(x,y); this.speed = 0.05; this.hp = 100; this.maxHp = 100; this.damage = 15; this.attackRange = 1.2; this.attackSpeed = 30; }
    update() { if (this.hp <= 0) return; if (!this.combatUpdate(GameState.enemies)) this.moveUpdate(); }
    draw(ctx, sx, sy) {
        const bob = (!GameState.isPaused && this.isMoving) ? Math.abs(Math.sin(Date.now() * 0.02)) * 7 : 0;
        this.drawSelectionRing(ctx, sx, sy);
        ctx.save(); ctx.translate(sx, sy - bob); if (!this.facingRight) ctx.scale(-1, 1);
        const img = images.horse;
        if (imagePaths.horse && img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, -24, -38, 48, 48); } 
        else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8B4513'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -10, 10, 6, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        }
        ctx.restore(); drawHealthBar(ctx, sx, sy - 35, this.hp, this.maxHp);
    }
}

// ------ Enemy

class Enemy extends CombatEntity {
    constructor(x, y, hpMult) { super(x,y); this.speed = 0.015; this.hp = 40 * hpMult; this.maxHp = 40 * hpMult; this.damage = 10 * hpMult; this.attackRange = 1.2; this.attackSpeed = 50; }
    update() {
        if (this.hp <= 0) return;
        if (this.actionTimer > 0) this.actionTimer--;

        let defenders = [...GameState.soldiers, ...GameState.elephants, ...GameState.horses, ...GameState.villagers];
        let targets = [...defenders, ...GameState.buildings];
        let nearest = null; let minDist = 9999;
        targets.forEach(t => { let d = getDistance(this, t); if (d < minDist) { minDist = d; nearest = t; } });

        if (nearest) {
            let range = (nearest instanceof Building) ? nearest.size + 0.5 : this.attackRange;
            if (minDist <= range) {
                this.isMoving = false;
                if (this.actionTimer <= 0) {
                    this.actionTimer = this.attackSpeed; nearest.hp -= this.damage;
                    GameState.floatingTexts.push(new FloatingText(nearest.gridX || nearest.x, nearest.gridY || nearest.y, `-${this.damage}`, '#FF0000'));
					
					playSound('attack');
                }
            } else {
                this.isMoving = true;
                const dx = (nearest.gridX || nearest.x) - this.x; const dy = (nearest.gridY || nearest.y) - this.y; const dist = Math.hypot(dx, dy);
                this.facingRight = dx - dy > 0.01;
                
                let moveX = (dx / dist) * this.speed;
                let moveY = (dy / dist) * this.speed;
                if (!isBuildingBlocked(Math.floor(this.x + moveX), Math.floor(this.y))) this.x += moveX;
                if (!isBuildingBlocked(Math.floor(this.x), Math.floor(this.y + moveY))) this.y += moveY;
            }
        } else {
            this.isMoving = true;
            const dx = 20 - this.x; const dy = 20 - this.y; const dist = Math.hypot(dx, dy);
            if(dist > 0.5) { 
                let moveX = (dx / dist) * this.speed; 
                let moveY = (dy / dist) * this.speed;
                if (!isBuildingBlocked(Math.floor(this.x + moveX), Math.floor(this.y))) this.x += moveX;
                if (!isBuildingBlocked(Math.floor(this.x), Math.floor(this.y + moveY))) this.y += moveY;
                this.facingRight = dx - dy > 0.01; 
            }
        }
    }
    draw(ctx, sx, sy) {
        const bob = (!GameState.isPaused && this.isMoving) ? Math.abs(Math.sin(Date.now() * 0.015)) * 6 : 0;
        ctx.save(); if(!this.facingRight) { ctx.translate(sx, sy); ctx.scale(-1, 1); ctx.translate(-sx, -sy); }
        const img = images.enemy;
        if (imagePaths.enemy && img && img.complete && img.naturalWidth > 0) { ctx.drawImage(img, sx - 16, sy - 38 - bob, 32, 48); } 
        else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.beginPath(); ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.fillStyle = '#800000'; ctx.fillRect(sx - 4, sy - 18 - bob, 8, 12); ctx.strokeRect(sx - 4, sy - 18 - bob, 8, 12);
        }
        ctx.restore(); drawHealthBar(ctx, sx, sy - 30, this.hp, this.maxHp);
    }
}

// --- DYNAMIC ROYAL ADVISOR ---
function showRoyalAdvisor(messages) {
    advisorTimeouts.forEach(t => clearTimeout(t));
    advisorTimeouts = [];

    let aiPanel = document.getElementById('ai-guide-panel');
    if (!aiPanel) {
        aiPanel = document.createElement('div');
        aiPanel.id = 'ai-guide-panel';
        aiPanel.style.cssText = "position:absolute; top:130px; left:15px; width:280px; background:var(--bg-panel); border:1px solid var(--gold-primary); border-radius:8px; padding:20px; color:var(--text-main); font-family:var(--font-body); z-index:20; box-shadow:0 8px 25px rgba(0,0,0,0.8), inset 0 0 15px rgba(212,175,55,0.1); pointer-events:none; transition: opacity 0.5s ease;";
        
        const aiHeader = document.createElement('div');
        aiHeader.innerHTML = '<div style="text-align:center; width:100%;"><span style="font-size:24px;">👑</span><br><span style="font-family:var(--font-heading); font-weight:700; color:var(--gold-primary); letter-spacing:1px; font-size:16px;">ROYAL ADVISOR</span><hr style="border:0; height:1px; background: linear-gradient(to right, transparent, var(--gold-primary), transparent); margin:12px 0;"></div>';
        
        const aiText = document.createElement('div');
        aiText.id = 'ai-chat-text';
        aiText.style.cssText = "font-size:13px; line-height:1.6; font-weight:400; min-height:60px;";
        
        aiPanel.appendChild(aiHeader);
        aiPanel.appendChild(aiText);
        document.body.appendChild(aiPanel);
    }

    aiPanel.style.opacity = '1';
    let aiText = document.getElementById('ai-chat-text');
    aiText.innerHTML = ''; 

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
                    aiText.innerHTML += '<br><br>';
                    msgIndex++;
                    charIndex = 0;
                    typeWriter();
                }, 3000); 
                advisorTimeouts.push(t2);
            }
        } else {
             aiText.innerHTML += '<span style="color:var(--gold-primary); font-family:var(--font-heading); font-weight:700;">Good Luck! ⚔️</span>';
             let t3 = setTimeout(() => {
                 aiPanel.style.opacity = '0';
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

    if (GameState.phase === 'build' && GameState.frameCount % 300 === 0) {
        let palaceCount = GameState.buildings.filter(b => b.type === 'Palace').length;
        if (palaceCount > 0) {
            let goldEarned = 10 * GameState.palaceLevel; GameState.gold += goldEarned; updateDOM();
            let palace = GameState.buildings.find(b => b.type === 'Palace');
            GameState.floatingTexts.push(new FloatingText(palace.gridX+1, palace.gridY+1, `+${goldEarned} Gold`, '#FFD700'));
        }
    }

    if (GameState.phase === 'build') {
        GameState.timer--;
        if (GameState.timer <= 0) {
            GameState.phase = 'combat';
            GameState.enemiesSpawned = false;
            GameState.combatFrameCount = 0; 
        }
    } 
    else if (GameState.phase === 'combat') {
        GameState.combatFrameCount++; 

        // --- TUTORIAL / ADVICE TRIGGER ---
        if (GameState.level === 1 && GameState.combatFrameCount === 180 && !GameState.midCombatAdviceGiven) {
            GameState.midCombatAdviceGiven = true;
            
            // Check if player has any combat troops
            let combatUnits = [...GameState.soldiers, ...GameState.elephants, ...GameState.horses];
            
            if (combatUnits.length > 0 && GameState.tutorialState === 'inactive') {
                // START TUTORIAL
                GameState.tutorialState = 'select_troop';
                showRoyalAdvisor([
                    "Your Majesty, the enemies are here!",
                    "Let me show you how to command your troops.",
                    "First, CLICK on one of your Soldiers to select them."
                ]);
            } else {
                // Normal Advice
                let combatAdvice = [];
                if (GameState.gold >= 150) {
                    combatAdvice.push("Your Majesty, the enemy attacks! You have ample Gold.");
                    combatAdvice.push("Quickly build a Barracks to deploy Soldiers.");
                } else if (GameState.gold >= 50) {
                    combatAdvice.push("They approach fast! Use your remaining Gold to build Fortified Walls.");
                    combatAdvice.push("Walls will delay them while our Palace guards strike from afar!");
                } else {
                    combatAdvice.push("Our treasury is low! Trust in the strength of our Palace for this wave.");
                    combatAdvice.push("Next time, build Paddy Fields early to strengthen our economy.");
                }
                showRoyalAdvisor(combatAdvice); 
            }
        }

        if (!GameState.enemiesSpawned) {
            let multiplier = GameState.difficulty === 'hard' ? 5 : (GameState.difficulty === 'easy' ? 2 : 3);
            let enemyCount = GameState.level * multiplier; 
            for (let i = 0; i < enemyCount; i++) {
                let ex = Math.random() > 0.5 ? (Math.random() > 0.5 ? 0 : MAP_COLS-1) : Math.random() * MAP_COLS;
                let ey = (ex === 0 || ex === MAP_COLS-1) ? Math.random() * MAP_ROWS : (Math.random() > 0.5 ? 0 : MAP_ROWS-1);
                GameState.enemies.push(new Enemy(ex, ey, 1 + (GameState.level * 0.2)));
            }
            GameState.enemiesSpawned = true;
        } else {
            // --- GAME OVER CHECK ---
            if (GameState.phase !== 'game_over' && GameState.phase !== 'game_over_delay') {
                let anyBuildingExists = GameState.buildings.length > 0;
                if (!anyBuildingExists) {
                    GameState.phase = 'game_over_delay';
                    
                    // --- HIGH SCORE LOGIC ---
                    // Take the previously saved one (or take 1).
                    let bestScore = parseInt(localStorage.getItem('apexLionHighScore')) || 1;
                    let isNewRecord = false;
                    
                    // If the current level is higher than the previous one, it will be saved.
                    if (GameState.level > bestScore) {
                        localStorage.setItem('apexLionHighScore', GameState.level);
                        bestScore = GameState.level;
                        isNewRecord = true;
                    }
                    // ---------------------------------
                    
                    setTimeout(() => {
                        GameState.phase = 'game_over';
                        GameState.isPaused = true; 
                        
                        let goPopup = document.getElementById('game-over-popup');
                        if(goPopup) {
                            let lvlText = document.getElementById('game-over-level-text');
                            if(lvlText) {
                                // Game Over Popup desplay a new record
                                lvlText.innerHTML = `You survived until Level ${GameState.level}.<br><br>
                                <span style="color: #FFD700; font-weight: bold; font-size: 22px;">🏆 Best Record: Level ${bestScore}</span>
                                ${isNewRecord ? '<br><span style="color: #00FA9A; font-size: 16px; font-weight: bold; display: block; margin-top: 10px;">🎉 NEW HIGH SCORE! 🎉</span>' : ''}`;
                            }
                            goPopup.style.display = 'block';
                        }
                    }, 3000);
                    return; 
                }
            }

            if (GameState.enemies.length === 0 && GameState.phase !== 'game_over_delay' && GameState.phase !== 'game_over') {
                
                let rewardMult = GameState.difficulty === 'hard' ? 1.5 : (GameState.difficulty === 'easy' ? 0.5 : 1);
                
                let goldBonus = Math.floor(GameState.level * 150 * rewardMult);
                let riceBonus = Math.floor(GameState.level * 50 * rewardMult);
                
                GameState.gold += goldBonus;
                GameState.rice += riceBonus;
                updateDOM();
                
                GameState.phase = 'level_cleared';
                GameState.popupTimer = 180; 

                let popup = document.getElementById('level-popup');
                if(popup) {
                    popup.innerHTML = `
                        <h2 style="font-family:var(--font-heading); color:var(--gold-primary); margin:0 0 10px 0; font-size:28px;">🎉 Level ${GameState.level} Cleared! 🎉</h2>
                        <p style="margin:5px 0; font-size:18px;">You have successfully defended the kingdom!</p>
                        <p style="margin:15px 0; font-size:20px; font-weight:bold;">Reward: +${goldBonus} 🪙 | +${riceBonus} 🌾</p>
                        <p style="margin:0; font-size:14px; color:#aaa;">Starting next level automatically...</p>
                    `;
                    popup.style.display = 'block';
                }
            }
        }
    }
    else if (GameState.phase === 'level_cleared') {
        GameState.popupTimer--;
        if (GameState.popupTimer <= 0) {
            let popup = document.getElementById('level-popup');
            if(popup) popup.style.display = 'none';
            
            GameState.level++;
            GameState.phase = 'build';
            GameState.timer = 3600; 
            GameState.enemiesSpawned = false;

            let nextLevelAdvice = [
                `Excellent victory! But beware, Level ${GameState.level} brings stronger foes.`,
                "Expand your Paddy Fields to increase Rice production.",
                "I highly advise constructing a Tower or an Elephant Pen for better defence."
            ];
            showRoyalAdvisor(nextLevelAdvice);
        }
    }
}

// --- UI SETUP & INJECTIONS ---
const uiGold = document.getElementById('gold-count'); const uiRice = document.getElementById('rice-count');
const uiMessage = document.getElementById('system-message'); const btnCancel = document.getElementById('btn-cancel');

const getBtnHTML = (id, type, costGold, costRice, extraClass="") => `
    <button id="${id}" class="build-btn ${extraClass}" data-type="${type}" data-cost-gold="${costGold}" data-cost-rice="${costRice}">
        <span class="btn-title">${type.toUpperCase()}</span>
        <div class="btn-cost">
            ${costGold > 0 ? `<span class="icon">🪙</span> ${costGold} G ` : ''}
            ${costRice > 0 ? `<span class="icon">🌾</span> ${costRice} R ` : ''}
        </div>
    </button>
`;


// Adjust building prices (Gold, Rice) below:

function setupUIButtons() {
    const uiBottom = document.getElementById('ui-bottom');
    if (uiBottom) { 
        uiBottom.innerHTML = ''; 
        uiBottom.insertAdjacentHTML('beforeend', getBtnHTML('btn-paddy', 'Paddy Field', 50, 0));
        uiBottom.insertAdjacentHTML('beforeend', getBtnHTML('btn-palace', 'Palace', 200, 0));
        uiBottom.insertAdjacentHTML('beforeend', getBtnHTML('btn-barracks', 'Barracks', 150, 0));
        uiBottom.insertAdjacentHTML('beforeend', getBtnHTML('btn-elephant', 'Elephant Pen', 300, 0));
        uiBottom.insertAdjacentHTML('beforeend', getBtnHTML('btn-stables', 'Stables', 200, 0));
        uiBottom.insertAdjacentHTML('beforeend', getBtnHTML('btn-wall', 'Wall', 0, 50));
        uiBottom.insertAdjacentHTML('beforeend', getBtnHTML('btn-tower', 'Tower', 100, 50));
        uiBottom.insertAdjacentHTML('beforeend', getBtnHTML('btn-upgrade', 'Upgrade Palace', 500, 0, 'upgrade-btn'));
        uiBottom.insertAdjacentHTML('beforeend', `<button id="btn-cancel" class="build-btn hidden">CANCEL</button>`);
    }

    const pairs = [ { id: 'btn-palace', img: imagePaths.palace, svg: svgs.palaceIcon }, { id: 'btn-barracks', img: imagePaths.barracks, svg: svgs.barracksIcon }, { id: 'btn-elephant', img: imagePaths.elephantPen, svg: svgs.elephantPenIcon }, { id: 'btn-stables', img: imagePaths.stables, svg: svgs.stablesIcon }, { id: 'btn-wall', img: imagePaths.wall, svg: svgs.wallIcon }, { id: 'btn-paddy', img: imagePaths.paddyField, svg: svgs.paddyFieldIcon }, { id: 'btn-tower', img: imagePaths.tower, svg: svgs.towerIcon } ];
    pairs.forEach(p => { 
        const btn = document.getElementById(p.id); 
        if (btn) {
            btn.style.backgroundImage = p.img ? `url("${p.img}"), url('data:image/svg+xml;utf8,${encodeURIComponent(p.svg.replace('data:image/svg+xml;utf8,', ''))}')` : `url('data:image/svg+xml;utf8,${encodeURIComponent(p.svg.replace('data:image/svg+xml;utf8,', ''))}')`; 
        }
    });

    if (!document.getElementById('level-popup')) {
        let popup = document.createElement('div');
        popup.id = 'level-popup';
        popup.style.cssText = "display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--bg-panel); border:1px solid var(--gold-primary); border-radius:15px; padding:30px; text-align:center; z-index:9999; color:white; box-shadow:0 10px 30px rgba(0,0,0,0.9); pointer-events:none;";
        document.body.appendChild(popup);
    }

    if (!document.getElementById('level-status-container')) {
        const statusCont = document.createElement('div');
        statusCont.id = 'level-status-container';
        statusCont.style.cssText = "position:absolute; top:25px; left:50%; transform:translateX(-50%); display:flex; flex-direction:row; align-items:center; justify-content:center; gap:20px; z-index:20; pointer-events:none; width:max-content; white-space:nowrap;";
        
        const statusText = document.createElement('div');
        statusText.id = 'level-status-text';
        statusText.style.cssText = "pointer-events:auto; display:flex; align-items:center; gap:15px;";
        statusCont.appendChild(statusText);

        const btnEarly = document.createElement('button');
        btnEarly.id = 'btn-early-wave';
        btnEarly.style.cssText = "background: linear-gradient(180deg, #F9DF9F 0%, #D4AF37 50%, #AA7C11 100%); border: 1px solid #5a3a00; color: #fff; padding: 10px 24px; border-radius: 8px; font-family: var(--font-heading); font-weight: bold; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.6), inset 0 0 10px rgba(255,255,255,0.4); text-align: center; pointer-events: auto; touch-action: manipulation; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);";
        
        btnEarly.onpointerdown = function(e) {
            e.stopPropagation(); 
            if(GameState.phase === 'build' && !GameState.isPaused) {
                GameState.gold += 100;
                GameState.timer = 0; 
                updateDOM();
                let palace = GameState.buildings.find(b => b.type === 'Palace');
                if(palace) GameState.floatingTexts.push(new FloatingText(palace.gridX+1, palace.gridY+1, "+100 Gold!", "#D4AF37"));
            }
        };
        statusCont.appendChild(btnEarly);
        document.body.appendChild(statusCont);
    }

    const wrapper = document.getElementById('bottom-dock-wrapper');
    if (wrapper && !document.getElementById('panel-toggle-btn')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'panel-toggle-btn';
        toggleBtn.innerHTML = '▼';
        
        // CSS changed to stay inside the wrapper logic properly
        toggleBtn.style.cssText = "position:absolute; top:-25px; left:50%; transform:translateX(-50%); background:var(--bg-panel); border:1px solid var(--gold-primary); border-bottom:none; color:var(--gold-primary); font-size:12px; padding:4px 35px; border-radius:10px 10px 0 0; cursor:pointer; z-index:15; box-shadow:0 -4px 10px rgba(0,0,0,0.5); pointer-events:auto; touch-action:manipulation;";
        
        wrapper.appendChild(toggleBtn);
        
        // Hide using CSS class instead of inline styles for perfect scaling
        toggleBtn.onpointerdown = function(e) {
            e.stopPropagation();
            if (wrapper.classList.contains('dock-hidden')) {
                wrapper.classList.remove('dock-hidden');
                toggleBtn.innerHTML = '▼';
            } else {
                wrapper.classList.add('dock-hidden');
                toggleBtn.innerHTML = '▲';
            }
        };
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setupUIButtons();

    // --- PAUSE, SETTINGS & FULLSCREEN UI INJECTION ---
    const btnSettings = document.getElementById('btn-settings');
    const btnPause = document.getElementById('btn-pause');
    const btnFullscreen = document.getElementById('btn-fullscreen');

   // Settings Modal
    if(btnSettings) {
        let settingsModal = document.createElement('div');
        settingsModal.id = 'settings-modal';
        settingsModal.style.cssText = "display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--bg-panel); border:1px solid var(--gold-primary); border-radius:15px; padding:30px; text-align:center; z-index:10001; color:white; box-shadow:0 10px 30px rgba(0,0,0,0.9); min-width: 320px;";
        
        settingsModal.innerHTML = `
            <h2 style="font-family:var(--font-heading); color:var(--gold-primary); margin-bottom:20px; font-size:24px;">⚙️ Game Settings</h2>
            
            <div style="margin-bottom: 15px; text-align: left;">
                <label style="font-size: 16px; font-family:var(--font-body); color: var(--gold-light);">Music Volume: <span id="bgm-vol-text">30%</span></label>
                <input type="range" id="bgm-slider" min="0" max="100" value="30" style="width: 100%; cursor: pointer; margin-top: 5px; accent-color: var(--gold-primary);">
            </div>

            <div style="margin-bottom: 25px; text-align: left;">
                <label style="font-size: 16px; font-family:var(--font-body); color: var(--gold-light);">Effects Volume: <span id="sfx-vol-text">80%</span></label>
                <input type="range" id="sfx-slider" min="0" max="100" value="80" style="width: 100%; cursor: pointer; margin-top: 5px; accent-color: var(--gold-primary);">
            </div>

            <div style="margin-bottom: 15px; text-align: left;">
                <label style="font-size: 16px; margin-right: 10px; font-family:var(--font-body);">Select Land:</label>
                <select id="land-select" style="padding: 6px 10px; font-size: 14px; background: #162545; color: white; border: 1px solid var(--gold-primary); border-radius: 5px; outline: none; cursor: pointer;">
                    <option value="land1" selected>Land 1</option>
                    <option value="land2">Land 2</option>
                    <option value="land3">Land 3</option>
                </select>
            </div>

            <div style="margin-bottom: 25px; text-align: left;">
                <label style="font-size: 16px; margin-right: 10px; font-family:var(--font-body);">Difficulty:</label>
                <select id="difficulty-select" style="padding: 6px 10px; font-size: 14px; background: #162545; color: white; border: 1px solid var(--gold-primary); border-radius: 5px; outline: none; cursor: pointer;">
                    <option value="easy">Easy (Less Enemies, Less Rewards)</option>
                    <option value="normal" selected>Normal</option>
                    <option value="hard">Hard (More Enemies, More Rewards)</option>
                </select>
            </div>
            <button id="btn-close-settings" style="background: linear-gradient(180deg, #F9DF9F 0%, #D4AF37 50%, #AA7C11 100%); border: 1px solid #5a3a00; color: #000; padding: 10px 30px; border-radius: 8px; font-family: var(--font-heading); font-weight: bold; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.6);">Save & Close</button>
        `;
        document.body.appendChild(settingsModal);

        // Music Slider එක වෙනස් කරද්දි සද්දෙ වෙනස් වෙනවා
        document.getElementById('bgm-slider').addEventListener('input', (e) => {
            globalBGMVolume = e.target.value / 100;
            document.getElementById('bgm-vol-text').innerText = e.target.value + '%';
            sounds.bgm.volume = globalBGMVolume;
            
            // සද්දෙ 0ට වඩා වැඩිකරොත් ඉබේම Mute එක අයින් වෙනවා
            if(globalBGMVolume > 0 && isMuted) {
                isMuted = false;
                let btnMute = document.getElementById('btn-mute');
                if(btnMute) btnMute.innerText = '🔊';
                sounds.bgm.play();
            }
        });

        // Effect Slider එක වෙනස් කරද්දි අනිත් සද්ද වෙනස් වෙනවා
        document.getElementById('sfx-slider').addEventListener('input', (e) => {
            globalSFXVolume = e.target.value / 100;
            document.getElementById('sfx-vol-text').innerText = e.target.value + '%';
        });

        btnSettings.addEventListener('click', () => {
            settingsModal.style.display = settingsModal.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('land-select').addEventListener('change', (e) => {
            GameState.currentLand = e.target.value;
        });

        document.getElementById('difficulty-select').addEventListener('change', (e) => {
            GameState.difficulty = e.target.value;
        });

        document.getElementById('btn-close-settings').addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
    }
    // Pause Overlay
    if(btnPause) {
        let pauseOverlay = document.createElement('div');
        pauseOverlay.id = 'pause-overlay';
        pauseOverlay.style.cssText = "display:none; position:absolute; top:0; left:0; width:100vw; height:100vh; background:rgba(6, 11, 20, 0.85); z-index:10000; justify-content:center; align-items:center; flex-direction:column; backdrop-filter: blur(5px);";
        pauseOverlay.innerHTML = `
            <h1 style="font-family:var(--font-heading); color:var(--gold-primary); font-size:60px; text-shadow: 0 4px 15px rgba(0,0,0,1); margin-bottom: 40px; text-align:center;">PAUSED</h1>
            <button id="btn-resume-game" style="background: linear-gradient(180deg, #F9DF9F 0%, #D4AF37 50%, #AA7C11 100%); border: 2px solid #5a3a00; color: #fff; padding: 15px 50px; border-radius: 12px; font-family: var(--font-heading); font-weight: bold; font-size: 26px; cursor: pointer; box-shadow: 0 8px 25px rgba(0,0,0,0.8), inset 0 0 15px rgba(255,255,255,0.4); text-shadow: 1px 1px 3px rgba(0,0,0,0.9); transition: transform 0.2s;">
                ▶ RESUME
            </button>
        `;
        document.body.appendChild(pauseOverlay);

        btnPause.addEventListener('click', () => {
            GameState.isPaused = true;
            pauseOverlay.style.display = 'flex';
        });

        document.getElementById('btn-resume-game').addEventListener('click', () => {
            GameState.isPaused = false;
            pauseOverlay.style.display = 'none';
        });
    }

    // Fullscreen Button (Cross-Browser support added)
    if(btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            let doc = window.document;
            let docEl = doc.documentElement;

            let requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
            let cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

            if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
                if(requestFullScreen) {
                    requestFullScreen.call(docEl).catch(err => {
                        showMessage("Fullscreen not supported on this device.", true);
                    });
                } else {
                    showMessage("Fullscreen not supported on iOS Safari.", true);
                }
            }
            else {
                if(cancelFullScreen) {
                    cancelFullScreen.call(doc);
                }
            }
        });
    }

    // --- GAME OVER POPUP INJECTION ---
    if (!document.getElementById('game-over-popup')) {
        let goPopup = document.createElement('div');
        goPopup.id = 'game-over-popup';
        goPopup.style.cssText = "display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(20, 5, 5, 0.95); border:2px solid #FF0000; border-radius:15px; padding:40px; text-align:center; z-index:10005; color:white; box-shadow:0 10px 50px rgba(255,0,0,0.6);";
        goPopup.innerHTML = `
            <h1 style="font-family:var(--font-heading); color:#FF4500; margin:0 0 15px 0; font-size:40px; text-shadow: 2px 2px 5px black;">💀 GAME OVER 💀</h1>
            <p style="margin:10px 0; font-size:20px; font-family:var(--font-body);">Your base has been destroyed!</p>
            <p id="game-over-level-text" style="margin:5px 0 25px 0; font-size:18px; color:#aaa;">You survived until Level 1.</p>
            <button id="btn-restart-game" style="background: linear-gradient(180deg, #8B0000 0%, #500000 100%); border: 1px solid #FF6347; color: #fff; padding: 12px 35px; border-radius: 8px; font-family: var(--font-heading); font-weight: bold; font-size: 18px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.6); transition: 0.2s;">
                🔄 RESTART GAME
            </button>
        `;
        document.body.appendChild(goPopup);

        document.getElementById('btn-restart-game').addEventListener('click', () => {
            location.reload(); 
        });
    }

    showRoyalAdvisor([
        "Greetings, Your Majesty! I am your Royal Advisor. I shall guide you in building this kingdom.",
        "Firstly, select a 'Paddy Field' from the menu below and place it upon the rock. This shall yield 'Rice'.",
        "Both Gold and Rice are required to train soldiers and breed war elephants.",
        "When you are ready, press 'START NOW' above to summon the enemy forces!"
    ]);
});

function updateDOM() { if(uiGold) uiGold.innerText = GameState.gold; if(uiRice) uiRice.innerText = GameState.rice; }
function showMessage(msg, isError = false) { 
    if(uiMessage) { 
        uiMessage.innerText = msg; 
        uiMessage.style.color = isError ? '#FF6347' : '#00FA9A'; 
        uiMessage.style.borderLeftColor = isError ? '#FF6347' : '#00FA9A'; 
    } 
}

function setPlacementMode(type, goldCost, riceCost) {
    if (GameState.isPaused) return;
    const size = (type === 'Wall' || type === 'Tower') ? 1 : 2;
    GameState.mode = 'placement_mode'; GameState.selectedBuilding = { type, goldCost, riceCost, size };
    const btnCancel = document.getElementById('btn-cancel');
    if(btnCancel) btnCancel.classList.remove('hidden'); 
    canvas.style.cursor = 'crosshair'; showMessage(`Placing ${type}...`);
}
function cancelPlacement() { 
    GameState.mode = 'normal'; GameState.selectedBuilding = null; 
    const btnCancel = document.getElementById('btn-cancel');
    if(btnCancel) btnCancel.classList.add('hidden'); 
    canvas.style.cursor = 'grab'; showMessage('Pan the map to explore!'); 
}

document.body.addEventListener('click', (e) => {
	
	if (e.target.closest('button')) {
        playSound('click'); 
    }
	
    if (e.target.closest('.build-btn')) {
        const btn = e.target.closest('.build-btn');
        if (btn.id === 'btn-cancel') { cancelPlacement(); return; }
        if (btn.id === 'btn-upgrade') {
            if (GameState.isPaused) return;
            let palace = GameState.buildings.find(b => b.type === 'Palace');
            if (!palace) return showMessage("Build a Palace first!", true);
            if (GameState.gold >= 500) { GameState.gold -= 500; GameState.palaceLevel++; palace.maxHp += 2000; palace.hp = palace.maxHp; updateDOM(); showMessage(`Palace Upgraded to Level ${GameState.palaceLevel}!`); GameState.floatingTexts.push(new FloatingText(palace.gridX+1, palace.gridY+1, `LEVEL UP!`, '#FFD700')); } 
            else { showMessage("Need 500 Gold to upgrade!", true); } return;
        }
        setPlacementMode(btn.dataset.type, parseInt(btn.dataset.costGold), parseInt(btn.dataset.costRice));
    }
});

// --- Mouse and Touch Controls ---
canvas.addEventListener('mousedown', (e) => { 
    if (e.button === 0 && GameState.mode === 'normal') { 
        isDragging = true; 
        dragStart.x = e.clientX - camera.x; 
        dragStart.y = e.clientY - camera.y; 
        canvas.style.cursor = 'grabbing'; 
    } 
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) { 
        camera.x = e.clientX - dragStart.x; camera.y = e.clientY - dragStart.y; 
        let oldX = camera.x; let oldY = camera.y; clampCamera(); 
        if (camera.x !== oldX) dragStart.x = e.clientX - camera.x;
        if (camera.y !== oldY) dragStart.y = e.clientY - camera.y; return; 
    }
    const gridPos = screenToIso(e.clientX, e.clientY); mouse.gridX = Math.floor(gridPos.x); mouse.gridY = Math.floor(gridPos.y);
});

window.addEventListener('mouseup', () => { isDragging = false; if (GameState.mode === 'normal') canvas.style.cursor = 'grab'; });

// --- UPDATED TOUCH CONTROLS FOR MOBILE (DRAG & ZOOM) ---
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        e.preventDefault(); 
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        return;
    }

    touchMoved = false;
    if (GameState.mode === 'normal') { 
        isDragging = true; 
        dragStart.x = e.touches[0].clientX - camera.x; 
        dragStart.y = e.touches[0].clientY - camera.y; 
    } else if (GameState.mode === 'placement_mode') { 
        const gridPos = screenToIso(e.touches[0].clientX, e.touches[0].clientY); 
        mouse.gridX = Math.floor(gridPos.x); 
        mouse.gridY = Math.floor(gridPos.y); 
    }
}, {passive: false});

canvas.addEventListener('touchmove', (e) => { 
    e.preventDefault(); 
    touchMoved = true; 
    
    // Zoom Logic
    if (e.touches.length === 2 && initialPinchDistance !== null) {
        let currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        let diff = currentDistance - initialPinchDistance;
        let centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        let centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        doZoom(diff * 0.005, centerX, centerY); 
        initialPinchDistance = currentDistance;
        return;
    }

    // Drag Logic
    if (isDragging && e.touches.length === 1) { 
        camera.x = e.touches[0].clientX - dragStart.x; 
        camera.y = e.touches[0].clientY - dragStart.y; 
        let oldX = camera.x; let oldY = camera.y; clampCamera(); 
        if (camera.x !== oldX) dragStart.x = e.touches[0].clientX - camera.x;
        if (camera.y !== oldY) dragStart.y = e.touches[0].clientY - camera.y;
    } 
}, {passive: false});

window.addEventListener('touchend', (e) => { 
    isDragging = false; 
    if (e.touches.length < 2) {
        initialPinchDistance = null;
    }
});

canvas.addEventListener('click', (e) => {
    if (GameState.isPaused) return; 
    if (touchMoved || (e.target && e.target.tagName === 'BUTTON')) return; 

    if (GameState.mode === 'normal') {
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (clientX === undefined && e.changedTouches) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }
        if (clientX === undefined) return;

        let exactIso = screenToIso(clientX, clientY);
        let ex = exactIso.x;
        let ey = exactIso.y;

        let clickedFriendly = null;
        let myTroops = [...GameState.soldiers, ...GameState.elephants, ...GameState.horses, ...GameState.villagers];
        for (let u of myTroops) {
            if (getDistance({x: ex, y: ey}, u) < 0.8) { 
                clickedFriendly = u; break;
            }
        }

        // --- TUTORIAL CLICK LOGIC ---
        if (clickedFriendly) {
            if (GameState.tutorialState === 'select_troop') {
                GameState.tutorialState = 'command_attack'; 
                showRoyalAdvisor([
                    "Excellent! The soldier is ready for your command.",
                    "Now, CLICK on an Enemy to order the attack!"
                ]);
            }
            GameState.selectedUnit = clickedFriendly;
            GameState.floatingTexts.push(new FloatingText(clickedFriendly.x, clickedFriendly.y, "Ready!", "#00FF00"));
            return;
        }

        if (GameState.selectedUnit) {
            let clickedEnemy = null;
            for (let en of GameState.enemies) {
                if (getDistance({x: ex, y: ey}, en) < 0.8) { clickedEnemy = en; break; }
            }

            if (GameState.tutorialState === 'command_attack') {
                GameState.tutorialState = 'done'; 
                showRoyalAdvisor([
                    "Brilliant strategy, My Lord!",
                    "Your troops will now engage the target.",
                    "Defend the Palace at all costs!"
                ]);
            }

            if (clickedEnemy) {
                GameState.selectedUnit.manualTargetEnemy = clickedEnemy;
                GameState.selectedUnit.manualTargetPos = null;
                GameState.floatingTexts.push(new FloatingText(ex, ey, "⚔️ Attack!", "#FF0000"));
            } else {
                GameState.selectedUnit.manualTargetPos = { x: ex, y: ey };
                GameState.selectedUnit.manualTargetEnemy = null;
                GameState.floatingTexts.push(new FloatingText(ex, ey, "🚩 Move", "#00FA9A"));
            }
            GameState.selectedUnit = null; 
            return;
        }
    }

    if (GameState.mode !== 'placement_mode') return;
    
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (clientX === undefined && e.changedTouches) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    }
    
    if(clientX !== undefined) { 
        const gridPos = screenToIso(clientX, clientY); 
        mouse.gridX = Math.floor(gridPos.x); mouse.gridY = Math.floor(gridPos.y); 
    }
    const { gridX: gx, gridY: gy } = mouse;
    const { type, goldCost, riceCost, size } = GameState.selectedBuilding;
    
    let isBlocked = false;
    for(let dx=0; dx<size; dx++) for(let dy=0; dy<size; dy++) if (isTileBlocked(gx+dx, gy+dy, null)) isBlocked = true;
    if (isBlocked) return showMessage("Area blocked or outside bounds!", true);

    if (GameState.gold >= goldCost && GameState.rice >= riceCost) {
        GameState.gold -= goldCost; GameState.rice -= riceCost; updateDOM();
        GameState.buildings.push(new Building(gx, gy, type));
        
		playSound('build');
		
        let spawnX = gx + size; let spawnY = gy + size;
        if (spawnX >= MAP_COLS) spawnX = gx - 1; if (spawnY >= MAP_ROWS) spawnY = gy - 1;

        if (type === 'Paddy Field') { GameState.villagers.push(new Villager(spawnX, spawnY)); }
        else if (type === 'Palace') { for(let i=0; i<3; i++) GameState.villagers.push(new Villager(spawnX, spawnY)); }
        else if (type === 'Barracks') { for(let i=0; i<2; i++) GameState.soldiers.push(new Soldier(spawnX, spawnY)); } 
        else if (type === 'Elephant Pen') { for(let i=0; i<2; i++) GameState.elephants.push(new Elephant(spawnX, spawnY)); } 
        else if (type === 'Stables') { for(let i=0; i<3; i++) GameState.horses.push(new Horse(spawnX, spawnY)); } 

        showMessage(`${type} constructed!`); cancelPlacement();
    } else showMessage("Not enough resources!", true);
});

function drawDiamond(ctx, screenX, screenY, colorTop, colorBorder) {
    ctx.beginPath(); ctx.moveTo(screenX, screenY - TILE_H / 2); ctx.lineTo(screenX + TILE_W / 2, screenY); ctx.lineTo(screenX, screenY + TILE_H / 2); ctx.lineTo(screenX - TILE_W / 2, screenY); ctx.closePath();
    ctx.fillStyle = colorTop; ctx.fill(); ctx.strokeStyle = colorBorder; ctx.lineWidth = 1; ctx.stroke();
}

function drawSigiriyaRockBase() {
    const left = isoToScreen(0, MAP_ROWS); const right = isoToScreen(MAP_COLS, 0); const bottom = isoToScreen(MAP_COLS, MAP_ROWS);
    ctx.lineWidth = 1; ctx.strokeStyle = '#050a12';
    ctx.fillStyle = '#3a2b1f'; ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(bottom.x, bottom.y + ROCK_HEIGHT); ctx.lineTo(left.x, left.y + ROCK_HEIGHT); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b1f15'; ctx.beginPath(); ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(right.x, right.y); ctx.lineTo(right.x, right.y + ROCK_HEIGHT); ctx.lineTo(bottom.x, bottom.y + ROCK_HEIGHT); ctx.fill(); ctx.stroke();
}

function drawGame() {
    try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save(); ctx.translate(camera.x, camera.y); ctx.scale(zoom, zoom);

        handleGameLogic(); 

        GameState.buildings = GameState.buildings.filter(b => b.hp > 0);
        GameState.villagers = GameState.villagers.filter(v => v.hp > 0);
        GameState.soldiers = GameState.soldiers.filter(s => s.hp > 0);
        GameState.elephants = GameState.elephants.filter(e => e.hp > 0);
        GameState.horses = GameState.horses.filter(h => h.hp > 0);
        GameState.enemies = GameState.enemies.filter(e => e.hp > 0);

        const currentLandKey = GameState.currentLand;
        const gridImg = images[currentLandKey];
        const config = GRID_IMAGE_CONFIG[currentLandKey];
        
        let useImageGrid = (imagePaths[currentLandKey] && imagePaths[currentLandKey] !== "" && gridImg && gridImg.complete && gridImg.naturalWidth > 0);

        if (useImageGrid) {
            ctx.drawImage(gridImg, config.offsetX, config.offsetY, config.width, config.height);
            
            if (GameState.mode === 'placement_mode') { 
                for (let y = 0; y < MAP_ROWS; y++) {
                    for (let x = 0; x < MAP_COLS; x++) {
                        const size = GameState.selectedBuilding.size; const bx = mouse.gridX; const by = mouse.gridY;
                        if (x >= bx && x < bx + size && y >= by && y < by + size) {
                            const pos = isoToScreen(x, y);
                            let isBlocked = false;
                            for(let dx=0; dx<size; dx++) for(let dy=0; dy<size; dy++) if (isTileBlocked(bx+dx, by+dy, null)) isBlocked = true;
                            drawDiamond(ctx, pos.x, pos.y, isBlocked ? 'rgba(255, 0, 0, 0.6)' : 'rgba(0, 255, 0, 0.6)', '#fff');
                        }
                    }
                }
            }
        } else {
            drawSigiriyaRockBase();

            for (let y = 0; y < MAP_ROWS; y++) {
                for (let x = 0; x < MAP_COLS; x++) {
                    const pos = isoToScreen(x, y); 
                    drawDiamond(ctx, pos.x, pos.y, (x + y) % 2 === 0 ? '#5A9E24' : '#4E8D1E', '#3E7017');
                    
                    if (GameState.mode === 'placement_mode') { 
                        const size = GameState.selectedBuilding.size; const bx = mouse.gridX; const by = mouse.gridY;
                        if (x >= bx && x < bx + size && y >= by && y < by + size) {
                            let isBlocked = false;
                            for(let dx=0; dx<size; dx++) for(let dy=0; dy<size; dy++) if (isTileBlocked(bx+dx, by+dy, null)) isBlocked = true;
                            drawDiamond(ctx, pos.x, pos.y, isBlocked ? 'rgba(255, 0, 0, 0.6)' : 'rgba(0, 255, 0, 0.6)', '#fff');
                        }
                    }
                }
            }
        }

        let renderQueue = [];
        
        GameState.buildings.forEach(b => { 
            if(!GameState.isPaused) b.update(); 
            let d = b.gridX + b.gridY + (b.type === 'Paddy Field' ? -0.1 : b.size * 0.8);
            renderQueue.push({ obj: b, type: 'building', depth: d }); 
        });
        
        GameState.villagers.forEach(v => { if(!GameState.isPaused) v.update(); renderQueue.push({ obj: v, type: 'villager', depth: v.x + v.y }); });
        GameState.soldiers.forEach(s => { if(!GameState.isPaused) s.update(); renderQueue.push({ obj: s, type: 'soldier', depth: s.x + s.y }); });
        GameState.elephants.forEach(el => { if(!GameState.isPaused) el.update(); renderQueue.push({ obj: el, type: 'elephant', depth: el.x + el.y }); });
        GameState.horses.forEach(h => { if(!GameState.isPaused) h.update(); renderQueue.push({ obj: h, type: 'horse', depth: h.x + h.y }); });
        GameState.enemies.forEach(e => { if(!GameState.isPaused) e.update(); renderQueue.push({ obj: e, type: 'enemy', depth: e.x + e.y }); });

        renderQueue.sort((a, b) => a.depth - b.depth);
        renderQueue.forEach(item => {
            const pos = isoToScreen(item.type === 'building' ? item.obj.gridX : item.obj.x, item.type === 'building' ? item.obj.gridY : item.obj.y);
            item.obj.draw(ctx, pos.x, pos.y);
        });

        for (let i = GameState.floatingTexts.length - 1; i >= 0; i--) {
            let ft = GameState.floatingTexts[i]; ft.draw(ctx);
            if (ft.life <= 0) GameState.floatingTexts.splice(i, 1);
        }

        // --- TUTORIAL POINTER RENDER LOGIC ---
        if (GameState.phase === 'combat' && GameState.level === 1 && !GameState.isPaused) {
            
            if (GameState.tutorialState === 'select_troop') {
                let troops = [...GameState.soldiers, ...GameState.elephants, ...GameState.horses, ...GameState.villagers];
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
            } 
            else if (GameState.tutorialState === 'command_attack' && GameState.selectedUnit) {
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

        // --- Status Text & Horizontal Layout ---
        let statusTextDiv = document.getElementById('level-status-text');
        let btnEarly = document.getElementById('btn-early-wave');

        if (GameState.phase === 'build') {
            let secs = Math.ceil(GameState.timer / 60);
            if (statusTextDiv) {
                statusTextDiv.innerHTML = `<span style="font-family:var(--font-heading); font-size:22px; color:var(--gold-primary); text-shadow: 0 2px 4px rgba(0,0,0,0.8);">👑 LEVEL ${GameState.level}</span> <span style="font-family:var(--font-body); font-size:16px; color:var(--text-main); text-shadow: 0 1px 3px rgba(0,0,0,0.8);"> | ⏳ Starts In: ${secs}s</span>`;
            }
            if (btnEarly) {
                btnEarly.style.display = 'block';
                btnEarly.innerHTML = `⚔️ START NOW (+100 Gold)`;
            }
        } else if (GameState.phase === 'combat') {
            if (statusTextDiv) {
                statusTextDiv.innerHTML = `<span style="font-family:var(--font-heading); font-size:22px; color:#FF6347; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">⚔️ LEVEL ${GameState.level}</span> <span style="font-family:var(--font-body); font-size:16px; color:var(--text-main); text-shadow: 0 1px 3px rgba(0,0,0,0.8);"> | Defeat ${GameState.enemies.length} Enemies!</span>`;
            }
            if (btnEarly) btnEarly.style.display = 'none';
        } else {
            if (statusTextDiv) statusTextDiv.innerHTML = "";
            if (btnEarly) btnEarly.style.display = 'none';
        }

    } catch (err) { console.error("Game Loop Render Error:", err); }
}

resizeCanvas(); 
updateDOM();
function gameLoop() { drawGame(); requestAnimationFrame(gameLoop); }
gameLoop();

// --- Landing page එකෙන් එද්දී Settings auto-open කරන කෝඩ් එක ---
window.addEventListener('DOMContentLoaded', () => {
    // URL එකේ අගට ?action=settings කියලා තියෙනවද බලනවා
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');

    if (action === 'settings') {
        // ගේම් එක ලෝඩ් වෙන්න පොඩි වෙලාවක් දීලා Settings Button එක Auto ඔබනවා
        setTimeout(() => {
            const settingsBtn = document.getElementById('btn-settings');
            if (settingsBtn) {
                settingsBtn.click(); 
            }
        }, 100);
    }
});
