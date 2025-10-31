// game.js (modular split version)
// Simple, commented, and robust setup.
// Make sure index.html & style.css are in the same folder.

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('miniCanvas');
const miniCtx = miniCanvas.getContext('2d');

let W = window.innerWidth, H = window.innerHeight;
function resizeCanvas(){
  W = Math.max(800, window.innerWidth);
  H = Math.max(480, Math.round(window.innerHeight * 0.95));
  canvas.width = W; canvas.height = H;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// WORLD (large)
const WORLD = { w: W * 2.2, h: H * 1.6 };

// Camera
let camera = { x: 0, y: 0 };
function updateCamera(){
  camera.x = clamp(player.x - canvas.width/2, 0, WORLD.w - canvas.width);
  camera.y = clamp(player.y - canvas.height/2, 0, WORLD.h - canvas.height);
}

// Player (larger limbs)
const player = {
  x: WORLD.w/2, y: WORLD.h/2,
  speed: 220, hp: 260, maxHp:260, invul:0, stepTimer:0, facingAngle:0,
  hasFruit:false, activeFruit:null
};

// State
let enemies = [], boss = null;
let particles = [], projectiles = [], coins = [];
let coinCount = 0, wave = 1, maxWaves = 5, waveDelay=false;
let cooldowns = { s1:0, s2:0, s3:0 };

// UI refs
const hpValue = document.getElementById('hpValue');
const coinValue = document.getElementById('coinValue');
const waveValue = document.getElementById('waveValue');
const centerMsg = document.getElementById('centerMsg');
const bossBar = document.getElementById('bossBar'), bossBarInner = document.getElementById('bossBarInner');

// D-Pad input
let input = { up:false, down:false, left:false, right:false };
const dpad = document.getElementById('dpadCircle');
const sectors = {
  up: document.getElementById('dpadUp'),
  down: document.getElementById('dpadDown'),
  left: document.getElementById('dpadLeft'),
  right: document.getElementById('dpadRight')
};
function getDpadCenter(){ const r = dpad.getBoundingClientRect(); return { x:r.left + r.width/2, y:r.top + r.height/2 }; }
function activateDpadDirFromAngle(a){
  input.up = (a > Math.PI/4 && a < 3*Math.PI/4);
  input.down = (a < -Math.PI/4 && a > -3*Math.PI/4);
  input.right = (a >= -Math.PI/4 && a <= Math.PI/4);
  input.left = (a >= 3*Math.PI/4 || a <= -3*Math.PI/4);
  updateDpadVisual();
}
function updateDpadVisual(){
  sectors.up.classList.toggle('dpad-active', input.up);
  sectors.down.classList.toggle('dpad-active', input.down);
  sectors.left.classList.toggle('dpad-active', input.left);
  sectors.right.classList.toggle('dpad-active', input.right);
}
dpad.addEventListener('touchstart', e=>{ e.preventDefault(); for(const t of e.touches){ const c=getDpadCenter(); const a=Math.atan2(t.clientY-c.y,t.clientX-c.x); activateDpadDirFromAngle(a); } }, {passive:false});
dpad.addEventListener('touchmove', e=>{ e.preventDefault(); if(e.touches.length===0) return; const t=e.touches[0]; const c=getDpadCenter(); const a=Math.atan2(t.clientY-c.y,t.clientX-c.x); activateDpadDirFromAngle(a); }, {passive:false});
dpad.addEventListener('touchend', e=>{ input.up=input.down=input.left=input.right=false; updateDpadVisual(); }, {passive:false});
dpad.addEventListener('mousedown', e=>{ const c=getDpadCenter(); const a=Math.atan2(e.clientY-c.y,e.clientX-c.x); activateDpadDirFromAngle(a); window.addEventListener('mousemove', mouseMoveDpad); });
window.addEventListener('mouseup', ()=>{ input.up=input.down=input.left=input.right=false; updateDpadVisual(); window.removeEventListener('mousemove', mouseMoveDpad); });
function mouseMoveDpad(e){ const c=getDpadCenter(); const a=Math.atan2(e.clientY-c.y,e.clientX-c.x); activateDpadDirFromAngle(a); }

// Buttons
function byId(id){ return document.getElementById(id); }
const attackBtn = byId('attackBtn'), skill1Btn = byId('skill1Btn'), skill2Btn = byId('skill2Btn'), skill3Btn = byId('skill3Btn'), healBtn = byId('healBtn'), gachaBtn = byId('gachaBtn'), rotateBtn = byId('rotateBtn');
function bind(el,fn){ el.addEventListener('touchstart', e=>{ e.preventDefault(); fn(); }, {passive:false}); el.addEventListener('mousedown', fn); }
bind(attackBtn, basicAttack); bind(healBtn, heal); bind(gachaBtn, openGacha);
bind(skill1Btn, ()=>useSkill(1)); bind(skill2Btn, ()=>useSkill(2)); bind(skill3Btn, ()=>useSkill(3));
rotateBtn.addEventListener('click', toggleLayout);

// Layout toggle (manual mode)
let isLandscape = false;
function toggleLayout(){
  isLandscape = !isLandscape;
  // adjust positions: simple: swap sizes by adding/removing CSS classes or inline adjustments
  // We'll just reposition by small transforms for simplicity
  const d = document.getElementById('dpadCircle'), acts = document.querySelector('.actions'), mini = document.getElementById('minimap');
  if (isLandscape){
    d.style.left = '32px'; d.style.bottom = '28px';
    acts.style.right = '18px'; acts.style.bottom = '28px';
    mini.style.left = '18px'; mini.style.top = '18px';
  } else {
    d.style.left = '18px'; d.style.bottom = '18px';
    acts.style.right = '12px'; acts.style.bottom = '18px';
    mini.style.left = '12px'; mini.style.top = '56px';
  }
}

// Utilities
function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function showCenter(msg, ms=1000){ const el=centerMsg; el.innerText=msg; el.style.opacity=1; clearTimeout(el._t); el._t=setTimeout(()=>{ el.style.opacity=0; el.innerText=''; }, ms); }
function spawnParticles(x,y,color,count=12,spread=2,power=1.2){ for(let i=0;i<count;i++){ const a=Math.random()*Math.PI*2; const s=Math.random()*power*spread; particles.push({ x,y,vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:30+Math.random()*40, color }); if (particles.length>900) particles.splice(0, particles.length-900); } }

// Coins
function spawnCoin(x,y){ coins.push({ x,y, vx:0, vy:0, frame:0 }); }
function updateCoins(){ const magnet=140; for(let i=coins.length-1;i>=0;i--){ const c=coins[i]; const dx=player.x-c.x, dy=player.y-c.y; const d=Math.hypot(dx,dy)||1; if (d<magnet){ const pull=6*(1-d/magnet); c.vx+=(dx/d)*pull*0.12; c.vy+=(dy/d)*pull*0.12; } else c.vy+=Math.sin((c.frame||0)/8)*0.02; c.x+=c.vx; c.y+=c.vy; c.vx*=0.92; c.vy*=0.92; c.frame=(c.frame||0)+1; if (Math.hypot(player.x-c.x,player.y-c.y)<18){ coinCount++; spawnParticles(player.x+rand(-6,6),player.y+rand(-6,6),'gold',8,1.2,1.0); coins.splice(i,1);} } }

// Projectiles (same approach as earlier)
function spawnProjectile(o){ projectiles.push(o); }
function updateProjectiles(){
  for (let i=projectiles.length-1;i>=0;i--){ const p=projectiles[i];
    if (p.type==='laserWarning'){ p.life--; if (p.life<=0) projectiles.splice(i,1); continue; }
    if (p.type==='blackhole'){ p.life--; for(const e of enemies){ if(e.dead) continue; const dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||1; if (d<p.radius*1.2){ e.x += (dx/d)*0.6; e.y += (dy/d)*0.6; } } if (p.life<=0){ damageInRadius(p.x,p.y,p.radius*0.9,p.dmg,{color:p.color}); spawnParticles(p.x,p.y,p.color,60,3.2,2.2); projectiles.splice(i,1);} continue; }
    p.x += (p.vx||0)*(1/60); p.y += (p.vy||0)*(1/60); p.life--; for(const e of enemies.concat(boss?[boss]:[])){ if(!e||e.dead) continue; const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<(p.radius||8)+12){ e.hp -= p.dmg||12; spawnParticles(e.x,e.y,p.color||'#fff',10,1.8,1.2); if (p.aoe) damageInRadius(p.x,p.y,p.aoe, Math.floor((p.dmg||10)*0.8), { color:p.color }); if (p.freezeFor) e._freeze = Date.now()+p.freezeFor*1000; if (p.slow) e._slowFactor = p.slow; if (p.vamp) player.hp = Math.min(player.maxHp, player.hp + Math.floor((p.dmg||0)*p.vamp)); if(!p.pierce){ projectiles.splice(i,1); break; } } } if (p.life<=0) projectiles.splice(i,1);
  }
}

