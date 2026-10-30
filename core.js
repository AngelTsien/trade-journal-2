/* 交易日志核心：统计 + 导入解析（浏览器与 Node 共用） */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.TJCore = f(); })(this, function () {
  'use strict';
  const num = v => { if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim().replace(/\s/g, '').replace(/[^\d.,\-+eE]/g, ''); if (!s) return null;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = /,\d{3}$/.test(s) && s.split(',').length > 1 && !/^-?0,/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    const n = parseFloat(s); return isFinite(n) ? n : null; };
  const pad = n => String(n).padStart(2, '0');
  function toLocalISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function parseDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : toLocalISO(v);
    if (typeof v === 'number') { if (v > 20000 && v < 80000) { const ms = Math.round((v - 25569) * 864e5); const d = new Date(ms); return toLocalISO(new Date(d.getTime() + d.getTimezoneOffset() * 6e4)); } if (v > 1e11) return toLocalISO(new Date(v)); return null; }
    let s = String(v).trim(); let m;
    if ((m = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) + 'T' + pad(m[4] || 0) + ':' + pad(m[5] || 0) + ':' + pad(m[6] || 0);
    if ((m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]) + 'T' + pad(m[4] || 0) + ':' + pad(m[5] || 0) + ':' + pad(m[6] || 0);
    const d = new Date(s); return isNaN(d) ? null : toLocalISO(d);
  }
  function parseSide(v) { const s = String(v || '').toLowerCase(); if (/sell|short|空|卖/.test(s)) return 'short'; if (/buy|long|多|买/.test(s)) return 'long'; return null; }
  const netOf = t => (+t.pnl || 0) - Math.abs(+t.commission || 0) + (+t.swap || 0);
  function rMultiple(t) { const o = +t.openPrice, c = +t.closePrice, sl = +t.sl; if (!o || !c || !sl) return null;
    const risk = t.side === 'short' ? sl - o : o - sl; if (risk <= 0) return null; const move = t.side === 'short' ? o - c : c - o; return move / risk; }
  const dayKey = iso => (iso || '').slice(0, 10);
  function group(trades, keyFn) { const m = {};
    trades.forEach(t => { const k = keyFn(t); (m[k] = m[k] || []).push(t); });
    return Object.keys(m).map(k => { const a = m[k], n = a.map(netOf), w = n.filter(x => x > 0), l = n.filter(x => x < 0);
      const gw = w.reduce((s, x) => s + x, 0), gl = -l.reduce((s, x) => s + x, 0);
      return { key: k, count: a.length, net: gw - gl, winRate: a.length ? w.length / a.length : 0, profitFactor: gl ? gw / gl : (gw ? Infinity : 0), expectancy: a.length ? (gw - gl) / a.length : 0 }; })
      .sort((a, b) => b.net - a.net); }
  /* base = 初始资金 + 净出入金；资金曲线 = base + 累计净盈亏 */
  function computeStats(tradesIn, base) {
    base = +base || 0;
    const trades = tradesIn.filter(t => t.closeTime).slice().sort((a, b) => a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0);
    const nets = trades.map(netOf), n = trades.length;
    const wins = nets.filter(x => x > 0), losses = nets.filter(x => x < 0);
    const grossWin = wins.reduce((s, x) => s + x, 0), grossLoss = -losses.reduce((s, x) => s + x, 0), net = grossWin - grossLoss;
    const avgWin = wins.length ? grossWin / wins.length : 0, avgLoss = losses.length ? grossLoss / losses.length : 0;
    let eq = base, peak = base, maxDD = 0, maxDDPct = 0, cw = 0, cl = 0, maxW = 0, maxL = 0; const equity = [], drawdown = [];
    trades.forEach((t, i) => { eq += nets[i]; if (eq > peak) peak = eq; const dd = peak - eq; const ddp = peak > 0 ? dd / peak * 100 : 0;
      if (dd > maxDD) maxDD = dd; if (ddp > maxDDPct) maxDDPct = ddp; equity.push({ t: t.closeTime, v: eq }); drawdown.push({ t: t.closeTime, v: -dd, p: -ddp });
      if (nets[i] > 0) { cw++; cl = 0; } else if (nets[i] < 0) { cl++; cw = 0; } else { cw = 0; cl = 0; } maxW = Math.max(maxW, cw); maxL = Math.max(maxL, cl); });
    const holds = trades.filter(t => t.openTime && t.closeTime).map(t => (new Date(t.closeTime) - new Date(t.openTime)) / 6e4).filter(x => x >= 0);
    const rs = trades.map(rMultiple).filter(x => x !== null);
    const daily = {}; trades.forEach((t, i) => { const d = dayKey(t.closeTime); daily[d] = daily[d] || { net: 0, count: 0 }; daily[d].net += nets[i]; daily[d].count++; });
    const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return { count: n, wins: wins.length, losses: losses.length, winRate: n ? wins.length / n : 0, avgWin, avgLoss,
      payoff: avgLoss ? avgWin / avgLoss : (avgWin ? Infinity : 0), profitFactor: grossLoss ? grossWin / grossLoss : (grossWin ? Infinity : 0),
      grossWin, grossLoss, net, expectancy: n ? net / n : 0, avgR: rs.length ? rs.reduce((s, x) => s + x, 0) / rs.length : null, totalR: rs.reduce((s, x) => s + x, 0), rCount: rs.length,
      maxDD, maxDDPct, maxWinStreak: maxW, maxLossStreak: maxL, avgHoldMin: holds.length ? holds.reduce((s, x) => s + x, 0) / holds.length : 0,
      returnPct: base > 0 ? net / base * 100 : 0, base, equity, drawdown, daily,
      bySymbol: group(trades, t => t.symbol || '-'), byStrategy: group(trades, t => t.strategy || '未标记'),
      bySide: group(trades, t => t.side === 'short' ? '做空' : '做多'),
      byWeekday: group(trades, t => WD[new Date(t.closeTime).getDay()]),
      byHour: group(trades, t => pad(new Date(t.openTime || t.closeTime).getHours()) + ':00') .sort((a, b) => a.key < b.key ? -1 : 1) };
  }
  /* ---------- 导入 ---------- */
  const FIELDS = [['symbol', '品种'], ['side', '方向'], ['openTime', '开仓时间'], ['closeTime', '平仓时间'], ['openPrice', '开仓价'], ['closePrice', '平仓价'], ['lots', '手数'],
    ['commission', '手续费'], ['swap', '隔夜费'], ['pnl', '盈亏'], ['sl', '止损'], ['tp', '止盈'], ['strategy', '策略'], ['emotion', '情绪'], ['notes', '备注']];
  const SYN = { symbol: ['symbol', 'instrument', 'ticker', 'market', 'epic', '品种', '交易品种', 'name'], side: ['type', 'direction', 'side', 'action', '方向', '类型'],
    openTime: ['opentime', 'opened', 'opendate', 'openingdate', 'opening', 'dateopened', 'time', '开仓时间'], closeTime: ['closetime', 'closed', 'closedate', 'closingdate', 'dateclosed', 'closing', '平仓时间'],
    openPrice: ['openprice', 'openingprice', 'entryprice', 'price', '开仓价'], closePrice: ['closeprice', 'closingprice', 'exitprice', '平仓价'],
    lots: ['volume', 'lots', 'size', 'quantity', 'amount', 'noofshares', 'qty', '手数', '数量'], commission: ['commission', 'fee', 'fees', 'chargeamount', '手续费'],
    swap: ['swap', 'overnightfee', 'financing', 'overnight', 'rollover', '隔夜费'], pnl: ['profit', 'profitloss', 'pnl', 'pl', 'result', 'realisedpl', 'realizedpl', '盈亏'],
    sl: ['sl', 'stoploss', 'stop', '止损'], tp: ['tp', 'takeprofit', 'limit', 'profittarget', '止盈'], strategy: ['strategy', 'tag', '策略'], emotion: ['emotion', '情绪'], notes: ['notes', 'note', 'comment', '备注'] };
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  function findHeader(rows) { for (let i = 0; i < Math.min(rows.length, 30); i++) { const r = rows[i] || []; const ne = r.filter(c => c !== '' && c !== null && c !== undefined).length;
    const hits = r.filter(c => Object.values(SYN).some(a => a.includes(norm(c)))).length; if (ne >= 3 && hits >= 2) return i; } return 0; }
  function detectFormat(headers) { const h = headers.map(norm);
    if (h.includes('position') && h.includes('sl') && h.filter(x => x === 'time').length >= 2) return 'MT5';
    if (h.includes('noofshares') || h.includes('pricesharess') || (h.includes('action') && h.includes('result'))) return 'Trading212';
    if (h.some(x => /openingprice|closingprice|profitloss|epic|overnightfee/.test(x)) && h.some(x => /instrument|market|epic/.test(x))) return 'Capital.com';
    if (h.includes('品种') || h.includes('开仓时间')) return '模板'; return '通用'; }
  function autoMap(headers, fmt) { const h = headers.map(norm), map = {}, used = new Set();
    if (fmt === 'MT5') { const ti = h.reduce((a, x, i) => (x === 'time' ? a.concat(i) : a), []), pi = h.reduce((a, x, i) => (x === 'price' ? a.concat(i) : a), []);
      map.openTime = ti[0]; map.closeTime = ti[1]; map.openPrice = pi[0]; map.closePrice = pi[1]; [ti[0], ti[1], pi[0], pi[1]].forEach(i => used.add(i)); }
    if (fmt === 'Trading212') { const ti = h.indexOf('time'); if (ti >= 0) { map.closeTime = ti; used.add(ti); } const pi = h.indexOf('priceshare'); if (pi >= 0) { map.closePrice = pi; used.add(pi); } }
    FIELDS.forEach(([f]) => { if (map[f] !== undefined) return; for (const syn of SYN[f]) { const i = h.findIndex((x, j) => x === syn && !used.has(j)); if (i >= 0) { map[f] = i; used.add(i); return; } } });
    if (fmt === 'Trading212') delete map.openTime;
    return map; }
  function rowsToTrades(rows, headerIdx, map, accountId, fmt) { const out = [], hdr = rows[headerIdx] || []; const actionIdx = hdr.map(norm).indexOf('action');
    for (let i = headerIdx + 1; i < rows.length; i++) { const r = rows[i]; if (!r || !r.some(c => c !== '' && c != null)) continue; const g = f => (map[f] === undefined || map[f] === '' || map[f] < 0) ? '' : r[map[f]];
      if (fmt === 'Trading212') { const a = String(r[actionIdx] || '').toLowerCase(); if (!/sell/.test(a) || num(g('pnl')) === null) continue; }
      let side = parseSide(g('side')); if (fmt === 'MT5' && !side) continue; if (fmt === 'Trading212') side = 'long';
      const t = { accountId, symbol: String(g('symbol') || '').trim(), side: side || 'long', openTime: parseDate(g('openTime')), closeTime: parseDate(g('closeTime')) || parseDate(g('openTime')),
        openPrice: num(g('openPrice')), closePrice: num(g('closePrice')), lots: num(g('lots')), commission: num(g('commission')) || 0, swap: num(g('swap')) || 0, pnl: num(g('pnl')),
        sl: num(g('sl')), tp: num(g('tp')), strategy: String(g('strategy') || ''), emotion: String(g('emotion') || ''), notes: String(g('notes') || '') };
      if (t.sl === 0) t.sl = null; if (t.tp === 0) t.tp = null; if (fmt === 'Trading212') t.commission = Math.abs(t.commission);
      if (!t.symbol || t.pnl === null || !t.closeTime) continue; out.push(t); }
    return out; }
  const dedupeKey = t => [t.accountId, String(t.symbol).toUpperCase(), t.side, (t.openTime || '').slice(0, 16), (t.closeTime || '').slice(0, 16), +t.lots || 0, (+t.pnl || 0).toFixed(2)].join('|');
  function dedupe(existing, incoming) { const seen = new Set(existing.map(dedupeKey)), add = [], dup = []; incoming.forEach(t => { const k = dedupeKey(t); if (seen.has(k)) dup.push(t); else { seen.add(k); add.push(t); } }); return { add, dup }; }
  return { num, parseDate, parseSide, netOf, rMultiple, computeStats, group, FIELDS, findHeader, detectFormat, autoMap, rowsToTrades, dedupe, dedupeKey, toLocalISO };
});
