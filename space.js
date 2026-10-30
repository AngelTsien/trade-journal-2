/* 交易日志 2.0 · 量子空间（three.js 全屏场景） */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const C = window.TJCore, $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 2) => v == null || !isFinite(v) ? (v === Infinity ? '∞' : '-') : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = v => (v > 0 ? '+' : '') + fmt(v), cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } })();
if (!hasGL || !C || !window.TJApp) { document.body.className = 'flat'; throw new Error('no-webgl'); }
window.TJSpaceOK = true; document.body.className = 'space';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, SPEED = RM ? .15 : 1, MOBILE = matchMedia('(pointer:coarse)').matches || innerWidth < 760;
const GREEN = new THREE.Color(0x2ee6a0), RED = new THREE.Color(0xff5d73), CYAN = new THREE.Color(0x2fd3e0), VIOLET = new THREE.Color(0xa46bff), PINK = new THREE.Color(0xff6ec4);
/* ---- 渲染器 ---- */
const host = $('#space'), renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2)); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x05030f); host.appendChild(renderer.domElement);
const labels = new CSS2DRenderer(); labels.setSize(innerWidth, innerHeight); Object.assign(labels.domElement.style, { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }); host.appendChild(labels.domElement);
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x05030f, .006);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 1200); const HOME = { pos: new THREE.Vector3(0, 26, MOBILE ? 78 : 58), tgt: new THREE.Vector3() };
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .07; controls.minDistance = 4; controls.maxDistance = 220;
controls.autoRotate = !RM; controls.autoRotateSpeed = .35;
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), MOBILE ? .75 : .95, .55, .12); composer.addPass(bloom); composer.addPass(new OutputPass());
if (MOBILE) composer.setPixelRatio(1);
scene.add(new THREE.AmbientLight(0x8877ff, .55)); const pl = new THREE.PointLight(0xffffff, 300, 0, 1.6); scene.add(pl);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); labels.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

/* ---- 共享资源 ---- */
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.2, 'rgba(255,255,255,.6)'); r.addColorStop(.5, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const SPH = new THREE.SphereGeometry(1, MOBILE ? 12 : 18, MOBILE ? 10 : 14);
const glow = (color, size, op = .9) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); return s; };
const label = (html, klass = '') => { const d = document.createElement('div'); d.className = 'lbl ' + klass; d.innerHTML = html; return new CSS2DObject(d); };
const ring = (r, color, op = .35) => { const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); };
let rs = 11; const rnd = () => (rs = (rs * 9301 + 49297) % 233280) / 233280;

/* 星空 */
(() => { const n = MOBILE ? 1500 : 3500, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(180 + Math.random() * 380); p.set([v.x, v.y, v.z], i * 3); const k = .5 + Math.random() * .5, col = Math.random() < .2 ? VIOLET : Math.random() < .2 ? CYAN : new THREE.Color(1, 1, 1); c.set([col.r * k, col.g * k, col.b * k], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(stars); window.__stars = stars; })();

/* ---- 原子核 ---- */
function nucleus(r, color, n) { const g = new THREE.Group(), m = new THREE.InstancedMesh(SPH, new THREE.MeshStandardMaterial({ roughness: .35, metalness: .2, emissive: 0x222244 }), n), d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { d.position.copy(new THREE.Vector3().randomDirection().multiplyScalar(r * Math.cbrt(rnd()) * .75)); d.scale.setScalar(r * .32); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, i % 2 ? color : new THREE.Color(0x8f6bf0)); }
  g.add(m); g.add(glow(color, r * 4, .45)); g.userData.core = m; return g; }