// Damage radius helper
function damageInRadius(cx,cy,radius,damage,opts={}){
  for(const e of enemies.concat(boss?[boss]:[])){ if(!e||e.dead) continue; const d=Math.hypot(e.x-cx,e.y-cy); if(d<=radius){ e.hp -= damage; spawnParticles(e.x,e.y,opts.color||'#fff',12,2.2,1.6); if (opts.stun) e._stun = Date.now()+opts.stun*1000; if (opts.freeze) e._freeze = Date.now()+opts.freeze*1000; if (e.hp<=0){ e.dead=true; spawnParticles(e.x,e.y,'#ffaaaa',28,2.8,2.0); for(let k=0;k<1+Math.floor(Math.random()*2);k++) spawnCoin(e.x+rand(-8,8), e.y+rand(-8,8)); } } }
}

// Spawn enemies & boss
function spawnEnemiesForWave(w){
  enemies = [];
  const count = 3 + w*2;
  for(let i=0;i<count;i++){
    const r = Math.random(); let type='common';
    if (r>0.86) type='tank'; else if (r>0.66) type='fast';
    const side = Math.floor(Math.random()*4);
    let ex = rand(40, WORLD.w-40), ey = rand(40, WORLD.h-40);
    if (side===0) ex = rand(0,80);
    if (side===1) ex = rand(WORLD.w-80, WORLD.w);
    if (side===2) ey = rand(0,80);
    if (side===3) ey = rand(WORLD.h-80, WORLD.h);
    let hp = 60 + w*10; if (type==='fast') hp = Math.floor(hp*0.7); if (type==='tank') hp = Math.floor(hp*1.9);
    enemies.push({ x:ex, y:ey, hp:hp, maxHp:hp, type, speed:(type==='fast'?80:(type==='tank'?24:40)), dead:false, anim:Math.random()*1000 });
  }
  showCenter('Wave '+w,900);
}

