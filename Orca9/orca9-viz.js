/* Orca9 visual layer: traffic & conversion analytics demo data, and alternative pipeline views.
   Prototype only: all numbers are generated, deterministic, and fictional. Loaded before the main script. */

/* ---------- palettes (validated: categorical 8-slot order passes adjacent CVD / normal-vision checks on white) ---------- */
const VZ_CH = [
  { k: 'og', name: 'Органіка Google', grp: 'SEO', col: '#2a78d6', base: 19000, cr: 2.1, act: 38, pay: 24, arpa: 118 },
  { k: 'ob', name: 'Органіка Bing', grp: 'SEO', col: '#eb6834', base: 2400, cr: 2.6, act: 40, pay: 24, arpa: 112 },
  { k: 'ga', name: 'Google Ads', grp: 'PPC', col: '#1baf7a', base: 2600, cr: 2.4, act: 31, pay: 22, arpa: 104, spend: 2350 },
  { k: 'li', name: 'LinkedIn Ads', grp: 'PPC', col: '#eda100', base: 900, cr: 4.3, act: 44, pay: 30, arpa: 160, spend: 1480 },
  { k: 'me', name: 'Meta Ads', grp: 'PPC', col: '#e87ba4', base: 1100, cr: 2.1, act: 22, pay: 15, arpa: 85, spend: 520 },
  { k: 'em', name: 'Email', grp: 'Email', col: '#008300', base: 1300, cr: 4.8, act: 52, pay: 28, arpa: 125 },
  { k: 'ai', name: 'AI-реферали', grp: 'AI', col: '#6250d6', base: 380, cr: 5.5, act: 47, pay: 32, arpa: 130 },
  { k: 'ot', name: 'Пряме і реферали', grp: 'Інше', col: '#e34948', base: 2200, cr: 3.0, act: 45, pay: 26, arpa: 120 }
];
const VZ_W = Array.from({ length: 24 }, (_, i) => 'W' + (18 + i));
const VZ_LAST = VZ_W.length - 1;
const VZ_ATTR = { og: 1.06, ob: 1.0, ga: 0.86, li: 1.18, me: 1.25, em: 1.12, ai: 1.2, ot: 0.8 };
const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#104281'];