/* ---- 场景数据构建 ---- */
let root = null, pick = [], anim = [], pulses = [];
const STATS = [
  ['net', '净盈亏', s => money(s.net), s => s.net, '所有已平仓交易扣除手续费、加上隔夜费后的总盈亏。', s => `毛盈利 ${fmt(s.grossWin)}<br>毛亏损 ${fmt(s.grossLoss)}<br>收益率 ${fmt(s.returnPct)}%<br>当前净值 ${fmt(s.base + s.net)}`],
  ['win', '胜率', s => fmt(s.winRate * 100, 1) + '%', s => s.winRate - .5, '盈利交易笔数 ÷ 总笔数。', s => `盈利 ${s.wins ?? '-'} 笔 · 亏损 ${s.losses ?? '-'} 笔`],
  ['pf', '获利因子', s => fmt(s.profitFactor), s => s.profitFactor - 1, '毛盈利 ÷ 毛亏损。大于 1 说明整体赚钱，越高越好。', s => `毛盈利 ${fmt(s.grossWin)} / 毛亏损 ${fmt(s.grossLoss)}`],
  ['dd', '最大回撤', s => fmt(s.maxDD), () => -1, '净值从最高点回落的最大金额。', s => `最大回撤 ${fmt(s.maxDD)} · ${fmt(s.maxDDPct)}%`],
  ['aw', '平均盈利', s => fmt(s.avgWin), () => 1, '盈利交易的平均每笔盈利。', s => `盈亏比 ${fmt(s.payoff)}<br>每笔期望 ${money(s.expectancy)}`],
  ['al', '平均亏损', s => fmt(s.avgLoss), () => -1, '亏损交易的平均每笔亏损。', s => `盈亏比 ${fmt(s.payoff)}<br>每笔期望 ${money(s.expectancy)}`],
  ['n', '交易笔数', s => String(s.count ?? s.n ?? '-'), () => 0, '选定账户和日期范围内的已平仓交易数量。', s => `累计 R ${fmt(s.totalR)}R（${s.rCount} 笔有止损）`]];