function spawnBoss(){
  boss = { x: WORLD.w/2, y: WORLD.h/2, hp:900, maxHp:900, damage:16, dead:false, cycle:{state:0,timer:120} };
  bossBar.style.display='block';
  showCenter('BOSS!',1300);
}

// Enemies AI
function updateEnemies(dt){
  for(const e of enemies){
    if (e.dead) continue;
    if (e._freeze && Date.now() < e._freeze) continue;
    const dx = player.x - e.x, dy = player.y - e.y; const d = Math.hypot(dx,dy)||1;
    e.x += (dx/d) * e.speed * dt;
    e.y += (dy/d) * e.speed * dt;
    if (d < 22 && (!e._lastHit || Date.now()-e._lastHit > 900)){ damagePlayer((e.type==='tank')?10:6 + Math.floor(Math.random()*6)); e._lastHit = Date.now(); }
    if (e.hp <= 0 && !e.dead){ e.dead=true; spawnParticles(e.x,e.y,'#ffccaa',30,2.6,2.0); for(let k=0;k<1+Math.floor(Math.random()*2);k++) spawnCoin(e.x+rand(-8,8), e.y+rand(-8,8)); }
  }
}

// Boss AI (laser warning)
function updateBoss(dt){
  if (!boss || boss.dead) return;
  const dx = player.x - boss.x, dy = player.y - boss.y; const d = Math.hypot(dx,dy)||1;
  boss.x += (dx/d) * 30 * dt; boss.y += (dy/d) * 30 * dt;
  const cyc = boss.cycle; cyc.timer -= 60*dt;
  if (cyc.state===0 && cyc.timer <= 0){ cyc.state=1; cyc.timer=1.6; boss._warnTarget={x:player.x,y:player.y}; projectiles.push({ type:'laserWarning', x:boss.x, y:boss.y, tx:boss._warnTarget.x, ty:boss._warnTarget.y, life:Math.ceil(1.2*60) }); }
  else if (cyc.state===1 && cyc.timer <= 0){ cyc.state=2; cyc.timer=0.25; const tx = boss._warnTarget.x, ty = boss._warnTarget.y; const distLine = pointLineDist(player.x,player.y,boss.x,boss.y,tx,ty); if (distLine < 18) damagePlayer(Math.floor(boss.damage*0.9)); for(const e of enemies){ const dl = pointLineDist(e.x,e.y,boss.x,boss.y,tx,ty); if (dl < 20) { e.hp -= 90; spawnParticles(e.x,e.y,'#ff8888',16,2.0,1.4); } } damageInRadius(tx,ty,60,60,{color:'#ff6633'}); }
  else if (cyc.state===2 && cyc.timer <= 0){ cyc.state=0; cyc.timer=3 + Math.random()*2; }
  if (boss.hp <= 0 && !boss.dead){ boss.dead=true; showCenter('Boss Kalah!',1400); boss=null; bossBar.style.display='none'; }
}
function pointLineDist(px,py,x1,y1,x2,y2){ const A = px-x1, B = py-y1, C = x2-x1, D = y2-y1; const dot = A*C + B*D; const len_sq = C*C + D*D; let param=-1; if(len_sq!==0) param = dot/len_sq; let xx, yy; if (param<0){ xx=x1; yy=y1; } else if (param>1){ xx=x2; yy=y2; } else { xx = x1 + param*C; yy = y1 + param*D; } return Math.hypot(px-xx, py-yy); }

