// ============================================================
// STEEL FURY — Top-Down Tank Shooter
// Minimalist tank designs: rectangles + circles
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

  // ============ TANK TYPES ============
  const TANK_TYPES = [
    { id: 'panzer', name: 'Panzer IV', color: '#5a5a3a', accent: '#7a7a5a', gunColor: '#3a3a1a', speed: 2.6, armor: { front: 50, side: 30, rear: 20, turret: 45 }, gun: { caliber: 75, pen: 95, damage: 580, reload: 5.0, range: 750 }, size: { w: 32, l: 58 }, turretR: 13, barrel: 38 },
    { id: 'panther', name: 'Panther', color: '#4a4a2a', accent: '#6a6a4a', gunColor: '#2a2a0a', speed: 2.4, armor: { front: 80, side: 50, rear: 40, turret: 70 }, gun: { caliber: 75, pen: 120, damage: 720, reload: 6.5, range: 900 }, size: { w: 40, l: 72 }, turretR: 16, barrel: 54 },
    { id: 'tiger', name: 'Tiger I', color: '#5a4a2a', accent: '#7a6a4a', gunColor: '#3a2a0a', speed: 2.0, armor: { front: 100, side: 80, rear: 60, turret: 90 }, gun: { caliber: 88, pen: 145, damage: 920, reload: 7.5, range: 1000 }, size: { w: 44, l: 72 }, turretR: 19, barrel: 54 },
    { id: 't34', name: 'T-34-85', color: '#4a5e2a', accent: '#6a7e4a', gunColor: '#2a3e1a', speed: 2.5, armor: { front: 45, side: 40, rear: 30, turret: 55 }, gun: { caliber: 85, pen: 105, damage: 680, reload: 6.0, range: 800 }, size: { w: 34, l: 66 }, turretR: 15, barrel: 46 },
    { id: 't44', name: 'T-44', color: '#3a4e1a', accent: '#5a6e3a', gunColor: '#1a2e0a', speed: 2.7, armor: { front: 70, side: 50, rear: 40, turret: 75 }, gun: { caliber: 85, pen: 115, damage: 700, reload: 5.5, range: 850 }, size: { w: 38, l: 64 }, turretR: 16, barrel: 44 },
    { id: 'is2', name: 'IS-2', color: '#2a3e1a', accent: '#4a5e3a', gunColor: '#0a1e00', speed: 2.1, armor: { front: 90, side: 70, rear: 50, turret: 85 }, gun: { caliber: 122, pen: 155, damage: 1100, reload: 9.0, range: 1100 }, size: { w: 36, l: 76 }, turretR: 18, barrel: 68 },
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
  let debris = [];
  let player = null;
  let score = 0;
  let killCount = 0;
  let wave = 1;
  let enemiesToSpawn = 0;
  let spawnTimer = 0;

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
  let terrainPatches = [];
  let ammoZones = [];

  function generateMap() {
    obstacles = [];
    terrainPatches = [];
    ammoZones = [];
    const towns = [];
    for (let t = 0; t < 6; t++) {
      towns.push({ x: 300 + Math.random() * (MAP_W - 600), y: 300 + Math.random() * (MAP_H - 600), size: 150 + Math.random() * 200 });
    }
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
          obstacles.push({ x: bx - bw / 2, y: by - bh / 2, w: bw, h: bh, type: 'building', hp: 800, color: '#2a2a2a' });
        }
      }
    }
    for (let i = 0; i < 30; i++) {
      const rx = 200 + Math.random() * (MAP_W - 400);
      const ry = 200 + Math.random() * (MAP_H - 400);
      const distToCenter = Math.sqrt((rx - MAP_W / 2) ** 2 + (ry - MAP_H / 2) ** 2);
      if (distToCenter > 250) {
        const r = 15 + Math.random() * 30;
        obstacles.push({ x: rx, y: ry, r: r, type: 'rock', hp: 500, color: '#4a4a4a' });
      }
    }
    const terrainTypes = [
      { color: 'rgba(60,80,40,0.15)', size: 150 },
      { color: 'rgba(40,50,30,0.12)', size: 200 },
      { color: 'rgba(80,70,40,0.10)', size: 180 },
      { color: 'rgba(30,40,50,0.10)', size: 120 }
    ];
    for (let i = 0; i < 50; i++) {
      const type = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      terrainPatches.push({ x: Math.random() * MAP_W, y: Math.random() * MAP_H, r: type.size * (0.5 + Math.random()), color: type.color });
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
          respawnTimer: 0, active: true
        });
      }
    }
  }

  // ============ TANK FACTORY ============
  function createTank(type, x, y, angle, isPlayer) {
    const t = typeof type === 'string' ? TANK_TYPES.find(t => t.id === type) : type;
    return {
      type: t, x, y, angle, turretAngle: angle,
      vx: 0, vy: 0, speed: 0, throttle: 0, steering: 0,
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
      trackMarks: [], markTimer: 0, hitFlash: 0,
      ai: { state: 'idle', wanderTimer: 0, fireCooldown: 0, detectionRange: 450, aggro: false, strafeAngle: 0, lastSeenX: 0, lastSeenY: 0, aimTime: 0 },
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

    for (let i = 0; i < 12; i++) {
      const sa = finalAngle + (Math.random() - 0.5) * 0.8;
      const ss = 60 + Math.random() * 100;
      particles.push({ x: muzzleX, y: muzzleY, vx: Math.cos(sa) * ss, vy: Math.sin(sa) * ss, life: 0.4 + Math.random() * 0.3, maxLife: 0.7, size: 3 + Math.random() * 5, color: '#bbb', alpha: 0.7 });
    }

    if (tank.isPlayer) { shakeTimer = 12; shakeIntensity = 5; }
    AudioSystem.playGunshot(tank.isPlayer, tank.type.gun.caliber);
  }

  // ============ EXPLOSION FX ============
  function createExplosion(x, y, radius, owner) {
    explosions.push({ x, y, radius: 0, maxRadius: radius, alpha: 1, life: 0.5 });
    debris.push({ x, y, type: 'scorch', radius: radius * 0.7, alpha: 0.5, life: 20 });
    AudioSystem.playExplosion(radius / 50);
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 100 + Math.random() * 250;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.5, maxLife: 0.9, size: 2 + Math.random() * 5, color: Math.random() > 0.5 ? '#ff8844' : '#ffcc44', alpha: 1 });
    }
    shakeTimer = Math.max(shakeTimer, 12);
    shakeIntensity = Math.max(shakeIntensity, radius * 0.12);
  }

  // ============================================================
  // PENETRATION / DAMAGE
  // ============================================================

  const DEG = Math.PI / 180;

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

    let incidence = Math.acos(Math.max(-1, Math.min(1, -(udx * hit.nx + udy * hit.ny))));

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

      for (let k = 0; k < 6; k++) {
        const a = Math.atan2(hit.ny, hit.nx) + (Math.random() - 0.5) * 1.2;
        particles.push({
          x: hit.x, y: hit.y,
          vx: Math.cos(a) * (60 + Math.random() * 100),
          vy: Math.sin(a) * (60 + Math.random() * 100),
          life: 0.2, maxLife: 0.3, size: 1.5, color: '#ffcc88', alpha: 0.9,
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

    for (let k = 0; k < 8; k++) {
      const a = Math.atan2(hit.ny, hit.nx) + (Math.random() - 0.5) * 1.5;
      particles.push({
        x: hit.x, y: hit.y,
        vx: Math.cos(a) * (100 + Math.random() * 150),
        vy: Math.sin(a) * (100 + Math.random() * 150),
        life: 0.3, maxLife: 0.4, size: 2, color: '#ffcc44', alpha: 0.9,
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
      createExplosion(tank.x + (Math.random()-0.5)*20, tank.y + (Math.random()-0.5)*20, 100, 'enemy');
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
    damageNumbers.push({ x: tank.x + (Math.random() - 0.5) * 20, y: tank.y + (Math.random() - 0.5) * 20, text: `${part.toUpperCase()} -${Math.round(actualDmg)}`, life: 1.0, color: '#ffaa00', vy: -30 });
    checkTankDestruction(tank);
  }

  function killCrew(tank, role) {
    if (!tank.crew[role].alive) return;
    tank.crew[role].alive = false;
    tank.crew[role].hp = 0;
    if (role === 'gunner') tank.turretTraverseSpeed *= 0.35;
    if (role === 'loader') tank.reloadTime *= 2.5;
    damageNumbers.push({ x: tank.x + (Math.random() - 0.5) * 20, y: tank.y, text: `${role.toUpperCase()} KIA`, life: 1.5, color: '#ff4444', vy: -25 });
    if (tank.isPlayer) AudioSystem.playCrewDeath();
    for (let i = 0; i < 4; i++) {
      particles.push({ x: tank.x + (Math.random() - 0.5) * 15, y: tank.y + (Math.random() - 0.5) * 15, vx: (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 20, life: 0.8 + Math.random() * 0.5, maxLife: 1.3, size: 2 + Math.random() * 3, color: '#888', alpha: 0.5 });
    }
  }

  // ============ PHYSICS ============
  function updateTankPhysics(tank, dt) {
    if (!tank.alive) return;
    let enginePower = tank.type.speed * (1 - tank.engineDamage * 0.75);
    if (!tank.crew.driver.alive) enginePower *= 0.15;
    let trackMult = 1 - tank.trackDamage * 0.85;
    if (!tank.crew.driver.alive) trackMult *= 0.2;

    const targetSpeed = enginePower * 60 * tank.throttle * trackMult;
    tank.speed += (targetSpeed - tank.speed) * Math.min(1, dt * 3);

    if (Math.abs(tank.speed) > 8) {
      const turnRate = 1.2 * Math.min(1, Math.abs(tank.speed) / 80);
      tank.angle += tank.steering * turnRate * dt;
    }

    tank.vx = Math.cos(tank.angle) * tank.speed;
    tank.vy = Math.sin(tank.angle) * tank.speed;
    tank.x += tank.vx * dt;
    tank.y += tank.vy * dt;
    tank.x = Math.max(40, Math.min(MAP_W - 40, tank.x));
    tank.y = Math.max(40, Math.min(MAP_H - 40, tank.y));

    for (const obs of obstacles) {
      if (obs.type === 'building') {
        const cx = Math.max(obs.x, Math.min(tank.x, obs.x + obs.w));
        const cy = Math.max(obs.y, Math.min(tank.y, obs.y + obs.h));
        const ddx = tank.x - cx, ddy = tank.y - cy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < tank.type.size.w * 0.5) {
          const push = tank.type.size.w * 0.5 - dist + 1;
          tank.x += (ddx / dist) * push; tank.y += (ddy / dist) * push;
          tank.speed *= 0.4;
        }
      } else {
        const ddx = tank.x - obs.x, ddy = tank.y - obs.y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < obs.r + tank.type.size.w * 0.4) {
          const push = obs.r + tank.type.size.w * 0.4 - dist + 1;
          tank.x += (ddx / dist) * push; tank.y += (ddy / dist) * push;
          tank.speed *= 0.6;
        }
      }
    }

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

    if (tank.recoilOffset) { tank.recoilOffset *= Math.pow(0.02, dt); if (tank.recoilOffset < 0.3) tank.recoilOffset = 0; }
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
      if (Math.random() < 0.35) {
        particles.push({ x: tank.x + (Math.random() - 0.5) * 20, y: tank.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 30, vy: -35 - Math.random() * 40, life: 0.5 + Math.random() * 0.5, maxLife: 1, size: 4 + Math.random() * 6, color: Math.random() > 0.5 ? '#ff4400' : '#ffaa00', alpha: 0.8 });
      }
      for (const role of ['driver', 'gunner', 'loader', 'commander']) {
        if (tank.crew[role].alive && Math.random() < dt * 0.2) { tank.crew[role].hp -= 12; if (tank.crew[role].hp <= 0) killCrew(tank, role); }
      }
      if (tank.fireTimer <= 0) tank.onFire = false;
      if (tank.parts.hull.hp <= 0) destroyTank(tank, 'FIRE');
    }

    if (Math.abs(tank.speed) > 30) {
      tank.markTimer += dt;
      if (tank.markTimer > 0.08) {
        tank.markTimer = 0;
        const off = tank.type.size.l * 0.35;
        const perp = tank.angle + Math.PI / 2;
        tank.trackMarks.push({ x: tank.x - Math.cos(tank.angle) * off + Math.cos(perp) * tank.type.size.w * 0.55, y: tank.y - Math.sin(tank.angle) * off + Math.sin(perp) * tank.type.size.w * 0.55, alpha: 0.3, life: 30 });
        tank.trackMarks.push({ x: tank.x - Math.cos(tank.angle) * off - Math.cos(perp) * tank.type.size.w * 0.55, y: tank.y - Math.sin(tank.angle) * off - Math.sin(perp) * tank.type.size.w * 0.55, alpha: 0.3, life: 30 });
      }
    }
    tank.trackMarks = tank.trackMarks.filter(m => { m.alpha -= dt * 0.02; return m.alpha > 0; });
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

    b.trail.push({ x: b.x, y: b.y, alpha: 1 });
    if (b.trail.length > 10) b.trail.shift();
    b.trail.forEach(t => t.alpha *= 0.82);

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
  // Squad-shared intel: any enemy that sees the player broadcasts position
  const SQUAD = { x: 0, y: 0, t: -999, spotterX: 0, spotterY: 0 };

  // --- Perception tuning (all in world pixels / seconds) ---
  const AI_SIGHT      = 650;  // visual detection range (requires clear line of sight)
  const AI_HEARING    = 190;  // engine-noise detection (no LOS needed, very short)
  const AI_RADIO      = 480;  // max range to receive a squadmate's contact report
  const AI_INTEL_MEM  = 6;    // seconds a radio report stays actionable
  const AI_AGGRO_MEM  = 7;    // seconds of lost contact before resuming patrol

  function angleDelta(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---- Line of sight: does anything solid sit between these two points? ----
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

  // ---- Would driving in `angle` for `dist` px hit terrain or a friendly? ----
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

    // Don't pile into squadmates
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

  // ---- Pick the smallest deviation from `desired` that isn't blocked ----
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

  // ---- Don't shoot through a squadmate ----
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
      /* -------- Investigate last known contact -------- */
      if (ai.wanderTimer <= 0 || !ai._intelTarget) {
        ai.wanderTimer = 2 + Math.random() * 2;
        ai.wanderX = clamp(ai.lastSeenX + (Math.random() - 0.5) * 260, 120, MAP_W - 120);
        ai.wanderY = clamp(ai.lastSeenY + (Math.random() - 0.5) * 260, 120, MAP_H - 120);
        ai.flankAngle = Math.random() * Math.PI * 2;
        ai._intelTarget = true;
      }
    } else {
      /* -------- Genuine random patrol, ignores the player entirely -------- */
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

    // Idle scanning — turret sweeps slowly while on patrol
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

    /* ================= PERCEPTION ================= */
    const sighted = los && dist < AI_SIGHT;
    const heard   = dist < AI_HEARING;

    if (sighted || heard) {
      // Own detection — full aggro, and radio nearby allies
      ai.aggro = true;
      ai.lastSeenX = player.x;
      ai.lastSeenY = player.y;
      ai.lostTimer = 0;

      SQUAD.x = player.x; SQUAD.y = player.y; SQUAD.t = gameTime;
      SQUAD.spotterX = tank.x; SQUAD.spotterY = tank.y;

      for (let i = 0; i < enemies.length; i++) {
        const ally = enemies[i];
        if (ally === tank || !ally.alive) continue;
        // Radio only reaches allies within AI_RADIO of the SPOTTER (not the player)
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

    /* ================= DESIRED POSITION ================= */
    const gunRange = tank.type.gun.range;
    let preferred = Math.min(700, gunRange * 0.55);
    if (hullFrac < 0.35) preferred *= 1.55;      // hurt tanks keep their distance
    if (tank.reloading) preferred *= 1.22;        // back off while the breech is open
    if (!canPen) preferred = Math.min(preferred, 420); // must close to flank

    let desiredHeading, throttle;
    const aimX = los ? player.x : ai.lastSeenX;
    const aimY = los ? player.y : ai.lastSeenY;

    if (!los) {
      /* ---- No line of sight: flank toward last known position ---- */
      const gx = aimX + Math.cos(ai.flankAngle) * preferred * 0.9;
      const gy = aimY + Math.sin(ai.flankAngle) * preferred * 0.9;
      if (Math.hypot(gx - tank.x, gy - tank.y) < 90) {
        ai.flankAngle += (Math.random() - 0.5) * 2.2; // try a different approach lane
      }
      desiredHeading = Math.atan2(gy - tank.y, gx - tank.x);
      throttle = 1;
      if (ai.lostTimer > 5) { // search expired, just push the contact
        desiredHeading = Math.atan2(aimY - tank.y, aimX - tank.x);
      }

    } else if (hullFrac < 0.28 && dist < 800) {
      /* ---- Critically damaged: break contact ---- */
      desiredHeading = angTo + Math.PI;
      throttle = 1;

    } else {
      /* ---- Engage: orbit at preferred range, front armour toward threat ---- */
      const rangeErr = dist - preferred;
      const orbitMag = canPen ? 0.55 : 0.95; // can't pen? swing much wider for a flank
      let base = angTo;

      if (!canPen) {
        // Work around toward the player's hull flank
        const fl = player.angle + ai.strafeDir * Math.PI * 0.5;
        const gx = player.x + Math.cos(fl) * preferred;
        const gy = player.y + Math.sin(fl) * preferred;
        base = Math.atan2(gy - tank.y, gx - tank.x);
      }

      // Off-axis hull heading = angled armour + circling motion.
      // Turret handles the aim independently, so the hull is free to angle.
      const osc = 0.65 + 0.35 * Math.sin(gameTime * 0.45 + ai.seed);
      desiredHeading = base + ai.strafeDir * orbitMag * osc;

      if (rangeErr > 110) {
        throttle = 1;
        desiredHeading = base + ai.strafeDir * orbitMag * 0.25; // drive in, mild angle
      } else if (rangeErr < -130) {
        throttle = -0.75;                                       // too close, back out
      } else {
        throttle = 0.45;                                        // hold, keep circling
      }

      if (Math.random() < dt * 0.18) ai.strafeDir *= -1; // reverse orbit now and then
    }

    /* ================= OBSTACLE AVOIDANCE ================= */
    if (ai.avoidTimer <= 0) {
      ai.avoidTimer = 0.1 + Math.random() * 0.06;
      const look = 80 + Math.min(140, Math.abs(tank.speed) * 0.7);
      ai.avoidOffset = findAvoidOffset(tank, desiredHeading, look, ai.strafeDir);
    }
    desiredHeading += ai.avoidOffset;

    /* ================= UNSTICK ================= */
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

    /* ================= TURRET / AIM ================= */
    let tx = aimX, ty = aimY;
    if (los) { // lead the target
      const tof = dist / 900;
      tx = player.x + player.vx * tof;
      ty = player.y + player.vy * tof;
    }

    if (ai.errorTimer <= 0) { // re-roll aim error periodically
      ai.errorTimer = 0.7 + Math.random() * 1.5;
      const spread = Math.min(0.055, (los ? 0.018 : 0.05) + dist * 0.00003);
      ai.aimError = (Math.random() - 0.5) * 2 * spread;
    }
    const aimAngle = Math.atan2(ty - tank.y, tx - tank.x) + ai.aimError;
    tank.turretTargetAngle = aimAngle;

    /* ================= AMMO SELECTION ================= */
    if (!tank.reloading) {
      const wantHE = !canPen && dist < 520 && tank.ammoHE > 0;
      tank.currentAmmo = wantHE ? 'HE' : 'AP';
    }

    /* ================= FIRING ================= */
    const hasAmmo = (tank.currentAmmo === 'AP' && tank.ammoAP > 0) ||
                    (tank.currentAmmo === 'HE' && tank.ammoHE > 0);

    if (los && hasAmmo && !tank.reloading && !tank.gunBroken && ai.fireCooldown <= 0) {
      const diff = Math.abs(angleDelta(tank.turretAngle, aimAngle));
      const tol = clamp(0.015 + dist * 0.000055, 0.02, 0.09); // tighter up close

      if (diff < tol) ai.aimTime += dt;
      else ai.aimTime = 0;

      // Settle time grows with range and with how badly the tank is damaged
      const needed = 0.22 + Math.min(0.5, dist / 1600) + (1 - hullFrac) * 0.2;

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

    if (keys['Space']) { player.speed *= 0.9; player.throttle = 0; }

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
              damageNumbers.push({ x: player.x, y: player.y - 30, text: `+${apGain}AP +${heGain}HE`, life: 2.0, color: '#4f4', vy: -20 });
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
        damageNumbers.push({ x: tank.x, y: tank.y - 20, text: `${role.toUpperCase()} RECOVERED`, life: 1.5, color: '#4f4', vy: -25 });
      }
    }
    if (tank.gunBroken) tank.gunBroken = Math.random() > dt * 0.15;
    tank.engineDamage = 1 - tank.parts.engine.hp / tank.parts.engine.maxHp;
    tank.trackDamage = 1 - tank.parts.tracks.hp / tank.parts.tracks.maxHp;
    if (totalRepaired > 0.5 && Math.random() < dt * 10) AudioSystem.playTurretMotor();
  }

  // ============ CAMERA ============
  function updateCamera(dt) {
    if (!player) return;
    cam.x = player.x - W / 2;
    cam.y = player.y - H / 2;
    cam.x = Math.max(0, Math.min(MAP_W - W, cam.x));
    cam.y = Math.max(0, Math.min(MAP_H - H, cam.y));
    if (shakeTimer > 0) {
      shakeTimer -= dt * 60;
      cam.x += (Math.random() - 0.5) * shakeIntensity;
      cam.y += (Math.random() - 0.5) * shakeIntensity;
    }
  }

  // ============ RENDERING ============
  function drawGround() {
    ctx.fillStyle = '#1a1e12';
    ctx.fillRect(0, 0, W, H);
    for (const p of terrainPatches) {
      const ssx = p.x - cam.x, ssy = p.y - cam.y;
      if (ssx > -p.r && ssx < W + p.r && ssy > -p.r && ssy < H + p.r) {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(ssx, ssy, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(100,180,80,0.06)';
    ctx.lineWidth = 1;
    const gridSize = 64;
    const startX = -(cam.x % gridSize), startY = -(cam.y % gridSize);
    for (let x = startX; x < W; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = startY; y < H; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  function drawObstacles() {
    for (const zone of ammoZones) {
      const ssx = zone.x - cam.x;
      const ssy = zone.y - cam.y;
      if (ssx < -200 || ssx > W + 200 || ssy < -200 || ssy > H + 200) continue;
      if (zone.active) {
        const pulse = 1 + Math.sin(gameTime * 3) * 0.1;
        ctx.fillStyle = 'rgba(100, 255, 100, 0.1)';
        ctx.beginPath(); ctx.arc(ssx, ssy, zone.radius * 1.5 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(100, 255, 100, 0.3)';
        ctx.beginPath(); ctx.arc(ssx, ssy, zone.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#6f6'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ssx, ssy, zone.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#6f6'; ctx.font = 'bold 18px "Share Tech Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('AMMO', ssx, ssy);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      } else {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.beginPath(); ctx.arc(ssx, ssy, zone.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(ssx, ssy, zone.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#888'; ctx.font = '10px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(zone.respawnTimer)}s`, ssx, ssy);
        ctx.textAlign = 'start';
      }
    }
    for (const obs of obstacles) {
      const ssx = obs.x - cam.x, ssy = obs.y - cam.y;
      if (obs.type === 'building') {
        if (ssx > -obs.w && ssx < W + obs.w && ssy > -obs.h && ssy < H + obs.h) {
          ctx.fillStyle = obs.color;
          ctx.fillRect(ssx, ssy, obs.w, obs.h);
          ctx.strokeStyle = 'rgba(100,180,80,0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(ssx, ssy, obs.w, obs.h);
          if (obs.hp < 400) {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ssx + obs.w * 0.3, ssy);
            ctx.lineTo(ssx + obs.w * 0.5, ssy + obs.h * 0.6);
            ctx.moveTo(ssx + obs.w * 0.7, ssy);
            ctx.lineTo(ssx + obs.w * 0.4, ssy + obs.h * 0.8);
            ctx.stroke();
          }
        }
      } else {
        if (ssx > -obs.r && ssx < W + obs.r && ssy > -obs.r && ssy < H + obs.r) {
          ctx.fillStyle = obs.color;
          ctx.beginPath(); ctx.arc(ssx, ssy, obs.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(100,180,80,0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  function drawTrackMarks(tank) {
    if (!tank.trackMarks) return;
    for (const m of tank.trackMarks) {
      const msx = m.x - cam.x, msy = m.y - cam.y;
      if (msx > -5 && msx < W + 5 && msy > -5 && msy < H + 5) { ctx.fillStyle = `rgba(35,30,20,${m.alpha})`; ctx.fillRect(msx - 1, msy - 1, 3, 3); }
    }
  }

  function drawTank(t) {
    if (!t.alive && t.deathTimer <= 0) return;
    const ssx = t.x - cam.x, ssy = t.y - cam.y;
    const recoilBack = t.recoilOffset || 0;

    if (!t.alive) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#1a1a1a';
      ctx.save(); ctx.translate(ssx, ssy); ctx.rotate(t.angle);
      ctx.fillRect(-t.type.size.l / 2, -t.type.size.w / 2, t.type.size.l, t.type.size.w);
      ctx.restore(); ctx.globalAlpha = 1;
      if (Math.random() < 0.2) {
        particles.push({ x: t.x + (Math.random() - 0.5) * 20, y: t.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 20, life: 0.4, maxLife: 0.7, size: 3, color: '#333', alpha: 0.4 });
      }
      return;
    }

    const hl = t.type.size.l, hw = t.type.size.w;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.save(); ctx.translate(ssx + 2, ssy + 2); ctx.rotate(t.angle);
    ctx.fillRect(-hl / 2, -hw / 2, hl, hw);
    ctx.restore();

    ctx.fillStyle = '#111';
    ctx.save(); ctx.translate(ssx, ssy); ctx.rotate(t.angle);
    ctx.fillRect(-hl / 2, -hw / 2 - 5, hl, 6);
    ctx.fillRect(-hl / 2, hw / 2 - 1, hl, 6);
    ctx.restore();

    ctx.save(); ctx.translate(ssx, ssy); ctx.rotate(t.angle);
    ctx.fillStyle = t.hitFlash > 0.5 ? '#fff' : t.type.color;
    ctx.strokeStyle = t.type.accent;
    ctx.lineWidth = 2;
    ctx.fillRect(-hl / 2, -hw / 2, hl, hw);
    ctx.strokeRect(-hl / 2, -hw / 2, hl, hw);
    ctx.fillStyle = t.type.accent;
    ctx.beginPath();
    ctx.moveTo(hl / 2, -hw / 2 + 6);
    ctx.lineTo(hl / 2 - 12, -hw / 2);
    ctx.lineTo(hl / 2 - 12, hw / 2);
    ctx.lineTo(hl / 2, hw / 2 - 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save(); ctx.translate(ssx, ssy); ctx.rotate(t.turretAngle);
    ctx.fillStyle = t.hitFlash > 0.5 ? '#fff' : t.type.color;
    ctx.strokeStyle = t.type.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, t.type.turretR, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = t.hitFlash > 0.5 ? '#444' : t.type.gunColor;
    ctx.fillRect(t.type.turretR - 2, -3, t.type.barrel - t.type.turretR + recoilBack * 0.5, 6);
    if (t.type.id !== 't34' && t.type.id !== 't44') {
      ctx.fillStyle = '#111';
      ctx.fillRect(t.type.barrel - 6 + recoilBack * 0.5, -5, 8, 10);
    }
    ctx.restore();

    if (t.muzzleFlash > 0) {
      ctx.fillStyle = `rgba(255,220,120,${t.muzzleFlash / 8})`;
      ctx.beginPath(); ctx.arc(ssx + Math.cos(t.turretAngle) * t.type.barrel, ssy + Math.sin(t.turretAngle) * t.type.barrel, t.muzzleFlash * 1.5, 0, Math.PI * 2); ctx.fill();
    }

    if (t.onFire) {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(255,${Math.floor(80 + Math.random() * 175)},0,0.7)`;
        ctx.beginPath(); ctx.arc(ssx + (Math.random() - 0.5) * 30, ssy + (Math.random() - 0.5) * 30 - 5, 3 + Math.random() * 6, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (!t.isPlayer) {
      const barW = 36, barH = 3;
      const hppct = Math.max(0, t.parts.hull.hp / t.parts.hull.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(ssx - barW / 2, ssy - 32, barW, barH);
      ctx.fillStyle = hppct > 0.5 ? '#6f6' : hppct > 0.25 ? '#fc0' : '#f44';
      ctx.fillRect(ssx - barW / 2, ssy - 32, barW * hppct, barH);
    }
  }

  function drawBullets() {
    for (const b of [...bullets_player, ...bullets]) {
      const bsx = b.x - cam.x, bsy = b.y - cam.y;
      for (let i = 0; i < b.trail.length; i++) {
        const tr = b.trail[i];
        ctx.fillStyle = `rgba(255,200,100,${tr.alpha * 0.35})`;
        ctx.beginPath(); ctx.arc(tr.x - cam.x, tr.y - cam.y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(bsx, bsy, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bsx, bsy, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawExplosions() {
    for (const e of explosions) {
      const esx = e.x - cam.x, esy = e.y - cam.y;
      const grad = ctx.createRadialGradient(esx, esy, 0, esx, esy, e.radius);
      grad.addColorStop(0, `rgba(255,220,100,${e.alpha * 0.7})`);
      grad.addColorStop(0.4, `rgba(255,100,50,${e.alpha * 0.4})`);
      grad.addColorStop(1, `rgba(255,50,0,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(esx - e.radius, esy - e.radius, e.radius * 2, e.radius * 2);
      ctx.strokeStyle = `rgba(255,100,50,${e.alpha})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(esx, esy, e.radius, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawDebris() {
    for (const d of debris) {
      if (d.type === 'scorch') {
        ctx.fillStyle = `rgba(10,5,0,${d.alpha * 0.5})`;
        ctx.beginPath(); ctx.arc(d.x - cam.x, d.y - cam.y, d.radius, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawDamageNumbers() {
    for (const d of damageNumbers) {
      ctx.fillStyle = d.color;
      ctx.font = 'bold 14px "Orbitron", "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, Math.min(1, d.life));
      ctx.fillText(d.text, d.x - cam.x, d.y - cam.y);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }
  }

  function drawMapBorder() {
    ctx.strokeStyle = 'rgba(255,50,50,0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(-cam.x, -cam.y, MAP_W, MAP_H);
  }

  // ============ MINIMAP ============
  function drawMinimap() {
    mctx.fillStyle = '#0a0e08'; mctx.fillRect(0, 0, 160, 160);
    const scale = 160 / MAP_W;
    mctx.fillStyle = '#333';
    for (const obs of obstacles) {
      if (obs.type === 'building') mctx.fillRect(obs.x * scale, obs.y * scale, Math.max(1, obs.w * scale), Math.max(1, obs.h * scale));
      else { mctx.beginPath(); mctx.arc(obs.x * scale, obs.y * scale, Math.max(1, obs.r * scale), 0, Math.PI * 2); mctx.fill(); }
    }
    mctx.fillStyle = '#f44';
    for (const e of enemies) { if (!e.alive) continue; mctx.beginPath(); mctx.arc(e.x * scale, e.y * scale, 2, 0, Math.PI * 2); mctx.fill(); }
    if (player && player.alive) {
      mctx.fillStyle = '#6f6'; mctx.beginPath(); mctx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#6f6'; mctx.lineWidth = 1; mctx.beginPath();
      mctx.moveTo(player.x * scale, player.y * scale);
      mctx.lineTo(player.x * scale + Math.cos(player.turretAngle) * 12, player.y * scale + Math.sin(player.turretAngle) * 12);
      mctx.stroke();
    }
    for (const zone of ammoZones) {
      if (zone.active) { mctx.fillStyle = '#4f4'; mctx.beginPath(); mctx.arc(zone.x * scale, zone.y * scale, 3, 0, Math.PI * 2); mctx.fill(); }
      else { mctx.fillStyle = '#444'; mctx.beginPath(); mctx.arc(zone.x * scale, zone.y * scale, 2, 0, Math.PI * 2); mctx.fill(); }
    }
    mctx.strokeStyle = 'rgba(120,220,100,0.4)'; mctx.lineWidth = 1;
    mctx.strokeRect(cam.x * scale, cam.y * scale, W * scale, H * scale);
  }

  // ============ SPAWNING ============
  const GERMAN_TANKS = [0, 1, 2];
  const RUSSIAN_TANKS = [3, 4, 5];

  function getEnemyFaction(playerTypeId) {
    const isPlayerGerman = GERMAN_TANKS.includes(playerTypeId);
    return isPlayerGerman ? RUSSIAN_TANKS : GERMAN_TANKS;
  }

  function spawnEnemy() {
    const playerTypeId = TANK_TYPES.indexOf(player.type);
    const enemyFaction = getEnemyFaction(playerTypeId);
    let typeIdx;
    if (wave >= 4) typeIdx = enemyFaction[Math.floor(Math.random() * enemyFaction.length)];
    else if (wave >= 2) typeIdx = enemyFaction[Math.floor(Math.random() * Math.min(2, enemyFaction.length))];
    else typeIdx = enemyFaction[0];
    const type = TANK_TYPES[typeIdx];
    let ssx, ssy;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { ssx = player.x - W; ssy = player.y + (Math.random() - 0.5) * H; }
    else if (side === 1) { ssx = player.x + W; ssy = player.y + (Math.random() - 0.5) * H; }
    else if (side === 2) { ssx = player.x + (Math.random() - 0.5) * W; ssy = player.y - H; }
    else { ssx = player.x + (Math.random() - 0.5) * W; ssy = player.y + H; }
    ssx = Math.max(60, Math.min(MAP_W - 60, ssx));
    ssy = Math.max(60, Math.min(MAP_H - 60, ssy));
    const enemy = createTank(type, ssx, ssy, Math.random() * Math.PI * 2, false);
    enemy.ammoAP = type.gun.reload * 8;
    enemy.ammoHE = type.gun.reload * 4;
    enemies.push(enemy);
  }

  function updateSpawning(dt) {
    if (!gameRunning) return;
    spawnTimer -= dt;
    if (spawnTimer <= 0 && enemiesToSpawn > 0) { spawnEnemy(); enemiesToSpawn--; spawnTimer = 3 + Math.random() * 2.5; }
    if (enemiesToSpawn <= 0 && enemies.filter(e => e.alive).length === 0) {
      wave++; enemiesToSpawn = 3 + wave * 2;
      AudioSystem.playWaveAlert();
      addKillFeed(null, `WAVE ${wave} INCOMING`);
    }
  }

  // ============ HUD ============
  function updateHUD() {
    if (!player) return;
    dot('dot-driver', player.crew.driver); dot('dot-gunner', player.crew.gunner); dot('dot-loader', player.crew.loader); dot('dot-commander', player.crew.commander);
    const ammoText = document.getElementById('ammo-readout'), ammoTypeEl = document.getElementById('ammo-type');
    if (player.currentAmmo === 'AP') { ammoText.textContent = `AP: ${player.ammoAP} / ${player.ammoHE}`; ammoTypeEl.textContent = 'ARMOR-PIERCING'; }
    else { ammoText.textContent = `HE: ${player.ammoHE} / ${player.ammoAP}`; ammoTypeEl.textContent = 'HIGH-EXPLOSIVE'; }
    const reloadBar = document.getElementById('reload-bar');
    reloadBar.style.width = (player.reloading ? (player.reloadTimer / player.reloadTime) * 100 : 100) + '%';
    const gunState = document.getElementById('gun-state');
    if (player.gunBroken) { gunState.textContent = 'DESTROYED'; gunState.style.color = '#f44'; }
    else if (player.reloading) { gunState.textContent = 'RELOADING...'; gunState.style.color = '#fc0'; }
    else { gunState.textContent = 'READY'; gunState.style.color = '#9f9'; }
    updateBar('hull', player.parts.hull.hp / player.parts.hull.maxHp * 100, 'hp');
    updateBar('engine', player.parts.engine.hp / player.parts.engine.maxHp * 100, 'engine');
    updateBar('turret', player.parts.turret.hp / player.parts.turret.maxHp * 100, 'turret');
    updateBar('gun', player.parts.gun.hp / player.parts.gun.maxHp * 100, 'gun');
    updateBar('track', player.parts.tracks.hp / player.parts.tracks.maxHp * 100, 'track');
    document.getElementById('score').textContent = score;
    const mins = Math.floor(gameTime / 60), secs = Math.floor(gameTime % 60);
    document.getElementById('timer').textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    document.getElementById('tank-count').textContent = `Enemies: ${enemies.filter(e => e.alive).length} | Wave ${wave}`;
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
    pct = Math.max(0, pct); bar.style.width = pct + '%'; bar.className = `bar ${type}`;
    txt.textContent = Math.round(pct) + '%';
    if (pct < 25) bar.style.background = '#f44'; else if (pct < 50) bar.style.background = '#fc0';
  }

  // ============ KILL FEED ============
  function addKillFeed(tank, msg) {
    const feed = document.getElementById('kill-feed');
    const div = document.createElement('div');
    div.className = 'kill-msg';
    div.innerHTML = tank ? `💥 <span style="color:#f66">${tank.type.name}</span> ${msg || 'destroyed'}` : `<span style="color:#fc0">${msg}</span>`;
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
      Survival Time: <b>${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2,'0')}</b><br>
      Waves Survived: <b>${wave - 1}</b>
    `;
    AudioSystem.playGameOver();
  }

  // ============ INPUT ============
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
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
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (player) player.currentAmmo = player.currentAmmo === 'AP' ? 'HE' : 'AP'; });

  // ============ MAIN LOOP ============
  function gameLoop(timestamp) {
    if (!gameRunning) { requestAnimationFrame(gameLoop); return; }
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp; gameTime += dt;

    updatePlayer(dt);
    for (const e of enemies) { if (e.alive) updateAI(e, dt); updateTankPhysics(e, dt); }
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

    ctx.clearRect(0, 0, W, H);
    drawGround();
    drawMapBorder();
    drawDebris();
    drawObstacles();
    if (player) drawTrackMarks(player);
    for (const e of enemies) drawTrackMarks(e);
    for (const e of enemies) drawTank(e);
    if (player) drawTank(player);
    drawBullets();
    drawParticles();
    drawExplosions();
    drawDamageNumbers();
    drawMinimap();
    updateHUD();
    requestAnimationFrame(gameLoop);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 50 * dt;
      p.life -= dt; p.alpha = Math.max(0, p.life / p.maxLife); p.size *= 0.995;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      e.radius += (e.maxRadius - e.radius) * dt * 14;
      e.life -= dt; e.alpha = Math.max(0, e.life / 0.5);
      if (e.life <= 0) explosions.splice(i, 1);
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      debris[i].life -= dt; debris[i].alpha = Math.max(0, debris[i].life / 20);
      if (debris[i].life <= 0) debris.splice(i, 1);
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
          <div class="stats">SPD:${tk.speed} | GUN:${tk.gun.caliber}mm | RLD:${tk.gun.reload}s | ${tk.armor.front}F/${tk.armor.side}S</div>
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
    bullets = []; bullets_player = []; enemies = []; particles = []; explosions = []; debris = []; damageNumbers = [];
    gameTime = 0; score = 0; killCount = 0; wave = 1; enemiesToSpawn = 5; spawnTimer = 1;
    SQUAD.t = -999;
    SQUAD.spotterX = 0; SQUAD.spotterY = 0;
    generateMap();
    player = createTank(tankType, MAP_W / 2, MAP_H / 2, 0, true);
    for (let i = 0; i < 3; i++) spawnEnemy();
    enemiesToSpawn -= 3;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('gameover-screen').style.display = 'none';
    gameRunning = true; lastTime = performance.now();
    AudioSystem.init();
  }

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
  });
  buildTankSelect();
  requestAnimationFrame(gameLoop);
})();