function build() {
  if (root) { scene.remove(root); root.traverse(o => { if (o.geometry && o.geometry !== SPH) o.geometry.dispose(); if (o.material) o.material.dispose(); if (o.element) o.element.remove(); }); }
  root = new THREE.Group(); scene.add(root); pick = []; anim = []; pulses = []; rs = 11;
  const S = TJApp.S, accs = S.accounts, all = S.trades.slice().sort((a, b) => a.closeTime < b.closeTime ? -1 : 1);
  const baseOf = ids => ids.reduce((s, id) => { const a = accs.find(x => x.id === id); return a ? s + (+a.initial || 0) + a.cash.reduce((x, c) => x + (+c.amount || 0), 0) : s; }, 0);
  const st = C.computeStats(all, baseOf(accs.map(a => a.id))); st.count = all.length; st.wins = all.filter(t => C.netOf(t) > 0).length; st.losses = all.filter(t => C.netOf(t) < 0).length;
  $('#hudSum').innerHTML = `全部账户 · 净盈亏 <b class="${cls(st.net)}">${money(st.net)}</b> · ${all.length} 笔交易`;
  // 中心原子核：总净值
  const cr = 1.6 + Math.min(2.2, Math.abs(st.returnPct) / 10), core = nucleus(cr, st.net >= 0 ? GREEN : RED, MOBILE ? 26 : 40); root.add(core);
  const cl = label(`总净值<b class="${cls(st.net)}">${fmt(st.base + st.net)}</b>`, 'nuc ' + cls(st.net)); cl.position.y = cr + 1.4; core.add(cl);
  core.userData.info = { type: 'core', st }; pick.push(core.userData.core); core.userData.core.userData.ref = core; anim.push(t => { core.rotation.y = t * .2; core.scale.setScalar(1 + Math.sin(t * 2) * .03); });
  // 统计电子
  STATS.forEach(([k, name, val, sign, desc, more], i) => { const R = 4.5 + i * 1.25, shell = new THREE.Group(); shell.rotation.set(rnd() * 1.4 - .7, rnd() * 6, rnd() * 1.4 - .7); root.add(shell);
    const sg = sign(st), col = sg > 0 ? GREEN : sg < 0 ? RED : CYAN; shell.add(ring(R, col, .22));
    const atom = new THREE.Group(), body = new THREE.Mesh(SPH, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .9 })); body.scale.setScalar(.38); atom.add(body, glow(col, 2.6, .8));
    const er = ring(.75, 0xffffff, .5); er.rotation.x = 1.1; atom.add(er); const er2 = ring(.75, 0xffffff, .35); er2.rotation.z = 1.1; atom.add(er2);
    const lb = label(`${name}<b class="${cls(sg)}">${val(st)}</b>`, cls(sg)); lb.position.y = 1.1; atom.add(lb); shell.add(atom);
    const info = { type: 'stat', name, val: val(st), desc, more: more(st), sg }; body.userData.ref = atom; atom.userData.info = info; pick.push(body);
    lb.element.addEventListener('click', e => { e.stopPropagation(); select(atom); });
    const ph = rnd() * 6.28, sp = .25 / Math.sqrt(R / 4.5); anim.push(t => { const a = ph + t * sp; atom.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); er.rotation.y = t * 3; er2.rotation.y = -t * 2.4; }); });
  // 账户原子核 + 交易粒子
  const N = accs.length, AR = N > 1 ? 26 : 22, nucs = [];
  accs.forEach((a, ai) => { const ang = ai / N * Math.PI * 2 + .4, pos = new THREE.Vector3(Math.cos(ang) * AR, (ai % 2 ? 1 : -1) * 3, Math.sin(ang) * AR);
    const tr = all.filter(t => t.accountId === a.id), as = C.computeStats(tr, baseOf([a.id])); as.count = tr.length;
    const g = new THREE.Group(); g.position.copy(pos); root.add(g); nucs.push(g);
    const r = 1 + Math.min(1.6, Math.abs(as.returnPct) / 12), nu = nucleus(r, as.net >= 0 ? GREEN : RED, MOBILE ? 16 : 24); g.add(nu);
    const lb = label(`${esc(a.name)}<b class="${cls(as.net)}">${money(as.net)}</b>`, 'nuc ' + cls(as.net)); lb.position.y = r + 1.3; g.add(lb);
    nu.userData.info = { type: 'acc', a, as }; nu.userData.core.userData.ref = nu; pick.push(nu.userData.core); lb.element.addEventListener('click', e => { e.stopPropagation(); select(nu); });
    // 按日期聚类：每天一个方向
    const days = [...new Set(tr.map(t => t.closeTime.slice(0, 10)))], dir = {}; days.forEach((d, i) => { const y = 1 - (i + .5) / days.length * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996; dir[d] = new THREE.Vector3(Math.cos(th) * rr, y * .7, Math.sin(th) * rr).normalize(); });
    const mx = Math.max(1, ...tr.map(t => Math.abs(C.netOf(t)))), cloud = new THREE.Group(); g.add(cloud);
    const im = new THREE.InstancedMesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, tr.length)), d = new THREE.Object3D(), P = [];
    im.count = tr.length; const byDay = {}, bySym = {};
    tr.forEach((t, i) => { const n = C.netOf(t), base = dir[t.closeTime.slice(0, 10)], k = (byDay[t.closeTime.slice(0, 10)] = byDay[t.closeTime.slice(0, 10)] || []).length;
      const p = base.clone().multiplyScalar(5.5 + k * .9).add(new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(.9)); P.push(p);
      byDay[t.closeTime.slice(0, 10)].push(i); (bySym[t.symbol] = bySym[t.symbol] || []).push(i);
      d.position.copy(p); d.scale.setScalar(.16 + .42 * Math.sqrt(Math.abs(n) / mx)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, (n >= 0 ? GREEN : RED).clone().multiplyScalar(.75)); });
    im.userData = { trades: tr, P, ref: null, acc: a, cloud }; cloud.add(im); pick.push(im);
    // 纠缠线：同日（青）+ 同品种（紫）
    const seg = [], col = [], push = (i, j, c) => { seg.push(P[i].x, P[i].y, P[i].z, P[j].x, P[j].y, P[j].z); col.push(c.r, c.g, c.b, c.r, c.g, c.b); };
    Object.values(byDay).forEach(ix => { for (let k = 1; k < ix.length; k++) push(ix[k - 1], ix[k], CYAN); });
    Object.values(bySym).forEach(ix => { for (let k = 1; k < ix.length; k++) push(ix[k - 1], ix[k], VIOLET); });
    tr.forEach((t, i) => { if (i % 3 === 0) { seg.push(0, 0, 0, P[i].x, P[i].y, P[i].z); const c = C.netOf(t) >= 0 ? GREEN : RED; col.push(c.r * .4, c.g * .4, c.b * .4, c.r * .4, c.g * .4, c.b * .4); } });
    if (seg.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      cloud.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false }))); addPulses(cloud, seg, MOBILE ? 24 : 60); }
    const sp = .05 + rnd() * .05; anim.push(t => { cloud.rotation.y = t * sp; nu.rotation.y = t * .3; }); });
  // 账户之间、账户与中心的量子纠缠
  const seg = [];
  nucs.forEach((g, i) => { seg.push(0, 0, 0, g.position.x, g.position.y, g.position.z); nucs.forEach((h, j) => { if (j > i) seg.push(g.position.x, g.position.y, g.position.z, h.position.x, h.position.y, h.position.z); }); });
  if (seg.length) { const pts = []; for (let i = 0; i < seg.length; i += 6) { const a = new THREE.Vector3(seg[i], seg[i + 1], seg[i + 2]), b = new THREE.Vector3(seg[i + 3], seg[i + 4], seg[i + 5]);
      for (let w = 0; w < 2; w++) { const m = a.clone().lerp(b, .5).add(new THREE.Vector3(0, (w ? 1 : -1) * 4, 0)), cv = new THREE.QuadraticBezierCurve3(a, m, b), ps = cv.getPoints(40);
        for (let k = 1; k < ps.length; k++) pts.push(ps[k - 1].x, ps[k - 1].y, ps[k - 1].z, ps[k].x, ps[k].y, ps[k].z); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: PINK, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }))); addPulses(root, pts, 30, PINK, 1.2); }
}
/* 沿线流动的能量脉冲 */
function addPulses(parent, seg, n, color = 0xffffff, size = .7) { const ns = seg.length / 6; if (!ns) return; n = Math.min(n, ns * 2);
  const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); parent.add(pts);
  const st = []; for (let i = 0; i < n; i++) st.push({ s: Math.floor(Math.random() * ns), u: Math.random(), v: .4 + Math.random() * .8 });
  pulses.push(dt => { for (let i = 0; i < n; i++) { const p = st[i]; p.u += dt * p.v * SPEED; if (p.u > 1) { p.u = 0; p.s = Math.floor(Math.random() * ns); } const o = p.s * 6;
    pos[i * 3] = seg[o] + (seg[o + 3] - seg[o]) * p.u; pos[i * 3 + 1] = seg[o + 1] + (seg[o + 4] - seg[o + 1]) * p.u; pos[i * 3 + 2] = seg[o + 2] + (seg[o + 5] - seg[o + 2]) * p.u; } g.attributes.position.needsUpdate = true; }); }