// Damage player
function damagePlayer(dmg){
  if (player.invul > 0) return;
  player.hp -= dmg; player.hp = clamp(player.hp,0,player.maxHp);
  if (player.hp === 0){ showCenter('Kamu Kalah!',1800); setTimeout(()=>{ player.hp = player.maxHp; player.x = WORLD.w/2; player.y = WORLD.h/2; updateUI(); }, 1600); }
  player.invul = 60; updateUI();
}

// Attack/Heal/Gacha
function basicAttack(){ const range=48; let hit=false; for(const e of enemies){ if(e.dead) continue; const d = Math.hypot(e.x-player.x,e.y-player.y); if (d<=range){ e.hp -= 36; spawnParticles(e.x,e.y,'#fff2aa',12,1.8,1.6); hit=true; if (e.hp<=0){ e.dead=true; for(let k=0;k<1+Math.floor(Math.random()*2);k++) spawnCoin(e.x+rand(-8,8), e.y+rand(-8,8)); } } } if(!hit) showCenter('No Hit',600); updateUI(); }
let healReady=true;
function heal(){ if(!healReady){ showCenter('Heal cooldown'); return; } if(player.hp>=player.maxHp){ showCenter('HP penuh'); return; } healReady=false; player.hp = Math.min(player.maxHp, player.hp + 100); spawnParticles(player.x, player.y, '#a8ffb0', 36, 2.2, 1.8); updateUI(); setTimeout(()=>{ healReady=true; showCenter('Heal siap'); }, 10000); }

function openGacha(){ if (coinCount < 5) { showCenter('Coin kurang'); return; } coinCount -= 5; updateUI(); const r = Math.random(); let f; if (r < 0.45) f='Gale'; else if (r < 0.75) f='Flame'; else if (r < 0.90) f='Ice'; else if (r < 0.97) f='Dark'; else if (r < 0.995) f='Light'; else f='Buddha'; player.hasFruit=true; player.activeFruit={name:f,color:'#ffd36b'}; setSkillUI(true); showCenter('Dapat: '+f,1200); updateUI(); }

