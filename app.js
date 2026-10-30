/* 交易日志 主程序 */
(() => {
'use strict';
const C = TJCore, $ = s => document.querySelector(s), KEY = 'tj_v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 2) => v == null || !isFinite(v) ? (v === Infinity ? '∞' : '-') : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = v => (v > 0 ? '+' : '') + fmt(v), cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const hold = m => !m ? '-' : m < 60 ? fmt(m, 0) + ' 分' : m < 1440 ? fmt(m / 60, 1) + ' 小时' : fmt(m / 1440, 1) + ' 天';
/* ---- IndexedDB 存截图 ---- */
const idb = new Promise(r => { const q = indexedDB.open('tj_img', 1); q.onupgradeneeded = () => q.result.createObjectStore('img'); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
const imgOp = async (mode, fn) => { const db = await idb; if (!db) return null; return new Promise(r => { const tx = db.transaction('img', mode), st = tx.objectStore('img'); const q = fn(st); tx.oncomplete = () => r(q && q.result); tx.onerror = () => r(null); }); };
const imgPut = (k, v) => imgOp('readwrite', s => s.put(v, k)), imgGet = k => imgOp('readonly', s => s.get(k)), imgDel = k => imgOp('readwrite', s => s.delete(k));
const imgAll = () => imgOp('readonly', s => s.getAllKeys()).then(async ks => { const o = {}; for (const k of ks || []) o[k] = await imgGet(k); return o; });
/* ---- 状态 ---- */
let S = load(); let view = 'dash', calMonth = null, dayView = null, charts = [];
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.accounts) return s; } catch (e) {} return seed(); }
function save() { localStorage.setItem(KEY, JSON.stringify(S)); dispatchEvent(new Event('tj:changed')); }
function seed() { // 示例数据
  const a1 = { id: 'demo1', name: '示例·外汇账户', currency: 'USD', initial: 10000, cash: [{ id: uid(), date: '2026-09-15', amount: 2000, note: '入金' }], sample: true };
  const a2 = { id: 'demo2', name: '示例·指数账户', currency: 'USD', initial: 5000, cash: [], sample: true };
  const syms = ['XAUUSD', 'US100', 'USOIL', 'EURUSD'], strats = ['FVG回补', '突破', '订单块', 'HVN反转'], emos = ['冷静', '贪婪', '恐惧', '冲动'];
  let r = 7; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280; const trades = [];
  for (let i = 0; i < 46; i++) { const d = new Date(2026, 8, 1 + Math.floor(i * 1.0), 8 + Math.floor(rnd() * 10), Math.floor(rnd() * 60)); if (d.getDay() % 6 === 0) d.setDate(d.getDate() + 2);
    const side = rnd() > .45 ? 'long' : 'short', o = 100 + rnd() * 50, risk = 1 + rnd(), Rm = rnd() > .45 ? 0.5 + rnd() * 2.5 : -(0.3 + rnd() * 0.8), mv = Rm * risk;
    const c = side === 'long' ? o + mv : o - mv, sl = side === 'long' ? o - risk : o + risk, cl = new Date(d.getTime() + (20 + rnd() * 400) * 6e4);
    trades.push({ id: uid(), accountId: i % 3 ? 'demo1' : 'demo2', symbol: syms[i % 4], side, openTime: C.toLocalISO(d), closeTime: C.toLocalISO(cl), openPrice: +o.toFixed(2), closePrice: +c.toFixed(2),
      lots: 1, commission: 2, swap: 0, pnl: +(Rm * 100).toFixed(2), sl: +sl.toFixed(2), tp: null, strategy: strats[i % 4], emotion: emos[Math.floor(rnd() * 4)], notes: '示例交易', sample: true }); }
  return { accounts: [a1, a2], trades, journals: { '2026-10-15': { plan: '只做 1H FVG 回补', review: '按计划执行', mistakes: '追单一次', lessons: '等确认', mood: 7, sample: true } }, current: 'all' };
}
const accById = id => S.accounts.find(a => a.id === id);
const baseOf = ids => ids.reduce((s, id) => { const a = accById(id); return a ? s + (+a.initial || 0) + a.cash.reduce((x, c) => x + (+c.amount || 0), 0) : s; }, 0);
const accIds = () => S.current === 'all' ? S.accounts.map(a => a.id) : [S.current];
function filtered(useSearch = true) { const ids = accIds(), f = $('#from').value, t = $('#to').value, q = useSearch ? $('#search').value.trim().toLowerCase() : '';
  return S.trades.filter(x => ids.includes(x.accountId) && (!f || x.closeTime.slice(0, 10) >= f) && (!t || x.closeTime.slice(0, 10) <= t) &&
    (!q || [x.symbol, x.strategy, x.notes, x.emotion].join(' ').toLowerCase().includes(q))); }
const cur = () => S.current === 'all' ? (new Set(S.accounts.map(a => a.currency)).size > 1 ? '混合币种' : (S.accounts[0] || {}).currency || '') : (accById(S.current) || {}).currency;
/* ---- 布局 ---- */
const NAV = [['dash', '📊 仪表盘'], ['trades', '📋 交易记录'], ['stats', '📈 统计分析'], ['daily', '📅 每日记录'], ['import', '📥 导入'], ['accounts', '👛 账户'], ['backup', '💾 备份']];
function render() {
  if (S.current !== 'all' && !accById(S.current)) S.current = 'all';
  $('#rail').innerHTML = `<div class="av ${S.current === 'all' ? 'on' : ''}" data-acc="all" title="全部账户">全</div>` + S.accounts.map(a => `<div class="av ${S.current === a.id ? 'on' : ''}" data-acc="${a.id}" title="${esc(a.name)}">${esc(a.name.replace('示例·', '').slice(0, 2))}</div>`).join('') + `<div class="av add" id="addAcc" title="新建账户">+</div>`;
  $('#nav').innerHTML = `<h2>交易日志 ⚛ 2.0</h2>` + NAV.map(([k, l]) => `<a data-v="${k}" class="${view === k ? 'on' : ''}">${l}</a>`).join('') + (S.trades.some(t => t.sample) || S.accounts.some(a => a.sample) ? `<a id="delSample" style="color:#ffd27a">🧹 删除全部示例数据</a>` : '');
  charts.forEach(c => c.destroy()); charts = [];
  ({ dash, trades: tradesView, stats: statsView, daily, import: importView, accounts: accountsView, backup })[view]();
  side();
}
function side() { const ids = accIds(); const accs = S.accounts.filter(a => ids.includes(a.id));
  const rec = filtered(false).slice().sort((a, b) => b.closeTime < a.closeTime ? -1 : 1).slice(0, 6), js = Object.keys(S.journals).sort().reverse().slice(0, 4);
  $('#side').innerHTML = `<h3>账户概况</h3>` + accs.map(a => { const st = C.computeStats(S.trades.filter(t => t.accountId === a.id), baseOf([a.id]));
    return `<div class="item"><b>${esc(a.name)}</b>${a.sample ? '<span class="tag">示例</span>' : ''}<small>${a.currency} · 本金+出入金 ${fmt(st.base)}</small>净值 <b>${fmt(st.base + st.net)}</b> <span class="${cls(st.net)}">${money(st.net)}</span></div>`; }).join('') +
    `<h3 style="margin-top:16px">最近交易</h3>` + (rec.map(t => `<div class="item" data-edit="${t.id}"><b>${esc(t.symbol)}</b> ${t.side === 'long' ? '多' : '空'} <span class="${cls(C.netOf(t))}" style="float:right">${money(C.netOf(t))}</span><small>${t.closeTime.replace('T', ' ').slice(0, 16)}${t.sample ? ' · 示例' : ''}</small></div>`).join('') || '<small>暂无</small>') +
    `<h3 style="margin-top:16px">最近日记</h3>` + (js.map(d => `<div class="item" data-day="${d}"><b>${d}</b> 心情 ${S.journals[d].mood ?? '-'}/10${S.journals[d].sample ? '<span class="tag">示例</span>' : ''}<small>${esc((S.journals[d].review || S.journals[d].plan || '').slice(0, 40))}</small></div>`).join('') || '<small>暂无</small>'); }
function chart(id, cfg) { const el = document.getElementById(id); if (!el || !window.Chart) return; cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
  scales: { x: { ticks: { color: '#b9b4e6', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,.05)' } }, y: { ticks: { color: '#b9b4e6' }, grid: { color: 'rgba(255,255,255,.07)' } } } }, cfg.options || {}); charts.push(new Chart(el, cfg)); }
/* ---- 仪表盘 ---- */
function kpis(s) { return [['胜率', fmt(s.winRate * 100, 1) + '%'], ['盈亏比', fmt(s.payoff)], ['获利因子', fmt(s.profitFactor)], ['每笔期望', money(s.expectancy), s.expectancy], ['平均 R', s.avgR == null ? '-' : fmt(s.avgR) + 'R', s.avgR],
  ['最大回撤', fmt(s.maxDD) + ' / ' + fmt(s.maxDDPct) + '%', -1], ['最长连赢/连亏', s.maxWinStreak + ' / ' + s.maxLossStreak], ['平均持仓', hold(s.avgHoldMin)], ['交易笔数', s.count + `（${s.wins}胜 ${s.losses}负）`], ['收益率', fmt(s.returnPct) + '%', s.returnPct]]
  .map(([k, v, c]) => `<div class="kpi"><span>${k}</span><b class="${c === undefined ? '' : cls(c)}">${v}</b></div>`).join(''); }
function dash() { const tr = filtered(), s = C.computeStats(tr, baseOf(accIds()));
  $('#view').innerHTML = `<div class="hero"><small>${S.current === 'all' ? '全部账户合并' : esc(accById(S.current).name)} · 净盈亏（${cur()}）${tr.some(t => t.sample) ? '<span class="tag" style="background:rgba(0,0,0,.25)">含示例数据</span>' : ''}</small>
   <div class="big">${money(s.net)}</div><small>收益率 ${fmt(s.returnPct)}% · 毛盈利 ${fmt(s.grossWin)} · 毛亏损 ${fmt(s.grossLoss)} · 当前净值 ${fmt(s.base + s.net)}</small></div>
   <div class="grid">${kpis(s)}</div>
   <div class="two"><div class="card"><h3>收益走势</h3><div class="chart"><canvas id="cEq"></canvas></div></div><div class="card"><h3>回撤</h3><div class="chart"><canvas id="cDd"></canvas></div></div></div>
   <div class="two"><div class="card"><h3>每日盈亏</h3><div class="chart"><canvas id="cDay"></canvas></div></div><div class="card" id="calCard"></div></div>`;
  const lab = s.equity.map(p => p.t.slice(5, 16).replace('T', ' '));
  chart('cEq', { type: 'line', data: { labels: lab, datasets: [{ data: s.equity.map(p => p.v), borderColor: '#2fd3e0', backgroundColor: 'rgba(47,211,224,.15)', fill: true, pointRadius: 0, tension: .25 }] } });
  chart('cDd', { type: 'line', data: { labels: lab, datasets: [{ data: s.drawdown.map(p => p.p), borderColor: '#ff5d73', backgroundColor: 'rgba(255,93,115,.2)', fill: true, pointRadius: 0 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmt(c.raw) + '% / ' + fmt(s.drawdown[c.dataIndex].v) } } } } });
  const days = Object.keys(s.daily).sort();
  chart('cDay', { type: 'bar', data: { labels: days.map(d => d.slice(5)), datasets: [{ data: days.map(d => s.daily[d].net), backgroundColor: days.map(d => s.daily[d].net >= 0 ? '#2ee6a0' : '#ff5d73') }] } });
  calendar(s.daily, days[days.length - 1]); }
function calendar(daily, last) { if (!calMonth) calMonth = (last || C.toLocalISO(new Date())).slice(0, 7);
  const [y, m] = calMonth.split('-').map(Number), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate(), off = (first.getDay() + 6) % 7;
  const vals = Object.values(daily).map(d => Math.abs(d.net)), mx = Math.max(1, ...vals); let h = '一二三四五六日'.split('').map(x => `<div class="h">${x}</div>`).join('') + '<div style="background:none"></div>'.repeat(off);
  for (let d = 1; d <= n; d++) { const k = calMonth + '-' + String(d).padStart(2, '0'), v = daily[k]; const a = v ? .15 + .7 * Math.abs(v.net) / mx : 0;
    h += `<div data-day="${k}" style="${v ? `background:${v.net >= 0 ? `rgba(46,230,160,${a})` : `rgba(255,93,115,${a})`}` : ''}"><b>${d}</b>${v ? `<br>${money(v.net)}<br>${v.count}笔` : ''}</div>`; }
  $('#calCard').innerHTML = `<h3>日历热力图 <span class="row"><button class="ghost" data-cal="-1">‹</button>${calMonth}<button class="ghost" data-cal="1">›</button></span></h3><div class="cal">${h}</div>`; }
/* ---- 交易列表 / 编辑 ---- */
function tradesView() { const tr = filtered().slice().sort((a, b) => a.closeTime < b.closeTime ? 1 : -1);
  $('#view').innerHTML = `<div class="card"><h3>交易记录（${tr.length}） <button id="newTrade">+ 新增交易</button></h3><div class="tw"><table><tr><th>平仓时间</th><th>账户</th><th>品种</th><th>方向</th><th>手数</th><th>开/平</th><th>止损</th><th>净盈亏</th><th>R</th><th>策略</th><th>情绪</th><th></th></tr>
  ${tr.map(t => { const r = C.rMultiple(t); return `<tr><td>${t.closeTime.replace('T', ' ').slice(0, 16)}</td><td>${esc((accById(t.accountId) || {}).name)}</td><td>${esc(t.symbol)}${t.sample ? '<span class="tag">示例</span>' : ''}${t.hasImg ? ' 🖼' : ''}</td><td>${t.side === 'long' ? '多' : '空'}</td><td>${t.lots ?? ''}</td><td>${t.openPrice ?? ''} → ${t.closePrice ?? ''}</td><td>${t.sl ?? ''}</td><td class="${cls(C.netOf(t))}">${money(C.netOf(t))}</td><td>${r == null ? '' : fmt(r) + 'R'}</td><td>${esc(t.strategy)}</td><td>${esc(t.emotion)}</td><td><button class="ghost" data-edit="${t.id}">编辑</button> <button class="danger" data-del="${t.id}">删</button></td></tr>`; }).join('')}</table></div></div>`; }
const TF = [['symbol', '品种', 'text'], ['side', '方向', 'side'], ['openTime', '开仓时间', 'datetime-local'], ['closeTime', '平仓时间', 'datetime-local'], ['openPrice', '开仓价', 'number'], ['closePrice', '平仓价', 'number'], ['lots', '手数', 'number'],
  ['commission', '手续费（成本）', 'number'], ['swap', '隔夜费（+收/-付）', 'number'], ['pnl', '盈亏（不含费用）', 'number'], ['sl', '止损价', 'number'], ['tp', '止盈价', 'number'], ['strategy', '策略标签', 'text'], ['emotion', '情绪', 'text']];
async function editTrade(id) { const t = id ? S.trades.find(x => x.id === id) : { accountId: S.current === 'all' ? (S.accounts[0] || {}).id : S.current, side: 'long', openTime: C.toLocalISO(new Date()).slice(0, 16), closeTime: C.toLocalISO(new Date()).slice(0, 16) };
  if (!S.accounts.length) return alert('请先新建账户'); const img = id ? await imgGet(id) : null;
  $('#mbox').innerHTML = `<h3>${id ? '编辑' : '新增'}交易 <button class="ghost" data-close>✕</button></h3><form class="form" id="tf"><label>账户<select name="accountId">${S.accounts.map(a => `<option value="${a.id}" ${a.id === t.accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
   ${TF.map(([k, l, ty]) => ty === 'side' ? `<label>${l}<select name="side"><option value="long">做多</option><option value="short" ${t.side === 'short' ? 'selected' : ''}>做空</option></select></label>` : `<label>${l}<input name="${k}" type="${ty}" step="any" value="${esc(ty === 'datetime-local' ? (t[k] || '').slice(0, 16) : t[k] ?? '')}"></label>`).join('')}
   <label style="grid-column:1/-1">备注<textarea name="notes">${esc(t.notes)}</textarea></label><label style="grid-column:1/-1">截图<input type="file" name="img" accept="image/*">${img ? `<img class="shot" src="${img}"><span><input type="checkbox" name="rmimg"> 删除截图</span>` : ''}</label>
   <div class="row" style="grid-column:1/-1"><button type="submit">保存</button><small>净盈亏 = 盈亏 − |手续费| + 隔夜费；R 倍数按止损距离计算</small></div></form>`;
  $('#modal').classList.add('on');
  $('#tf').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target), o = id ? t : { id: uid() };
    o.accountId = f.get('accountId'); TF.forEach(([k, , ty]) => { const v = f.get(k); o[k] = ty === 'number' ? C.num(v) : ty === 'datetime-local' ? C.parseDate(v) : String(v || '').trim(); });
    o.notes = f.get('notes'); o.commission = o.commission || 0; o.swap = o.swap || 0; o.pnl = o.pnl || 0; o.sample = false; if (!o.symbol || !o.closeTime) return alert('品种和平仓时间必填');
    const file = f.get('img'); if (file && file.size) { await imgPut(o.id, await shrink(file)); o.hasImg = true; } else if (f.get('rmimg')) { await imgDel(o.id); o.hasImg = false; }
    if (!id) S.trades.push(o); save(); closeModal(); render(); }; }
function shrink(file) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 1400 / im.width), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', .82)); }; im.src = fr.result; }; fr.readAsDataURL(file); }); }
const closeModal = () => $('#modal').classList.remove('on');
/* ---- 统计 ---- */
function statsView() { const s = C.computeStats(filtered(), baseOf(accIds()));
  const tb = (t, rows) => `<div class="card"><h3>${t}</h3><div class="tw"><table><tr><th>分组</th><th>笔数</th><th>胜率</th><th>净盈亏</th><th>获利因子</th><th>每笔期望</th></tr>${rows.map(g => `<tr><td>${esc(g.key)}</td><td>${g.count}</td><td>${fmt(g.winRate * 100, 1)}%</td><td class="${cls(g.net)}">${money(g.net)}</td><td>${fmt(g.profitFactor)}</td><td class="${cls(g.expectancy)}">${money(g.expectancy)}</td></tr>`).join('')}</table></div></div>`;
  $('#view').innerHTML = `<div class="grid">${kpis(s)}<div class="kpi"><span>平均盈利 / 平均亏损</span><b>${fmt(s.avgWin)} / ${fmt(s.avgLoss)}</b></div><div class="kpi"><span>累计 R（${s.rCount} 笔有止损）</span><b>${fmt(s.totalR)}R</b></div></div>
   <div class="two">${tb('按品种', s.bySymbol)}${tb('按策略', s.byStrategy)}</div><div class="two">${tb('按多空', s.bySide)}${tb('按星期（平仓日）', s.byWeekday)}</div>${tb('按开仓时段（小时）', s.byHour)}`; }
/* ---- 每日 ---- */
function daily() { const d = dayView || (filtered(false).map(t => t.closeTime.slice(0, 10)).sort().pop()) || C.toLocalISO(new Date()).slice(0, 10); dayView = d;
  const tr = S.trades.filter(t => accIds().includes(t.accountId) && t.closeTime.slice(0, 10) === d), s = C.computeStats(tr, 0), j = S.journals[d] || {};
  $('#view').innerHTML = `<div class="row" style="margin-bottom:12px"><button class="ghost" data-dd="-1">‹ 前一天</button><input type="date" id="dpick" value="${d}"><button class="ghost" data-dd="1">后一天 ›</button></div>
   <div class="hero"><small>${d} 当日净盈亏</small><div class="big">${money(s.net)}</div><small>${s.count} 笔 · 胜率 ${fmt(s.winRate * 100, 1)}%</small></div>
   <div class="card"><h3>当日交易</h3><div class="tw"><table>${tr.map(t => `<tr data-edit="${t.id}" style="cursor:pointer"><td>${t.closeTime.slice(11, 16)}</td><td>${esc(t.symbol)}</td><td>${t.side === 'long' ? '多' : '空'}</td><td class="${cls(C.netOf(t))}">${money(C.netOf(t))}</td><td>${esc(t.strategy)}</td><td>${esc(t.notes)}</td></tr>`).join('') || '<tr><td>当天无交易</td></tr>'}</table></div></div>
   <div class="card"><h3>复盘日记 ${j.sample ? '<span class="tag">示例</span>' : ''}</h3><form id="jf" class="form">${[['plan', '盘前计划'], ['review', '复盘'], ['mistakes', '错误'], ['lessons', '教训']].map(([k, l]) => `<label style="grid-column:1/-1">${l}<textarea name="${k}">${esc(j[k])}</textarea></label>`).join('')}
   <label>心情评分（1-10）<input name="mood" type="number" min="1" max="10" value="${j.mood ?? ''}"></label><div class="row"><button type="submit">保存日记</button>${S.journals[d] ? '<button type="button" class="danger" id="jdel">删除日记</button>' : ''}</div></form></div>`;
  $('#jf').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); S.journals[d] = { plan: f.get('plan'), review: f.get('review'), mistakes: f.get('mistakes'), lessons: f.get('lessons'), mood: C.num(f.get('mood')) }; save(); render(); };
  const jd = $('#jdel'); if (jd) jd.onclick = () => { if (confirm('删除这天的日记？')) { delete S.journals[d]; save(); render(); } };
  $('#dpick').onchange = e => { dayView = e.target.value; render(); }; }
/* ---- 导入 ---- */
let imp = null;
function importView() { $('#view').innerHTML = `<div class="card"><h3>导入 CSV / Excel</h3><p style="font-size:13px;color:#b9b4e6">支持自动识别 MT5（历史→持仓 导出）、Capital.com（已平仓头寸）、Trading212（交易历史 CSV，只导入带 Result 的卖出行）及本工具模板。导入时按 账户+品种+方向+开平时间+手数+盈亏 去重。</p>
  <div class="row"><select id="impAcc">${S.accounts.map(a => `<option value="${a.id}" ${a.id === S.current ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select><input type="file" id="impFile" accept=".csv,.xlsx,.xls,.txt"><button class="ghost" id="tpl">下载模板 CSV</button></div><div id="impMap"></div></div>`;
  $('#impFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; const buf = await f.arrayBuffer(); let wb;
    if (/\.(csv|txt)$/i.test(f.name)) { let txt = new TextDecoder('utf-8').decode(buf); if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1); if (/\u0000/.test(txt)) txt = new TextDecoder('utf-16le').decode(buf).replace(/^\ufeff/, '');
      const first = txt.split('\n')[0]; const FS = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
      wb = XLSX.read(txt, { type: 'string', raw: true, FS }); } else wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true }), hi = C.findHeader(rows), hdr = rows[hi] || [], fm = C.detectFormat(hdr);
    imp = { rows, hi, fm, map: C.autoMap(hdr, fm) }; mapUI(); }; }
function mapUI() { const hdr = imp.rows[imp.hi]; const opts = sel => `<option value="">（不导入）</option>` + hdr.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${i + 1}. ${esc(h)}</option>`).join('');
  const prev = C.rowsToTrades(imp.rows, imp.hi, imp.map, $('#impAcc').value, imp.fm);
  $('#impMap').innerHTML = `<p>识别格式：<b>${imp.fm}</b> · 表头在第 ${imp.hi + 1} 行 · 可解析 <b>${prev.length}</b> 笔</p><div class="form">${C.FIELDS.map(([k, l]) => `<label>${l}<select data-map="${k}">${opts(imp.map[k])}</select></label>`).join('')}</div>
   <div class="tw" style="margin-top:10px"><table><tr><th>品种</th><th>方向</th><th>开仓</th><th>平仓</th><th>手数</th><th>盈亏</th><th>费用</th></tr>${prev.slice(0, 5).map(t => `<tr><td>${esc(t.symbol)}</td><td>${t.side}</td><td>${t.openTime || ''}</td><td>${t.closeTime}</td><td>${t.lots ?? ''}</td><td>${t.pnl}</td><td>${t.commission}/${t.swap}</td></tr>`).join('')}</table></div>
   <button id="doImp" style="margin-top:10px">确认导入</button> <span id="impMsg"></span>`;
  document.querySelectorAll('[data-map]').forEach(s => s.onchange = () => { imp.map[s.dataset.map] = s.value === '' ? undefined : +s.value; mapUI(); });
  $('#doImp').onclick = () => { const acc = $('#impAcc').value; if (!acc) return alert('请先新建账户'); const tr = C.rowsToTrades(imp.rows, imp.hi, imp.map, acc, imp.fm); const r = C.dedupe(S.trades, tr);
    r.add.forEach(t => { t.id = uid(); S.trades.push(t); }); save(); side(); $('#impMsg').innerHTML = `✅ 导入 ${r.add.length} 笔，跳过重复 ${r.dup.length} 笔`; }; }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
/* ---- 账户 ---- */
function accountsView() { $('#view').innerHTML = `<div class="card"><h3>账户管理 <button id="addAcc2">+ 新建账户</button></h3>${S.accounts.map(a => `<div class="card"><div class="form" data-acc-form="${a.id}">
  <label>名称<input name="name" value="${esc(a.name)}"></label><label>币种<input name="currency" value="${esc(a.currency)}"></label><label>初始资金<input name="initial" type="number" step="any" value="${a.initial}"></label></div>
  <h3 style="margin-top:12px;font-size:14px">出入金（入金正数，出金负数）</h3><table>${a.cash.map(c => `<tr><td>${c.date}</td><td class="${cls(c.amount)}">${money(c.amount)}</td><td>${esc(c.note)}</td><td><button class="ghost" data-cdel="${a.id}|${c.id}">删</button></td></tr>`).join('')}</table>
  <div class="row" style="margin-top:8px"><input type="date" id="cd_${a.id}"><input type="number" step="any" placeholder="金额" id="ca_${a.id}"><input placeholder="备注" id="cn_${a.id}"><button class="ghost" data-cadd="${a.id}">添加出入金</button></div>
  <div class="row" style="margin-top:10px"><button data-asave="${a.id}">保存</button><button class="danger" data-adel="${a.id}">删除账户（含交易）</button>${a.sample ? '<span class="tag">示例</span>' : ''}</div></div>`).join('')}</div>`; }
function newAccount() { const name = prompt('账户名称'); if (!name) return; const a = { id: uid(), name, currency: prompt('币种', 'USD') || 'USD', initial: C.num(prompt('初始资金', '10000')) || 0, cash: [] }; S.accounts.push(a); S.current = a.id; save(); render(); }
/* ---- 备份 ---- */
function backup() { $('#view').innerHTML = `<div class="card"><h3>备份与恢复</h3><p style="font-size:13px;color:#b9b4e6">数据仅保存在本浏览器（localStorage + IndexedDB 截图）。清除浏览器数据会丢失，请定期导出。</p>
  <div class="row"><button id="exp">导出 JSON 备份（含截图）</button><label class="ghost" style="cursor:pointer">导入 JSON 备份 <input type="file" id="impJson" accept=".json"></label><button class="danger" id="wipe">清空全部数据</button></div></div>`;
  $('#exp').onclick = async () => download('交易日志备份_' + C.toLocalISO(new Date()).slice(0, 10) + '.json', JSON.stringify({ app: 'trade-journal', version: 1, data: S, images: await imgAll() }), 'application/json');
  $('#impJson').onchange = async e => { try { const o = JSON.parse(await e.target.files[0].text()); if (!o.data || !o.data.accounts) throw 0; if (!confirm('用备份覆盖当前数据？')) return; S = o.data; for (const k in o.images || {}) await imgPut(k, o.images[k]); save(); render(); alert('已恢复'); } catch (x) { alert('备份文件无效'); } };
  $('#wipe').onclick = () => { if (confirm('确定清空全部数据？')) { S = { accounts: [], trades: [], journals: {}, current: 'all' }; save(); render(); } }; }
/* ---- 事件 ---- */
document.addEventListener('click', e => { const el = e.target.closest('[data-acc],[data-v],[data-edit],[data-del],[data-day],[data-cal],[data-dd],[data-close],[data-asave],[data-adel],[data-cadd],[data-cdel],#addAcc,#addAcc2,#newTrade,#delSample,#tpl,#clr,#menuBtn'); if (!el) return; const d = el.dataset;
  if (el.id === 'menuBtn') return $('#nav').classList.toggle('open');
  if (d.acc) { S.current = d.acc; save(); render(); } else if (d.v) { view = d.v; $('#nav').classList.remove('open'); render(); } else if (d.edit) editTrade(d.edit);
  else if (d.del) { if (confirm('删除这笔交易？')) { S.trades = S.trades.filter(t => t.id !== d.del); imgDel(d.del); save(); render(); } }
  else if (d.day) { dayView = d.day; view = 'daily'; render(); } else if (d.cal) { const [y, m] = calMonth.split('-').map(Number), n = new Date(y, m - 1 + +d.cal, 1); calMonth = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); render(); }
  else if (d.dd) { const n = new Date(dayView + 'T12:00:00'); n.setDate(n.getDate() + +d.dd); dayView = C.toLocalISO(n).slice(0, 10); render(); } else if ('close' in d) closeModal();
  else if (d.asave) { const a = accById(d.asave), f = document.querySelector(`[data-acc-form="${a.id}"]`); a.name = f.querySelector('[name=name]').value || a.name; a.currency = f.querySelector('[name=currency]').value; a.initial = C.num(f.querySelector('[name=initial]').value) || 0; a.sample = false; save(); render(); }
  else if (d.adel) { if (confirm('删除账户及其所有交易？')) { S.trades.filter(t => t.accountId === d.adel).forEach(t => imgDel(t.id)); S.trades = S.trades.filter(t => t.accountId !== d.adel); S.accounts = S.accounts.filter(a => a.id !== d.adel); save(); render(); } }
  else if (d.cadd) { const id = d.cadd, amt = C.num($('#ca_' + id).value); if (amt == null) return; accById(id).cash.push({ id: uid(), date: $('#cd_' + id).value || C.toLocalISO(new Date()).slice(0, 10), amount: amt, note: $('#cn_' + id).value }); save(); render(); }
  else if (d.cdel) { const [a, c] = d.cdel.split('|'); accById(a).cash = accById(a).cash.filter(x => x.id !== c); save(); render(); }
  else if (el.id === 'addAcc' || el.id === 'addAcc2') newAccount(); else if (el.id === 'newTrade') editTrade();
  else if (el.id === 'delSample') { if (confirm('删除全部示例账户、示例交易和示例日记？')) { S.trades = S.trades.filter(t => !t.sample); S.accounts = S.accounts.filter(a => !a.sample); for (const k in S.journals) if (S.journals[k].sample) delete S.journals[k]; save(); render(); } }
  else if (el.id === 'tpl') download('交易导入模板.csv', '\ufeff' + C.FIELDS.map(f => f[1]).join(',') + '\nXAUUSD,多,2026-10-01 09:00,2026-10-01 12:00,2650,2660,0.1,0.7,0,100,2645,2670,FVG回补,冷静,备注\n', 'text/csv');
  else if (el.id === 'clr') { $('#from').value = $('#to').value = ''; render(); } });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
['#from', '#to'].forEach(s => $(s).onchange = render); let st; $('#search').oninput = () => { clearTimeout(st); st = setTimeout(() => { if (!['trades', 'dash', 'stats'].includes(view)) view = 'trades'; render(); }, 250); };
window.TJ = { state: () => S, render };
render();
window.TJApp = { get S() { return S; }, go(v) { view = v; render(); }, day(d) { dayView = d; view = 'daily'; render(); } };
})();