/* ---- 交互 ---- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), info = $('#info'); let pinned = false, fly = null, hoverKey = null, follow = null;
const wpOf = f => f.i != null ? f.o.localToWorld(f.o.userData.P[f.i].clone()) : f.o.getWorldPosition(new THREE.Vector3());
function hit(e) { const r = renderer.domElement.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ptr, camera); return ray.intersectObjects(pick, false)[0]; }
function tradeCard(t, acc) { const n = C.netOf(t);
  return `<h4><span>${esc(t.symbol)} ${t.side === 'short' ? '空' : '多'}</span><span class="x" data-x>✕</span></h4><div class="kv">
  <span>账户</span><div>${esc(acc.name)}</div><span>净盈亏</span><b class="${cls(n)}">${money(n)}</b><span>开仓</span><div>${esc((t.openTime || '').replace('T', ' ').slice(0, 16))} @ ${fmt(t.openPrice, 2)}</div>
  <span>平仓</span><div>${esc(t.closeTime.replace('T', ' ').slice(0, 16))} @ ${fmt(t.closePrice, 2)}</div><span>手数</span><div>${fmt(t.lots, 2)}</div>
  <span>策略</span><div>${esc(t.strategy || '-')}</div><span>情绪</span><div>${esc(t.emotion || '-')}</div><span>备注</span><div>${esc(t.notes || '-')}</div></div>
  <div class="row"><button data-edit="${t.id}">✏️ 编辑</button><button class="ghost" data-goday="${t.closeTime.slice(0, 10)}">📅 当日记录</button></div>`; }
function show(html, pin) { info.innerHTML = html; info.classList.add('on'); pinned = pin; }
function select(obj, inst) { let html, wp = new THREE.Vector3(), dist = 9;
  if (inst != null) { const u = obj.userData; obj.localToWorld(wp.copy(u.P[inst])); html = tradeCard(u.trades[inst], u.acc); dist = 6; }
  else { obj.getWorldPosition(wp); const f = obj.userData.info;
    if (f.type === 'stat') { html = `<h4><span>⚛ ${f.name}</span><span class="x" data-x>✕</span></h4><div style="font-size:26px;font-weight:800" class="${cls(f.sg)}">${f.val}</div><p style="color:#cfcaf5">${f.desc}</p><div>${f.more}</div><div class="row"><button data-p="stats">📈 打开统计面板</button></div>`; dist = 12; }
    else if (f.type === 'acc') { const s = f.as; html = `<h4><span>👛 ${esc(f.a.name)}</span><span class="x" data-x>✕</span></h4><div class="kv"><span>币种</span><div>${esc(f.a.currency)}</div><span>净盈亏</span><b class="${cls(s.net)}">${money(s.net)}</b><span>收益率</span><div>${fmt(s.returnPct)}%</div><span>胜率</span><div>${fmt(s.winRate * 100, 1)}%</div><span>获利因子</span><div>${fmt(s.profitFactor)}</div><span>交易笔数</span><div>${s.count}</div></div><div class="row"><button data-acc="${f.a.id}" data-p="dash">📊 看这个账户</button></div>`; dist = 16; }
    else { const s = f.st; html = `<h4><span>⚛ 总净值</span><span class="x" data-x>✕</span></h4><div style="font-size:26px;font-weight:800">${fmt(s.base + s.net)}</div><div class="kv"><span>本金+出入金</span><div>${fmt(s.base)}</div><span>净盈亏</span><b class="${cls(s.net)}">${money(s.net)}</b><span>收益率</span><div>${fmt(s.returnPct)}%</div></div><div class="row"><button data-p="dash">📊 打开仪表盘</button></div>`; dist = 20; } }
  show(html, true); flyTo(wp, dist); follow = inst != null ? { o: obj, i: inst } : { o: obj }; }
function flyTo(tgt, dist) { const dir = camera.position.clone().sub(controls.target).normalize(); fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: tgt.clone().add(dir.multiplyScalar(dist)), t1: tgt.clone() }; controls.autoRotate = false; }
const home = () => { fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: HOME.pos.clone(), t1: HOME.tgt.clone() }; follow = null; controls.autoRotate = !RM; info.classList.remove('on'); pinned = false; };
let last = 0;
renderer.domElement.addEventListener('pointermove', e => { if (e.buttons || pinned || performance.now() - last < 50) return; last = performance.now();
  const h = hit(e); renderer.domElement.style.cursor = h ? 'pointer' : '';
  if (h && h.instanceId != null && h.object.userData.trades) { const k = h.object.id + ':' + h.instanceId; if (k !== hoverKey) { hoverKey = k; show(tradeCard(h.object.userData.trades[h.instanceId], h.object.userData.acc), false); } }
  else if (hoverKey) { hoverKey = null; info.classList.remove('on'); } });
let down = null; renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; fly = null; follow = null; });
renderer.domElement.addEventListener('pointerup', e => { if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return down = null; down = null; const h = hit(e);
  if (!h) { if (pinned) { info.classList.remove('on'); pinned = false; follow = null; } return; }
  if (h.object.userData.trades && h.instanceId != null) select(h.object, h.instanceId); else select(h.object.userData.ref); });
const openPanel = v => { document.body.classList.add('hud-open'); TJApp.go(v); document.querySelectorAll('#hudMenu [data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === v)); };
document.addEventListener('click', e => { const b = e.target.closest('[data-p],[data-x],[data-goday],#hudClose,#homeBtn'); if (!b) return;
  if (b.id === 'hudClose') { document.body.classList.remove('hud-open'); document.querySelectorAll('#hudMenu button').forEach(x => x.classList.remove('on')); }
  else if (b.id === 'homeBtn') { document.body.classList.remove('hud-open'); home(); }
  else if (b.dataset.x != null) { info.classList.remove('on'); pinned = false; follow = null; }
  else if (b.dataset.goday) { document.body.classList.add('hud-open'); TJApp.day(b.dataset.goday); }
  else if (b.dataset.p) { if (b.closest('#hud')) return; setTimeout(() => openPanel(b.dataset.p)); } });
let tm; addEventListener('tj:changed', () => { clearTimeout(tm); tm = setTimeout(build, 300); });
addEventListener('storage', e => { if (e.key === 'tj_v1') location.reload(); });

/* ---- 主循环 ---- */
build(); const clock = new THREE.Clock(); let T = 0;
renderer.setAnimationLoop(() => { const dt = Math.min(clock.getDelta(), .05); T += dt * SPEED;
  if (fly) { fly.t = Math.min(1, fly.t + dt / 1.1); const k = fly.t < .5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2; camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k); if (fly.t >= 1) fly = null; }
  if (follow) { const w = wpOf(follow); if (fly) { fly.p1.add(w.clone().sub(fly.t1)); fly.t1.copy(w); } else { const d = w.sub(controls.target); camera.position.add(d); controls.target.add(d); } }
  if (document.body.classList.contains('hud-open') && MOBILE) return; // 面板打开时手机暂停省电
  anim.forEach(f => f(T)); pulses.forEach(f => f(dt)); window.__stars.rotation.y = T * .004; controls.update(); composer.render(); labels.render(scene, camera); });