// Skills + auto-aim
function getNearestEnemyOnScreen(){
  let nearest=null,minD=Infinity;
  for(const e of enemies){ if(e.dead) continue; const sx=e.x-camera.x, sy=e.y-camera.y; if (sx < -80 || sx > canvas.width+80 || sy < -80 || sy > canvas.height+80) continue; const d = Math.hypot(e.x-player.x,e.y-player.y); if (d < minD){ minD = d; nearest = e; } }
  if(!nearest && boss && !boss.dead){ const sx=boss.x-camera.x, sy=boss.y-camera.y; if(!(sx < -80 || sx > canvas.width+80 || sy < -80 || sy > canvas.height+80)) nearest=boss; }
  return nearest;
}
function lockAndFire(target, onFire, warnColor='#ff4444', warnDuration=360){
  const p = { type:'laserWarning', x: player.x, y: player.y, tx: target.x, ty: target.y, life: Math.ceil(warnDuration/16), color: warnColor };
  projectiles.push(p);
  setTimeout(()=>{ onFire(); }, warnDuration);
}
function useSkill(slot){
  if (!player.hasFruit){ showCenter('Belum punya buah!'); return; }
  const name = player.activeFruit.name;
  const key = slot===1?'s1':slot===2?'s2':'s3';
  if (cooldowns[key] > 0){ showCenter('Cooldown'); return; }
  const target = getNearestEnemyOnScreen();
  const fire = ()=>{ /* minimal mapping to avoid too long */ 
    // call simple versions to keep file short; real mapping can be expanded
    const ang = target ? Math.atan2(target.y-player.y, target.x-player.x) : player.facingAngle;
    if (slot===1) spawnProjectile({ x:player.x+Math.cos(ang)*8, y:player.y+Math.sin(ang)*8, vx:Math.cos(ang)*480, vy:Math.sin(ang)*480, radius:8, life:90, color:'#ff8c4a', dmg:36 });
    if (slot===2) damageInRadius(player.x, player.y, 140, 80, { color:'#ff6b1a' });
    if (slot===3) { player.x += Math.cos(ang)*180; player.y += Math.sin(ang)*180; spawnParticles(player.x, player.y, '#fff', 24, 2.5, 1.8); }
  };
  if (target) lockAndFire(target, ()=>{ fire(); });
  else fire();
  if (slot===1) cooldowns.s1 = 45;
  if (slot===2) cooldowns.s2 = 120;
  if (slot===3) cooldowns.s3 = 300;
}

// Cooldowns tick
function tickCooldowns(){ if(cooldowns.s1>0) cooldowns.s1=Math.max(0,cooldowns.s1-1); if(cooldowns.s2>0) cooldowns.s2=Math.max(0,cooldowns.s2-1); if(cooldowns.s3>0) cooldowns.s3=Math.max(0,cooldowns.s3-1); }
function setSkillUI(enabled){ [skill1Btn,skill2Btn,skill3Btn].forEach(b=>{ if(enabled) b.classList.remove('disabled'); else b.classList.add('disabled'); }); }

// Draw functions (player bigger limbs & visible)
function drawPlayer(ctx){
  const moving = input.up||input.down||input.left||input.right;
  if (moving) player.stepTimer += 0.16; else player.stepTimer = Math.max(0, player.stepTimer - 0.2);
  const sx = player.x - camera.x, sy = player.y - camera.y;
  const body = '#6cb4ff', head = '#ffd9b0', limb = '#333';
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.36)'; ctx.fillRect(sx-18, sy+12, 36, 10);
  // body bigger
  ctx.fillStyle = body; ctx.fillRect(sx-12, sy-10, 24, 28);
  // head bigger
  ctx.fillStyle = head; ctx.fillRect(sx-10, sy-30, 20, 16);
  if (player.hasFruit){ ctx.fillStyle = player.activeFruit.color || '#ffd36b'; ctx.fillRect(sx-6, sy-4, 12, 8); }
  // limbs (bigger)
  const leg = Math.sin(player.stepTimer)*6;
  const arm = Math.sin(player.stepTimer + Math.PI/2)*5;
  ctx.fillStyle = limb; ctx.fillRect(sx-14, sy+10 + (moving? leg*0.45:0), 6, 14); ctx.fillRect(sx+8, sy+10 - (moving? leg*0.45:0), 6, 14);
  ctx.fillRect(sx-18, sy-4 + (moving? arm*0.45:0), 6, 16); ctx.fillRect(sx+12, sy-4 - (moving? arm*0.45:0), 6, 16);
}