function vzRnd(k, i) { const x = Math.sin(k.charCodeAt(0) * 31.7 + k.charCodeAt(1) * 17.3 + i * 7.31) * 10000; return x - Math.floor(x); }
function vzBuild() {
  const rows = [];
  VZ_CH.forEach(c => VZ_W.forEach((w, i) => {
    let s = c.base * (0.94 + 0.12 * vzRnd(c.k, i));
    if (c.k === 'og' && i === VZ_LAST - 1) s *= 0.91;
    if (c.k === 'og' && i === VZ_LAST) s *= 0.86;
    if (c.k === 'ai') s = c.base * Math.pow(1.045, i - 12) * (0.95 + 0.1 * vzRnd(c.k, i));
    if (c.k === 'em' && i % 4 === 3) s *= 1.7;
    if (c.k === 'ga' && i >= VZ_LAST - 1) s *= 1.12;
    const cr = c.cr * (0.92 + 0.16 * vzRnd(c.k, i + 20)) * (c.k === 'ga' && i >= VZ_LAST - 1 ? 0.82 : 1);
    const signups = Math.round(s * cr / 100);
    const act = Math.round(signups * c.act / 100 * (0.9 + 0.2 * vzRnd(c.k, i + 40)));
    const paid = Math.max(0, Math.round(act * c.pay / 100 * (0.85 + 0.3 * vzRnd(c.k, i + 60))));
    const spend = c.spend ? Math.round(c.spend * (0.95 + 0.1 * vzRnd(c.k, i + 80)) * (c.k === 'ga' && i >= VZ_LAST - 1 ? 1.16 : 1)) : 0;
    rows.push({ ch: c.k, w: i, sessions: Math.round(s), signups, act, paid, spend, mrr: paid * c.arpa });
  }));
  return rows;
}
const VZ_ROWS = vzBuild();
const vzN = n => Math.round(n).toLocaleString('uk');
const vzM = n => '$' + Math.round(n).toLocaleString('uk');
const vzP = (n, d = 1) => (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toString().replace('.', ',') + '%';

/* Last full week for the SEO screen tiles: clicks ≈ organic sessions, impressions from CTR. */
function vzBase(chs, key) { return vzSum(chs, VZ_LAST - 5, VZ_LAST - 2, key) / 4; }
function vzSeoWeek() {
  const seo = VZ_CH.filter(c => c.grp === 'SEO'), c1 = vzSum(seo, VZ_LAST, VZ_LAST, 'sessions'), c0 = vzBase(seo, 'sessions');
  const i1 = c1 / 0.039, i0 = c0 / 0.043, pc = (a, b) => (a >= b ? '+' : '−') + vzP(Math.abs(a - b) / b * 100, 0);
  return { clicks: c1, dClicks: pc(c1, c0), impr: vzN(i1 / 1000), dImpr: pc(i1, i0) };
}
function vzOgDrop() { const og = VZ_CH.filter(c => c.k === 'og'); return Math.round((1 - vzSum(og, VZ_LAST, VZ_LAST, 'sessions') / vzBase(og, 'sessions')) * 100); }
function vzState() { if (!S.vz) S.vz = { weeks: 8, grp: 'all', table: false }; return S.vz; }
function vzChannels() { const v = vzState(); return VZ_CH.filter(c => v.grp === 'all' || c.grp === v.grp); }
function vzSum(chs, from, to, key) { return VZ_ROWS.filter(r => chs.some(c => c.k === r.ch) && r.w >= from && r.w <= to).reduce((t, r) => t + r[key], 0); }
function vzDelta(cur, prev, goodUp = true) {
  if (!prev) return '<span class="small muted">—</span>';
  const d = (cur - prev) / prev * 100, up = d >= 0, good = goodUp ? up : !up;
  return `<span class="${Math.abs(d) < 1 ? 'small muted' : good ? 'up' : 'down'}">${up ? '↑' : '↓'} ${vzP(Math.abs(d))}</span> <span class="small muted">до попер. ${vzState().weeks} тиж.</span>`;
}

/* ---------- charts ---------- */
function vzStack(chs, from, to) {
  const W = 960, H = 300, L = 44, R = 70, T = 16, B = 30, n = to - from + 1, band = (W - L - R) / n, bw = Math.min(46, band * 0.62);
  const tot = i => vzSum(chs, i, i, 'signups');
  const max = Math.max(...Array.from({ length: n }, (_, k) => tot(from + k)));
  const top = Math.ceil(max / 100) * 100 || 100, y = v => T + (1 - v / top) * (H - T - B);
  let g = '';
  for (let v = 0; v <= top; v += top / 5) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#E3E7EF"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11.5" fill="#8A93A8">${vzN(v)}</text>`;
  let bars = '', hits = '';
  for (let k = 0; k < n; k++) {
    const i = from + k, x = L + k * band + (band - bw) / 2;
    let acc = 0; const parts = chs.map(c => ({ c, v: VZ_ROWS.find(r => r.ch === c.k && r.w === i).signups })).filter(p => p.v > 0);
    parts.forEach((p, idx) => {
      const y0 = y(acc), y1 = y(acc + p.v); acc += p.v;
      const h = Math.max(0, y0 - y1 - 2), last = idx === parts.length - 1;
      bars += last ? `<path d="M${x} ${y0 - 2} V${y0 - 2 - h + 4} q0 -4 4 -4 H${x + bw - 4} q4 0 4 4 V${y0 - 2} Z" fill="${p.c.col}"/>` : `<rect x="${x}" y="${y0 - 2 - h}" width="${bw}" height="${h}" fill="${p.c.col}"/>`;
    });
    g += `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle" font-size="11.5" fill="#8A93A8">${VZ_W[i]}</text>`;
    const tip = `${VZ_W[i]} · ${vzN(acc)} реєстрацій\n` + parts.slice().sort((a, b) => b.v - a.v).map(p => `${p.c.name}: ${vzN(p.v)}`).join('\n');
    hits += `<rect x="${L + k * band}" y="${T}" width="${band}" height="${H - T - B}" fill="transparent" data-hint="${esc(tip)}" tabindex="0" class="vz-hit"/>`;
    if (k === n - 1) g += `<text x="${x + bw + 6}" y="${y(acc) + 4}" font-size="12" font-weight="600" fill="#182033">${vzN(acc)}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Реєстрації за тижнями за каналами">${g}${bars}${hits}</svg>`;
}
function vzSpark(vals, label) {
  const W = 320, H = 46, P = 4, max = Math.max(...vals), min = Math.min(...vals), rng = max - min || 1;
  const X = i => P + i * (W - P * 2 - 120) / (vals.length - 1), Y = v => P + (1 - (v - min) / rng) * (H - P * 2);
  const pts = vals.map((v, i) => `${X(i)},${Y(v)}`).join(' '), last = vals.length - 1;
  const hits = vals.map((v, i) => `<rect x="${X(i) - 8}" y="0" width="16" height="${H}" fill="transparent" data-hint="${esc(VZ_W[VZ_W.length - vals.length + i] + ': ' + label(v))}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="spark" role="img" aria-label="Тренд"><polyline points="${pts}" fill="none" stroke="#3442A8" stroke-width="2" stroke-linejoin="round"/><circle cx="${X(last)}" cy="${Y(vals[last])}" r="4" fill="#3442A8" stroke="#fff" stroke-width="2"/><text x="${X(last) + 8}" y="${Y(vals[last]) + 4}" font-size="11.5" font-weight="600" fill="#182033">${esc(label(vals[last]))}</text>${hits}</svg>`;
}
function vzStatus(level, text) { return `<span class="chip ${level === 'ok' ? 'ok' : level === 'warn' ? 'warn' : 'bad'}">${level === 'ok' ? '✓' : level === 'warn' ? '!' : '✕'} ${text}</span>`; }

function trafficView() {
  const v = vzState(), chs = vzChannels(), to = VZ_LAST, from = VZ_W.length - v.weeks, pFrom = from - v.weeks, pTo = from - 1;
  const cur = k => vzSum(chs, from, to, k), prev = k => pFrom >= 0 ? vzSum(chs, pFrom, pTo, k) : 0;
  const ses = cur('sessions'), sig = cur('signups'), act = cur('act'), paid = cur('paid'), mrr = cur('mrr'), spend = cur('spend');
  const paidChs = chs.filter(c => c.spend);
  const all = VZ_CH, allSig = vzSum(all, from, to, 'signups');
  const filt = `<div class="vz-filters" data-tour="traffic-kpi"><span class="small muted">Період</span>${[4, 8, 12].map(w => `<button class="btn small ${v.weeks === w ? 'primary' : ''}" data-action="vz-weeks" data-id="${w}">${w} тиж.</button>`).join('')}
    <span class="small muted" style="margin-left:12px">Канал</span>${[['all', 'Усі'], ['SEO', 'SEO'], ['PPC', 'PPC'], ['Email', 'Email'], ['AI', 'AI'], ['Інше', 'Інше']].map(([k, l]) => `<button class="btn small ${v.grp === k ? 'primary' : ''}" data-action="vz-grp" data-id="${k}">${l}</button>`).join('')}
    <span class="sp small muted">${VZ_W[from]}–${VZ_W[to]} · демо-дані, вигадані</span></div>`;
  const kpi = (lbl, val, d, sub) => `<div class="metric"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${d}${sub ? ' · ' + sub : ''}</div></div>`;
  const tiles = `<div class="grid g4 sec-gap" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
    ${kpi('Сесії', vzN(ses), vzDelta(ses, prev('sessions')))}
    ${kpi('Реєстрації', vzN(sig), vzDelta(sig, prev('signups')))}
    ${kpi('Конверсія в реєстрацію', vzP(sig / ses * 100, 2), vzDelta(sig / ses, prev('signups') / (prev('sessions') || 1)))}
    ${kpi('Активовані', vzN(act), vzDelta(act, prev('act')), vzP(act / sig * 100, 0) + ' реєстрацій')}
    ${kpi('Нові платні', vzN(paid), vzDelta(paid, prev('paid')))}
    ${kpi('Новий MRR', vzM(mrr), vzDelta(mrr, prev('mrr')))}
    ${paidChs.length ? kpi('CAC платних каналів', vzM(spend / Math.max(1, vzSum(paidChs, from, to, 'paid'))), vzDelta(spend / Math.max(1, vzSum(paidChs, from, to, 'paid')), prev('spend') / Math.max(1, pFrom >= 0 ? vzSum(paidChs, pFrom, pTo, 'paid') : 1), false), 'ціль $450') : ''}
  </div>`;
  const legend = `<div class="legend" style="margin:0 0 8px">${chs.map(c => `<span><i style="width:12px;height:12px;border-radius:3px;background:${c.col};display:inline-block"></i>${esc(c.name)}</span>`).join('')}</div>`;
  const table = `<div class="tbl-wrap"><table><thead><tr><th>Тиждень</th>${chs.map(c => `<th>${esc(c.name)}</th>`).join('')}<th>Разом</th></tr></thead><tbody>${Array.from({ length: v.weeks }, (_, k) => from + k).map(i => `<tr><td>${VZ_W[i]}</td>${chs.map(c => `<td>${vzN(VZ_ROWS.find(r => r.ch === c.k && r.w === i).signups)}</td>`).join('')}<td><b>${vzN(vzSum(chs, i, i, 'signups'))}</b></td></tr>`).join('')}</tbody></table></div>`;
  const chart = `<div class="panel sec-gap"><h2>Реєстрації за тижнями, за каналами ${hint('Стовпчик — тиждень, сегменти — канали. Наведіть на тиждень, щоб побачити всі канали. Таблиця дає ті самі числа без графіка.')}<span class="sp"><button class="btn small" data-action="vz-table">${v.table ? 'Графік' : 'Таблиця'}</button></span></h2>${legend}${v.table ? table : `<div class="vz-chart">${vzStack(chs, from, to)}</div>`}</div>`;

  const fun = chs.map(c => { const g = k => vzSum([c], from, to, k); return { c, ses: g('sessions'), sig: g('signups'), act: g('act'), paid: g('paid'), spend: g('spend'), mrr: g('mrr') }; }).sort((a, b) => b.sig - a.sig);
  const maxSig = Math.max(...fun.map(f => f.sig));
  const funnel = `<div class="panel sec-gap"><h2>Воронка за каналами ${hint('Сесія → реєстрація → активація (підключили дані) → платний клієнт. CAC — витрати на одного нового платного клієнта.')}</h2><div class="tbl-wrap"><table><thead><tr><th>Канал</th><th>Сесії</th><th style="min-width:170px">Реєстрації</th><th>CR</th><th>Активація</th><th>Платні</th><th>Витрати</th><th>CPA реєстр.</th><th>CAC</th><th>Новий MRR</th></tr></thead><tbody>
    ${fun.map(f => `<tr><td><i style="width:10px;height:10px;border-radius:2px;background:${f.c.col};display:inline-block;margin-right:6px"></i><b>${esc(f.c.name)}</b></td><td>${vzN(f.ses)}</td><td><div class="dbar"><i style="width:${f.sig / maxSig * 100}%"></i></div>${vzN(f.sig)}</td><td>${vzP(f.sig / f.ses * 100, 1)}</td><td>${vzP(f.act / Math.max(1, f.sig) * 100, 0)}</td><td>${vzN(f.paid)}</td><td>${f.spend ? vzM(f.spend) : '—'}</td><td>${f.spend ? vzM(f.spend / Math.max(1, f.sig)) : '—'}</td><td>${f.spend ? `<span class="${f.spend / Math.max(1, f.paid) > 450 ? 'down' : ''}">${vzM(f.spend / Math.max(1, f.paid))}</span>` : '—'}</td><td>${vzM(f.mrr)}</td></tr>`).join('')}
    </tbody></table></div></div>`;

  const attr = fun.map(f => ({ c: f.c, lc: f.sig, dd: f.sig * VZ_ATTR[f.c.k] }));
  const k = attr.reduce((t, a) => t + a.lc, 0) / Math.max(1, attr.reduce((t, a) => t + a.dd, 0));
  attr.forEach(a => a.dd = Math.round(a.dd * k));
  const amax = Math.max(...attr.flatMap(a => [a.lc, a.dd]));
  const attrHTML = `<div class="panel"><h2>Атрибуція: last-click проти data-driven ${hint('Last-click віддає реєстрацію останньому каналу. Data-driven розподіляє її між усіма дотиками. Різниця показує недооцінені канали.')}</h2>
    <div class="legend" style="margin:0 0 10px"><span><i style="width:12px;height:12px;border-radius:3px;background:#A9B1C3;display:inline-block"></i>Last-click</span><span><i style="width:12px;height:12px;border-radius:3px;background:#3442A8;display:inline-block"></i>Data-driven</span></div>
    ${attr.map(a => { const d = (a.dd - a.lc) / Math.max(1, a.lc) * 100; return `<div class="arow"><span class="small">${esc(a.c.name)}</span><div class="abars"><i style="width:${a.lc / amax * 100}%;background:#A9B1C3" data-hint="${esc(a.c.name + ' · last-click: ' + vzN(a.lc))}"></i><i style="width:${a.dd / amax * 100}%;background:#3442A8" data-hint="${esc(a.c.name + ' · data-driven: ' + vzN(a.dd))}"></i></div><span class="small ${Math.abs(d) < 3 ? 'muted' : d > 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${vzP(Math.abs(d), 0)}</span></div>`; }).join('')}</div>`;

  const paidRows = VZ_CH.filter(c => c.spend).map(c => ({ c, cac: vzSum([c], from, to, 'spend') / Math.max(1, vzSum([c], from, to, 'paid')) }));
  const cmax = Math.max(600, ...paidRows.map(r => r.cac)) * 1.1;
  const cacHTML = `<div class="panel"><h2>CAC платних каналів проти цілі ${hint('Вертикальна риска — ціль $450 на нового платного клієнта.')}</h2>
    ${paidRows.map(r => `<div class="arow"><span class="small">${esc(r.c.name)}</span><div class="abars cac"><i style="width:${r.cac / cmax * 100}%;background:${r.c.col}" data-hint="${esc(r.c.name + ' · CAC ' + vzM(r.cac))}"></i><b class="target" style="left:${450 / cmax * 100}%"></b></div><span class="small ${r.cac > 450 ? 'down' : ''}">${vzM(r.cac)}</span></div>`).join('')}
    <p class="small muted" style="margin:10px 0 0">Ціль $450 · риска на шкалі. ${paidRows.filter(r => r.cac > 450).map(r => esc(r.c.name)).join(', ') || 'Усі канали'} ${paidRows.some(r => r.cac > 450) ? 'вище цілі.' : 'в межах цілі.'}</p></div>`;

  const wk = Array.from({ length: v.weeks }, (_, i) => from + i);
  const ser = (cs, key) => wk.map(i => vzSum(cs, i, i, key));
  const seo = VZ_CH.filter(c => c.grp === 'SEO'), ppc = VZ_CH.filter(c => c.grp === 'PPC'), em = VZ_CH.filter(c => c.grp === 'Email'), ai = VZ_CH.filter(c => c.grp === 'AI');
  const ctr = wk.map(i => i === VZ_LAST ? 3.9 : i === VZ_LAST - 1 ? 4.1 : 4.3 + 0.2 * vzRnd('ct', i));
  const pos = wk.map(i => i === VZ_LAST ? 6.8 : i === VZ_LAST - 1 ? 6.5 : 6.0 + 0.3 * vzRnd('po', i));
  const seoSig = vzSum(seo, from, to, 'signups') / v.weeks, ppcSp = vzSum(ppc, from, to, 'spend'), ppcSig = vzSum(ppc, from, to, 'signups'), ppcPaid = vzSum(ppc, from, to, 'paid');
  const sent = wk.map(i => i % 4 === 3 ? 58000 : 21000 + Math.round(1500 * vzRnd('se', i))), open = 41.2, click = 3.9, unsub = wk.map(i => i % 4 === 3 ? 0.34 : 0.19);
  const aiSes = ser(ai, 'sessions'), aiGrow = (aiSes[aiSes.length - 1] - aiSes[0]) / aiSes[0] * 100;
  const card = (title, tour, spark, rows) => `<div class="panel"${tour ? ` data-tour="${tour}"` : ''}><h2>${title}</h2>${spark}<div class="sc-rows">${rows.map(r => `<div class="row"><span class="grow">${r[0]}</span><b>${r[1]}</b><span class="small muted" style="min-width:86px;text-align:right">${r[2]}</span>${r[3]}</div>`).join('')}</div></div>`;
  const cards = `<div class="grid g2 sec-gap">
    ${card('SEO · оцінка каналу', 'vz-seo', vzSpark(ser(seo, 'signups'), x => vzN(x) + ' реєстр.'), [
      ['Реєстрації з органіки на тиждень', vzN(seoSig), 'ціль 450', vzStatus(seoSig >= 450 ? 'ok' : seoSig >= 400 ? 'warn' : 'bad', seoSig >= 450 ? 'у нормі' : 'нижче цілі')],
      ['CTR у пошуку, останній тиждень', vzP(ctr[ctr.length - 1], 1), 'ціль 4,3%', vzStatus(ctr[ctr.length - 1] >= 4.3 ? 'ok' : 'warn', 'увага')],
      ['Сер. позиція Google', String(Math.round(pos[pos.length - 1] * 10) / 10).replace('.', ','), 'ціль ≤ 6', vzStatus(pos[pos.length - 1] <= 6 ? 'ok' : 'warn', pos[pos.length - 1] <= 6 ? 'у нормі' : 'core update')],
      ['Частка реєстрацій сайту', vzP(vzSum(seo, from, to, 'signups') / allSig * 100, 0), '—', '']
    ])}
    ${card('PPC · оцінка каналу', 'vz-ppc', vzSpark(wk.map(i => vzSum(ppc, i, i, 'spend') / Math.max(1, vzSum(ppc, i, i, 'signups'))), x => vzM(x) + ' CPA'), [
      ['CPA на реєстрацію', vzM(ppcSp / Math.max(1, ppcSig)), 'ціль $35', vzStatus(ppcSp / ppcSig <= 35 ? 'ok' : ppcSp / ppcSig <= 40 ? 'warn' : 'bad', ppcSp / ppcSig <= 35 ? 'у нормі' : 'вище цілі')],
      ['CAC нового платного', vzM(ppcSp / Math.max(1, ppcPaid)), 'ціль $450', vzStatus(ppcSp / ppcPaid <= 450 ? 'ok' : 'warn', ppcSp / ppcPaid <= 450 ? 'у нормі' : 'увага')],
      ['ROAS (MRR × 12 / витрати)', String(Math.round(vzSum(ppc, from, to, 'mrr') * 12 / Math.max(1, ppcSp) * 10) / 10).replace('.', ','), 'ціль 2,5', vzStatus(vzSum(ppc, from, to, 'mrr') * 12 / ppcSp >= 2.5 ? 'ok' : 'warn', 'річний')],
      ['Витрати за період', vzM(ppcSp), `бюджет ${vzM(5000 * v.weeks)}`, vzStatus(ppcSp <= 5000 * v.weeks ? 'ok' : 'bad', ppcSp <= 5000 * v.weeks ? 'у межах' : 'перевищено')]
    ])}
    ${card('Email · оцінка каналу', 'vz-email', vzSpark(ser(em, 'signups'), x => vzN(x) + ' реєстр.'), [
      ['Надіслано за період', vzN(sent.reduce((t, x) => t + x, 0)), '3 розсилки + lifecycle', ''],
      ['Відкриття і кліки', `${vzP(open, 1)} / ${vzP(click, 1)}`, 'відкриття завищені Apple MPP', vzStatus('ok', 'у нормі')],
      ['Відписки в тижні розсилки', vzP(unsub.find(x => x > 0.3) || 0.19, 2), 'межа 0,3%', vzStatus((unsub.find(x => x > 0.3) || 0) > 0.3 ? 'warn' : 'ok', (unsub.find(x => x > 0.3) || 0) > 0.3 ? 'увага' : 'у нормі')],
      ['Реєстрації з email', vzN(vzSum(em, from, to, 'signups')), 'найвища активація', vzStatus('ok', vzP(vzSum(em, from, to, 'act') / Math.max(1, vzSum(em, from, to, 'signups')) * 100, 0))]
    ])}
    ${card('AI Visibility · оцінка каналу', 'vz-ai', vzSpark(aiSes, x => vzN(x) + ' сесій'), [
      ['AI-реферали, зростання за період', (aiGrow >= 0 ? '+' : '') + vzP(aiGrow, 0), 'ChatGPT, Perplexity, Copilot', vzStatus('ok', 'росте')],
      ['Конверсія в реєстрацію', vzP(vzSum(ai, from, to, 'signups') / vzSum(ai, from, to, 'sessions') * 100, 1), 'найвища серед каналів', vzStatus('ok', 'у нормі')],
      ['Цитування нашого сайту', '18%', 'ціль 25%', vzStatus('warn', 'нижче цілі')],
      ['Частка реєстрацій', vzP(vzSum(ai, from, to, 'signups') / allSig * 100, 1), 'мала, але найдешевша', '']
    ])}
  </div>`;
  const ins = `<div class="panel sec-gap"><h2>Що бачить Marketing Performance Analyst ${hint('Висновки зібрані з тих самих даних; кожен веде до задачі, яку вже веде оркестр.')}</h2>
    <div class="row"><span class="grow"><b>Органіка Google −${vzOgDrop()}% у W41</b> проти середнього W36–W39. Позиція 6,0 → 6,8, CTR 4,3% → 3,9%. Збігається з core update і аномалією /pricing-analytics.</span><button class="btn small" data-action="vz-anom">Аномалії</button></div>
    <div class="row"><span class="grow"><b>Google Ads: CPA зріс у W40–W41.</b> Витрати +16%, конверсія −18%: перевитрата Brand UA.</span><button class="btn small" data-action="nav-to" data-screen="ppc">PPC</button></div>
    <div class="row"><span class="grow"><b>AI-реферали ростуть найшвидше і конвертують найкраще.</b> Підсилюють REC-1 і груповий пакет GP-2.</span><button class="btn small" data-action="nav-to" data-screen="aiv">AI Visibility</button></div>
    <div class="row"><span class="grow"><b>Meta Ads дає найдорожчого клієнта.</b> CAC вище цілі; data-driven показує, що канал допомагає на ранніх дотиках — не вимикати, а переглянути ставки.</span><button class="btn small" data-action="nav-to" data-screen="ppc">PPC</button></div></div>`;
  return `${intro(`<b>Трафік і конверсії.</b> Звідки приходять люди, скільки реєструються, активуються і платять, скільки це коштує — по SEO, PPC, Email, AI-рефералах і решті. Ці ж дані бачать агенти: детектор аномалій, Budget Optimizer і Marketing Performance Analyst. Усі числа вигадані для демо.`)}${filt}${tiles}${chart}${funnel}<div class="grid g2 sec-gap">${attrHTML}${cacHTML}</div>${cards}${ins}`;
}
function anTabs() {
  const t = S.anTab || 'traffic';
  return `<div class="seg big" role="tablist" aria-label="Розділ аналітики">${[['traffic', 'Трафік і конверсії'], ['anom', 'Аномалії і діагностика']].map(([k, l]) => `<button role="tab" aria-selected="${k === t}" data-action="an-tab" data-id="${k}">${l}</button>`).join('')}</div>`;
}

/* ---------- alternative pipeline views ---------- */
const SCORE_VIEWS = [
  ['score', 'Партитура', 'рядок на задачу, ворота — латунні риски'],
  ['metro', 'Метро', 'лінія на задачу, ворота — пересадки, повернення — дуги'],
  ['gantt', 'Час на етапах', 'де задача провела час: машини проти людей'],
  ['heat', 'Теплова карта', 'задачі × етапи, колір — години на етапі'],
  ['cards', 'Картки', 'де задача і хто діє зараз'],
  ['flow', 'Етапи', 'колонки: де скупчились задачі']
];
const SV_BASE = [0.3, 5, 1.2, 0.7, 0.4, 0, 0, 0.2];
const SV_TYPE = ['orch', 'agent', 'orch', 'orch', 'orch', 'human', 'test', 'gw'];
const SV_COL = { agent: '#eb6834', orch: '#2a78d6', human: '#1baf7a', test: '#eda100', gw: '#e87ba4' };
const SV_TL = { orch: 'Оркестратори і ворота', agent: 'Агенти', human: 'Людина', test: 'Тест-гейт', gw: 'Gateway' };
function svJit(id, i) { let h = 7; for (const ch of String(id) + i) h = (h * 31 + ch.charCodeAt(0)) % 9973; return 0.6 + (h % 80) / 100; }
function stageHours(p) {
  return p.st.map((x, i) => {
    if (x === 'wait' || x === 'skip') return 0;
    if (i === 5) { const a = S.approvals.find(a => a.pl === p.id && a.status === 'pending'); return x === 'active' ? Math.max(1, a?.age || 2) : Math.round(6 * svJit(p.id, i) * 10) / 10; }
    if (i === 6) return x === 'active' ? 120 : 504;
    let h = SV_BASE[i] * svJit(p.id, i);
    if (x === 'return') h += 3;
    if (x === 'active') h *= 0.5;
    return Math.round(h * 10) / 10;
  });
}
const fmtH = h => h <= 0 ? '—' : h < 1 ? Math.max(1, Math.round(h * 60)) + ' хв' : h < 48 ? String(Math.round(h * 10) / 10).replace('.', ',') + ' год' : Math.round(h / 24) + ' дн';
const svShort = (t, n = 34) => t.length > n ? t.slice(0, n - 1) + '…' : t;

function scoreMetro(list) {
  const L = 250, R = 30, W = 1000, RH = 72, top = 54, H = top + list.length * RH + 10, gap = (W - L - R) / 7, X = i => L + i * gap;
  let head = '';
  ST.forEach((n, i) => { const parts = n.split(' '); const a = parts.slice(0, Math.ceil(parts.length / 2)).join(' '), b = parts.slice(Math.ceil(parts.length / 2)).join(' ');
    head += `<text x="${X(i)}" y="18" text-anchor="middle" font-size="11.5" font-weight="${GATES.includes(i) ? 600 : 400}" fill="${GATES.includes(i) ? '#7A5A0C' : '#55607A'}">${esc(a)}</text>${b ? `<text x="${X(i)}" y="32" text-anchor="middle" font-size="11.5" font-weight="${GATES.includes(i) ? 600 : 400}" fill="${GATES.includes(i) ? '#7A5A0C' : '#55607A'}">${esc(b)}</text>` : ''}`; });
  let rows = '';
  list.forEach((p, r) => {
    const y = top + r * RH + 34, cur = curStage(p), stt = pipeState(p), hrs = stageHours(p);
    const lineCol = stt === 'veto' ? '#B9382A' : stt === 'return' ? '#B86E00' : '#1E8A6E';
    const reach = stt === 'done' ? 7 : cur;
    rows += `<text x="12" y="${y - 4}" font-size="13" font-weight="600" fill="#182033">${esc(svShort(p.title, 29))}</text><text x="12" y="${y + 13}" font-size="11.5" fill="#8A93A8">${esc(p.id + ' · ' + p.ch + ' · ' + p.risk)}</text>`;
    rows += `<line x1="${X(0)}" x2="${X(7)}" y1="${y}" y2="${y}" stroke="#D9DEE8" stroke-width="3" stroke-linecap="round"/>`;
    if (reach > 0) rows += `<line x1="${X(0)}" x2="${X(reach)}" y1="${y}" y2="${y}" stroke="${lineCol}" stroke-width="7" stroke-linecap="round"/>`;
    p.st.forEach((s, i) => { if (s !== 'return') return; const x1 = X(i), x0 = X(1); rows += `<path d="M${x1} ${y - 9} C ${x1} ${y - 34}, ${x0} ${y - 34}, ${x0} ${y - 11}" fill="none" stroke="#B86E00" stroke-width="2" marker-end="url(#mt-a)"/>`; });
    p.st.forEach((s, i) => {
      const x = X(i), g = GATES.includes(i), done = s === 'done', isCur = i === cur && stt !== 'done';
      const fill = done ? lineCol : s === 'skip' ? '#EDF0F5' : '#FFFFFF';
      const stroke = s === 'veto' ? '#B9382A' : s === 'return' ? '#B86E00' : s === 'active' ? '#3442A8' : done ? lineCol : '#C3CAD8';
      const tip = `${p.id} · ${ST[i]}: ${ST_STATE[s]}${hrs[i] ? ' · ' + fmtH(hrs[i]) : ''}`;
      if (isCur) rows += `<circle cx="${x}" cy="${y}" r="15" fill="${s === 'active' ? '#E2E5F7' : s === 'veto' ? '#F8DEDA' : '#FBEBD2'}"/>`;
      rows += g ? `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="4" fill="${fill}" stroke="${s === 'wait' ? '#B8891A' : stroke}" stroke-width="2.5" ${s === 'skip' ? 'stroke-dasharray="3 2"' : ''}/>`
        : `<circle cx="${x}" cy="${y}" r="${isCur ? 8 : 6}" fill="${s === 'active' ? '#3442A8' : fill}" stroke="${stroke}" stroke-width="2.5" ${s === 'skip' ? 'stroke-dasharray="3 2"' : ''}/>`;
      rows += `<circle cx="${x}" cy="${y}" r="16" fill="transparent" data-hint="${esc(tip)}"/>`;
      if (isCur) rows += `<text x="${x}" y="${y + 30}" text-anchor="middle" font-size="11.5" font-weight="600" fill="#3442A8">${esc('зараз' + (hrs[i] ? ' · ' + fmtH(hrs[i]) : ''))}</text>`;
    });
    if (stt === 'done') rows += `<text x="${X(7)}" y="${y + 30}" text-anchor="middle" font-size="11.5" font-weight="600" fill="#1E8A6E">виконано</text>`;
  });
  return `<div class="dag"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Метро-схема конвеєрів" style="min-width:860px"><defs><marker id="mt-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#B86E00"/></marker></defs>${head}${rows}</svg></div>
    <div class="legend"><span><i class="note done"></i>пройдено</span><span><i class="note active"></i>зараз</span><span><i style="width:12px;height:12px;border:2.5px solid #B8891A;border-radius:3px;display:inline-block"></i>ворота-пересадка</span><span style="color:#B86E00">дуга — повернення на доопрацювання</span><span><i class="note veto"></i>вето або відкат</span></div>`;
}
function scoreGantt(list) {
  const L = 250, R = 210, W = 1000, RH = 40, top = 34, H = top + list.length * RH + 12;
  const data = list.map(p => ({ p, h: stageHours(p) })), maxT = Math.max(24, ...data.map(d => d.h.reduce((t, x) => t + x, 0)));
  const unit = maxT > 96 ? 24 : 1, step = unit === 24 ? Math.ceil(maxT / 24 / 6) * 24 : Math.ceil(maxT / 6 / 6) * 6;
  const sx = h => L + h / maxT * (W - L - R);
  let g = '';
  for (let t = 0; t <= maxT + 0.01; t += step) g += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${top - 6}" y2="${H - 8}" stroke="#E3E7EF"/><text x="${sx(t)}" y="${top - 12}" text-anchor="middle" font-size="11.5" fill="#8A93A8">${unit === 24 ? t / 24 + ' дн' : t + ' год'}</text>`;
  let bars = '', machine = 0, human = 0;
  data.forEach(({ p, h }, r) => {
    const y = top + r * RH + 8; let acc = 0; const tot = h.reduce((t, x) => t + x, 0);
    bars += `<text x="12" y="${y + 9}" font-size="12.5" font-weight="600" fill="#182033">${esc(svShort(p.title, 32))}</text><text x="12" y="${y + 23}" font-size="11" fill="#8A93A8">${esc(p.id)}</text>`;
    h.forEach((x, i) => {
      if (!x) return; const typ = SV_TYPE[i], x0 = sx(acc), w = Math.max(3, sx(acc + x) - x0 - 2); acc += x;
      if (typ === 'human') human += x; else if (typ !== 'test') machine += x;
      bars += `<rect x="${x0}" y="${y}" width="${w}" height="20" rx="3" fill="${SV_COL[typ]}" ${p.st[i] === 'active' ? 'opacity=".55"' : ''}/><rect x="${x0}" y="${y - 6}" width="${Math.max(10, w + 2)}" height="32" fill="transparent" data-hint="${esc(`${p.id} · ${ST[i]} (${SV_TL[typ]}): ${fmtH(x)}${p.st[i] === 'active' ? ', триває' : ''}`)}"/>`;
    });
    const hs = h[5] / Math.max(0.1, tot) * 100;
    bars += `<text x="${sx(acc) + 8}" y="${y + 15}" font-size="12" fill="#182033"><tspan font-weight="600">${fmtH(tot)}</tspan><tspan fill="#55607A">${hs >= 50 ? ' · ' + Math.round(hs) + '% — очікування людини' : ''}</tspan></text>`;
  });
  const legend = `<div class="legend" style="margin:0 0 8px">${Object.entries(SV_TL).map(([k, l]) => `<span><i style="width:12px;height:12px;border-radius:3px;background:${SV_COL[k]};display:inline-block"></i>${l}</span>`).join('')}<span class="small muted">бліді сегменти — етап ще триває</span></div>`;
  return `<p class="small" style="margin:0 0 8px"><b>Машинні етапи: ${fmtH(machine)} сумарно · очікування людини: ${fmtH(human)} (${Math.round(human / Math.max(0.1, human + machine) * 100)}%).</b> <span class="muted">Найповільніша ланка — рішення людей, а не агенти. Тест-гейт показано окремо: 3 тижні — це вимірювання, а не очікування.</span></p>${legend}
    <div class="dag"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Час на етапах" style="min-width:860px">${g}${bars}</svg></div>`;
}
function scoreHeat(list) {
  const bins = [0.5, 2, 8, 24, 72, Infinity], lab = ['< 30 хв', '30 хв–2 год', '2–8 год', '8–24 год', '1–3 дн', '> 3 дн'];
  const cell = (p, i, h) => {
    const s = p.st[i], tip = esc(`${p.id} · ${ST[i]}: ${ST_STATE[s]}${h ? ' · ' + fmtH(h) : ''}`);
    if (s === 'wait') return `<td class="hc wait" data-hint="${tip}">·</td>`;
    if (s === 'skip') return `<td class="hc skip" data-hint="${tip}">—</td>`;
    const b = bins.findIndex(x => h < x), bg = SEQ[b], dark = b >= 3;
    const mark = s === 'return' ? '↺ ' : s === 'veto' ? '✕ ' : s === 'active' ? '● ' : '';
    return `<td class="hc ${s}" style="background:${bg};color:${dark ? '#fff' : '#182033'}" data-hint="${tip}">${mark}${fmtH(h)}</td>`;
  };
  return `<div class="tbl-wrap"><table class="heatmap"><thead><tr><th>Задача</th>${ST.map((n, i) => `<th class="${GATES.includes(i) ? 'gate' : ''}">${n}</th>`).join('')}<th>Разом</th></tr></thead><tbody>
    ${list.map(p => { const h = stageHours(p); return `<tr><td><button class="lnk" data-action="open-pl" data-id="${p.id}">${esc(svShort(p.title, 40))}</button><div class="small muted">${p.id} · ${p.risk}</div></td>${h.map((x, i) => cell(p, i, x)).join('')}<td><b>${fmtH(h.reduce((t, x) => t + x, 0))}</b></td></tr>`; }).join('')}
  </tbody></table></div>
  <div class="legend"><span class="small muted">Години на етапі:</span>${SEQ.map((c, i) => `<span><i style="width:16px;height:12px;border-radius:2px;background:${c};display:inline-block"></i>${lab[i]}</span>`).join('')}<span>● триває</span><span style="color:#B86E00">↺ повернуто</span><span style="color:#B9382A">✕ вето</span><span>· ще не дійшло</span><span>— не потрібно</span></div>`;
}
