// ============================================================
// STEEL FURY — Top-Down Tank Shooter
// Visual overhaul: baked terrain, sprite-cached tanks,
// layered explosions, dynamic lighting, atmospheric FX.
// ============================================================

(function () {
  'use strict';

  // ============ AUDIO SYSTEM ============
  const AudioSystem = (function() {
    let ctx = null;
    let masterGain = null;
    let initialized = false;
    let engineOsc = null;
    let engineGain = null;
    let engineFilter = null;
    let engineRunning = false;

    function init() {
      if (initialized) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.6;
        masterGain.connect(ctx.destination);
        initialized = true;
      } catch (e) {
        console.warn('Web Audio API not available');
      }
    }

    function ensureContext() {
      if (!initialized) init();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx !== null;
    }

    function createNoiseBuffer(duration) {
      if (!ctx) return null;
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    }

    function playGunshot(isPlayer, caliber) {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      const baseFreq = 80 + (caliber || 80) * 0.5;

      const crack = ctx.createOscillator();
      const crackGain = ctx.createGain();
      crack.type = 'square';
      crack.frequency.setValueAtTime(800, now);
      crack.frequency.exponentialRampToValueAtTime(200, now + 0.03);
      crackGain.gain.setValueAtTime(0.4, now);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      crack.connect(crackGain).connect(masterGain);
      crack.start(now); crack.stop(now + 0.05);

      const boom = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(baseFreq, now);
      boom.frequency.exponentialRampToValueAtTime(30, now + 0.15);
      boomGain.gain.setValueAtTime(0.6, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      boom.connect(boomGain).connect(masterGain);
      boom.start(now); boom.stop(now + 0.25);

      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noise.buffer = createNoiseBuffer(0.1);
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 3000;
      noiseFilter.Q.value = 2;
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
      noise.start(now); noise.stop(now + 0.1);

      const tail = ctx.createOscillator();
      const tailGain = ctx.createGain();
      tail.type = 'sawtooth';
      tail.frequency.setValueAtTime(40, now + 0.05);
      tail.frequency.exponentialRampToValueAtTime(20, now + 0.3);
      tailGain.gain.setValueAtTime(0.15, now + 0.05);
      tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      tail.connect(tailGain).connect(masterGain);
      tail.start(now + 0.05); tail.stop(now + 0.35);
    }

    function playExplosion(size) {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      const s = size || 1;

      const impact = ctx.createOscillator();
      const impactGain = ctx.createGain();
      impact.type = 'sine';
      impact.frequency.setValueAtTime(150 * s, now);
      impact.frequency.exponentialRampToValueAtTime(20, now + 0.3);
      impactGain.gain.setValueAtTime(0.7 * s, now);
      impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      impact.connect(impactGain).connect(masterGain);
      impact.start(now); impact.stop(now + 0.5);

      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noise.buffer = createNoiseBuffer(0.4);
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(5000, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(500, now + 0.3);
      noiseFilter.Q.value = 1;
      noiseGain.gain.setValueAtTime(0.5 * s, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
      noise.start(now); noise.stop(now + 0.4);

      const rumble = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      rumble.type = 'sawtooth';
      rumble.frequency.setValueAtTime(30, now + 0.1);
      rumble.frequency.exponentialRampToValueAtTime(15, now + 0.8);
      rumbleGain.gain.setValueAtTime(0.3 * s, now + 0.1);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      rumble.connect(rumbleGain).connect(masterGain);
      rumble.start(now + 0.1); rumble.stop(now + 0.9);
    }

    function playHit(penetrated) {
      if (!ensureContext()) return;
      const now = ctx.currentTime;

      if (penetrated) {
        const thud = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(200, now);
        thud.frequency.exponentialRampToValueAtTime(60, now + 0.12);
        thudGain.gain.setValueAtTime(0.5, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        thud.connect(thudGain).connect(masterGain);
        thud.start(now); thud.stop(now + 0.2);

        const sparks = ctx.createBufferSource();
        const sparksGain = ctx.createGain();
        const sparksFilter = ctx.createBiquadFilter();
        sparks.buffer = createNoiseBuffer(0.15);
        sparksFilter.type = 'highpass';
        sparksFilter.frequency.value = 4000;
        sparksFilter.Q.value = 3;
        sparksGain.gain.setValueAtTime(0.3, now);
        sparksGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        sparks.connect(sparksFilter).connect(sparksGain).connect(masterGain);
        sparks.start(now); sparks.stop(now + 0.15);
      } else {
        const ping = ctx.createOscillator();
        const pingGain = ctx.createGain();
        ping.type = 'sine';
        ping.frequency.setValueAtTime(2000, now);
        ping.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        pingGain.gain.setValueAtTime(0.25, now);
        pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        ping.connect(pingGain).connect(masterGain);
        ping.start(now); ping.stop(now + 0.15);

        const noise = ctx.createBufferSource();
        const noiseGain = ctx.createGain();
        noise.buffer = createNoiseBuffer(0.05);
        noiseGain.gain.setValueAtTime(0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        noise.connect(noiseGain).connect(masterGain);
        noise.start(now); noise.stop(now + 0.06);
      }
    }

    function startEngine() {
      if (!ensureContext() || engineRunning) return;
      const now = ctx.currentTime;
      engineOsc = ctx.createOscillator();
      engineFilter = ctx.createBiquadFilter();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.setValueAtTime(60, now);
      engineFilter.type = 'lowpass';
      engineFilter.frequency.setValueAtTime(200, now);
      engineFilter.Q.value = 2;
      engineGain.gain.setValueAtTime(0.08, now);
      engineOsc.connect(engineFilter).connect(engineGain).connect(masterGain);
      engineOsc.start();
      engineRunning = true;
    }

    function updateEngine(speed, throttle) {
      if (!engineOsc || !engineGain || !ctx) return;
      const now = ctx.currentTime;
      const freq = 40 + Math.abs(speed) * 0.8;
      const vol = 0.05 + Math.abs(throttle || 0) * 0.08;
      engineOsc.frequency.linearRampToValueAtTime(freq, now + 0.1);
      engineGain.gain.linearRampToValueAtTime(Math.min(vol, 0.15), now + 0.1);
    }

    function stopEngine() {
      if (engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; }
      engineRunning = false;
    }

    function playReload() {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      const clunk = ctx.createOscillator();
      const clunkGain = ctx.createGain();
      clunk.type = 'square';
      clunk.frequency.setValueAtTime(120, now);
      clunk.frequency.exponentialRampToValueAtTime(40, now + 0.08);
      clunkGain.gain.setValueAtTime(0.3, now);
      clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      clunk.connect(clunkGain).connect(masterGain);
      clunk.start(now); clunk.stop(now + 0.12);

      const slide = ctx.createBufferSource();
      const slideGain = ctx.createGain();
      const slideFilter = ctx.createBiquadFilter();
      slide.buffer = createNoiseBuffer(0.08);
      slideFilter.type = 'bandpass';
      slideFilter.frequency.value = 2000;
      slideFilter.Q.value = 4;
      slideGain.gain.setValueAtTime(0.2, now + 0.05);
      slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      slide.connect(slideFilter).connect(slideGain).connect(masterGain);
      slide.start(now + 0.05); slide.stop(now + 0.13);
    }

    function playAmmoDetonation() {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const delay = i * 0.15;
        const boom = ctx.createOscillator();
        const boomGain = ctx.createGain();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(100, now + delay);
        boom.frequency.exponentialRampToValueAtTime(15, now + delay + 0.4);
        boomGain.gain.setValueAtTime(0.8, now + delay);
        boomGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);
        boom.connect(boomGain).connect(masterGain);
        boom.start(now + delay); boom.stop(now + delay + 0.6);
      }
      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noise.buffer = createNoiseBuffer(0.6);
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(8000, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.5);
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
      noise.start(now); noise.stop(now + 0.7);
    }

    function playFire() {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      const fire = ctx.createBufferSource();
      const fireGain = ctx.createGain();
      const fireFilter = ctx.createBiquadFilter();
      fire.buffer = createNoiseBuffer(0.8);
      fireFilter.type = 'bandpass';
      fireFilter.frequency.value = 800;
      fireFilter.Q.value = 2;
      fireGain.gain.setValueAtTime(0.15, now);
      fireGain.gain.linearRampToValueAtTime(0.25, now + 0.3);
      fireGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      fire.connect(fireFilter).connect(fireGain).connect(masterGain);
      fire.start(now); fire.stop(now + 0.9);
    }

    function playCrewDeath() {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      const tone = ctx.createOscillator();
      const toneGain = ctx.createGain();
      tone.type = 'square';
      tone.frequency.setValueAtTime(440, now);
      tone.frequency.setValueAtTime(350, now + 0.1);
      tone.frequency.setValueAtTime(440, now + 0.2);
      tone.frequency.setValueAtTime(350, now + 0.3);
      toneGain.gain.setValueAtTime(0.2, now);
      toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      tone.connect(toneGain).connect(masterGain);
      tone.start(now); tone.stop(now + 0.45);
    }

    function playWaveAlert() {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const beep = ctx.createOscillator();
        const beepGain = ctx.createGain();
        beep.type = 'square';
        beep.frequency.setValueAtTime(600, now + i * 0.2);
        beepGain.gain.setValueAtTime(0.2, now + i * 0.2);
        beepGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.1);
        beep.connect(beepGain).connect(masterGain);
        beep.start(now + i * 0.2); beep.stop(now + i * 0.2 + 0.12);
      }
    }

    function playGameOver() {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      const tone = ctx.createOscillator();
      const toneGain = ctx.createGain();
      tone.type = 'sawtooth';
      tone.frequency.setValueAtTime(300, now);
      tone.frequency.exponentialRampToValueAtTime(50, now + 1.5);
      toneGain.gain.setValueAtTime(0.3, now);
      toneGain.gain.linearRampToValueAtTime(0.001, now + 1.5);
      tone.connect(toneGain).connect(masterGain);
      tone.start(now); tone.stop(now + 1.6);
      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      noise.buffer = createNoiseBuffer(1.5);
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.linearRampToValueAtTime(0.001, now + 1.5);
      noise.connect(noiseGain).connect(masterGain);
      noise.start(now); noise.stop(now + 1.6);
    }

    function playTurretMotor() {
      if (!ensureContext()) return;
      const now = ctx.currentTime;
      const motor = ctx.createOscillator();
      const motorGain = ctx.createGain();
      motor.type = 'sawtooth';
      motor.frequency.setValueAtTime(120, now);
      motor.frequency.linearRampToValueAtTime(180, now + 0.2);
      motorGain.gain.setValueAtTime(0.08, now);
      motorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      motor.connect(motorGain).connect(masterGain);
      motor.start(now); motor.stop(now + 0.3);
    }

    return {
      init, playGunshot, playExplosion, playHit,
      startEngine, updateEngine, stopEngine,
      playReload, playAmmoDetonation, playFire,
      playCrewDeath, playWaveAlert, playGameOver, playTurretMotor
    };
  })();

  // ============ CANVAS & STATE ============
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const minimap = document.getElementById('minimap');
  const mctx = minimap.getContext('2d');

  const W = 1280, H = 720;
  canvas.width = W; canvas.height = H;

  let gameRunning = false;
  let gameTime = 0;
  let lastTime = 0;
  let shakeTimer = 0, shakeIntensity = 0;

  // ---- render caches ----
  const spriteCache = {};
  let terrainLayer = null;
  let terrainCtx = null;
  let vignetteLayer = null;
  let smokeSprite = null;
  let glowSprite = null;

  const MAX_PARTICLES = 1500;

  // ============ TANK TYPES ============
  // `pivot` = peak yaw rate (rad/s) for a neutral-steer turn on the spot.
  const TANK_TYPES = [
    { id: 'panzer',  name: 'Panzer IV', color: '#5a5a3a', accent: '#7a7a5a', gunColor: '#3a3a1a', speed: 2.6, pivot: 2.00, armor: { front: 50, side: 30, rear: 20, turret: 45 }, gun: { caliber: 75, pen: 95, damage: 580, reload: 5.0, range: 750 }, size: { w: 32, l: 58 }, turretR: 13, barrel: 38 },
    { id: 'panther', name: 'Panther',   color: '#4a4a2a', accent: '#6a6a4a', gunColor: '#2a2a0a', speed: 2.4, pivot: 1.80, armor: { front: 80, side: 50, rear: 40, turret: 70 }, gun: { caliber: 75, pen: 120, damage: 720, reload: 6.5, range: 900 }, size: { w: 40, l: 72 }, turretR: 16, barrel: 54 },
    { id: 'tiger',   name: 'Tiger I',   color: '#5a4a2a', accent: '#7a6a4a', gunColor: '#3a2a0a', speed: 2.0, pivot: 1.55, armor: { front: 100, side: 80, rear: 60, turret: 90 }, gun: { caliber: 88, pen: 145, damage: 920, reload: 7.5, range: 1000 }, size: { w: 44, l: 72 }, turretR: 19, barrel: 54 },
    { id: 't34',     name: 'T-34-85',   color: '#4a5e2a', accent: '#6a7e4a', gunColor: '#2a3e1a', speed: 2.5, pivot: 2.15, armor: { front: 45, side: 40, rear: 30, turret: 55 }, gun: { caliber: 85, pen: 105, damage: 680, reload: 6.0, range: 800 }, size: { w: 34, l: 66 }, turretR: 15, barrel: 46 },
    { id: 't44',     name: 'T-44',      color: '#3a4e1a', accent: '#5a6e3a', gunColor: '#1a2e0a', speed: 2.7, pivot: 2.05, armor: { front: 70, side: 50, rear: 40, turret: 75 }, gun: { caliber: 85, pen: 115, damage: 700, reload: 5.5, range: 850 }, size: { w: 38, l: 64 }, turretR: 16, barrel: 44 },
    { id: 'is2',     name: 'IS-2',      color: '#2a3e1a', accent: '#4a5e3a', gunColor: '#0a1e00', speed: 2.1, pivot: 1.50, armor: { front: 90, side: 70, rear: 50, turret: 85 }, gun: { caliber: 122, pen: 155, damage: 1100, reload: 9.0, range: 1100 }, size: { w: 36, l: 76 }, turretR: 18, barrel: 68 },
  ];

  // ============ AMMO TYPES ============
  const AMMO_TYPES = {
    AP: { name: 'AP', color: '#ffaa44', splash: 0, penMult: 1.0, crewDmg: 0.6 },
    HE: { name: 'HE', color: '#ff6633', splash: 60, penMult: 0.35, crewDmg: 2.0 },
  };

  // ============ ENTITY POOLS ============
  let bullets = [];
  let bullets_player = [];
  let enemies = [];
  let particles = [];
  let explosions = [];
  let damageNumbers = [];
  let player = null;
  let score = 0;
  let killCount = 0;
  let wave = 1;
  let spawnTimer = 0;

  // ---- Wave state machine ----
  let waveState = 'intermission';   // 'intermission' | 'active'
  let intermissionTimer = 3.0;
  let waveEnemiesRemaining = 0;
  let currentWaveConfig = null;
  let aiSkill = 0.5;                // 0..1, drives enemy accuracy/patience

  // ============ INPUT ============
  const keys = {};
  let mouseX = W / 2, mouseY = H / 2;
  let mouseDown = false;
  let lastFire = 0;

  // ============ CAMERA ============
  const cam = { x: 0, y: 0 };

  // ============ MAP ============
  const MAP_W = 3000, MAP_H = 3000;
  let obstacles = [];
  let ammoZones = [];

  // ============================================================
  // CANVAS HELPERS
  // ============================================================

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function shade(hex, mult) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * mult)));
    gg = Math.max(0, Math.min(255, Math.round(gg * mult)));
    b = Math.max(0, Math.min(255, Math.round(b * mult)));
    return `rgb(${r},${gg},${b})`;
  }

  function makeFlashVersion(srcCanvas) {
    const c = makeCanvas(srcCanvas.width, srcCanvas.height);
    const g = c.getContext('2d');
    g.drawImage(srcCanvas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function makeDarkVersion(srcCanvas, amount) {
    const c = makeCanvas(srcCanvas.width, srcCanvas.height);
    const g = c.getContext('2d');
    g.drawImage(srcCanvas, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(0,0,0,${amount})`;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

    // ============================================================
  // TANK SILHOUETTES — distinct hull & turret profiles per vehicle
  //   Hull points   : x = -1 (rear) .. +1 (front), y = -1 (left) .. +1 (right)
  //   Turret points : normalised to turret radius (1.0 == type.turretR)
  // ============================================================
  const TANK_SILHOUETTES = {
    // ---- Panzer IV : slab-sided box hull, angular turret with rear bustle ----
    panzer: {
      hull: [
        [-1.00, -1.00], [ 0.70, -1.00], [ 0.92, -0.88], [ 1.00, -0.58],
        [ 1.00,  0.58], [ 0.92,  0.88], [ 0.70,  1.00], [-1.00,  1.00],
      ],
      fender: { front: 0.70, rear: -1.00 },
      turret: {
        pts: [
          [ 1.00, -0.42], [ 0.70, -0.82], [-0.26, -0.92], [-1.00, -0.74],
          [-1.00,  0.74], [-0.26,  0.92], [ 0.70,  0.82], [ 1.00,  0.42],
        ],
        mantlet:  { w: 11, h: 12.5 },
        barrelW:  6.2,
        muzzle:   'single',
        cupola:   { x: -0.38, y: -0.42, r: 0.34 },
        hatches:  [{ x: 0.32, y: 0.44, r: 0.26 }],
        vents:    [],
      },
    },

    // ---- Panther : long sloped hull, rounded-front turret w/ flat rear ----
    panther: {
      hull: [
        [-1.00, -1.00], [ 0.62, -1.00], [ 0.88, -0.86], [ 0.98, -0.48],
        [ 0.98,  0.48], [ 0.88,  0.86], [ 0.62,  1.00], [-1.00,  1.00],
      ],
      fender: { front: 0.62, rear: -1.00 },
      turret: {
        pts: [
          [ 1.00, -0.38], [ 0.80, -0.76], [ 0.24, -0.94], [-0.62, -0.88],
          [-0.88, -0.58], [-0.88,  0.58], [-0.62,  0.88], [ 0.24,  0.94],
          [ 0.80,  0.76], [ 1.00,  0.38],
        ],
        mantlet:  { w: 12, h: 13 },
        barrelW:  6.6,
        muzzle:   'double',
        cupola:   { x: -0.34, y: -0.40, r: 0.32 },
        hatches:  [{ x: 0.34, y: 0.40, r: 0.26 }],
        vents:    [],
      },
    },

    // ---- Tiger I : big boxy hull, wide horseshoe turret ----
    tiger: {
      hull: [
        [-1.00, -1.00], [ 0.80, -1.00], [ 0.96, -0.90], [ 1.00, -0.60],
        [ 1.00,  0.60], [ 0.96,  0.90], [ 0.80,  1.00], [-1.00,  1.00],
      ],
      fender: { front: 0.80, rear: -1.00 },
      turret: {
        pts: [
          [ 0.96, -0.36], [ 0.84, -0.74], [ 0.40, -0.94], [-0.34, -1.00],
          [-0.82, -0.78], [-0.96, -0.42], [-0.96,  0.42], [-0.82,  0.78],
          [-0.34,  1.00], [ 0.40,  0.94], [ 0.84,  0.74], [ 0.96,  0.36],
        ],
        mantlet:  { w: 13, h: 14 },
        barrelW:  6.8,
        muzzle:   'double',
        cupola:   { x: -0.32, y: -0.44, r: 0.36 },
        hatches:  [{ x: 0.34, y: 0.46, r: 0.26 }],
        vents:    [],
      },
    },

    // ---- T-34-85 : sloped hull w/ big front chamfers, hexagonal turret ----
    t34: {
      hull: [
        [-0.90, -1.00], [ 0.56, -1.00], [ 0.88, -0.74], [ 0.98, -0.36],
        [ 0.98,  0.36], [ 0.88,  0.74], [ 0.56,  1.00], [-0.90,  1.00],
        [-1.00,  0.86], [-1.00, -0.86],
      ],
      fender: { front: 0.56, rear: -0.90 },
      turret: {
        pts: [
          [ 1.00, -0.24], [ 0.82, -0.68], [ 0.34, -0.90], [-0.42, -0.94],
          [-0.86, -0.66], [-0.92, -0.26], [-0.92,  0.26], [-0.86,  0.66],
          [-0.42,  0.94], [ 0.34,  0.90], [ 0.82,  0.68], [ 1.00,  0.24],
        ],
        mantlet:  { w: 12, h: 13 },
        barrelW:  6.4,
        muzzle:   'none',
        cupola:   null,
        hatches:  [
          { x: -0.10, y: -0.44, r: 0.30 },
          { x:  0.34, y:  0.36, r: 0.26 },
        ],
        vents:    [{ x: -0.46, y: 0.02, r: 0.16 }],
      },
    },

    // ---- T-44 : low sloped hull, angular rounded-front turret ----
    t44: {
      hull: [
        [-0.92, -1.00], [ 0.52, -1.00], [ 0.86, -0.72], [ 0.98, -0.32],
        [ 0.98,  0.32], [ 0.86,  0.72], [ 0.52,  1.00], [-0.92,  1.00],
        [-1.00,  0.86], [-1.00, -0.86],
      ],
      fender: { front: 0.52, rear: -0.92 },
      turret: {
        pts: [
          [ 1.00, -0.16], [ 0.68, -0.74], [ 0.10, -0.94], [-0.56, -0.88],
          [-0.88, -0.52], [-0.92,  0.00], [-0.88,  0.52], [-0.56,  0.88],
          [ 0.10,  0.94], [ 0.68,  0.74], [ 1.00,  0.16],
        ],
        mantlet:  { w: 12, h: 12.5 },
        barrelW:  6.4,
        muzzle:   'none',
        cupola:   { x: -0.40, y: -0.34, r: 0.28 },
        hatches:  [{ x: 0.28, y: 0.38, r: 0.26 }],
        vents:    [],
      },
    },

    // ---- IS-2 : heavy boxy hull, big cast oval turret ----
    is2: {
      hull: [
        [-1.00, -1.00], [ 0.58, -1.00], [ 0.88, -0.82], [ 1.00, -0.42],
        [ 1.00,  0.42], [ 0.88,  0.82], [ 0.58,  1.00], [-1.00,  1.00],
      ],
      fender: { front: 0.58, rear: -1.00 },
      turret: {
        pts: [
          [ 0.94, -0.42], [ 0.76, -0.78], [ 0.26, -0.96], [-0.46, -0.96],
          [-0.84, -0.72], [-0.96, -0.34], [-0.96,  0.34], [-0.84,  0.72],
          [-0.46,  0.96], [ 0.26,  0.96], [ 0.76,  0.78], [ 0.94,  0.42],
        ],
        mantlet:  { w: 14, h: 15 },
        barrelW:  8.0,
        muzzle:   'is2',
        cupola:   { x: -0.38, y: -0.42, r: 0.32 },
        hatches:  [{ x: 0.32, y: 0.42, r: 0.28 }],
        vents:    [],
      },
    },
  };

  // Build a closed Path2D from a normalised point list.
  function polyPath(pts, sx, sy) {
    const p = new Path2D();
    p.moveTo(pts[0][0] * sx, pts[0][1] * sy);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0] * sx, pts[i][1] * sy);
    p.closePath();
    return p;
  }

  // Per-vehicle muzzle device: 'none' | 'single' | 'double' | 'is2'
  function drawMuzzleBrake(tg, barrelLen, bw, style) {
    const half = bw / 2;

    // ---- bare muzzle (T-34-85 / T-44) ----
    if (!style || style === 'none') {
      tg.fillStyle = 'rgba(0,0,0,0.55)';
      tg.fillRect(barrelLen - 2.5, -half, 2.5, bw);
      tg.fillStyle = 'rgba(255,255,255,0.10)';
      tg.fillRect(barrelLen - 4.5, -half, 2, 1.2);
      return;
    }

    // ---- single-baffle (Panzer IV) ----
    if (style === 'single') {
      const len = Math.max(8, barrelLen * 0.14);
      const x = barrelLen - len;
      tg.fillStyle = '#0d0f11';
      roundRect(tg, x, -half * 1.55, len, bw * 1.55, 1.5);
      tg.fill();
      tg.fillStyle = 'rgba(255,255,255,0.12)';
      tg.fillRect(x, -half * 1.55, len, 1.3);
      tg.fillStyle = 'rgba(0,0,0,0.7)';
      tg.fillRect(x + len * 0.26, -half * 1.55, len * 0.24, half * 0.80);
      tg.fillRect(x + len * 0.26,  half * 0.75, len * 0.24, half * 0.80);
      tg.fillStyle = '#050607';
      tg.fillRect(barrelLen - 2.5, -half, 2.5, bw);
      return;
    }

    // ---- double-baffle (Panther / Tiger) ----
    if (style === 'double') {
      const len = Math.max(11, barrelLen * 0.17);
      const x0  = barrelLen - len;
      const seg = len * 0.38;
      const gap = len * 0.24;
      for (let i = 0; i < 2; i++) {
        const x = x0 + i * (seg + gap);
        tg.fillStyle = '#0d0f11';
        roundRect(tg, x, -half * 1.6, seg, bw * 1.6, 1.5);
        tg.fill();
        tg.fillStyle = 'rgba(255,255,255,0.13)';
        tg.fillRect(x, -half * 1.6, seg, 1.3);
        tg.fillStyle = 'rgba(0,0,0,0.7)';
        tg.fillRect(x + seg * 0.30, -half * 1.6, seg * 0.22, half * 0.85);
        tg.fillRect(x + seg * 0.30,  half * 0.75, seg * 0.22, half * 0.85);
      }
      tg.fillStyle = '#050607';
      tg.fillRect(barrelLen - 2.5, -half, 2.5, bw);
      return;
    }

    // ---- IS-2 twin-slot brake ----
    if (style === 'is2') {
      const len = Math.max(13, barrelLen * 0.16);
      const x = barrelLen - len;
      tg.fillStyle = '#0d0f11';
      roundRect(tg, x, -half * 1.7, len, bw * 1.7, 2);
      tg.fill();
      tg.fillStyle = 'rgba(255,255,255,0.12)';
      tg.fillRect(x, -half * 1.7, len, 1.4);
      tg.fillStyle = 'rgba(0,0,0,0.82)';
      tg.fillRect(x + len * 0.14, -half * 1.7, len * 0.24, half * 1.15);
      tg.fillRect(x + len * 0.14,  half * 0.55, len * 0.24, half * 1.15);
      tg.fillRect(x + len * 0.56, -half * 1.7, len * 0.24, half * 1.15);
      tg.fillRect(x + len * 0.56,  half * 0.55, len * 0.24, half * 1.15);
      tg.fillStyle = '#050607';
      tg.fillRect(barrelLen - 2.5, -half, 2.5, bw);
    }
  }

    // ============================================================
  // SPRITE FACTORY — build detailed tank sprites once
  // ============================================================
  function buildTankSprites() {
    for (const type of TANK_TYPES) {
      const sil = TANK_SILHOUETTES[type.id];
      const hl = type.size.l, hw = type.size.w;
      const tw = Math.max(8, hw * 0.26);
      const padX = 10, padY = 8;
      const cw = hl + padX * 2;
      // Tracks are tucked under the hull now, so the sprite's vertical
      // extent is set by the 3.5px fender overhang on each side, not
      // by the track band.
      const ch = hw + 7 + padY * 2;

      const cv = makeCanvas(cw, ch);
      const g = cv.getContext('2d');
      g.translate(cw / 2, ch / 2);

      const halfL = hl / 2, halfW = hw / 2;
      // Track centreline is INSIDE the hull edge. Track band now spans
      //   inner  = halfW - tw * 0.68
      //   outer  = halfW + tw * 0.32
      // so only ~30% of the track pokes past the hull, and the fender
      // drawn further down covers the exposed sliver.
      const trackY = halfW - tw * 0.18;

      // ---------------- TRACKS ---------------- (unchanged)
      for (const s of [-1, 1]) {
        const y = trackY * s;

        g.fillStyle = '#0a0b0c';
        roundRect(g, -halfL - 2, y - tw / 2, hl + 4, tw, tw * 0.4);
        g.fill();

        g.fillStyle = '#1d2023';
        for (let x = -halfL - 1; x < halfL + 1; x += 6) {
          g.fillRect(x, y - tw / 2 + 1, 3.5, tw - 2);
        }

        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(-halfL - 2, y - tw / 2, hl + 4, 1.2);

        const n = Math.max(4, Math.round(hl / 13));
        for (let i = 0; i < n; i++) {
          const wx = -halfL + 5 + (i / (n - 1)) * (hl - 10);
          g.fillStyle = '#15181a';
          g.beginPath(); g.arc(wx, y, tw * 0.44, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#2c3135';
          g.beginPath(); g.arc(wx, y, tw * 0.26, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.12)';
          g.beginPath(); g.arc(wx - tw * 0.09, y - tw * 0.09, tw * 0.10, 0, Math.PI * 2); g.fill();
        }
      }

      // ---------------- HULL ----------------
      // Distinct silhouette per vehicle (box / tapered / sloped / pike nose)
      const hullPath = polyPath(sil.hull, halfL, halfW);

      const hullGrad = g.createLinearGradient(0, -halfW, 0, halfW);
      hullGrad.addColorStop(0, shade(type.color, 1.45));
      hullGrad.addColorStop(0.35, shade(type.color, 1.05));
      hullGrad.addColorStop(0.75, shade(type.color, 0.75));
      hullGrad.addColorStop(1, shade(type.color, 0.5));

      g.fillStyle = hullGrad;
      g.fill(hullPath);
      g.strokeStyle = shade(type.accent, 0.55);
      g.lineWidth = 1.5;
      g.stroke(hullPath);

      // camo blobs, clipped to whatever the hull shape is
      g.save();
      g.clip(hullPath);
      for (let i = 0; i < 9; i++) {
        const bx = (Math.random() - 0.5) * hl;
        const by = (Math.random() - 0.5) * hw;
        const br = 5 + Math.random() * 13;
        g.fillStyle = i % 3 === 0
          ? `rgba(255,255,255,0.07)`
          : `rgba(0,0,0,0.16)`;
        g.beginPath();
        g.ellipse(bx, by, br, br * 0.65, Math.random() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();

      // Everything below is clipped to the hull outline so nothing
      // pokes over a tapered nose / pike front.
      g.save();
      g.clip(hullPath);

      // front glacis sheen (follows the hull front, whatever its shape)
      const gl = g.createLinearGradient(halfL * 0.40, 0, halfL, 0);
      gl.addColorStop(0, 'rgba(255,255,255,0)');
      gl.addColorStop(1, 'rgba(255,255,255,0.14)');
      g.fillStyle = gl;
      g.fillRect(halfL * 0.40, -halfW, halfL * 0.60, halfW * 2);

      // rear engine-deck grilles
      g.fillStyle = 'rgba(0,0,0,0.42)';
      for (let i = 0; i < 4; i++) {
        g.fillRect(-halfL + 4, -halfW + 5 + i * ((hw - 10) / 4), 11, 3);
      }
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 4; i++) {
        g.fillRect(-halfL + 4, -halfW + 5 + i * ((hw - 10) / 4) - 1, 11, 1);
      }

      // driver hatch
      g.fillStyle = 'rgba(0,0,0,0.30)';
      roundRect(g, halfL * 0.42, -halfW * 0.72, 9, 8, 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.13)';
      g.lineWidth = 1;
      g.stroke();

      // tow hooks
      g.fillStyle = '#20242a';
      g.fillRect(halfL - 4, -halfW + 3, 5, 4);
      g.fillRect(halfL - 4, halfW - 7, 5, 4);

      g.restore();

      // fenders over tracks — length follows the hull's straight sides
      const fFront = halfL * (sil.fender ? sil.fender.front : 0.85);
      const fRear  = halfL * (sil.fender ? sil.fender.rear  : -1.00);
      g.fillStyle = shade(type.color, 0.62);
      g.fillRect(fRear, -halfW - 3.5, fFront - fRear, 3.5);
      g.fillRect(fRear,  halfW,       fFront - fRear, 3.5);
      g.fillStyle = 'rgba(255,255,255,0.09)';
      g.fillRect(fRear, -halfW - 3.5, fFront - fRear, 1);

      // rivets — dashed round-cap stroke along an inset copy of the hull
      g.save();
      g.setLineDash([0.1, 12]);
      g.lineCap = 'round';
      g.lineWidth = 2.4;
      g.strokeStyle = 'rgba(255,255,255,0.16)';
      g.stroke(polyPath(sil.hull, halfL * 0.93, halfW * 0.90));
      g.restore();

      // ---------------- TURRET ----------------
      const tc = sil.turret;
      const tr = type.turretR;
      const barrelLen = type.barrel;
      const tox = tr + 8;
      const tcw = tox + barrelLen + 14;
      const tch = tr * 2 + 16;
      const tcv = makeCanvas(tcw, tch);
      const tg = tcv.getContext('2d');
      tg.translate(tox, tch / 2);

      const bw = tc.barrelW || 6.4;
      const halfBw = bw / 2;

      // barrel
      const barrelGrad = tg.createLinearGradient(0, -halfBw, 0, halfBw);
      barrelGrad.addColorStop(0, shade(type.gunColor, 1.6));
      barrelGrad.addColorStop(0.5, type.gunColor);
      barrelGrad.addColorStop(1, shade(type.gunColor, 0.55));
      tg.fillStyle = barrelGrad;
      tg.fillRect(tr * 0.35, -halfBw, barrelLen - tr * 0.35, bw);

      // barrel highlight
      tg.fillStyle = 'rgba(255,255,255,0.14)';
      tg.fillRect(tr * 0.35, -halfBw, barrelLen - tr * 0.35, bw * 0.22);

      // muzzle device (per-vehicle)
      drawMuzzleBrake(tg, barrelLen, bw, tc.muzzle);

      // mantlet (per-vehicle size)
      const mt = tc.mantlet || { w: 11, h: 12.4 };
      tg.fillStyle = shade(type.color, 0.85);
      roundRect(tg, tr * 0.32, -mt.h / 2, mt.w, mt.h, 2.5);
      tg.fill();
      tg.strokeStyle = shade(type.accent, 0.6);
      tg.lineWidth = 1.2;
      tg.stroke();

      // turret body — unique polygon per vehicle
      const turretPath = polyPath(tc.pts, tr, tr);

      const tGrad = tg.createRadialGradient(-tr * 0.35, -tr * 0.35, tr * 0.15, 0, 0, tr * 1.35);
      tGrad.addColorStop(0, shade(type.color, 1.5));
      tGrad.addColorStop(0.55, shade(type.color, 1.0));
      tGrad.addColorStop(1, shade(type.color, 0.6));

      tg.fillStyle = tGrad;
      tg.fill(turretPath);
      tg.strokeStyle = shade(type.accent, 0.6);
      tg.lineWidth = 1.6;
      tg.stroke(turretPath);

      // turret camo
      tg.save();
      tg.clip(turretPath);
      for (let i = 0; i < 7; i++) {
        const bx = (Math.random() - 0.5) * tr * 1.7;
        const by = (Math.random() - 0.5) * tr * 1.7;
        const br = 3 + Math.random() * tr * 0.65;
        tg.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)';
        tg.beginPath();
        tg.ellipse(bx, by, br, br * 0.65, Math.random() * Math.PI, 0, Math.PI * 2);
        tg.fill();
      }
      tg.restore();

      // roof vents / domes (drawn first, sit under the hatches)
      if (tc.vents) {
        for (const v of tc.vents) {
          tg.fillStyle = 'rgba(0,0,0,0.28)';
          tg.beginPath();
          tg.arc(v.x * tr, v.y * tr, v.r * tr, 0, Math.PI * 2);
          tg.fill();
          tg.strokeStyle = 'rgba(255,255,255,0.10)';
          tg.lineWidth = 0.9;
          tg.stroke();
        }
      }

      // roof hatches
      if (tc.hatches) {
        for (const h of tc.hatches) {
          tg.fillStyle = 'rgba(0,0,0,0.32)';
          tg.beginPath();
          tg.arc(h.x * tr, h.y * tr, h.r * tr, 0, Math.PI * 2);
          tg.fill();
          tg.strokeStyle = 'rgba(255,255,255,0.13)';
          tg.lineWidth = 1;
          tg.stroke();
        }
      }

      // commander's cupola (Panzer IV / Panther / Tiger / T-44 / IS-2)
      if (tc.cupola) {
        const c = tc.cupola;
        const cx = c.x * tr, cy = c.y * tr, cr = c.r * tr;

        tg.fillStyle = shade(type.color, 1.22);
        tg.beginPath(); tg.arc(cx, cy, cr, 0, Math.PI * 2); tg.fill();
        tg.strokeStyle = 'rgba(0,0,0,0.45)';
        tg.lineWidth = 1.3;
        tg.stroke();

        // vision blocks around the rim
        tg.fillStyle = 'rgba(120,190,220,0.38)';
        for (let i = 0; i < 5; i++) {
          const a = -1.1 + i * 0.55;
          tg.beginPath();
          tg.arc(cx + Math.cos(a) * cr * 0.70,
                 cy + Math.sin(a) * cr * 0.70, 1.5, 0, Math.PI * 2);
          tg.fill();
        }

        // hatch lid
        tg.fillStyle = 'rgba(0,0,0,0.40)';
        tg.beginPath(); tg.arc(cx, cy, cr * 0.46, 0, Math.PI * 2); tg.fill();
      }

      // antenna
      tg.strokeStyle = 'rgba(30,30,30,0.9)';
      tg.lineWidth = 1.3;
      tg.beginPath();
      tg.moveTo(-tr * 0.72, -tr * 0.55);
      tg.lineTo(-tr * 1.15, -tr * 1.02);
      tg.stroke();

      // ---------------- CACHE ----------------
      spriteCache[type.id] = {
        hull: cv,
        hullFlash: makeFlashVersion(cv),
        hullWreck: makeDarkVersion(cv, 0.72),
        turret: tcv,
        turretFlash: makeFlashVersion(tcv),
        turretOX: tox,
        hullW: cw,
        hullH: ch,
      };
    }
  }

  // ============================================================
  // ATMOSPHERIC SPRITES
  // ============================================================

  function buildAtmosphericSprites() {
    const s = 96;
    smokeSprite = makeCanvas(s, s);
    let g = smokeSprite.getContext('2d');
    let grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(170,168,162,0.70)');
    grad.addColorStop(0.45, 'rgba(110,108,104,0.34)');
    grad.addColorStop(1, 'rgba(60,58,55,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);

    glowSprite = makeCanvas(s, s);
    g = glowSprite.getContext('2d');
    grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,240,190,1)');
    grad.addColorStop(0.25, 'rgba(255,170,70,0.75)');
    grad.addColorStop(0.6, 'rgba(255,90,20,0.28)');
    grad.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);

    // vignette (screen space)
    vignetteLayer = makeCanvas(W, H);
    g = vignetteLayer.getContext('2d');
    grad = g.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 1.02);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0.68)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

  // ============================================================
  // TERRAIN BAKING
  // ============================================================

  function traceRoad(g, ax, ay, bx, by, cpx, cpy) {
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo(cpx, cpy, bx, by);
  }

  function buildTerrainLayer(towns) {
    terrainLayer = makeCanvas(MAP_W, MAP_H);
    terrainCtx = terrainLayer.getContext('2d');
    const g = terrainCtx;

    // ---- base gradient ----
    const baseGrad = g.createLinearGradient(0, 0, MAP_W, MAP_H);
    baseGrad.addColorStop(0, '#242b19');
    baseGrad.addColorStop(0.45, '#2c3321');
    baseGrad.addColorStop(1, '#1e2417');
    g.fillStyle = baseGrad;
    g.fillRect(0, 0, MAP_W, MAP_H);

    // ---- large soft mottling ----
    const palette = [
      'rgba(60,74,40,0.55)', 'rgba(44,54,32,0.60)', 'rgba(74,68,44,0.42)',
      'rgba(36,44,30,0.55)', 'rgba(84,78,50,0.30)', 'rgba(30,38,26,0.55)',
      'rgba(52,60,38,0.45)'
    ];
    for (let i = 0; i < 480; i++) {
      const x = Math.random() * MAP_W;
      const y = Math.random() * MAP_H;
      const r = 50 + Math.random() * 240;
      const c = palette[(Math.random() * palette.length) | 0];
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    // ---- dirt roads between towns ----
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let i = 0; i < towns.length; i++) {
      for (let j = i + 1; j < towns.length; j++) {
        if (Math.random() > 0.5) continue;
        const a = towns[i], b = towns[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 1700) continue;
        const cpx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 340;
        const cpy = (a.y + b.y) / 2 + (Math.random() - 0.5) * 340;

        g.strokeStyle = 'rgba(52,46,32,0.55)';
        g.lineWidth = 76;
        traceRoad(g, a.x, a.y, b.x, b.y, cpx, cpy);
        g.stroke();

        g.strokeStyle = 'rgba(96,84,58,0.62)';
        g.lineWidth = 56;
        traceRoad(g, a.x, a.y, b.x, b.y, cpx, cpy);
        g.stroke();

        g.strokeStyle = 'rgba(122,106,74,0.32)';
        g.lineWidth = 34;
        traceRoad(g, a.x, a.y, b.x, b.y, cpx, cpy);
        g.stroke();

        // wheel ruts
        g.strokeStyle = 'rgba(56,48,32,0.42)';
        g.lineWidth = 5;
        g.setLineDash([18, 14]);
        traceRoad(g, a.x, a.y, b.x, b.y, cpx, cpy);
        g.stroke();
        g.setLineDash([]);
      }
    }

    // ---- gravel specks ----
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * MAP_W;
      const y = Math.random() * MAP_H;
      const r = 0.6 + Math.random() * 1.7;
      const v = Math.random();
      g.fillStyle = v > 0.6
        ? `rgba(150,142,116,${0.05 + Math.random() * 0.10})`
        : `rgba(20,22,16,${0.06 + Math.random() * 0.12})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    // ---- grass tufts ----
    g.lineWidth = 1;
    for (let i = 0; i < 3400; i++) {
      const x = Math.random() * MAP_W;
      const y = Math.random() * MAP_H;
      const len = 3 + Math.random() * 6;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
      const green = 60 + Math.random() * 60;
      g.strokeStyle = `rgba(${Math.round(green * 0.55)},${Math.round(green)},${Math.round(green * 0.35)},${0.10 + Math.random() * 0.18})`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }

    // ---- subtle grain overlay ----
    const grain = makeCanvas(256, 256);
    const gg = grain.getContext('2d');
    const img = gg.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 14;
    }
    gg.putImageData(img, 0, 0);
    const pat = g.createPattern(grain, 'repeat');
    g.fillStyle = pat;
    g.fillRect(0, 0, MAP_W, MAP_H);

    // ---- map edge darkening ----
    const edge = g.createLinearGradient(0, 0, 0, 220);
    edge.addColorStop(0, 'rgba(0,0,0,0.55)');
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge;
    g.fillRect(0, 0, MAP_W, 220);

    const edge2 = g.createLinearGradient(0, MAP_H, 0, MAP_H - 220);
    edge2.addColorStop(0, 'rgba(0,0,0,0.55)');
    edge2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge2;
    g.fillRect(0, MAP_H - 220, MAP_W, 220);

    const edge3 = g.createLinearGradient(0, 0, 220, 0);
    edge3.addColorStop(0, 'rgba(0,0,0,0.55)');
    edge3.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge3;
    g.fillRect(0, 0, 220, MAP_H);

    const edge4 = g.createLinearGradient(MAP_W, 0, MAP_W - 220, 0);
    edge4.addColorStop(0, 'rgba(0,0,0,0.55)');
    edge4.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge4;
    g.fillRect(MAP_W - 220, 0, 220, MAP_H);
  }

  // ---- permanent ground decals ----
  function stampScorch(x, y, r, alpha) {
    if (!terrainCtx) return;
    const g = terrainCtx;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(8,6,4,${alpha})`);
    grad.addColorStop(0.45, `rgba(18,13,8,${alpha * 0.6})`);
    grad.addColorStop(0.8, `rgba(28,22,14,${alpha * 0.2})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function stampTrack(x, y, angle) {
    if (!terrainCtx) return;
    const g = terrainCtx;
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = 'rgba(24,20,14,0.30)';
    g.fillRect(-4, -2, 8, 4);
    g.restore();
  }

  // ============================================================
  // MAP GENERATION
  // ============================================================

  function generateMap() {
    obstacles = [];
    ammoZones = [];
    const towns = [];
    for (let t = 0; t < 6; t++) {
      towns.push({
        x: 300 + Math.random() * (MAP_W - 600),
        y: 300 + Math.random() * (MAP_H - 600),
        size: 150 + Math.random() * 200
      });
    }

    buildTerrainLayer(towns);

    for (const town of towns) {
      const numBuildings = 5 + Math.floor(Math.random() * 8);
      for (let i = 0; i < numBuildings; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * town.size;
        const bx = town.x + Math.cos(angle) * dist;
        const by = town.y + Math.sin(angle) * dist;
        const bw = 40 + Math.random() * 80;
        const bh = 40 + Math.random() * 80;
        if (bx > 50 && bx + bw < MAP_W - 50 && by > 50 && by + bh < MAP_H - 50) {
          obstacles.push({
            x: bx - bw / 2, y: by - bh / 2, w: bw, h: bh,
            type: 'building', hp: 800, maxHp: 800, color: '#2a2a2a',
            seed: Math.random() * 1000
          });
        }
      }
    }

    for (let i = 0; i < 34; i++) {
      const rx = 200 + Math.random() * (MAP_W - 400);
      const ry = 200 + Math.random() * (MAP_H - 400);
      const distToCenter = Math.sqrt((rx - MAP_W / 2) ** 2 + (ry - MAP_H / 2) ** 2);
      if (distToCenter > 250) {
        const r = 15 + Math.random() * 30;
        const verts = [];
        const nv = 7 + Math.floor(Math.random() * 4);
        for (let k = 0; k < nv; k++) {
          const a = (k / nv) * Math.PI * 2;
          const rr = r * (0.72 + Math.random() * 0.5);
          verts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
        }
        obstacles.push({ x: rx, y: ry, r, verts, type: 'rock', hp: 500, color: '#4a4a4a' });
      }
    }

    for (let i = 0; i < 4; i++) {
      let zx, zy, valid, attempts = 0;
      do {
        const t1 = towns[Math.floor(Math.random() * towns.length)];
        const t2 = towns[Math.floor(Math.random() * towns.length)];
        if (t1 !== t2) {
          zx = (t1.x + t2.x) / 2 + (Math.random() - 0.5) * 200;
          zy = (t1.y + t2.y) / 2 + (Math.random() - 0.5) * 200;
        } else {
          zx = 400 + Math.random() * (MAP_W - 800);
          zy = 400 + Math.random() * (MAP_H - 800);
        }
        valid = true;
        for (const obs of obstacles) {
          if (obs.type === 'building') {
            const cx = obs.x + obs.w / 2;
            const cy = obs.y + obs.h / 2;
            if (Math.sqrt((zx - cx) ** 2 + (zy - cy) ** 2) < 100) { valid = false; break; }
          }
        }
        attempts++;
      } while (!valid && attempts < 20);
      if (valid && zx > 200 && zx < MAP_W - 200 && zy > 200 && zy < MAP_H - 200) {
        ammoZones.push({
          x: zx, y: zy, radius: 120,
          ammoAP: 15 + Math.floor(Math.random() * 10),
          ammoHE: 6 + Math.floor(Math.random() * 5),
          respawnTimer: 0, active: true, lastPickupTime: 0
        });
      }
    }
  }

  // ============ TANK FACTORY ============
  function createTank(type, x, y, angle, isPlayer) {
    const t = typeof type === 'string' ? TANK_TYPES.find(t => t.id === type) : type;

    const decalW = t.size.l + 28;
    const decalH = t.size.w + 28;
    const decalCanvas = makeCanvas(decalW, decalH);
    const decalCtx = decalCanvas.getContext('2d');

    return {
      type: t, x, y, angle, turretAngle: angle,
      vx: 0, vy: 0, speed: 0, throttle: 0, steering: 0,
      trackL: 0, trackR: 0,
      isPlayer, turretTargetAngle: angle,
      parts: {
        hull: { hp: 100, maxHp: 100 },
        turret: { hp: 80, maxHp: 80 },
        gun: { hp: 60, maxHp: 60 },
        engine: { hp: 70, maxHp: 70 },
        tracks: { hp: 80, maxHp: 80 },
        ammoRack: { hp: 40, maxHp: 40 },
        fuelTank: { hp: 50, maxHp: 50 },
      },
      crew: {
        driver: { alive: true, hp: 100 },
        gunner: { alive: true, hp: 100 },
        loader: { alive: true, hp: 100 },
        commander: { alive: true, hp: 100 },
      },
      engineRunning: true, engineDamage: 0, trackDamage: 0,
      gunJammed: false, gunBroken: false,
      turretTraverseSpeed: 2.8, onFire: false, fireTimer: 0,
      ammoAP: 30, ammoHE: 12, maxAP: 30, maxHE: 12,
      currentAmmo: 'AP', reloading: false, reloadTimer: 0,
      reloadTime: t.gun.reload, alive: true, deathTimer: 0,
      muzzleFlash: 0, recoilOffset: 0,
      markTimer: 0, hitFlash: 0, engineSmokeTimer: 0,
      decalCanvas, decalCtx, decalW, decalH,
      ai: {
        state: 'idle', wanderTimer: 0, fireCooldown: 0,
        detectionRange: 450, aggro: false, strafeAngle: 0,
        lastSeenX: 0, lastSeenY: 0, aimTime: 0
      },
    };
  }

  // ============================================================
  // GEOMETRY HELPERS
  // ============================================================

  function worldToLocal(wx, wy, cx, cy, angle) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const dx = wx - cx, dy = wy - cy;
    return { x: dx * ca + dy * sa, y: -dx * sa + dy * ca };
  }
  function localToWorld(lx, ly, cx, cy, angle) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    return { x: cx + lx * ca - ly * sa, y: cy + lx * sa + ly * ca };
  }
  function dirWorldToLocal(dx, dy, angle) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    return { x: dx * ca + dy * sa, y: -dx * sa + dy * ca };
  }
  function dirLocalToWorld(dx, dy, angle) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    return { x: dx * ca - dy * sa, y: dx * sa + dy * ca };
  }

  function rayOBB(px, py, dx, dy, cx, cy, angle, halfLen, halfWid, maxT) {
    const p = worldToLocal(px, py, cx, cy, angle);
    const d = dirWorldToLocal(dx, dy, angle);

    let tmin = 0, tmax = maxT;
    let hitAxis = -1, hitSign = 0;

    if (Math.abs(d.x) < 1e-9) {
      if (p.x < -halfLen || p.x > halfLen) return null;
    } else {
      let t1 = (-halfLen - p.x) / d.x;
      let t2 = (halfLen - p.x) / d.x;
      let sign = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1; }
      if (t1 > tmin) { tmin = t1; hitAxis = 0; hitSign = sign; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (Math.abs(d.y) < 1e-9) {
      if (p.y < -halfWid || p.y > halfWid) return null;
    } else {
      let t1 = (-halfWid - p.y) / d.y;
      let t2 = (halfWid - p.y) / d.y;
      let sign = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1; }
      if (t1 > tmin) { tmin = t1; hitAxis = 1; hitSign = sign; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (hitAxis < 0) return null;

    const hx = px + dx * tmin;
    const hy = py + dy * tmin;
    const hl = worldToLocal(hx, hy, cx, cy, angle);

    let lnx = 0, lny = 0;
    if (hitAxis === 0) lnx = hitSign;
    else lny = hitSign;

    const nw = dirLocalToWorld(lnx, lny, angle);

    let zone;
    if (hitAxis === 0) zone = (hitSign > 0) ? 'front' : 'rear';
    else zone = 'side';

    return {
      t: tmin, x: hx, y: hy,
      nx: nw.x, ny: nw.y,
      zone, localX: hl.x, localY: hl.y,
      faceAxis: hitAxis, faceSign: hitSign,
    };
  }

  function rayCircle(px, py, dx, dy, cx, cy, r, maxT) {
    const ox = px - cx, oy = py - cy;
    const b = ox * dx + oy * dy;
    const c = ox * ox + oy * oy - r * r;
    const disc = b * b - c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    let t = -b - sq;
    if (t < 0) t = -b + sq;
    if (t < 0) return null;
    if (maxT !== undefined && t > maxT) return null;
    const hx = px + dx * t;
    const hy = py + dy * t;
    const nx = (hx - cx) / r, ny = (hy - cy) / r;
    return { t, x: hx, y: hy, nx, ny };
  }

  function rayAABB(px, py, dx, dy, x, y, w, h, maxT) {
    let tmin = 0, tmax = maxT;
    if (Math.abs(dx) < 1e-9) {
      if (px < x || px > x + w) return null;
    } else {
      let t1 = (x - px) / dx;
      let t2 = (x + w - px) / dx;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (Math.abs(dy) < 1e-9) {
      if (py < y || py > y + h) return null;
    } else {
      let t1 = (y - py) / dy;
      let t2 = (y + h - py) / dy;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    return { t: tmin, x: px + dx * tmin, y: py + dy * tmin };
  }

  function getTankModules(tank) {
    const hl = tank.type.size.l / 2;
    const hw = tank.type.size.w / 2;
    const tr = tank.type.turretR;
    return [
      { name: 'driver',     kind: 'crew', crew: 'driver',    lx:  hl * 0.42, ly: -hw * 0.30, r: 5.5 },
      { name: 'gunner',     kind: 'crew', crew: 'gunner',    lx:  tr * 0.15, ly: -tr * 0.45, r: 4.5 },
      { name: 'loader',     kind: 'crew', crew: 'loader',    lx:  tr * 0.15, ly:  tr * 0.45, r: 4.5 },
      { name: 'commander',  kind: 'crew', crew: 'commander', lx: -tr * 0.45, ly:  0,         r: 4.5 },
      { name: 'breech',     kind: 'module', part: 'gun',     lx:  tr * 0.65, ly: 0, r: 4.5 },
      { name: 'turretRing', kind: 'module', part: 'turret',  lx: -tr * 0.20, ly: -tr * 0.25, r: 4.0 },
      { name: 'ammoRack',   kind: 'ammo',   part: 'ammoRack',lx: -hl * 0.10, ly:  0,         r: 7.0 },
      { name: 'engine',     kind: 'engine', part: 'engine',  lx: -hl * 0.60, ly:  0,         r: 7.5 },
      { name: 'fuelTank',   kind: 'module', part: 'fuelTank',lx: -hl * 0.50, ly:  hw * 0.45, r: 5.5 },
      { name: 'trackL',     kind: 'module', part: 'tracks',  lx:  0,         ly: -hw * 0.92, r: 4.0 },
      { name: 'trackR',     kind: 'module', part: 'tracks',  lx:  0,         ly:  hw * 0.92, r: 4.0 },
    ];
  }

  // ============================================================
  // PARTICLE HELPER
  // ============================================================

  function pushParticle(p) {
    if (particles.length < MAX_PARTICLES) particles.push(p);
  }

  // ============ FIRING ============
  function fireShell(tank, targetX, targetY) {
    if (!tank.alive || tank.gunBroken || tank.reloading) return;
    const ammo = AMMO_TYPES[tank.currentAmmo];
    if (ammo.name === 'AP' && tank.ammoAP <= 0) return;
    if (ammo.name === 'HE' && tank.ammoHE <= 0) return;

    if (ammo.name === 'AP') tank.ammoAP--;
    else tank.ammoHE--;

    const fireAngle = tank.turretAngle;
    const dist = Math.sqrt((targetX - tank.x) ** 2 + (targetY - tank.y) ** 2);
    const dispersion = Math.min(0.025 + dist * 0.00003, 0.06);
    const finalAngle = fireAngle + (Math.random() - 0.5) * dispersion;

    const speed = 900;
    const muzzleX = tank.x + Math.cos(finalAngle) * tank.type.barrel;
    const muzzleY = tank.y + Math.sin(finalAngle) * tank.type.barrel;

    const shell = {
      x: muzzleX, y: muzzleY,
      prevX: muzzleX, prevY: muzzleY,
      x0: muzzleX, y0: muzzleY,
      vx: Math.cos(finalAngle) * speed,
      vy: Math.sin(finalAngle) * speed,
      angle: finalAngle,
      ammo: ammo.name,
      type: tank.type,
      caliber: tank.type.gun.caliber,
      maxRange: tank.type.gun.range,
      basePen: tank.type.gun.pen * ammo.penMult,
      pen: tank.type.gun.pen * ammo.penMult,
      damage: tank.type.gun.damage * (ammo.name === 'AP' ? 1.0 : 0.75),
      splashRadius: ammo.splash * tank.type.gun.caliber * 0.008,
      splashDamage: ammo.name === 'HE' ? tank.type.gun.damage * 0.30 : 0,
      crewDmg: ammo.crewDmg,
      life: tank.type.gun.range / speed,
      color: ammo.color,
      owner: tank.isPlayer ? 'player' : 'enemy',
      trail: [],
      ricochetCount: 0,
      overPen: 0,
      hitTanks: new Set(),
    };

    if (tank.isPlayer) bullets_player.push(shell);
    else bullets.push(shell);

    tank.muzzleFlash = 8;
    tank.recoilOffset = 10;
    tank.reloading = true;
    tank.reloadTimer = 0;

    // muzzle smoke
    for (let i = 0; i < 16; i++) {
      const sa = finalAngle + (Math.random() - 0.5) * 0.9;
      const ss = 80 + Math.random() * 160;
      pushParticle({
        x: muzzleX, y: muzzleY,
        vx: Math.cos(sa) * ss, vy: Math.sin(sa) * ss,
        life: 0.35 + Math.random() * 0.4, maxLife: 0.75,
        size: 2 + Math.random() * 5,
        color: Math.random() > 0.5 ? '#c8c4bc' : '#8f8b84',
        alpha: 0.75, type: 'smoke', drag: 3.2
      });
    }
    // muzzle sparks
    for (let i = 0; i < 8; i++) {
      const sa = finalAngle + (Math.random() - 0.5) * 1.1;
      const ss = 260 + Math.random() * 320;
      pushParticle({
        x: muzzleX, y: muzzleY,
        vx: Math.cos(sa) * ss, vy: Math.sin(sa) * ss,
        life: 0.12 + Math.random() * 0.18, maxLife: 0.3,
        size: 1.4 + Math.random() * 2,
        color: '#ffd27a', alpha: 1, type: 'spark', drag: 5
      });
    }

    if (tank.isPlayer) { shakeTimer = 12; shakeIntensity = 5; }
    AudioSystem.playGunshot(tank.isPlayer, tank.type.gun.caliber);
  }

  // ============ EXPLOSION FX ============
  function createExplosion(x, y, radius, owner) {
    explosions.push({
      x, y,
      radius: radius * 0.25,
      maxRadius: radius,
      alpha: 1, life: 0.55, maxLife: 0.55,
      seed: Math.random() * 100,
    });

    stampScorch(x, y, radius * 1.05, 0.55);

    // fire
    const nf = Math.min(26, 8 + Math.floor(radius / 7));
    for (let i = 0; i < nf; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * radius * 3.2;
      pushParticle({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.30 + Math.random() * 0.5, maxLife: 0.8,
        size: 3 + Math.random() * 7,
        color: Math.random() > 0.5 ? '#ffb347' : '#ff6a1a',
        alpha: 1, type: 'fire', drag: 2.6
      });
    }
    // smoke
    const ns = Math.min(20, 5 + Math.floor(radius / 11));
    for (let i = 0; i < ns; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 12 + Math.random() * 45;
      pushParticle({
        x: x + (Math.random() - 0.5) * radius * 0.5,
        y: y + (Math.random() - 0.5) * radius * 0.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 18,
        life: 0.9 + Math.random() * 1.2, maxLife: 2.1,
        size: radius * 0.16 + Math.random() * radius * 0.16,
        color: '#4a4a4a', alpha: 0.65,
        type: 'smoke', drag: 1.1
      });
    }
    // sparks
    const nsp = Math.min(18, 5 + Math.floor(radius / 10));
    for (let i = 0; i < nsp; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 200 + Math.random() * 380;
      pushParticle({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.2 + Math.random() * 0.35, maxLife: 0.55,
        size: 1.2 + Math.random() * 1.8,
        color: '#ffe9a8', alpha: 1, type: 'spark', drag: 3.5
      });
    }

    AudioSystem.playExplosion(radius / 50);
    shakeTimer = Math.max(shakeTimer, 12);
    shakeIntensity = Math.max(shakeIntensity, radius * 0.10);
  }

  // ============================================================
  // PENETRATION / DAMAGE
  // ============================================================

  const DEG = Math.PI / 180;

  function stampTankDecal(tank, lx, ly, penetrated) {
    const g = tank.decalCtx;
    if (!g) return;
    const dx = lx + tank.decalW / 2;
    const dy = ly + tank.decalH / 2;
    if (dx < 0 || dy < 0 || dx > tank.decalW || dy > tank.decalH) return;

    if (penetrated) {
      const r = 7 + Math.random() * 6;
      const grad = g.createRadialGradient(dx, dy, 0, dx, dy, r);
      grad.addColorStop(0, 'rgba(0,0,0,0.88)');
      grad.addColorStop(0.5, 'rgba(22,12,6,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill();

      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const len = 5 + Math.random() * 11;
        g.beginPath();
        g.moveTo(dx, dy);
        g.lineTo(dx + Math.cos(a) * len, dy + Math.sin(a) * len);
        g.stroke();
      }
    } else {
      g.fillStyle = 'rgba(28,28,26,0.5)';
      g.beginPath();
      g.arc(dx, dy, 3.5 + Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  function handleSweptHit(b, hit, shooterSide) {
    const tank = hit.tank;

    if (!b.hitTanks) b.hitTanks = new Set();
    b.hitTanks.add(tank);

    let zone = hit.zone;
    let armorValue = 0;
    if (zone === 'front') armorValue = tank.type.armor.front;
    else if (zone === 'rear') armorValue = tank.type.armor.rear;
    else armorValue = tank.type.armor.side;

    const vlen = Math.hypot(b.vx, b.vy) || 1;
    const udx = b.vx / vlen, udy = b.vy / vlen;

    if (zone === 'front' || zone === 'rear') {
      const th = rayCircle(hit.x, hit.y, udx, udy, tank.x, tank.y, tank.type.turretR, 200);
      if (th && th.t > 0.5) {
        zone = 'turret';
        armorValue = tank.type.armor.turret;
        hit.x = th.x; hit.y = th.y;
        hit.nx = th.nx; hit.ny = th.ny;
        const ll = worldToLocal(th.x, th.y, tank.x, tank.y, tank.angle);
        hit.localX = ll.x; hit.localY = ll.y;
      }
    }

    const incidence = Math.acos(Math.max(-1, Math.min(1, -(udx * hit.nx + udy * hit.ny))));

    const overmatch = b.caliber / Math.max(1, armorValue);
    let normReduction = 0;
    if (b.ammo === 'AP') {
      if (overmatch >= 3) normReduction = 8 * DEG;
      else if (overmatch >= 2) normReduction = 4 * DEG;
    }
    const adjIncidence = Math.max(0, incidence - normReduction);

    const ricochetThreshold = 70 * DEG;
    if (adjIncidence > ricochetThreshold) {
      const noRicochet = (overmatch >= 3) || (b.caliber >= 3 * armorValue);
      if (!noRicochet) {
        const t = (adjIncidence - ricochetThreshold) / (90 * DEG - ricochetThreshold);
        const chance = Math.min(1, t * t);
        if (Math.random() < chance) {
          handleRicochet(b, hit);
          return;
        }
      }
    }

    const cosInc = Math.max(0.10, Math.cos(adjIncidence));
    const effectiveArmor = armorValue / cosInc;

    const traveled = Math.hypot(hit.x - b.x0, hit.y - b.y0);
    const rangeFactor = Math.max(0.70, 1 - (traveled / b.maxRange) * 0.30);
    const effectivePen = b.pen * rangeFactor;

    const ratio = effectivePen / effectiveArmor;
    const penetrated = ratio > (0.95 + Math.random() * 0.10);

    tank.hitFlash = 1.0;
    stampTankDecal(tank, hit.localX, hit.localY, penetrated);

    if (penetrated) {
      AudioSystem.playHit(true);
      createExplosion(hit.x, hit.y, 32, b.owner);
      damageNumbers.push({
        x: tank.x, y: tank.y - 26,
        text: `PEN ${Math.round(effectivePen)}/${Math.round(effectiveArmor)}`,
        life: 1.4, color: '#ff6622', vy: -45, critical: true,
      });

      const continuing = applyPenetration(tank, b, hit, effectivePen, effectiveArmor);

      if (tank.isPlayer) { showDamageFlash(); shakeTimer = 8; shakeIntensity = 4; }
      if (!continuing) b.life = 0;

    } else {
      AudioSystem.playHit(false);

      if (b.ammo === 'AP' && b.caliber >= 75) {
        for (const role of ['driver', 'gunner', 'loader', 'commander']) {
          if (tank.crew[role].alive && Math.random() < 0.06) {
            tank.crew[role].hp -= 30;
            if (tank.crew[role].hp <= 0) killCrew(tank, role);
          }
        }
      }

      if (hit.zone === 'side' && Math.abs(hit.localY) > tank.type.size.w * 0.35) {
        tank.parts.tracks.hp = Math.max(0, tank.parts.tracks.hp - b.damage * 0.06);
      }

      if (b.ammo === 'HE' && b.splashDamage > 0) {
        applySplashDamage(tank, b.splashDamage, b.owner);
        createExplosion(hit.x, hit.y, b.splashRadius * 1.5, b.owner);
      }

      for (let k = 0; k < 10; k++) {
        const a = Math.atan2(hit.ny, hit.nx) + (Math.random() - 0.5) * 1.3;
        const sp = 120 + Math.random() * 260;
        pushParticle({
          x: hit.x, y: hit.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.16 + Math.random() * 0.2, maxLife: 0.36,
          size: 1 + Math.random() * 1.8,
          color: '#ffd9a0', alpha: 1, type: 'spark', drag: 4
        });
      }

      damageNumbers.push({
        x: hit.x, y: hit.y - 15,
        text: `NO PEN ${Math.round(effectivePen)}/${Math.round(effectiveArmor)}`,
        life: 1.0, color: '#ff8866', vy: -30,
      });

      if (tank.isPlayer) { showDamageFlash(); shakeTimer = 8; shakeIntensity = 3; }
      b.life = 0;
    }

    if (tank.alive) checkTankDestruction(tank);
  }

  function handleRicochet(b, hit) {
    const dot = b.vx * hit.nx + b.vy * hit.ny;
    b.vx -= 2 * dot * hit.nx;
    b.vy -= 2 * dot * hit.ny;

    b.pen *= 0.75;
    b.damage *= 0.6;

    b.x = hit.x + hit.nx * 3;
    b.y = hit.y + hit.ny * 3;
    b.prevX = b.x; b.prevY = b.y;

    b.trail = [];
    b.ricochetCount++;
    if (b.ricochetCount >= 3) b.life = 0;

    AudioSystem.playHit(false);

    for (let k = 0; k < 14; k++) {
      const a = Math.atan2(hit.ny, hit.nx) + (Math.random() - 0.5) * 1.6;
      const sp = 160 + Math.random() * 320;
      pushParticle({
        x: hit.x, y: hit.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.22 + Math.random() * 0.3, maxLife: 0.55,
        size: 1.2 + Math.random() * 2,
        color: '#ffd76a', alpha: 1, type: 'spark', drag: 3.5
      });
    }
    damageNumbers.push({ x: hit.x, y: hit.y - 15, text: 'RICOCHET', life: 0.8, color: '#ffcc44', vy: -30 });
  }

  function applyPenetration(tank, b, hit, effectivePen, effectiveArmor) {
    const hl = tank.type.size.l / 2;
    const hw = tank.type.size.w / 2;
    const modules = getTankModules(tank);

    const vlen = Math.hypot(b.vx, b.vy) || 1;
    const dxw = b.vx / vlen, dyw = b.vy / vlen;
    const dLocal = dirWorldToLocal(dxw, dyw, tank.angle);

    const entryX = hit.localX, entryY = hit.localY;

    tank.parts.hull.hp = Math.max(0, tank.parts.hull.hp - b.damage * 0.08);
    checkTankDestruction(tank);
    if (!tank.alive) return false;

    const pathHits = [];
    for (const m of modules) {
      const ox = m.lx - entryX, oy = m.ly - entryY;
      const pb = ox * dLocal.x + oy * dLocal.y;
      const pc = ox * ox + oy * oy - m.r * m.r;
      const disc = pb * pb - pc;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      let t = -pb - sq;
      if (t < 0) t = -pb + sq;
      if (t < 0) continue;
      pathHits.push({ m, t });
    }
    pathHits.sort((a, c) => a.t - c.t);

    let residualPen = Math.max(0, effectivePen - effectiveArmor);

    for (const ph of pathHits) {
      if (residualPen <= 0) break;
      if (!tank.alive) break;
      const m = ph.m;

      if (m.kind === 'crew') {
        if (Math.random() < 0.80) killCrew(tank, m.crew);
        residualPen -= 4;
      } else if (m.kind === 'ammo') {
        damagePart(tank, 'ammoRack', b.damage * 0.55);
        if (!tank.alive) return false;
        if (Math.random() < 0.22) {
          destroyTank(tank, 'AMMO RACK DETONATION');
          return false;
        }
        residualPen -= 25;
      } else if (m.kind === 'engine') {
        damagePart(tank, 'engine', b.damage * 0.60);
        if (!tank.alive) return false;
        if (!tank.onFire && Math.random() < 0.25) {
          tank.onFire = true;
          tank.fireTimer = 6 + Math.random() * 4;
        }
        residualPen -= 22;
      } else {
        damagePart(tank, m.part, b.damage * 0.50);
        if (!tank.alive) return false;
        if (m.part === 'fuelTank' && !tank.onFire && Math.random() < 0.35) {
          tank.onFire = true;
          tank.fireTimer = 8 + Math.random() * 4;
        }
        residualPen -= 12;
      }
    }

    if (!tank.alive) return false;

    let exitT = Infinity;
    if (dLocal.x > 1e-6) exitT = Math.min(exitT, (hl - entryX) / dLocal.x);
    else if (dLocal.x < -1e-6) exitT = Math.min(exitT, (-hl - entryX) / dLocal.x);
    if (dLocal.y > 1e-6) exitT = Math.min(exitT, (hw - entryY) / dLocal.y);
    else if (dLocal.y < -1e-6) exitT = Math.min(exitT, (-hw - entryY) / dLocal.y);
    if (!isFinite(exitT) || exitT < 0) exitT = 0;

    if (exitT > 5 && residualPen > 0) {
      const ex = entryX + dLocal.x * exitT;
      const ey = entryY + dLocal.y * exitT;

      let exitArmor = 0;
      if (Math.abs(ex - hl) < 0.6) exitArmor = tank.type.armor.front;
      else if (Math.abs(ex + hl) < 0.6) exitArmor = tank.type.armor.rear;
      else exitArmor = tank.type.armor.side;

      if (residualPen > exitArmor * 1.5) {
        const world = localToWorld(ex, ey, tank.x, tank.y, tank.angle);
        b.x = world.x + dxw * 5;
        b.y = world.y + dyw * 5;
        b.prevX = b.x; b.prevY = b.y;
        b.pen = residualPen * 0.6;
        b.damage *= 0.5;
        b.trail = [];
        b.overPen++;
        if (b.overPen > 3) b.life = 0;
        return true;
      }
    }
    return false;
  }

  function applySplashDamage(tank, dmg, owner) {
    if (!tank.alive || dmg < 5) return;
    for (const role of ['driver', 'gunner', 'loader', 'commander']) {
      if (tank.crew[role].alive && Math.random() < 0.35) {
        tank.crew[role].hp -= dmg * 0.5;
        if (tank.crew[role].hp <= 0) killCrew(tank, role);
      }
    }
    tank.parts.tracks.hp = Math.max(0, tank.parts.tracks.hp - dmg * 0.30);
    tank.parts.hull.hp = Math.max(0, tank.parts.hull.hp - dmg * 0.10);
    checkTankDestruction(tank);
  }

  function checkTankDestruction(tank) {
    if (!tank.alive) return;
    if (tank.parts.hull.hp <= 0) { destroyTank(tank, 'HULL BREACH'); return; }
    if (tank.parts.engine.hp <= 0 && !tank.onFire) { tank.onFire = true; tank.fireTimer = 8; }
    if (tank.parts.fuelTank.hp <= 0 && !tank.onFire) { tank.onFire = true; tank.fireTimer = 10; }
  }

  function destroyTank(tank, cause) {
    if (!tank.alive) return;
    tank.alive = false;
    tank.deathTimer = 2;
    if (cause === 'AMMO RACK DETONATION') {
      AudioSystem.playAmmoDetonation();
      createExplosion(tank.x, tank.y, 250, 'enemy');
      createExplosion(tank.x + 15, tank.y - 10, 150, 'enemy');
      createExplosion(tank.x - 10, tank.y + 10, 120, 'enemy');
      if (tank !== player && !tank.killed) { tank.killed = true; score += 200; killCount++; addKillFeed(tank, cause); }
    } else {
      createExplosion(tank.x, tank.y, 180, 'enemy');
      createExplosion(tank.x + (Math.random() - 0.5) * 20, tank.y + (Math.random() - 0.5) * 20, 100, 'enemy');
      if (tank !== player && !tank.killed) { tank.killed = true; score += 100; killCount++; addKillFeed(tank, cause || 'destroyed'); }
    }
  }

  function damagePart(tank, part, dmg) {
    const p = tank.parts[part];
    if (!p) return;
    const actualDmg = dmg * 0.4;
    p.hp = Math.max(0, p.hp - actualDmg);
    if (part !== 'hull') tank.parts.hull.hp = Math.max(0, tank.parts.hull.hp - actualDmg * 0.3);
    if (part === 'engine') tank.engineDamage = 1 - p.hp / p.maxHp;
    if (part === 'tracks') tank.trackDamage = 1 - p.hp / p.maxHp;
    if (part === 'gun') {
      if (p.hp < 25) tank.gunBroken = true;
      else if (p.hp < 55) tank.gunJammed = Math.random() < 0.3;
    }
    if (part === 'ammoRack' && p.hp < 20 && Math.random() < 0.25) {
      destroyTank(tank, 'AMMO RACK DETONATION');
    }
    damageNumbers.push({
      x: tank.x + (Math.random() - 0.5) * 20,
      y: tank.y + (Math.random() - 0.5) * 20,
      text: `${part.toUpperCase()} -${Math.round(actualDmg)}`,
      life: 1.0, color: '#ffaa00', vy: -30
    });
    checkTankDestruction(tank);
  }

  function killCrew(tank, role) {
    if (!tank.crew[role].alive) return;
    tank.crew[role].alive = false;
    tank.crew[role].hp = 0;
    if (role === 'gunner') tank.turretTraverseSpeed *= 0.35;
    if (role === 'loader') tank.reloadTime *= 2.5;
    damageNumbers.push({
      x: tank.x + (Math.random() - 0.5) * 20, y: tank.y,
      text: `${role.toUpperCase()} KIA`, life: 1.5, color: '#ff4444', vy: -25
    });
    if (tank.isPlayer) AudioSystem.playCrewDeath();
    for (let i = 0; i < 5; i++) {
      pushParticle({
        x: tank.x + (Math.random() - 0.5) * 15,
        y: tank.y + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 22, vy: -15 - Math.random() * 22,
        life: 0.8 + Math.random() * 0.5, maxLife: 1.3,
        size: 2 + Math.random() * 3,
        color: '#8b8b8b', alpha: 0.55,
        type: 'smoke', drag: 1.5
      });
    }
  }

  // ============ OBB COLLISION RESOLUTION ============

  // Reusable SAT axes (avoids per-frame allocation).
  const _obbAxes = [
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }
  ];

  // Push a tank out of any obstacle it overlaps, using its full
  // oriented bounding box (hull length × width, rotated by tank.angle).
  function resolveTankObstacleCollisions(tank) {
    const hl = tank.type.size.l / 2;      // hull half-length
    const hw = tank.type.size.w / 2;      // hull half-width
    const ca = Math.cos(tank.angle), sa = Math.sin(tank.angle);
    const boundR = Math.sqrt(hl * hl + hw * hw); // bounding-circle radius

    let blocked = false;

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];

      // ---------- BUILDING (OBB vs AABB, SAT) ----------
      if (obs.type === 'building') {
        const bhx = obs.w / 2, bhy = obs.h / 2;
        const bx = obs.x + bhx, by = obs.y + bhy;
        const dx = tank.x - bx, dy = tank.y - by;

        // Broad phase
        if (Math.abs(dx) > bhx + boundR || Math.abs(dy) > bhy + boundR) continue;

        // SAT axes: tank forward, tank right, world X, world Y
        _obbAxes[0].x = ca;  _obbAxes[0].y = sa;
        _obbAxes[1].x = -sa; _obbAxes[1].y = ca;

        let minOverlap = Infinity, mtvX = 0, mtvY = 0;
        let separated = false;

        for (let a = 0; a < 4; a++) {
          const ax = _obbAxes[a];
          // Projection radius of the OBB on this axis
          const rT = hl * Math.abs(ca * ax.x + sa * ax.y)
                  + hw * Math.abs(-sa * ax.x + ca * ax.y);
          // Projection radius of the AABB on this axis
          const rB = bhx * Math.abs(ax.x) + bhy * Math.abs(ax.y);
          const d  = dx * ax.x + dy * ax.y;
          const overlap = rT + rB - Math.abs(d);
          if (overlap <= 0) { separated = true; break; }
          if (overlap < minOverlap) {
            minOverlap = overlap;
            const s = d < 0 ? -1 : 1;
            mtvX = ax.x * s;
            mtvY = ax.y * s;
          }
        }

        if (!separated) {
          tank.x += mtvX * minOverlap;
          tank.y += mtvY * minOverlap;
          blocked = true;
        }

      // ---------- ROCK (OBB vs circle) ----------
      } else {
        const ox = obs.x - tank.x, oy = obs.y - tank.y;
        const br = obs.r + boundR;
        if (ox * ox + oy * oy > br * br) continue; // broad phase

        // Circle centre expressed in the tank's local frame
        const lx =  ox * ca + oy * sa;
        const ly = -ox * sa + oy * ca;

        // Closest point on the OBB (in local frame) to the circle centre
        const cx = Math.max(-hl, Math.min(hl, lx));
        const cy = Math.max(-hw, Math.min(hw, ly));

        const ddx = lx - cx, ddy = ly - cy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist >= obs.r) continue;

        let localPushX, localPushY;

        if (dist > 1e-4) {
          // Circle centre is outside the OBB — push the tank directly
          // away from the rock along the closest-point vector.
          const k = (obs.r - dist) / dist;
          localPushX = -ddx * k;
          localPushY = -ddy * k;
        } else {
          // Circle centre is *inside* the OBB — escape along the nearest face.
          const escapeX = hl + obs.r - Math.abs(lx);
          const escapeY = hw + obs.r - Math.abs(ly);
          if (escapeX < escapeY) {
            localPushX = (lx > 0 ? -1 : 1) * escapeX;
            localPushY = 0;
          } else {
            localPushX = 0;
            localPushY = (ly > 0 ? -1 : 1) * escapeY;
          }
        }

        // Convert the local push vector back to world space
        tank.x += localPushX * ca - localPushY * sa;
        tank.y += localPushX * sa + localPushY * ca;
        blocked = true;
      }
    }

    if (blocked) {
      // Bleed off momentum so ramming a wall actually slows the tank
      tank.trackL *= 0.5;
      tank.trackR *= 0.5;
      tank.speed  *= 0.5;
    }
  }

  // ============ PHYSICS ============
  function updateTankPhysics(tank, dt) {
    if (!tank.alive) return;

    // ---- condition modifiers ----
    let enginePower = tank.type.speed * (1 - tank.engineDamage * 0.75);
    if (!tank.crew.driver.alive) enginePower *= 0.15;
    let trackMult = 1 - tank.trackDamage * 0.85;
    if (!tank.crew.driver.alive) trackMult *= 0.2;

    const maxTrackSpeed = enginePower * 60 * trackMult;
    const gauge = tank.type.size.w * 0.85;   // track centreline spacing

    // ---- decompose input into forward thrust + yaw demand ----
    //   throttle : +1 fwd  / -1 reverse  → forward track bias
    //   steering : +1 right / -1 left    → differential track bias
    const forward = tank.throttle * maxTrackSpeed;
    const desiredAng = tank.steering * tank.type.pivot;
    const turnBias = desiredAng * gauge * 0.5;

    let leftTarget  = forward + turnBias;
    let rightTarget = forward - turnBias;

    // If the combined command oversaturates a track, scale BOTH tracks
    // down proportionally. This preserves the forward/turn ratio, so
    // turning at speed costs a little velocity instead of gutting it.
    const peak = Math.max(Math.abs(leftTarget), Math.abs(rightTarget));
    if (peak > maxTrackSpeed && peak > 0) {
      const k = maxTrackSpeed / peak;
      leftTarget  *= k;
      rightTarget *= k;
    }

    // ---- track spool inertia (weighty feel) ----
    const spool = Math.min(1, dt * 10);
    tank.trackL += (leftTarget  - tank.trackL) * spool;
    tank.trackR += (rightTarget - tank.trackR) * spool;

    // ---- convert track speeds to hull motion ----
    tank.speed = (tank.trackL + tank.trackR) * 0.5;

    let angVel = (tank.trackL - tank.trackR) / gauge;
    const maxAng = tank.type.pivot
                * (1 - tank.trackDamage * 0.7)
                * (tank.crew.driver.alive ? 1 : 0.25);
    if (angVel >  maxAng) angVel =  maxAng;
    if (angVel < -maxAng) angVel = -maxAng;

    tank.angle += angVel * dt;

    tank.vx = Math.cos(tank.angle) * tank.speed;
    tank.vy = Math.sin(tank.angle) * tank.speed;
    tank.x += tank.vx * dt;
    tank.y += tank.vy * dt;
    tank.x = Math.max(40, Math.min(MAP_W - 40, tank.x));
    tank.y = Math.max(40, Math.min(MAP_H - 40, tank.y));

    // Resolve hull-vs-obstacle collisions using the tank's full OBB.
    // Two passes so wedging into a corner resolves cleanly.
    resolveTankObstacleCollisions(tank);
    resolveTankObstacleCollisions(tank);

    const turretSpeed = tank.turretTraverseSpeed * (tank.crew.gunner.alive ? 1 : 0.3);
    if (tank.turretTargetAngle !== undefined) {
      let tDiff = tank.turretTargetAngle - tank.turretAngle;
      while (tDiff > Math.PI) tDiff -= Math.PI * 2;
      while (tDiff < -Math.PI) tDiff += Math.PI * 2;
      const maxStep = turretSpeed * dt;
      if (Math.abs(tDiff) < maxStep) tank.turretAngle = tank.turretTargetAngle;
      else tank.turretAngle += Math.sign(tDiff) * maxStep;
      if (Math.abs(tDiff) > 0.02 && tank.isPlayer && Math.random() < dt * 8) AudioSystem.playTurretMotor();
    }

    if (tank.recoilOffset) {
      tank.recoilOffset *= Math.pow(0.02, dt);
      if (tank.recoilOffset < 0.3) tank.recoilOffset = 0;
    }
    if (tank.muzzleFlash > 0) tank.muzzleFlash -= dt * 70;
    if (tank.hitFlash > 0) tank.hitFlash -= dt * 3;

    if (tank.reloading) {
      tank.reloadTimer += dt;
      if (tank.reloadTimer >= tank.reloadTime) {
        tank.reloading = false;
        tank.reloadTimer = 0;
        if (tank.isPlayer) AudioSystem.playReload();
      }
    }

    if (tank.onFire) {
      tank.fireTimer -= dt;
      tank.parts.hull.hp -= dt * 18;
      if (Math.random() < 0.5) {
        pushParticle({
          x: tank.x + (Math.random() - 0.5) * 22,
          y: tank.y + (Math.random() - 0.5) * 22,
          vx: (Math.random() - 0.5) * 26, vy: -38 - Math.random() * 45,
          life: 0.5 + Math.random() * 0.6, maxLife: 1.1,
          size: 4 + Math.random() * 7,
          color: Math.random() > 0.5 ? '#ff4400' : '#ffaa00',
          alpha: 0.9, type: 'fire', drag: 1.4
        });
      }
      if (Math.random() < 0.35) {
        pushParticle({
          x: tank.x + (Math.random() - 0.5) * 18,
          y: tank.y + (Math.random() - 0.5) * 18,
          vx: (Math.random() - 0.5) * 18, vy: -30 - Math.random() * 30,
          life: 1.0 + Math.random() * 1.2, maxLife: 2.2,
          size: 8 + Math.random() * 10,
          color: '#3a3a3a', alpha: 0.55,
          type: 'smoke', drag: 1.0
        });
      }
      for (const role of ['driver', 'gunner', 'loader', 'commander']) {
        if (tank.crew[role].alive && Math.random() < dt * 0.2) {
          tank.crew[role].hp -= 12;
          if (tank.crew[role].hp <= 0) killCrew(tank, role);
        }
      }
      if (tank.fireTimer <= 0) tank.onFire = false;
      if (tank.parts.hull.hp <= 0) destroyTank(tank, 'FIRE');
    }

    // damaged engine smoke
    if (tank.engineDamage > 0.35 && !tank.onFire) {
      tank.engineSmokeTimer -= dt;
      if (tank.engineSmokeTimer <= 0) {
        tank.engineSmokeTimer = 0.08 + Math.random() * 0.12;
        const back = -tank.type.size.l * 0.5;
        const ex = tank.x + Math.cos(tank.angle) * back;
        const ey = tank.y + Math.sin(tank.angle) * back;
        pushParticle({
          x: ex + (Math.random() - 0.5) * 8,
          y: ey + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 14, vy: -22 - Math.random() * 20,
          life: 0.9 + Math.random() * 0.8, maxLife: 1.8,
          size: 5 + Math.random() * 7,
          color: '#2e2e2e', alpha: 0.5 * tank.engineDamage,
          type: 'smoke', drag: 1.0
        });
      }
    }

    // track marks + dust kicked up by movement
    if (Math.abs(tank.speed) > 26 && terrainCtx) {
      tank.markTimer += dt;
      if (tank.markTimer > 0.055) {
        tank.markTimer = 0;
        const off = tank.type.size.l * 0.34;
        const perp = tank.angle + Math.PI / 2;
        const hwid = tank.type.size.w * 0.55;
        for (const s of [-1, 1]) {
          const mx = tank.x - Math.cos(tank.angle) * off + Math.cos(perp) * hwid * s;
          const my = tank.y - Math.sin(tank.angle) * off + Math.sin(perp) * hwid * s;
          stampTrack(mx, my, tank.angle);
        }
        // dust plume behind
        if (Math.random() < 0.55) {
          const back = -tank.type.size.l * 0.5;
          pushParticle({
            x: tank.x + Math.cos(tank.angle) * back + (Math.random() - 0.5) * 16,
            y: tank.y + Math.sin(tank.angle) * back + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 30 - tank.vx * 0.1,
            vy: (Math.random() - 0.5) * 30 - tank.vy * 0.1,
            life: 0.5 + Math.random() * 0.7, maxLife: 1.2,
            size: 5 + Math.random() * 9,
            color: '#6b6350', alpha: 0.42,
            type: 'smoke', drag: 1.8
          });
        }
      }
    }
  }

  // ============================================================
  // BULLETS — SWEPT RAY MODEL
  // ============================================================

  function updateBullets(dt) {
    for (let i = bullets_player.length - 1; i >= 0; i--) {
      const b = bullets_player[i];
      updateSingleBullet(b, dt, enemies);
      if (b.life <= 0) bullets_player.splice(i, 1);
    }
    const playerTargets = (player && player.alive) ? [player] : [];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      updateSingleBullet(b, dt, playerTargets);
      if (b.life <= 0) bullets.splice(i, 1);
    }
    obstacles = obstacles.filter(o => o.hp > 0);
  }

  function updateSingleBullet(b, dt, targets) {
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 9) b.trail.shift();

    if (b.life <= 0 || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) { b.life = 0; return; }

    if (sweepBulletObstacles(b)) return;

    const hit = sweepShellAgainstTanks(b, targets);
    if (hit) handleSweptHit(b, hit, b.owner);
  }

  function sweepBulletObstacles(b) {
    const dx = b.x - b.prevX, dy = b.y - b.prevY;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return false;
    const udx = dx / len, udy = dy / len;

    let bestT = len + 1;
    let hitObs = null, hitX = 0, hitY = 0;

    for (const obs of obstacles) {
      if (obs.type === 'building') {
        const h = rayAABB(b.prevX, b.prevY, udx, udy, obs.x, obs.y, obs.w, obs.h, len);
        if (h && h.t < bestT) { bestT = h.t; hitObs = obs; hitX = h.x; hitY = h.y; }
      } else {
        const h = rayCircle(b.prevX, b.prevY, udx, udy, obs.x, obs.y, obs.r, len);
        if (h && h.t < bestT) { bestT = h.t; hitObs = obs; hitX = h.x; hitY = h.y; }
      }
    }
    if (!hitObs) return false;

    createExplosion(hitX, hitY, hitObs.type === 'building' ? 30 : 20, b.owner);
    hitObs.hp -= hitObs.type === 'building' ? 30 : 15;
    b.x = hitX; b.y = hitY;
    b.life = 0;
    return true;
  }

  function sweepShellAgainstTanks(b, tanks) {
    const dx = b.x - b.prevX, dy = b.y - b.prevY;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const udx = dx / len, udy = dy / len;

    let best = null;
    for (const tank of tanks) {
      if (!tank.alive) continue;
      if (b.hitTanks && b.hitTanks.has(tank)) continue;
      const halfLen = tank.type.size.l / 2;
      const halfWid = tank.type.size.w / 2;
      const h = rayOBB(b.prevX, b.prevY, udx, udy, tank.x, tank.y, tank.angle, halfLen, halfWid, len);
      if (h && (!best || h.t < best.t)) {
        best = Object.assign({}, h, { tank });
      }
    }
    return best;
  }

  // ============ AI ============
  const SQUAD = { x: 0, y: 0, t: -999, spotterX: 0, spotterY: 0 };

  const AI_SIGHT      = 650;
  const AI_HEARING    = 190;
  const AI_RADIO      = 480;
  const AI_INTEL_MEM  = 6;
  const AI_AGGRO_MEM  = 7;

  function angleDelta(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function hasLineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return true;
    const ux = dx / len, uy = dy / len;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (o.type === 'building') {
        if (rayAABB(x1, y1, ux, uy, o.x, o.y, o.w, o.h, len)) return false;
      } else if (rayCircle(x1, y1, ux, uy, o.x, o.y, o.r, len)) return false;
    }
    return true;
  }

  function pathBlocked(tank, angle, dist) {
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const r = tank.type.size.w * 0.55;
    const x1 = tank.x + ux * r, y1 = tank.y + uy * r;
    const x2 = x1 + ux * dist, y2 = y1 + uy * dist;
    if (x2 < 70 || x2 > MAP_W - 70 || y2 < 70 || y2 > MAP_H - 70) return true;

    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (o.type === 'building') {
        if (rayAABB(x1, y1, ux, uy, o.x - r, o.y - r, o.w + r * 2, o.h + r * 2, dist)) return true;
      } else if (rayCircle(x1, y1, ux, uy, o.x, o.y, o.r + r, dist)) return true;
    }

    for (let i = 0; i < enemies.length; i++) {
      const o = enemies[i];
      if (o === tank || !o.alive) continue;
      const ox = o.x - x1, oy = o.y - y1;
      const proj = ox * ux + oy * uy;
      if (proj < 0 || proj > dist) continue;
      const perp = Math.abs(ox * -uy + oy * ux);
      if (perp < r + o.type.size.w * 0.7) return true;
    }
    return false;
  }

  function findAvoidOffset(tank, desired, dist, bias) {
    const s = bias || 1;
    const seq = [
      0,
      0.22 * s, -0.22 * s, 0.45 * s, -0.45 * s, 0.72 * s, -0.72 * s,
      1.05 * s, -1.05 * s, 1.4 * s, -1.4 * s, 1.8 * s, -1.8 * s,
      2.3 * s, -2.3 * s, 2.9 * s, -2.9 * s
    ];
    for (let i = 0; i < seq.length; i++) {
      if (!pathBlocked(tank, desired + seq[i], dist)) return seq[i];
    }
    return Math.PI;
  }

  function friendlyInLine(tank, angle) {
    const ux = Math.cos(angle), uy = Math.sin(angle);
    for (let i = 0; i < enemies.length; i++) {
      const o = enemies[i];
      if (o === tank || !o.alive) continue;
      const ox = o.x - tank.x, oy = o.y - tank.y;
      const proj = ox * ux + oy * uy;
      if (proj < 40 || proj > 700) continue;
      const perp = Math.abs(ox * -uy + oy * ux);
      if (perp < o.type.size.w * 0.75 + 6) return true;
    }
    return false;
  }

  function aiPatrol(tank, dt) {
    const ai = tank.ai;
    const hasIntel = gameTime - (ai.receivedIntel || -999) < AI_INTEL_MEM;

    if (hasIntel) {
      if (ai.wanderTimer <= 0 || !ai._intelTarget) {
        ai.wanderTimer = 2 + Math.random() * 2;
        ai.wanderX = clamp(ai.lastSeenX + (Math.random() - 0.5) * 260, 120, MAP_W - 120);
        ai.wanderY = clamp(ai.lastSeenY + (Math.random() - 0.5) * 260, 120, MAP_H - 120);
        ai.flankAngle = Math.random() * Math.PI * 2;
        ai._intelTarget = true;
      }
    } else {
      if (ai.wanderTimer <= 0) {
        ai.wanderTimer = 4 + Math.random() * 4;
        const a = Math.random() * Math.PI * 2;
        const d = 350 + Math.random() * 550;
        ai.wanderX = clamp(tank.x + Math.cos(a) * d, 120, MAP_W - 120);
        ai.wanderY = clamp(tank.y + Math.sin(a) * d, 120, MAP_H - 120);
        ai.flankAngle = Math.random() * Math.PI * 2;
        ai._intelTarget = false;
      }
    }

    if (Math.hypot(ai.wanderX - tank.x, ai.wanderY - tank.y) < 90) {
      ai.wanderTimer = Math.min(ai.wanderTimer, 0.1);
      ai._intelTarget = false;
    }

    const desired = Math.atan2(ai.wanderY - tank.y, ai.wanderX - tank.x);
    if (ai.avoidTimer <= 0) {
      ai.avoidTimer = 0.12;
      ai.avoidOffset = findAvoidOffset(tank, desired, 130, ai.strafeDir);
    }
    const heading = desired + ai.avoidOffset;
    const turn = angleDelta(heading, tank.angle);
    tank.steering = clamp(turn * 2.2, -1, 1);
    tank.throttle = Math.abs(turn) > 1.6 ? 0.9 : 0.7;

    tank.turretTargetAngle = tank.angle + Math.sin(gameTime * 0.55 + ai.seed) * 0.85;
  }

  function updateAI(tank, dt) {
    if (!tank.alive) return;
    const ai = tank.ai;

    if (!ai._init) {
      ai._init = true;
      ai.detectionRange = 950;
      ai.flankAngle = Math.random() * Math.PI * 2;
      ai.strafeDir = Math.random() < 0.5 ? -1 : 1;
      ai.seed = Math.random() * 100;
      ai.stuckTimer = 0;
      ai.unstick = 0;
      ai.lastX = tank.x;
      ai.lastY = tank.y;
      ai.avoidTimer = 0;
      ai.avoidOffset = 0;
      ai.aimTime = 0;
      ai.aimError = 0;
      ai.errorTimer = 0;
      ai.lostTimer = 0;
      ai.wanderTimer = 0;
      ai.wanderX = tank.x;
      ai.wanderY = tank.y;
      ai.receivedIntel = -999;
      ai._intelTarget = false;
    }

    if (!player || !player.alive) {
      tank.throttle *= 0.94;
      tank.steering *= 0.9;
      return;
    }

    ai.fireCooldown -= dt;
    ai.wanderTimer -= dt;
    ai.avoidTimer -= dt;
    ai.errorTimer -= dt;

    const dx = player.x - tank.x, dy = player.y - tank.y;
    const dist = Math.hypot(dx, dy) || 1;
    const angTo = Math.atan2(dy, dx);
    const los = dist < 1600 && hasLineOfSight(tank.x, tank.y, player.x, player.y);
    const hullFrac = tank.parts.hull.hp / tank.parts.hull.maxHp;
    const canPen = tank.type.gun.pen >= player.type.armor.front * 1.05;

    const sighted = los && dist < AI_SIGHT;
    const heard   = dist < AI_HEARING;

    if (sighted || heard) {
      ai.aggro = true;
      ai.lastSeenX = player.x;
      ai.lastSeenY = player.y;
      ai.lostTimer = 0;

      SQUAD.x = player.x; SQUAD.y = player.y; SQUAD.t = gameTime;
      SQUAD.spotterX = tank.x; SQUAD.spotterY = tank.y;

      for (let i = 0; i < enemies.length; i++) {
        const ally = enemies[i];
        if (ally === tank || !ally.alive) continue;
        if (Math.hypot(ally.x - tank.x, ally.y - tank.y) < AI_RADIO) {
          ally.ai.lastSeenX = player.x;
          ally.ai.lastSeenY = player.y;
          ally.ai.receivedIntel = gameTime;
        }
      }
    } else if (ai.aggro) {
      ai.lostTimer += dt;
      if (ai.lostTimer > AI_AGGRO_MEM) {
        ai.aggro = false;
        ai._intelTarget = false;
      }
    }

    if (!ai.aggro) { aiPatrol(tank, dt); return; }

    const gunRange = tank.type.gun.range;
    let preferred = Math.min(700, gunRange * 0.55);
    if (hullFrac < 0.35) preferred *= 1.55;
    if (tank.reloading) preferred *= 1.22;
    if (!canPen) preferred = Math.min(preferred, 420);

    let desiredHeading, throttle;
    const aimX = los ? player.x : ai.lastSeenX;
    const aimY = los ? player.y : ai.lastSeenY;

    if (!los) {
      const gx = aimX + Math.cos(ai.flankAngle) * preferred * 0.9;
      const gy = aimY + Math.sin(ai.flankAngle) * preferred * 0.9;
      if (Math.hypot(gx - tank.x, gy - tank.y) < 90) {
        ai.flankAngle += (Math.random() - 0.5) * 2.2;
      }
      desiredHeading = Math.atan2(gy - tank.y, gx - tank.x);
      throttle = 1;
      if (ai.lostTimer > 5) {
        desiredHeading = Math.atan2(aimY - tank.y, aimX - tank.x);
      }

    } else if (hullFrac < 0.28 && dist < 800) {
      desiredHeading = angTo + Math.PI;
      throttle = 1;

    } else {
      const rangeErr = dist - preferred;
      const orbitMag = canPen ? 0.55 : 0.95;
      let base = angTo;

      if (!canPen) {
        const fl = player.angle + ai.strafeDir * Math.PI * 0.5;
        const gx = player.x + Math.cos(fl) * preferred;
        const gy = player.y + Math.sin(fl) * preferred;
        base = Math.atan2(gy - tank.y, gx - tank.x);
      }

      const osc = 0.65 + 0.35 * Math.sin(gameTime * 0.45 + ai.seed);
      desiredHeading = base + ai.strafeDir * orbitMag * osc;

      if (rangeErr > 110) {
        throttle = 1;
        desiredHeading = base + ai.strafeDir * orbitMag * 0.25;
      } else if (rangeErr < -130) {
        throttle = -0.75;
      } else {
        throttle = 0.45;
      }

      if (Math.random() < dt * 0.18) ai.strafeDir *= -1;
    }

    if (ai.avoidTimer <= 0) {
      ai.avoidTimer = 0.1 + Math.random() * 0.06;
      const look = 80 + Math.min(140, Math.abs(tank.speed) * 0.7);
      ai.avoidOffset = findAvoidOffset(tank, desiredHeading, look, ai.strafeDir);
    }
    desiredHeading += ai.avoidOffset;

    const moved = Math.hypot(tank.x - ai.lastX, tank.y - ai.lastY);
    if (moved < 0.35 && Math.abs(tank.throttle) > 0.25) ai.stuckTimer += dt;
    else ai.stuckTimer = Math.max(0, ai.stuckTimer - dt * 2);
    ai.lastX = tank.x; ai.lastY = tank.y;
    if (ai.stuckTimer > 1.3) { ai.unstick = 0.9; ai.stuckTimer = 0; }

    if (ai.unstick > 0) {
      ai.unstick -= dt;
      tank.throttle = -1;
      tank.steering = 1;
    } else {
      const turn = angleDelta(desiredHeading, tank.angle);
      tank.steering = clamp(turn * 2.3, -1, 1);
      tank.throttle = (Math.abs(turn) > 1.9) ? clamp(throttle, 0.55, 1) : clamp(throttle, -1, 1);
    }

    let tx = aimX, ty = aimY;
    if (los) {
      const tof = dist / 900;
      tx = player.x + player.vx * tof;
      ty = player.y + player.vy * tof;
    }

    if (ai.errorTimer <= 0) {
      ai.errorTimer = 0.7 + Math.random() * 1.5;
      // Low-skill AI has noticeably sloppier aim; high-skill AI tightens up.
      const spreadMult = 1.6 - aiSkill * 0.9;
      const spread = Math.min(0.075, ((los ? 0.018 : 0.05) + dist * 0.00003) * spreadMult);
      ai.aimError = (Math.random() - 0.5) * 2 * spread;
    }
    const aimAngle = Math.atan2(ty - tank.y, tx - tank.x) + ai.aimError;
    tank.turretTargetAngle = aimAngle;

    if (!tank.reloading) {
      const wantHE = !canPen && dist < 520 && tank.ammoHE > 0;
      tank.currentAmmo = wantHE ? 'HE' : 'AP';
    }

    const hasAmmo = (tank.currentAmmo === 'AP' && tank.ammoAP > 0) ||
                    (tank.currentAmmo === 'HE' && tank.ammoHE > 0);

    if (los && hasAmmo && !tank.reloading && !tank.gunBroken && ai.fireCooldown <= 0) {
      const diff = Math.abs(angleDelta(tank.turretAngle, aimAngle));
      const tol = clamp(0.015 + dist * 0.000055, 0.02, 0.09) * (0.85 + aiSkill * 0.5);

      if (diff < tol) ai.aimTime += dt;
      else ai.aimTime = 0;

      // Skilled AI needs less time on target before pulling the trigger.
      const needed = (0.22 + Math.min(0.5, dist / 1600) + (1 - hullFrac) * 0.2)
                   * (1.4 - aiSkill * 0.4);

      if (ai.aimTime >= needed && !friendlyInLine(tank, tank.turretAngle)) {
        fireShell(tank, tx, ty);
        ai.fireCooldown = tank.reloadTime + 0.35 + Math.random() * 1.6;
        ai.aimTime = 0;
      }
    } else {
      ai.aimTime = 0;
    }
  }

  // ============ PLAYER UPDATE ============
  function updatePlayer(dt) {
    if (!player || !player.alive) return;
    const ddx = mouseX + cam.x - player.x;
    const ddy = mouseY + cam.y - player.y;
    player.turretTargetAngle = Math.atan2(ddy, ddx);

    if (keys['KeyW'] || keys['ArrowUp']) player.throttle = 1;
    else if (keys['KeyS'] || keys['ArrowDown']) player.throttle = -0.5;
    else player.throttle *= 0.9;

    if (keys['KeyA'] || keys['ArrowLeft']) player.steering = -1;
    else if (keys['KeyD'] || keys['ArrowRight']) player.steering = 1;
    else player.steering *= 0.85;

    if (mouseDown && !player.reloading && !player.gunBroken && !keys['KeyF']) {
      const now = performance.now() / 1000;
      if (now - lastFire > player.reloadTime * 0.9) {
        lastFire = now;
        fireShell(player, mouseX + cam.x, mouseY + cam.y);
      }
    }
    if (Math.abs(player.throttle) > 0.1) AudioSystem.startEngine(player.speed, player.throttle);
    else AudioSystem.updateEngine(player.speed, 0);

    if (keys['KeyF'] && Math.abs(player.speed) < 5) repairTank(player, dt);

    if (Math.abs(player.speed) < 5) {
      for (const zone of ammoZones) {
        if (!zone.active) {
          zone.respawnTimer -= dt;
          if (zone.respawnTimer <= 0) {
            zone.active = true;
            zone.ammoAP = 20 + Math.floor(Math.random() * 10);
            zone.ammoHE = 8 + Math.floor(Math.random() * 5);
          }
          continue;
        }
        const zdx = player.x - zone.x;
        const zdy = player.y - zone.y;
        const dist = Math.sqrt(zdx * zdx + zdy * zdy);
        if (dist < zone.radius + 20) {
          if ((zone.ammoAP > 0 || zone.ammoHE > 0) && gameTime > (zone.lastPickupTime || 0) + 3) {
            const apGain = Math.min(1, zone.ammoAP, player.maxAP - player.ammoAP);
            const heGain = Math.min(1, zone.ammoHE, player.maxHE - player.ammoHE);
            if (apGain > 0 || heGain > 0) {
              player.ammoAP += apGain;
              player.ammoHE += heGain;
              zone.ammoAP -= apGain;
              zone.ammoHE -= heGain;
              zone.lastPickupTime = gameTime;
              if (zone.ammoAP <= 0 && zone.ammoHE <= 0) {
                zone.active = false;
                zone.respawnTimer = 60;
              }
              AudioSystem.playReload();
              damageNumbers.push({
                x: player.x, y: player.y - 30,
                text: `+${apGain}AP +${heGain}HE`, life: 2.0, color: '#66ff66', vy: -20
              });
            }
          }
          break;
        }
      }
    }

    updateTankPhysics(player, dt);
  }

  function repairTank(tank, dt) {
    const repairRate = 8 * dt;
    let totalRepaired = 0;
    for (const part in tank.parts) {
      const p = tank.parts[part];
      if (p.hp < p.maxHp) {
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + repairRate);
        totalRepaired += p.hp - before;
      }
    }
    for (const role in tank.crew) {
      if (!tank.crew[role].alive && Math.random() < dt * 0.1) {
        tank.crew[role].alive = true;
        tank.crew[role].hp = 100;
        damageNumbers.push({
          x: tank.x, y: tank.y - 20,
          text: `${role.toUpperCase()} RECOVERED`, life: 1.5, color: '#66ff66', vy: -25
        });
      }
    }
    if (tank.gunBroken) tank.gunBroken = Math.random() > dt * 0.15;
    tank.engineDamage = 1 - tank.parts.engine.hp / tank.parts.engine.maxHp;
    tank.trackDamage = 1 - tank.parts.tracks.hp / tank.parts.tracks.maxHp;

    // repair sparks
    if (totalRepaired > 0.4 && Math.random() < 0.5) {
      pushParticle({
        x: tank.x + (Math.random() - 0.5) * 34,
        y: tank.y + (Math.random() - 0.5) * 34,
        vx: (Math.random() - 0.5) * 60,
        vy: -40 - Math.random() * 60,
        life: 0.25 + Math.random() * 0.3, maxLife: 0.55,
        size: 1.2 + Math.random() * 1.6,
        color: '#9fe8ff', alpha: 1, type: 'spark', drag: 3
      });
    }
    if (totalRepaired > 0.5 && Math.random() < dt * 10) AudioSystem.playTurretMotor();
  }

  // ============ CAMERA ============
  function updateCamera(dt) {
    if (!player) return;
    cam.x = player.x - W / 2;
    cam.y = player.y - H / 2;

    if (shakeTimer > 0) {
      shakeTimer -= dt * 60;
      const k = Math.max(0, shakeTimer / 12);
      cam.x += (Math.random() - 0.5) * shakeIntensity * k;
      cam.y += (Math.random() - 0.5) * shakeIntensity * k;
    }

    cam.x = Math.max(0, Math.min(MAP_W - W, cam.x));
    cam.y = Math.max(0, Math.min(MAP_H - H, cam.y));
  }

  // ============================================================
  // RENDERING
  // ============================================================

  function drawTerrain() {
    if (!terrainLayer) {
      ctx.fillStyle = '#1a1e12';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const sx = Math.max(0, Math.floor(cam.x));
    const sy = Math.max(0, Math.floor(cam.y));
    const sw = Math.min(W + 2, MAP_W - sx);
    const sh = Math.min(H + 2, MAP_H - sy);
    if (sw <= 0 || sh <= 0) return;
    ctx.drawImage(
      terrainLayer,
      sx, sy, sw, sh,
      sx - cam.x, sy - cam.y, sw, sh
    );
  }

  function drawMapBorder() {
    ctx.strokeStyle = 'rgba(255,60,60,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-cam.x, -cam.y, MAP_W, MAP_H);
  }

  function drawObstacles() {
    // ---- ammo zones ----
    for (const zone of ammoZones) {
      const ssx = zone.x - cam.x;
      const ssy = zone.y - cam.y;
      if (ssx < -240 || ssx > W + 240 || ssy < -240 || ssy > H + 240) continue;

      if (zone.active) {
        const pulse = 1 + Math.sin(gameTime * 3) * 0.08;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(ssx, ssy, 0, ssx, ssy, zone.radius * 1.9 * pulse);
        g.addColorStop(0, 'rgba(80,255,120,0.22)');
        g.addColorStop(0.5, 'rgba(60,220,100,0.10)');
        g.addColorStop(1, 'rgba(40,180,80,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ssx, ssy, zone.radius * 1.9 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // crates
        const crateCount = 5;
        for (let i = 0; i < crateCount; i++) {
          const a = (i / crateCount) * Math.PI * 2 + gameTime * 0.35;
          const cr = zone.radius * 0.62;
          const cx = ssx + Math.cos(a) * cr;
          const cy = ssy + Math.sin(a) * cr;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(a * 0.4);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(-7, -5, 15, 12);
          ctx.fillStyle = '#3e5a34';
          ctx.fillRect(-8, -6, 15, 12);
          ctx.fillStyle = '#5a7a4a';
          ctx.fillRect(-8, -6, 15, 3);
          ctx.strokeStyle = 'rgba(140,220,140,0.55)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-8, -6, 15, 12);
          ctx.restore();
        }

        // ring
        ctx.strokeStyle = 'rgba(110,255,130,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -gameTime * 22;
        ctx.beginPath();
        ctx.arc(ssx, ssy, zone.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // label
        ctx.fillStyle = 'rgba(180,255,190,0.9)';
        ctx.font = 'bold 17px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AMMO', ssx, ssy);
        ctx.font = '11px "Share Tech Mono", monospace';
        ctx.fillStyle = 'rgba(150,255,170,0.75)';
        ctx.fillText(`${zone.ammoAP}AP / ${zone.ammoHE}HE`, ssx, ssy + 18);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';

      } else {
        ctx.fillStyle = 'rgba(60,60,60,0.22)';
        ctx.beginPath();
        ctx.arc(ssx, ssy, zone.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,120,120,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.arc(ssx, ssy, zone.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(170,170,170,0.8)';
        ctx.font = 'bold 14px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(zone.respawnTimer)}s`, ssx, ssy);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }
    }

    // ---- obstacles ----
    for (const obs of obstacles) {
      const ssx = obs.x - cam.x;
      const ssy = obs.y - cam.y;

      if (obs.type === 'building') {
        if (ssx < -obs.w - 60 || ssx > W + 60 || ssy < -obs.h - 60 || ssy > H + 60) continue;

        // drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(ssx + 7, ssy + 9, obs.w, obs.h);

        // body
        const grad = ctx.createLinearGradient(ssx, ssy, ssx + obs.w, ssy + obs.h);
        grad.addColorStop(0, '#454542');
        grad.addColorStop(0.5, '#333331');
        grad.addColorStop(1, '#202020');
        ctx.fillStyle = grad;
        ctx.fillRect(ssx, ssy, obs.w, obs.h);

        // roof inner
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(ssx + 7, ssy + 7, obs.w - 14, obs.h - 14);

        // wall edge highlight
        ctx.strokeStyle = 'rgba(180,180,170,0.30)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ssx + 1, ssy + 1, obs.w - 2, obs.h - 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ssx + 0.5, ssy + 0.5, obs.w - 1, obs.h - 1);

        // roof details (AC units / vents) — deterministic from seed
        const seed = obs.seed || 0;
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(ssx + 10 + (seed % 13), ssy + 12 + (seed % 9), 12, 9);
        ctx.fillRect(ssx + obs.w - 26 - (seed % 7), ssy + obs.h - 22 - (seed % 11), 10, 8);

        // damage
        const dmg = 1 - obs.hp / (obs.maxHp || 800);
        if (dmg > 0.15) {
          ctx.strokeStyle = `rgba(10,8,6,${0.35 + dmg * 0.5})`;
          ctx.lineWidth = 1.6 + dmg * 2;
          const crackCount = 2 + Math.floor(dmg * 5);
          for (let i = 0; i < crackCount; i++) {
            const t = (i + 0.5) / crackCount;
            ctx.beginPath();
            ctx.moveTo(ssx + obs.w * t, ssy);
            ctx.lineTo(ssx + obs.w * (t + 0.10), ssy + obs.h * 0.42);
            ctx.lineTo(ssx + obs.w * (t - 0.06), ssy + obs.h * 0.78);
            ctx.lineTo(ssx + obs.w * (t + 0.04), ssy + obs.h);
            ctx.stroke();
          }
          // soot
          ctx.fillStyle = `rgba(0,0,0,${dmg * 0.32})`;
          ctx.beginPath();
          ctx.arc(ssx + obs.w * 0.5, ssy + obs.h * 0.5, Math.min(obs.w, obs.h) * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }

        // scorch at base
        ctx.fillStyle = `rgba(0,0,0,${0.15 + dmg * 0.25})`;
        ctx.fillRect(ssx - 4, ssy + obs.h - 3, obs.w + 8, 6);

      } else {
        // ---- rock ----
        if (ssx < -obs.r - 40 || ssx > W + obs.r + 40 || ssy < -obs.r - 40 || ssy > H + obs.r + 40) continue;

        ctx.save();
        ctx.translate(ssx, ssy);

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        const v = obs.verts;
        ctx.moveTo(v[0].x + 3, v[0].y + 4);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x + 3, v[i].y + 4);
        ctx.closePath();
        ctx.fill();

        // body
        const rg = ctx.createRadialGradient(-obs.r * 0.35, -obs.r * 0.35, obs.r * 0.1, 0, 0, obs.r * 1.15);
        rg.addColorStop(0, '#6b6b66');
        rg.addColorStop(0.5, '#4c4c48');
        rg.addColorStop(1, '#2a2a28');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(200,200,190,0.16)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // highlight facet
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath();
        ctx.moveTo(v[0].x * 0.6, v[0].y * 0.6);
        for (let i = 1; i < Math.ceil(v.length / 2); i++) {
          ctx.lineTo(v[i].x * 0.6, v[i].y * 0.6);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }
  }

  function drawTank(t) {
    if (!t.alive && t.deathTimer <= 0) return;
    const ssx = t.x - cam.x, ssy = t.y - cam.y;
    if (ssx < -180 || ssx > W + 180 || ssy < -180 || ssy > H + 180) return;

    const sp = spriteCache[t.type.id];
    if (!sp) return;

    const hullW = sp.hull.width;
    const hullH = sp.hull.height;

    // ================= WRECK =================
    if (!t.alive) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.translate(ssx, ssy);
      ctx.rotate(t.angle);
      ctx.drawImage(sp.hullWreck, -hullW / 2, -hullH / 2);
      if (t.decalCanvas) ctx.drawImage(t.decalCanvas, -t.decalW / 2, -t.decalH / 2);
      ctx.restore();
      ctx.globalAlpha = 1;

      if (Math.random() < 0.30) {
        pushParticle({
          x: t.x + (Math.random() - 0.5) * 26,
          y: t.y + (Math.random() - 0.5) * 26,
          vx: (Math.random() - 0.5) * 16, vy: -22 - Math.random() * 22,
          life: 0.9 + Math.random() * 0.9, maxLife: 2.0,
          size: 7 + Math.random() * 9,
          color: '#3a3a3a', alpha: 0.42,
          type: 'smoke', drag: 1.0
        });
      }
      return;
    }

    // ================= SHADOW =================
    ctx.save();
    ctx.translate(ssx, ssy);
    ctx.rotate(t.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(3, 4, t.type.size.l * 0.52, t.type.size.w * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ================= HULL =================
    ctx.save();
    ctx.translate(ssx, ssy);
    ctx.rotate(t.angle);
    ctx.drawImage(sp.hull, -hullW / 2, -hullH / 2);
    if (t.decalCanvas) {
      ctx.drawImage(t.decalCanvas, -t.decalW / 2, -t.decalH / 2);
    }
    if (t.hitFlash > 0.45) {
      ctx.globalAlpha = Math.min(1, (t.hitFlash - 0.45) / 0.55);
      ctx.drawImage(sp.hullFlash, -hullW / 2, -hullH / 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ================= TURRET =================
    const th = sp.turret.height;
    const rec = t.recoilOffset || 0;

    ctx.save();
    ctx.translate(ssx, ssy);
    ctx.rotate(t.turretAngle);
    ctx.drawImage(sp.turret, -sp.turretOX - rec * 0.55, -th / 2);
    if (t.hitFlash > 0.45) {
      ctx.globalAlpha = Math.min(1, (t.hitFlash - 0.45) / 0.55);
      ctx.drawImage(sp.turretFlash, -sp.turretOX - rec * 0.55, -th / 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ================= MUZZLE FLASH =================
    if (t.muzzleFlash > 0) {
      const mx = ssx + Math.cos(t.turretAngle) * (t.type.barrel + 3);
      const my = ssy + Math.sin(t.turretAngle) * (t.type.barrel + 3);
      const f = t.muzzleFlash / 8;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // light bloom
      ctx.globalAlpha = Math.min(1, f) * 0.85;
      const bloom = 46 * f;
      ctx.drawImage(glowSprite, mx - bloom, my - bloom, bloom * 2, bloom * 2);

      // hot core
      ctx.globalAlpha = Math.min(1, f);
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.arc(mx, my, 5 * f + 1.5, 0, Math.PI * 2);
      ctx.fill();

      // spikes
      ctx.globalAlpha = Math.min(1, f) * 0.75;
      ctx.fillStyle = '#ffd070';
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(t.turretAngle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(26 * f, -7 * f);
      ctx.lineTo(34 * f, 0);
      ctx.lineTo(26 * f, 7 * f);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // ================= ENGINE FIRE =================
    if (t.onFire) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ox = (Math.random() - 0.5) * 26;
        const oy = (Math.random() - 0.5) * 26 - 6;
        const r = 12 + Math.random() * 16;
        ctx.globalAlpha = 0.32 + Math.random() * 0.3;
        ctx.drawImage(glowSprite, ssx + ox - r, ssy + oy - r, r * 2, r * 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // ================= HEALTH BAR =================
    if (!t.isPlayer) {
      const barW = 40, barH = 4;
      const hppct = Math.max(0, t.parts.hull.hp / t.parts.hull.maxHp);

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      roundRect(ctx, ssx - barW / 2 - 1, ssy - 40, barW + 2, barH + 2, 2);
      ctx.fill();

      ctx.fillStyle = hppct > 0.5 ? '#7ddb6a' : hppct > 0.25 ? '#ffc93c' : '#ff4d4d';
      roundRect(ctx, ssx - barW / 2, ssy - 39, barW * hppct, barH, 1.5);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      roundRect(ctx, ssx - barW / 2, ssy - 39, barW, barH, 1.5);
      ctx.stroke();
    }
  }

  function drawBullets() {
    const all = bullets_player.concat(bullets);
    if (!all.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const b of all) {
      const bsx = b.x - cam.x, bsy = b.y - cam.y;
      if (bsx < -200 || bsx > W + 200 || bsy < -200 || bsy > H + 200) continue;

      // trail polyline
      if (b.trail.length > 1) {
        for (let i = 1; i < b.trail.length; i++) {
          const t0 = b.trail[i - 1];
          const t1 = b.trail[i];
          const a = i / b.trail.length;
          ctx.strokeStyle = `rgba(255,170,70,${a * 0.55})`;
          ctx.lineWidth = a * 3.2;
          ctx.beginPath();
          ctx.moveTo(t0.x - cam.x, t0.y - cam.y);
          ctx.lineTo(t1.x - cam.x, t1.y - cam.y);
          ctx.stroke();
        }
      }

      // glow
      const gr = 14;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(glowSprite, bsx - gr, bsy - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;

      // core
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(bsx, bsy, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fffdf2';
      ctx.beginPath();
      ctx.arc(bsx, bsy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    // ---- normal blend pass (smoke / dust) ----
    ctx.save();
    for (const p of particles) {
      if (p.type === 'spark' || p.type === 'fire') continue;
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (sx < -120 || sx > W + 120 || sy < -120 || sy > H + 120) continue;

      const a = Math.max(0, Math.min(1, p.alpha));
      if (a <= 0.01) continue;

      if (p.type === 'smoke') {
        ctx.globalAlpha = a * 0.75;
        const r = p.size * 1.6;
        ctx.drawImage(smokeSprite, sx - r, sy - r, r * 2, r * 2);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // ---- additive pass (fire / sparks) ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      if (p.type !== 'spark' && p.type !== 'fire') continue;
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue;

      const a = Math.max(0, Math.min(1, p.alpha));
      if (a <= 0.01) continue;

      if (p.type === 'fire') {
        ctx.globalAlpha = a * 0.85;
        const r = p.size * 2.4;
        ctx.drawImage(glowSprite, sx - r, sy - r, r * 2, r * 2);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawExplosions() {
    if (!explosions.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const e of explosions) {
      const esx = e.x - cam.x, esy = e.y - cam.y;
      if (esx < -400 || esx > W + 400 || esy < -400 || esy > H + 400) continue;

      const t = 1 - e.alpha; // 0 -> 1 over life

      // outer fireball
      const grad = ctx.createRadialGradient(esx, esy, 0, esx, esy, e.radius);
      grad.addColorStop(0, `rgba(255,255,220,${e.alpha * 0.95})`);
      grad.addColorStop(0.18, `rgba(255,214,120,${e.alpha * 0.85})`);
      grad.addColorStop(0.45, `rgba(255,130,40,${e.alpha * 0.55})`);
      grad.addColorStop(0.75, `rgba(210,60,10,${e.alpha * 0.28})`);
      grad.addColorStop(1, 'rgba(120,20,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(esx, esy, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // shockwave ring
      if (t < 0.7) {
        const ringR = e.radius * (1.05 + t * 0.9);
        ctx.strokeStyle = `rgba(255,220,170,${(1 - t / 0.7) * e.alpha * 0.55})`;
        ctx.lineWidth = 3 * (1 - t / 0.7) + 0.5;
        ctx.beginPath();
        ctx.arc(esx, esy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // hot core
      const coreR = e.radius * 0.34 * e.alpha;
      if (coreR > 0.5) {
        const coreGrad = ctx.createRadialGradient(esx, esy, 0, esx, esy, coreR);
        coreGrad.addColorStop(0, `rgba(255,255,245,${e.alpha})`);
        coreGrad.addColorStop(0.6, `rgba(255,230,160,${e.alpha * 0.5})`);
        coreGrad.addColorStop(1, 'rgba(255,180,80,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(esx, esy, coreR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawDamageNumbers() {
    ctx.save();
    ctx.textAlign = 'center';
    for (const d of damageNumbers) {
      const sx = d.x - cam.x, sy = d.y - cam.y;
      if (sx < -120 || sx > W + 120 || sy < -120 || sy > H + 120) continue;

      const a = Math.max(0, Math.min(1, d.life));
      ctx.globalAlpha = a;
      ctx.font = d.critical
        ? 'bold 16px "Orbitron", "Share Tech Mono", monospace'
        : 'bold 14px "Orbitron", "Share Tech Mono", monospace';

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(d.text, sx, sy);

      ctx.fillStyle = d.color;
      ctx.fillText(d.text, sx, sy);
    }
    ctx.restore();
  }

  function drawVignette() {
    if (!vignetteLayer) return;
    ctx.drawImage(vignetteLayer, 0, 0);
  }

  // ============ MINIMAP ============
  function drawMinimap() {
    mctx.fillStyle = '#0a0e08';
    mctx.fillRect(0, 0, 160, 160);

    const scale = 160 / MAP_W;

    // obstacles
    mctx.fillStyle = '#333';
    for (const obs of obstacles) {
      if (obs.type === 'building') {
        mctx.fillRect(obs.x * scale, obs.y * scale, Math.max(1, obs.w * scale), Math.max(1, obs.h * scale));
      } else {
        mctx.beginPath();
        mctx.arc(obs.x * scale, obs.y * scale, Math.max(1, obs.r * scale), 0, Math.PI * 2);
        mctx.fill();
      }
    }

    // ammo zones
    for (const zone of ammoZones) {
      if (zone.active) {
        mctx.fillStyle = '#4f4';
        mctx.beginPath();
        mctx.arc(zone.x * scale, zone.y * scale, 3, 0, Math.PI * 2);
        mctx.fill();
      } else {
        mctx.fillStyle = '#444';
        mctx.beginPath();
        mctx.arc(zone.x * scale, zone.y * scale, 2, 0, Math.PI * 2);
        mctx.fill();
      }
    }

    // enemies
    mctx.fillStyle = '#ff4444';
    for (const e of enemies) {
      if (!e.alive) continue;
      mctx.beginPath();
      mctx.arc(e.x * scale, e.y * scale, 2.4, 0, Math.PI * 2);
      mctx.fill();
    }

    // player
    if (player && player.alive) {
      mctx.fillStyle = '#6f6';
      mctx.beginPath();
      mctx.arc(player.x * scale, player.y * scale, 3.2, 0, Math.PI * 2);
      mctx.fill();

      mctx.strokeStyle = 'rgba(120,255,120,0.85)';
      mctx.lineWidth = 1.5;
      mctx.beginPath();
      mctx.moveTo(player.x * scale, player.y * scale);
      mctx.lineTo(
        player.x * scale + Math.cos(player.turretAngle) * 13,
        player.y * scale + Math.sin(player.turretAngle) * 13
      );
      mctx.stroke();
    }

    // viewport rect
    mctx.strokeStyle = 'rgba(140,230,120,0.45)';
    mctx.lineWidth = 1;
    mctx.strokeRect(cam.x * scale, cam.y * scale, W * scale, H * scale);
  }

  // ============ SPAWNING ============
  const GERMAN_TANKS = [0, 1, 2];
  const RUSSIAN_TANKS = [3, 4, 5];

  function getEnemyFaction(playerTypeId) {
    const isPlayerGerman = GERMAN_TANKS.includes(playerTypeId);
    return isPlayerGerman ? RUSSIAN_TANKS : GERMAN_TANKS;
  }

  // ============================================================
  // WAVE CONFIGURATION
  // ------------------------------------------------------------
  // - count:          total enemies this wave (sublinear, soft-capped)
  // - spawnInterval:  seconds between individual spawns
  // - maxConcurrent:  cap on enemies alive at once (prevents swarms)
  // - weights:        [light, medium, heavy] tank tier probability
  // - aiSkill:        0..1 — scales enemy aim error and trigger patience
  // - interWaveDelay: breather before next wave begins
  // ============================================================
  function getWaveConfig(waveNum) {
    // Smooth ramp: W1=3, W2=4, W3=6, W4=7, W5=9, W6=10, W7=11, W8=13 …
    const count = Math.min(30, Math.floor(2 + waveNum * 1.4));

    // Spawn rate tightens slowly. Starts generous, caps at 1.6s.
    const spawnInterval = Math.max(1.6, 5.5 - waveNum * 0.35);

    // Concurrent cap: W1=2, W2=3, W3=4, W5=5, W6=6, W8+=7
    const maxConcurrent = Math.min(7, 2 + Math.floor(waveNum * 0.7));

    // Tank tier weights within the enemy faction.
    //   [ light, medium, heavy ]
    let weights;
    if (waveNum <= 1)       weights = [1.00, 0.00, 0.00];
    else if (waveNum === 2) weights = [0.85, 0.15, 0.00];
    else if (waveNum === 3) weights = [0.75, 0.25, 0.00];
    else if (waveNum === 4) weights = [0.62, 0.36, 0.02];
    else if (waveNum === 5) weights = [0.52, 0.42, 0.06];
    else if (waveNum === 6) weights = [0.42, 0.48, 0.10];
    else if (waveNum === 7) weights = [0.34, 0.50, 0.16];
    else if (waveNum === 8) weights = [0.27, 0.50, 0.23];
    else                    weights = [0.20, 0.50, 0.30];

    // AI gets meaningfully sharper the deeper you go — but Wave 1 is gentle.
    const aiSkill = Math.min(1.0, 0.45 + waveNum * 0.07);

    // Breather between waves (shrinks from ~6.6s to a 3.5s floor).
    const interWaveDelay = Math.max(3.5, 7 - waveNum * 0.35);

    return { count, spawnInterval, maxConcurrent, weights, aiSkill, interWaveDelay };
  }

  function pickEnemyTypeIdx(factionIdxs, weights) {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r <= acc) return factionIdxs[i];
    }
    return factionIdxs[0];
  }

  // Begin a wave: pick config, arm the state machine, announce it.
  function startWave(waveNum) {
    currentWaveConfig = getWaveConfig(waveNum);
    waveEnemiesRemaining = currentWaveConfig.count;
    waveState = 'active';
    spawnTimer = 1.2;
    aiSkill = currentWaveConfig.aiSkill;

    AudioSystem.playWaveAlert();
    addKillFeed(null, `WAVE ${waveNum} — ${currentWaveConfig.count} HOSTILES INBOUND`);
  }

  function spawnEnemy() {
    const playerTypeId = TANK_TYPES.indexOf(player.type);
    const enemyFaction = getEnemyFaction(playerTypeId);
    const cfg = currentWaveConfig || getWaveConfig(wave);
    const typeIdx = pickEnemyTypeIdx(enemyFaction, cfg.weights);
    const type = TANK_TYPES[typeIdx];

    // Spawn just outside the viewport on a random side, with a small pad
    // so they never materialize right on the screen edge.
    const pad = 80;
    let ssx, ssy;
    const side = Math.floor(Math.random() * 4);
    if (side === 0)      { ssx = player.x - W * 0.6 - pad; ssy = player.y + (Math.random() - 0.5) * H; }
    else if (side === 1) { ssx = player.x + W * 0.6 + pad; ssy = player.y + (Math.random() - 0.5) * H; }
    else if (side === 2) { ssx = player.x + (Math.random() - 0.5) * W; ssy = player.y - H * 0.6 - pad; }
    else                 { ssx = player.x + (Math.random() - 0.5) * W; ssy = player.y + H * 0.6 + pad; }

    ssx = Math.max(60, Math.min(MAP_W - 60, ssx));
    ssy = Math.max(60, Math.min(MAP_H - 60, ssy));

    const enemy = createTank(type, ssx, ssy, Math.random() * Math.PI * 2, false);
    enemy.ammoAP = 20 + Math.floor(type.gun.reload * 4);
    enemy.ammoHE = 8  + Math.floor(type.gun.reload * 2);
    enemies.push(enemy);
  }

  function updateSpawning(dt) {
    if (!gameRunning) return;

    // ---------- INTERMISSION ----------
    if (waveState === 'intermission') {
      intermissionTimer -= dt;
      if (intermissionTimer <= 0) startWave(wave);
      return;
    }

    // ---------- ACTIVE WAVE ----------
    const aliveCount = enemies.filter(e => e.alive).length;
    spawnTimer -= dt;

    if (spawnTimer <= 0 &&
        waveEnemiesRemaining > 0 &&
        aliveCount < currentWaveConfig.maxConcurrent) {
      spawnEnemy();
      waveEnemiesRemaining--;
      // Add jitter so spawns feel organic rather than metronomic.
      spawnTimer = currentWaveConfig.spawnInterval * (0.8 + Math.random() * 0.5);
    }

    // ---------- WAVE CLEARED ----------
    if (waveEnemiesRemaining <= 0 && aliveCount === 0) {
      // Field resupply reward for surviving the wave
      if (player && player.alive) {
        player.ammoAP = Math.min(player.maxAP, player.ammoAP + 8);
        player.ammoHE = Math.min(player.maxHE, player.ammoHE + 4);

        player.parts.hull.hp   = Math.min(player.parts.hull.maxHp,   player.parts.hull.hp   + 12);
        player.parts.engine.hp = Math.min(player.parts.engine.maxHp, player.parts.engine.hp + 18);
        player.parts.tracks.hp = Math.min(player.parts.tracks.maxHp, player.parts.tracks.hp + 22);
        player.parts.gun.hp    = Math.min(player.parts.gun.maxHp,    player.parts.gun.hp    + 15);
        player.parts.turret.hp = Math.min(player.parts.turret.maxHp, player.parts.turret.hp + 15);

        if (player.gunBroken && Math.random() < 0.4) player.gunBroken = false;
        for (const role of ['driver', 'gunner', 'loader', 'commander']) {
          if (!player.crew[role].alive && Math.random() < 0.35) {
            player.crew[role].alive = true;
            player.crew[role].hp = 100;
          }
        }
        addKillFeed(null, `WAVE CLEARED — FIELD RESUPPLY`);
      }

      wave++;
      waveState = 'intermission';
      intermissionTimer = currentWaveConfig.interWaveDelay;
    }
  }

  // ============ HUD ============
  function updateHUD() {
    if (!player) return;
    dot('dot-driver', player.crew.driver);
    dot('dot-gunner', player.crew.gunner);
    dot('dot-loader', player.crew.loader);
    dot('dot-commander', player.crew.commander);

    const ammoText = document.getElementById('ammo-readout');
    const ammoTypeEl = document.getElementById('ammo-type');
    if (player.currentAmmo === 'AP') {
      ammoText.textContent = `AP: ${player.ammoAP} / ${player.ammoHE}`;
      ammoTypeEl.textContent = 'ARMOR-PIERCING';
    } else {
      ammoText.textContent = `HE: ${player.ammoHE} / ${player.ammoAP}`;
      ammoTypeEl.textContent = 'HIGH-EXPLOSIVE';
    }

    const reloadBar = document.getElementById('reload-bar');
    reloadBar.style.width = (player.reloading ? (player.reloadTimer / player.reloadTime) * 100 : 100) + '%';

    const gunState = document.getElementById('gun-state');
    if (player.gunBroken) { gunState.textContent = 'DESTROYED'; gunState.style.color = '#f44'; }
    else if (player.reloading) { gunState.textContent = 'RELOADING...'; gunState.style.color = '#fc0'; }
    else { gunState.textContent = 'READY'; gunState.style.color = '#e8e8ee'; }

    updateBar('hull', player.parts.hull.hp / player.parts.hull.maxHp * 100, 'hp');
    updateBar('engine', player.parts.engine.hp / player.parts.engine.maxHp * 100, 'engine');
    updateBar('turret', player.parts.turret.hp / player.parts.turret.maxHp * 100, 'turret');
    updateBar('gun', player.parts.gun.hp / player.parts.gun.maxHp * 100, 'gun');
    updateBar('track', player.parts.tracks.hp / player.parts.tracks.maxHp * 100, 'track');

    document.getElementById('score').textContent = score;
    const mins = Math.floor(gameTime / 60), secs = Math.floor(gameTime % 60);
    document.getElementById('timer').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const aliveN = enemies.filter(e => e.alive).length;
    if (waveState === 'intermission') {
      document.getElementById('tank-count').textContent =
        `Wave ${wave} in ${Math.max(0, intermissionTimer).toFixed(1)}s`;
    } else {
      document.getElementById('tank-count').textContent =
        `Wave ${wave} — ${aliveN + waveEnemiesRemaining} enemies left`;
    }

    const repairEl = document.getElementById('repair-status');
    if (keys['KeyF'] && player && Math.abs(player.speed) < 5) repairEl.style.display = 'block';
    else repairEl.style.display = 'none';
  }

  function dot(id, crew) {
    const el = document.getElementById(id);
    if (!crew.alive) el.className = 'dot dead';
    else if (crew.hp < 50) el.className = 'dot crit';
    else el.className = 'dot';
  }

  function updateBar(id, pct, type) {
    const bar = document.getElementById(`${id}-bar`), txt = document.getElementById(`${id}-txt`);
    pct = Math.max(0, pct);
    bar.style.width = pct + '%';
    bar.className = `bar ${type}`;
    txt.textContent = Math.round(pct) + '%';
    if (pct < 25) bar.style.background = '#f44';
    else if (pct < 50) bar.style.background = '#fc0';
  }

  // ============ KILL FEED ============
  function addKillFeed(tank, msg) {
    const feed = document.getElementById('kill-feed');
    const div = document.createElement('div');
    div.className = 'kill-msg';
    div.innerHTML = tank
      ? `💥 <span style="color:#f66">${tank.type.name}</span> ${msg || 'destroyed'}`
      : `<span style="color:#fc0">${msg}</span>`;
    feed.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  function showDamageFlash() {
    const df = document.getElementById('damage-flash');
    df.classList.add('show');
    setTimeout(() => df.classList.remove('show'), 200);
  }

  // ============ GAME OVER ============
  function gameOver() {
    gameRunning = false;
    const screen = document.getElementById('gameover-screen');
    screen.style.display = 'flex';
    document.getElementById('go-stats').innerHTML = `
      Score: <b style="color:#6f6">${score}</b><br>
      Kills: <b style="color:#f66">${killCount}</b><br>
      Survival Time: <b>${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2, '0')}</b><br>
      Waves Survived: <b>${wave - 1}</b>
    `;
    AudioSystem.playGameOver();
  }

  // ============ INPUT ============
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'KeyQ' && player) player.currentAmmo = 'AP';
    if (e.code === 'KeyE' && player) player.currentAmmo = 'HE';
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (W / r.width);
    mouseY = (e.clientY - r.top) * (H / r.height);
  });
  canvas.addEventListener('mousedown', e => { if (e.button === 0) mouseDown = true; });
  canvas.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (player) player.currentAmmo = player.currentAmmo === 'AP' ? 'HE' : 'AP';
  });

  // ============ MAIN LOOP ============
  function gameLoop(timestamp) {
    if (!gameRunning) { requestAnimationFrame(gameLoop); return; }
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    gameTime += dt;

    updatePlayer(dt);
    for (const e of enemies) {
      if (e.alive) updateAI(e, dt);
      updateTankPhysics(e, dt);
    }
    updateBullets(dt);
    updateCamera(dt);
    updateSpawning(dt);
    updateParticles(dt);

    if (player && !player.alive && player.deathTimer > 0) player.deathTimer -= dt;
    if (player && !player.alive && player.deathTimer <= 0) gameOver();

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].alive && enemies[i].deathTimer > 0) enemies[i].deathTimer -= dt;
      if (!enemies[i].alive && enemies[i].deathTimer <= 0 && enemies[i].deathTimer > -100) {
        enemies[i].deathTimer = -100;
        if (!enemies[i].killed) {
          enemies[i].killed = true;
          score += 100;
          killCount++;
          addKillFeed(enemies[i], 'destroyed');
        }
      }
    }
    enemies = enemies.filter(e => e.deathTimer > -50);

    // ---------- RENDER ----------
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawTerrain();
    drawMapBorder();
    drawObstacles();

    for (const e of enemies) drawTank(e);
    if (player) drawTank(player);

    drawBullets();
    drawParticles();
    drawExplosions();
    drawDamageNumbers();

    drawVignette();
    drawMinimap();
    updateHUD();

    requestAnimationFrame(gameLoop);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.drag) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      } else {
        p.vy += 50 * dt;
      }

      if (p.type === 'smoke') {
        p.vy -= 14 * dt;
        p.size += 14 * dt;
      } else if (p.type === 'fire') {
        p.size *= Math.max(0, 1 - dt * 1.5);
      }

      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.type === 'smoke') p.alpha *= 0.62;

      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      e.radius += (e.maxRadius - e.radius) * dt * 13;
      e.life -= dt;
      e.alpha = Math.max(0, e.life / e.maxLife);
      if (e.life <= 0) explosions.splice(i, 1);
    }

    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      damageNumbers[i].y += damageNumbers[i].vy * dt;
      damageNumbers[i].life -= dt;
      if (damageNumbers[i].life <= 0) damageNumbers.splice(i, 1);
    }
  }

  // ============ START ============
  function buildTankSelect() {
    const container = document.getElementById('tank-select');
    TANK_TYPES.forEach((tk, idx) => {
      const div = document.createElement('div');
      div.className = 'tank-option' + (idx === 3 ? ' selected' : '');
      div.dataset.idx = idx;
      div.innerHTML = `
        <div class="icon">
          <svg width="28" height="28" viewBox="0 0 28 28">
            <rect x="6" y="10" width="16" height="8" rx="1" fill="${tk.color}" stroke="${tk.accent}" stroke-width="1"/>
            <rect x="14" y="11" width="8" height="3" fill="${tk.gunColor}"/>
            <circle cx="14" cy="14" r="4" fill="${tk.color}" stroke="${tk.accent}" stroke-width="1"/>
          </svg>
        </div>
        <div class="info">
          <div class="name">${tk.name}</div>
          <div class="stats">SPD:${tk.speed} | PVT:${tk.pivot} | GUN:${tk.gun.caliber}mm | RLD:${tk.gun.reload}s | ${tk.armor.front}F/${tk.armor.side}S</div>
        </div>
      `;
      div.addEventListener('click', () => {
        container.querySelectorAll('.tank-option').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
      });
      container.appendChild(div);
    });
  }

  function startGame() {
    const tankIdx = parseInt(document.querySelector('.tank-option.selected')?.dataset.idx || '3');
    const tankType = TANK_TYPES[tankIdx];

    bullets = [];
    bullets_player = [];
    enemies = [];
    particles = [];
    explosions = [];
    damageNumbers = [];
    gameTime = 0;
    score = 0;
    killCount = 0;
    wave = 1;
    waveState = 'intermission';
    intermissionTimer = 3.0;
    waveEnemiesRemaining = 0;
    currentWaveConfig = getWaveConfig(1);
    aiSkill = currentWaveConfig.aiSkill;
    spawnTimer = 1.2;
    SQUAD.t = -999;
    SQUAD.spotterX = 0;
    SQUAD.spotterY = 0;

    generateMap();
    player = createTank(tankType, MAP_W / 2, MAP_H / 2, 0, true);

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('gameover-screen').style.display = 'none';
    gameRunning = true;
    lastTime = performance.now();
    AudioSystem.init();
  }

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
  });

  // ---- boot ----
  buildTankSelect();
  buildTankSprites();
  buildAtmosphericSprites();
  requestAnimationFrame(gameLoop);
})();