// Draw enemy humanoid shapes
function drawEnemy(ctx, e){
  if (e.dead) return;
  const sx = e.x - camera.x, sy = e.y - camera.y;
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(sx-12, sy+10, 24, 6);
  let body='#0f0f0f', accent='#4a2b78';
  if (e.type==='fast'){ body='#ffd166'; accent='#b36b00'; }
  if (e.type==='tank'){ body='#6b6b6b'; accent='#333'; }
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = accent; ctx.fillRect(sx-7, sy-14, 14, 10);
  const t = (Date.now()+e.anim)/120; const lo = Math.sin(t)*4;
  ctx.fillStyle = '#222'; ctx.fillRect(sx-11, sy+6+lo, 6, 12); ctx.fillRect(sx+5, sy+6-lo, 6, 12);
  ctx.fillRect(sx-16, sy-2+lo, 6, 14); ctx.fillRect(sx+10, sy-2-lo, 6, 14);
  // hp
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(sx-20, sy-32, 40, 6);
  ctx.fillStyle='lime'; ctx.fillRect(sx-20, sy-32, 40 * clamp(e.hp/e.maxHp,0,1), 6);
}

// Draw everything
function drawAll(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.translate(-camera.x, -camera.y);
  // background
  ctx.fillStyle='#0b1b2a'; ctx.fillRect(0,0,WORLD.w,WORLD.h);
  // ground
  ctx.fillStyle='#103243'; ctx.fillRect(0, WORLD.h - 140, WORLD.w, 140);
  // coins
  for(const c of coins){ ctx.beginPath(); ctx.fillStyle='gold'; ctx.arc(c.x, c.y, 8, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='orange'; ctx.lineWidth=2; ctx.stroke(); }
  // projectiles (warning lines, vortex, normal)
  for(const p of projectiles){
    if (p.type==='laserWarning'){ ctx.save(); ctx.strokeStyle='rgba(255,60,60,0.95)'; ctx.lineWidth=3; ctx.setLineDash([8,6]); ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.tx,p.ty); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); continue; }
    if (p.type==='vortex' || p.type==='blackhole'){ ctx.beginPath(); ctx.fillStyle=p.color||'#8a2be2'; ctx.arc(p.x,p.y,p.radius||40,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=0.12; ctx.beginPath(); ctx.arc(p.x,p.y,(p.radius||40)*1.8,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; continue; }
    ctx.beginPath(); ctx.fillStyle = p.color||'#fff'; ctx.arc(p.x,p.y,p.radius||6,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=0.16; ctx.beginPath(); ctx.fillStyle = p.color||'#fff'; ctx.arc(p.x,p.y,(p.radius||6)*2.6,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  }
  // enemies
  for(const e of enemies) drawEnemy(ctx, e);
  // boss
  if (boss && !boss.dead){ ctx.fillStyle='#7a1f9a'; ctx.beginPath(); ctx.arc(boss.x,boss.y,44,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=0.12; ctx.beginPath(); ctx.fillStyle='#ff7a33'; ctx.arc(boss.x,boss.y,96,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; ctx.beginPath(); ctx.fillStyle='#ff4747'; ctx.arc(boss.x,boss.y,12,0,Math.PI*2); ctx.fill(); }
  // player
  drawPlayer(ctx);
  // particles
  for(const p of particles){ ctx.globalAlpha = Math.max(0,p.life/80); ctx.fillStyle = p.color; ctx.fillRect(p.x-2,p.y-2,4,4); ctx.globalAlpha=1; }
  ctx.restore();
  drawMinimap();
  renderCooldowns();
}

// Minimap
function drawMinimap(){
  const mW = miniCanvas.width, mH = miniCanvas.height;
  const scaleX = mW / WORLD.w, scaleY = mH / WORLD.h;
  miniCtx.clearRect(0,0,mW,mH);
  miniCtx.fillStyle='rgba(0,0,0,0.22)'; miniCtx.fillRect(0,0,mW,mH);
  miniCtx.fillStyle='#5bb6ff'; miniCtx.fillRect((player.x*scaleX)-3, (player.y*scaleY)-3, 6,6);
  for(const e of enemies){ if(e.dead) continue; miniCtx.fillStyle = e.type==='fast' ? '#ffd166' : (e.type==='tank' ? '#d67b7b' : '#ff6666'); miniCtx.fillRect(e.x*scaleX - 2, e.y*scaleY - 2, 4,4); }
  if (boss && !boss.dead){ miniCtx.fillStyle='#ffb84d'; miniCtx.fillRect(boss.