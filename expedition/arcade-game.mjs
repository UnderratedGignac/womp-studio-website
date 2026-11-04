import {createVolley, stepProjectile, drawProjectile, weaponIds, profiles} from './projectiles/index.mjs';

export function createArcadeGame(canvasId = 'arcade-game-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return null;
  const ctx = canvas.getContext('2d');

  // DOM HUD Elements
  const hpFill = document.getElementById('arcade-hp-fill');
  const hpText = document.getElementById('arcade-hp-text');
  const scoreEl = document.getElementById('arcade-score');
  const killsEl = document.getElementById('arcade-kills');
  const bossWrap = document.getElementById('arcade-boss-wrap');
  const bossFill = document.getElementById('arcade-boss-fill');
  const overlay = document.getElementById('arcade-overlay');
  const modalTitle = document.getElementById('arcade-modal-title');
  const modalDesc = document.getElementById('arcade-modal-desc');
  const modalStats = document.getElementById('arcade-modal-stats');
  const finalScore = document.getElementById('final-score');
  const finalKills = document.getElementById('final-kills');
  const startBtn = document.getElementById('arcade-start-btn');
  const wepButtons = Array.from(document.querySelectorAll('.arcade-wep-btn'));

  // Mobile Controls
  const stickZone = document.getElementById('virtual-stick-zone');
  const stickKnob = document.getElementById('virtual-stick-knob');
  const fireBtn = document.getElementById('virtual-fire-btn');
  const swapBtn = document.getElementById('virtual-swap-btn');

  // Audio Context for crisp in-game SFX
  let audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'shot') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'kill') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'pickup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'hurt') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (_) {}
  }

  // Preload authentic game sprites
  const sprites = {};
  const assetPaths = {
    hero: './assets/hero-swim.webp',
    raider: './assets/barracuda-sheet.webp',
    jelly: './assets/jellyfish-sheet.webp',
    boss: './assets/boss_abyssal-sheet.webp',
    snapper: './assets/snapperpistol.png',
    kraken: './assets/krakenshotgun.png',
    minigun: './assets/reefminigun.png',
    rail: './assets/narwhalrail.png',
    clam: './assets/clamcannon.png'
  };

  for (const [key, path] of Object.entries(assetPaths)) {
    const img = new Image();
    img.src = new URL(path, import.meta.url).href;
    sprites[key] = img;
  }

  // Game Arena Dimensions
  const V_WIDTH = 960;
  const V_HEIGHT = 540;

  // Game State
  let running = false;
  let gameOver = false;
  let score = 0;
  let kills = 0;
  let wave = 1;
  let lastTime = performance.now();
  let lastFireTime = 0;

  // Player Entity
  const player = {
    x: 180,
    y: 270,
    vx: 0,
    vy: 0,
    speed: 380,
    radius: 28,
    hp: 100,
    maxHp: 100,
    weaponIdx: 0,
    aimAngle: 0,
    tailPhase: 0,
    recoil: 0,
    invuln: 0
  };

  // Input State
  const keys = { w: false, a: false, s: false, d: false, space: false };
  let mouse = { x: 500, y: 270, down: false };
  let joystick = { active: false, dx: 0, dy: 0, touchId: null };

  // Game Entities
  let bullets = [];
  let enemies = [];
  let enemyBullets = [];
  let pickups = [];
  let particles = [];
  let boss = null;
  let spawnTimer = 0;
  let bossSpawned = false;

  // Background bubbles
  const bgBubbles = Array.from({ length: 32 }, () => ({
    x: Math.random() * V_WIDTH,
    y: Math.random() * V_HEIGHT,
    r: 1 + Math.random() * 3.5,
    speed: 20 + Math.random() * 45,
    wobble: Math.random() * Math.PI * 2
  }));

  function resetGame() {
    running = true;
    gameOver = false;
    score = 0;
    kills = 0;
    wave = 1;
    player.x = 180;
    player.y = 270;
    player.vx = 0;
    player.vy = 0;
    player.hp = 100;
    player.invuln = 0;
    bullets = [];
    enemies = [];
    enemyBullets = [];
    pickups = [];
    particles = [];
    boss = null;
    bossSpawned = false;
    spawnTimer = 0;
    lastTime = performance.now();

    if (overlay) overlay.style.display = 'none';
    if (bossWrap) bossWrap.style.display = 'none';
    updateHUD();
  }

  function setWeapon(idx) {
    player.weaponIdx = Math.max(0, Math.min(weaponIds.length - 1, idx));
    wepButtons.forEach((btn, i) => btn.classList.toggle('active', i === player.weaponIdx));
    playSound('shot');
  }

  function fireWeapon() {
    const now = performance.now() / 1000;
    const wId = weaponIds[player.weaponIdx];
    const prof = profiles[wId];
    if (!prof) return;

    const cooldown = 1 / Math.max(1, prof.fireRate || 2.5);
    if (now - lastFireTime < cooldown) return;
    lastFireTime = now;
    player.recoil = 1;

    // Spawn volley
    const volley = createVolley(wId, {
      x: player.x + Math.cos(player.aimAngle) * 36,
      y: player.y + Math.sin(player.aimAngle) * 36,
      angle: player.aimAngle,
      damage: 18,
      speedMul: 1.15
    });

    bullets.push(...volley);
    playSound('shot');

    // Muzzle sparks
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: player.x + Math.cos(player.aimAngle) * 38,
        y: player.y + Math.sin(player.aimAngle) * 38,
        vx: (Math.random() - 0.5) * 80 + Math.cos(player.aimAngle) * 120,
        vy: (Math.random() - 0.5) * 80 + Math.sin(player.aimAngle) * 120,
        r: 2 + Math.random() * 2,
        life: 0.25,
        maxLife: 0.25,
        color: '#7ef5e1'
      });
    }
  }

  function spawnEnemy(type = 'raider') {
    const y = 60 + Math.random() * (V_HEIGHT - 120);
    if (type === 'raider') {
      enemies.push({
        type: 'raider',
        x: V_WIDTH + 50,
        y,
        vx: -(90 + Math.random() * 50),
        vy: (Math.random() - 0.5) * 40,
        hp: 30,
        maxHp: 30,
        radius: 24,
        scoreVal: 25,
        shootCooldown: 2.2 + Math.random() * 2,
        hitTimer: 0,
        frameTimer: 0,
        frame: 0
      });
    } else if (type === 'jelly') {
      enemies.push({
        type: 'jelly',
        x: V_WIDTH + 60,
        y,
        vx: -60,
        vy: Math.sin(Date.now() / 400) * 50,
        hp: 65,
        maxHp: 65,
        radius: 32,
        scoreVal: 60,
        shootCooldown: 1.8,
        hitTimer: 0,
        frameTimer: 0,
        frame: 0
      });
    }
  }

  function spawnBoss() {
    bossSpawned = true;
    boss = {
      type: 'boss',
      x: V_WIDTH + 140,
      y: V_HEIGHT * 0.5,
      targetY: V_HEIGHT * 0.5,
      hp: 550,
      maxHp: 550,
      radius: 65,
      shootTimer: 1.2,
      chargeTimer: 6.0,
      charging: false,
      hitTimer: 0,
      frame: 0
    };
    if (bossWrap) bossWrap.style.display = 'flex';
  }

  function updateHUD() {
    if (hpFill) {
      const pct = Math.max(0, (player.hp / player.maxHp) * 100);
      hpFill.style.width = pct + '%';
      hpFill.style.background = pct > 45 ? 'var(--seafoam)' : pct > 20 ? '#ffb703' : '#e63946';
    }
    if (hpText) hpText.textContent = `${Math.max(0, Math.round(player.hp))} / ${player.maxHp}`;
    if (scoreEl) scoreEl.textContent = String(score);
    if (killsEl) killsEl.textContent = String(kills);
    if (boss && bossFill) {
      const bPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      bossFill.style.width = bPct + '%';
    }
  }

  function triggerGameOver(won = false) {
    running = false;
    gameOver = true;
    if (overlay) overlay.style.display = 'flex';
    if (modalTitle) modalTitle.textContent = won ? '🏆 Mission Cleared!' : '💀 Submersible Destroyed';
    if (modalDesc) modalDesc.textContent = won 
      ? 'The abyssal titan was vanquished and the trench secured!' 
      : 'Hull integrity reached zero. Re-arm and dive again!';
    if (modalStats) modalStats.style.display = 'flex';
    if (finalScore) finalScore.textContent = String(score);
    if (finalKills) finalKills.textContent = String(kills);
    if (startBtn) startBtn.textContent = '🔄 Play Again';
  }

  // Event Listeners
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['w', 'arrowup'].includes(k)) keys.w = true;
    if (['a', 'arrowleft'].includes(k)) keys.a = true;
    if (['s', 'arrowdown'].includes(k)) keys.s = true;
    if (['d', 'arrowright'].includes(k)) keys.d = true;
    if ([' ', 'spacebar'].includes(k)) { keys.space = true; fireWeapon(); }
    if (['1', '2', '3', '4', '5'].includes(k)) setWeapon(Number(k) - 1);
    if (k === 'q') setWeapon((player.weaponIdx + 4) % 5);
    if (k === 'e') setWeapon((player.weaponIdx + 1) % 5);
  });

  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (['w', 'arrowup'].includes(k)) keys.w = false;
    if (['a', 'arrowleft'].includes(k)) keys.a = false;
    if (['s', 'arrowdown'].includes(k)) keys.s = false;
    if (['d', 'arrowright'].includes(k)) keys.d = false;
    if ([' ', 'spacebar'].includes(k)) keys.space = false;
  });

  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = V_WIDTH / rect.width;
    const scaleY = V_HEIGHT / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
    player.aimAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  });

  canvas.addEventListener('pointerdown', e => {
    mouse.down = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = V_WIDTH / rect.width;
    const scaleY = V_HEIGHT / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
    player.aimAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    if (running) fireWeapon();
  });

  window.addEventListener('pointerup', () => { mouse.down = false; });

  // Virtual Joystick on Mobile
  if (stickZone && stickKnob) {
    function handleStickTouch(e) {
      e.preventDefault();
      const rect = stickZone.getBoundingClientRect();
      const touch = e.touches[0];
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const maxDist = rect.width * 0.4;
      const clampedDist = Math.min(dist, maxDist);
      const angle = Math.atan2(dy, dx);

      joystick.active = true;
      joystick.dx = (Math.cos(angle) * clampedDist) / maxDist;
      joystick.dy = (Math.sin(angle) * clampedDist) / maxDist;
      stickKnob.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
    }

    stickZone.addEventListener('touchstart', handleStickTouch, { passive: false });
    stickZone.addEventListener('touchmove', handleStickTouch, { passive: false });
    function resetStick(e) {
      e.preventDefault();
      joystick.active = false;
      joystick.dx = 0;
      joystick.dy = 0;
      stickKnob.style.transform = 'translate(0px, 0px)';
    }
    stickZone.addEventListener('touchend', resetStick, { passive: false });
    stickZone.addEventListener('touchcancel', resetStick, { passive: false });
  }

  if (fireBtn) {
    let fireInterval = 0;
    const startFire = (e) => {
      e.preventDefault();
      fireWeapon();
      clearInterval(fireInterval);
      fireInterval = setInterval(fireWeapon, 160);
    };
    const stopFire = (e) => {
      e.preventDefault();
      clearInterval(fireInterval);
    };
    fireBtn.addEventListener('pointerdown', startFire);
    fireBtn.addEventListener('pointerup', stopFire);
    fireBtn.addEventListener('pointercancel', stopFire);
  }

  if (swapBtn) {
    swapBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      setWeapon((player.weaponIdx + 1) % 5);
    });
  }

  wepButtons.forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      setWeapon(Number(btn.dataset.wepIdx || 0));
    });
  });

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      resetGame();
    });
  }

  // Main Game Animation Loop
  function gameLoop(now) {
    const dt = Math.min(0.06, (now - lastTime) / 1000);
    lastTime = now;

    if (running) {
      // 1. Process Player Movement
      let moveX = 0, moveY = 0;
      if (keys.w) moveY -= 1;
      if (keys.s) moveY += 1;
      if (keys.a) moveX -= 1;
      if (keys.d) moveX += 1;
      if (joystick.active) {
        moveX = joystick.dx;
        moveY = joystick.dy;
        player.aimAngle = Math.atan2(joystick.dy, joystick.dx);
      }

      const len = Math.hypot(moveX, moveY);
      if (len > 0) {
        player.vx += (moveX / (len > 1 ? len : 1)) * player.speed * dt * 4;
        player.vy += (moveY / (len > 1 ? len : 1)) * player.speed * dt * 4;
        player.tailPhase += dt * 14;
      } else {
        player.tailPhase += dt * 4;
      }

      // Drag
      player.vx *= 0.88;
      player.vy *= 0.88;
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      // Arena boundary clamp
      player.x = Math.max(player.radius + 10, Math.min(V_WIDTH - player.radius - 10, player.x));
      player.y = Math.max(player.radius + 10, Math.min(V_HEIGHT - player.radius - 10, player.y));

      if (player.invuln > 0) player.invuln -= dt;
      if (player.recoil > 0) player.recoil = Math.max(0, player.recoil - dt * 6);

      // Continuous mouse fire
      if (mouse.down && !keys.space) fireWeapon();

      // 2. Spawn Enemies
      spawnTimer += dt;
      if (!boss) {
        const interval = Math.max(1.0, 3.2 - kills * 0.08);
        if (spawnTimer >= interval) {
          spawnTimer = 0;
          spawnEnemy(Math.random() > 0.35 ? 'raider' : 'jelly');
        }
        if (kills >= 14 && !bossSpawned) {
          spawnBoss();
        }
      }

      // 3. Step Bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!stepProjectile(b, dt) || b.x > V_WIDTH + 60 || b.x < -60 || b.y < -60 || b.y > V_HEIGHT + 60) {
          bullets.splice(i, 1);
          continue;
        }

        // Bullet vs Enemies
        let hit = false;
        for (const en of enemies) {
          if (Math.hypot(b.x - en.x, b.y - en.y) < en.radius + b.radius) {
            en.hp -= b.damage || 15;
            en.hitTimer = 0.12;
            hit = true;
            playSound('hit');

            // Hit sparks
            for (let s = 0; s < 3; s++) {
              particles.push({
                x: b.x, y: b.y,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.5) * 160,
                r: 2, life: 0.2, maxLife: 0.2,
                color: '#ffd166'
              });
            }
            break;
          }
        }

        // Bullet vs Boss
        if (!hit && boss && Math.hypot(b.x - boss.x, b.y - boss.y) < boss.radius + b.radius) {
          boss.hp -= b.damage || 15;
          boss.hitTimer = 0.1;
          hit = true;
          playSound('hit');
        }

        if (hit && !b.pierce) {
          bullets.splice(i, 1);
        }
      }

      // 4. Step Enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        en.x += en.vx * dt;
        en.y += en.vy * dt;
        if (en.hitTimer > 0) en.hitTimer -= dt;

        // Enemy shooting
        en.shootCooldown -= dt;
        if (en.shootCooldown <= 0 && en.x < V_WIDTH - 20) {
          en.shootCooldown = 2.4 + Math.random() * 1.5;
          const a = Math.atan2(player.y - en.y, player.x - en.x);
          enemyBullets.push({
            x: en.x - 20, y: en.y,
            vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
            radius: 6, life: 4
          });
        }

        // Check death
        if (en.hp <= 0) {
          score += en.scoreVal;
          kills += 1;
          playSound('kill');

          // Spawn death explosion particles
          for (let p = 0; p < 12; p++) {
            particles.push({
              x: en.x, y: en.y,
              vx: (Math.random() - 0.5) * 220,
              vy: (Math.random() - 0.5) * 220,
              r: 3 + Math.random() * 3,
              life: 0.45, maxLife: 0.45,
              color: en.type === 'jelly' ? '#ff70a6' : '#7ef5e1'
            });
          }

          // Chance to drop pearl
          if (Math.random() > 0.4) {
            pickups.push({ x: en.x, y: en.y, vx: -20, vy: -10, r: 8, life: 8 });
          }

          enemies.splice(i, 1);
          continue;
        }

        // Collision with player
        if (player.invuln <= 0 && Math.hypot(player.x - en.x, player.y - en.y) < player.radius + en.radius) {
          player.hp -= 20;
          player.invuln = 0.8;
          playSound('hurt');
          if (player.hp <= 0) triggerGameOver(false);
        }

        // Despawn off-screen left
        if (en.x < -80) enemies.splice(i, 1);
      }

      // 5. Step Boss
      if (boss) {
        if (boss.x > V_WIDTH - 180) boss.x -= 80 * dt;
        boss.y += Math.sin(now / 500) * 80 * dt;
        if (boss.hitTimer > 0) boss.hitTimer -= dt;

        boss.shootTimer -= dt;
        if (boss.shootTimer <= 0) {
          boss.shootTimer = 1.3;
          const baseAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
          for (let s = -1; s <= 1; s++) {
            const a = baseAngle + s * 0.22;
            enemyBullets.push({
              x: boss.x - 40, y: boss.y,
              vx: Math.cos(a) * 210, vy: Math.sin(a) * 210,
              radius: 8, life: 4.5
            });
          }
          playSound('shot');
        }

        if (player.invuln <= 0 && Math.hypot(player.x - boss.x, player.y - boss.y) < player.radius + boss.radius) {
          player.hp -= 35;
          player.invuln = 1.0;
          playSound('hurt');
          if (player.hp <= 0) triggerGameOver(false);
        }

        if (boss.hp <= 0) {
          score += 500;
          kills += 1;
          playSound('kill');
          boss = null;
          if (bossWrap) bossWrap.style.display = 'none';
          triggerGameOver(true);
        }
      }

      // 6. Step Enemy Bullets
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const eb = enemyBullets[i];
        eb.x += eb.vx * dt;
        eb.y += eb.vy * dt;
        eb.life -= dt;
        if (eb.life <= 0 || eb.x < -20 || eb.x > V_WIDTH + 20 || eb.y < -20 || eb.y > V_HEIGHT + 20) {
          enemyBullets.splice(i, 1);
          continue;
        }

        if (player.invuln <= 0 && Math.hypot(player.x - eb.x, player.y - eb.y) < player.radius + eb.radius) {
          player.hp -= 15;
          player.invuln = 0.7;
          playSound('hurt');
          enemyBullets.splice(i, 1);
          if (player.hp <= 0) triggerGameOver(false);
        }
      }

      // 7. Step Pickups
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.x += p.vx * dt;
        p.y += Math.sin(now / 300) * 15 * dt;
        p.life -= dt;
        if (p.life <= 0 || p.x < -20) {
          pickups.splice(i, 1);
          continue;
        }
        if (Math.hypot(player.x - p.x, player.y - p.y) < player.radius + p.r + 10) {
          score += 100;
          player.hp = Math.min(player.maxHp, player.hp + 20);
          playSound('pickup');
          pickups.splice(i, 1);
        }
      }

      // 8. Step Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      updateHUD();
    }

    // 9. DRAW SCENE
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // Deep Underwater Gradient
    const bg = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
    bg.addColorStop(0, '#042138');
    bg.addColorStop(0.5, '#021626');
    bg.addColorStop(1, '#010c17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Ambient Bubbles
    ctx.fillStyle = 'rgba(126, 245, 225, 0.22)';
    for (const b of bgBubbles) {
      b.y -= b.speed * dt;
      b.x += Math.sin(now / 600 + b.wobble) * 0.4;
      if (b.y < -10) { b.y = V_HEIGHT + 10; b.x = Math.random() * V_WIDTH; }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grid Caustics Line Effect
    ctx.strokeStyle = 'rgba(126, 245, 225, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < V_WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, V_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < V_HEIGHT; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(V_WIDTH, y);
      ctx.stroke();
    }

    // Draw Pickups (Glowing Pearls)
    for (const p of pickups) {
      ctx.save();
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Player Bullets
    for (const b of bullets) {
      drawProjectile(ctx, b, now / 100);
    }

    // Draw Enemy Bullets (Red Torpedoes)
    ctx.fillStyle = '#ff4d6d';
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 8;
    for (const eb of enemyBullets) {
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, eb.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw Enemies
    for (const en of enemies) {
      ctx.save();
      ctx.translate(en.x, en.y);
      if (en.hitTimer > 0) ctx.filter = 'brightness(2) contrast(1.5)';
      const img = en.type === 'jelly' ? sprites.jelly : sprites.raider;
      if (img && img.complete && img.naturalWidth) {
        const fw = img.naturalWidth / 4;
        const fh = img.naturalHeight;
        const frame = Math.floor(now / 150) % 4;
        ctx.drawImage(img, frame * fw, 0, fw, fh, -en.radius * 1.5, -en.radius * 1.5, en.radius * 3, en.radius * 3);
      } else {
        ctx.fillStyle = en.type === 'jelly' ? '#ff70a6' : '#e63946';
        ctx.beginPath();
        ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      // Mini HP bar above enemy
      const hpPct = en.hp / en.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-20, -en.radius - 12, 40, 5);
      ctx.fillStyle = '#7ef5e1';
      ctx.fillRect(-20, -en.radius - 12, 40 * hpPct, 5);
      ctx.restore();
    }

    // Draw Boss
    if (boss) {
      ctx.save();
      ctx.translate(boss.x, boss.y);
      if (boss.hitTimer > 0) ctx.filter = 'brightness(2.2)';
      const img = sprites.boss;
      if (img && img.complete && img.naturalWidth) {
        const fw = img.naturalWidth / 4;
        const fh = img.naturalHeight;
        const frame = Math.floor(now / 200) % 4;
        ctx.drawImage(img, frame * fw, 0, fw, fh, -boss.radius * 1.5, -boss.radius * 1.5, boss.radius * 3, boss.radius * 3);
      } else {
        ctx.fillStyle = '#a01a35';
        ctx.beginPath();
        ctx.arc(0, 0, boss.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Player (Pleco Fighter)
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.invuln > 0 && Math.floor(now / 80) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Rotate player towards aim angle
    ctx.rotate(player.aimAngle);
    const heroImg = sprites.hero;
    if (heroImg && heroImg.complete && heroImg.naturalWidth) {
      const fw = heroImg.naturalWidth / 4;
      const fh = heroImg.naturalHeight;
      const frame = Math.floor(now / 140) % 4;
      ctx.drawImage(heroImg, frame * fw, 0, fw, fh, -36, -26, 72, 52);
    } else {
      ctx.fillStyle = '#7ef5e1';
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Equipped Weapon on Player
    const wepImgKeys = ['snapper', 'kraken', 'minigun', 'rail', 'clam'];
    const curWepImg = sprites[wepImgKeys[player.weaponIdx]];
    if (curWepImg && curWepImg.complete && curWepImg.naturalWidth) {
      const recOff = player.recoil * -6;
      ctx.drawImage(curWepImg, 12 + recOff, -8, 36, 18);
    }
    ctx.restore();

    // Draw Particles
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  return {
    start: resetGame,
    setWeapon,
    isRunning: () => running
  };
}
