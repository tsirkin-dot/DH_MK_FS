/* Orca9 insight layer: diagrams and charts added to existing screens, glossary and principles.
   Prototype only. Loaded before the main script; insightInit() runs after worldInit(). */

const IN = {};
const inTab = (k, d) => (S.inTab && S.inTab[k]) || d;
function inSeg(k, opts, d, label) {
  const v = inTab(k, d);
  return `<div class="seg" role="tablist"${label ? ` aria-label="${label}"` : ''}>${label ? `<span class="seg-l">${label}:</span>` : ''}${opts.map(([id, l]) => `<button role="tab" aria-selected="${id === v}" data-action="in-tab" data-id="${k}:${id}">${l}</button>`).join('')}</div>`;
}
const inSvg = (W, H, label, body, min) => `<div class="ins-scroll"><svg class="ins-svg hlz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"${min ? ` style="min-width:${min}px"` : ''}>${body}</svg></div>`;
/* Ширина графіка під реальну ширину панелі: на широкому екрані графік стає ширшим, а не більшим */
function inViewW() { const v = typeof document !== 'undefined' && document.getElementById('view'); return v && v.clientWidth ? Math.min(v.clientWidth, 1480) : 0; }
function inFit(def, frac = 1) { const vw = inViewW(); if (!vw) return def; const t = Math.round((vw - 64) * frac - 44); return Math.max(def, Math.min(t, Math.round(def * 1.8))); }
function inOpen(id) {
  if (!id) return;
  if (/^REC-/.test(id)) { closeModal(); openRec(id); return; }
  if (/^GP-/.test(id)) { closeModal(); go('groups'); setTimeout(() => { const el = $('#gp-' + id); el && el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); return; }
  if (/^CMP-/.test(id)) { closeModal(); go('cmps'); return; }
  if (/^HF-/.test(id)) { closeModal(); go('hotfix'); return; }
  if (/^AP-/.test(id)) { closeModal(); go('approvals'); return; }
  if (/^MKT-/.test(id)) { const p = S.pipelines.find(x => x.id === id); if (p) openPipeline(p); return; }
  if (/^E\d+/.test(id) && typeof wdEventModal === 'function') { wdEventModal(id); return; }
  if (typeof frFind === 'function' && frFind(id)) { frDetail(id); return; }
}
function inSel(k, v) { S.inTab[k] = S.inTab[k] === v ? '' : v; render(); }
const inT = (x, y, t, cls = '', anchor = 'start', extra = '') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="ins-t ${cls}"${extra}>${t}</text>`;
const inArrowDefs = id => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink-2)"/></marker></defs>`;
const inHash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

/* ---------- усі пакети в одному списку ---------- */
const IN_BUCKET = [
  ['new', 'Нові', ['new', 'plan'], 'var(--ink-3)'],
  ['review', 'Погодження і перевірки', ['review', 'verify', 'work', 'return', 'ready', 'auto'], 'var(--act)'],
  ['human', 'Чекає людину', ['human', 'won'], 'var(--hold)'],
  ['queue', 'У черзі ресурсу', ['queued', 'wait'], '#7B3FA0'],
  ['test', 'Тест і розгортання', ['test', 'rollout', 'launch'], '#2F7FC1'],
  ['done', 'Розгорнуто', ['deployed', 'done'], 'var(--pass)'],
  ['stop', 'Без змін або відкат', ['inconclusive', 'rolledback', 'rejected', 'expired'], 'var(--veto)']
];
function inPackets() {
  const out = [];
  (S.pipelines || []).forEach(p => { const st = p.st.includes('veto') ? 'rejected' : p.st[7] === 'done' ? 'done' : p.st[5] === 'active' ? 'human' : p.st[6] === 'active' || p.st[7] === 'active' ? 'test' : p.st.includes('return') ? 'return' : 'review';
    out.push({ id: p.id, kind: 'Конвеєр', st, res: p.page || p.ch, why: p.note, scr: 'hud' }); });
  (S.recs || []).forEach(r => out.push({ id: r.id, kind: 'Рекомендація', st: r.status, res: r.page, why: r.reason, scr: 'recs' }));
  (S.gps || []).forEach(g => out.push({ id: g.id, kind: 'Група', st: g.status, res: g.group, why: g.reason, scr: 'groups' }));
  (S.cmps || []).forEach(c => c.packets.forEach(k => out.push({ id: k.id, kind: 'Кампанія', st: k.status, res: k.res, why: k.note, scr: 'cmps' })));
  return out;
}
const inBucketOf = st => (IN_BUCKET.find(b => b[2].includes(st)) || IN_BUCKET[0]);

/* ---------- HUD: потік пакетів, застряглі, принципи ---------- */
function inFunnel() {
  const P = inPackets(), n = P.length || 1;
  const cnt = IN_BUCKET.map(b => [b, P.filter(p => b[2].includes(p.st)).length]);
  let x = 0;
  const bar = cnt.filter(c => c[1]).map(([b, c]) => { const w = c / n * 100; const s = `<span class="in-seg" style="left:${x}%;width:${w}%;background:${b[3]}" data-hint="${b[1]}: ${c}" data-action="in-sel" data-id="fb:${b[0]}"></span>`; x += w; return s; }).join('');
  const sel = inTab('fb', '');
  const list = sel ? P.filter(p => (IN_BUCKET.find(b => b[0] === sel) || [0, 0, []])[2].includes(p.st)) : [];
  return `<div class="in-stack">${bar}</div><div class="in-bk">${cnt.map(([b, c]) => `<button class="in-bkb${sel === b[0] ? ' on' : ''}" data-action="in-sel" data-id="fb:${b[0]}" ${c ? '' : 'disabled'}><i style="background:${b[3]}"></i><b>${c}</b><span>${b[1]}</span></button>`).join('')}</div>
    ${sel ? `<div class="in-pick">${list.map(p => `<button class="chip act" data-action="in-open" data-id="${p.id}" data-hint="${esc(p.kind)} · ${esc(p.res || '')}${p.why ? '\n' + esc(p.why) : ''}">${p.id}</button>`).join(' ')}</div>` : '<p class="small muted" style="margin:8px 0 0">Натисніть на стан, щоб побачити пакети в ньому.</p>'}`;
}
function inFunnelNote() {
  const P = inPackets(), c = IN_BUCKET.slice(1, 5).map(b => [b, P.filter(p => b[2].includes(p.st)).length]).sort((a, b) => b[1] - a[1])[0];
  const hum = P.filter(p => ['human', 'won'].includes(p.st)).length;
  return `<p class="small muted" style="margin:12px 0 0">${c[1] ? `Найбільше накопичення: <b>${c[0][1].toLowerCase()}</b> (${c[1]}). ` : ''}${hum ? `Людям зараз потрібно ухвалити ${hum} рішень — дивіться «Застрягло».` : 'Людських рішень зараз не чекаємо.'} Запустіть «Погодити нові пакети» в Рекомендаціях і подивіться, як смуга зміниться.</p>`;
}
function inStuck() {
  const L = [];
  pending().forEach(a => { const age = a.age || 0, s = sla(a); L.push({ sev: age / s, t: `${a.id}: ${a.title}`, d: `чекає ${age} год при SLA ${s} год · ${approverOf(a)}`, scr: 'approvals', bad: age > s }); });
  inPackets().filter(p => p.st === 'queued').forEach(p => L.push({ sev: 0.9, t: `${p.id} у черзі`, d: `${p.res}: ${p.why || 'ресурс утримує інший пакет'}`, scr: p.scr }));
  inPackets().filter(p => p.st === 'inconclusive').forEach(p => L.push({ sev: 0.7, t: `${p.id}: немає висновку`, d: p.why || 'тест не показав ні виграшу, ні шкоди', scr: p.scr }));
  inPackets().filter(p => p.st === 'return').forEach(p => L.push({ sev: 0.6, t: `${p.id} повернуто`, d: p.why || 'O2 повернув автору', scr: p.scr }));
  if (S.frTrial === 'conflict') L.push({ sev: 1.2, t: 'Реєстр фактів: розбіжність trial.days', d: 'нові тексти з цим фактом блокуються', scr: 'facts', bad: true });
  if (S.aq?.drift === 'alert' && (typeof dirOn !== 'function' || dirOn('Контроль якості'))) L.push({ sev: 1.1, t: 'Citation Analyst нижче порогу якості', d: 'людина перевіряє 100% висновків', scr: 'agentqa', bad: true });
  L.sort((a, b) => b.sev - a.sev);
  return L.length ? L.slice(0, 5).map(x => `<div class="row"><span class="dot-s ${x.bad ? 'bad' : 'warn'}"></span><span class="grow"><b>${esc(x.t)}</b><br><span class="small muted">${esc(x.d)}</span></span><button class="btn small" data-action="nav-to" data-screen="${x.scr}">Відкрити</button></div>`).join('') : '<p class="empty">Нічого не застрягло.</p>';
}
const IN_PRINCIPLES = [
  ['Агенти пропонують, а не пишуть', 'Запис робить лише Gateway після всіх воріт.'],
  ['Одна сторінка — одна версія', 'Координатор тримає один активний пакет на ресурс, інші чекають у черзі.'],
  ['Канали погоджують одну й ту саму версію', 'Будь-яка правка скидає погодження: відбиток пакета змінюється.'],
  ['Будь-яка зміна сторінки — через тест', 'A/B, SEO-тест і AI Visibility тест. Шкода — відкат, немає даних — немає висновку.'],
  ['Цифри лише з реєстру фактів', 'Агент не може вигадати ціну чи дату; O2 повертає цифру без джерела.'],
  ['Людина там, де ризик', 'Гроші, ключові сторінки, конфлікт і незворотні дії. Решта — авто з журналом.'],
  ['Світ враховано', 'Апдейти пошуку, нові моделі й свята змінюють вікна тестів за правилами.'],
  ['Агент не оцінює сам себе', 'Кожну зміну агента перевіряє контролер на еталонних кейсах.']
];
function inPrinciples() {
  return `<div class="panel sec-gap" data-tour="principles"><h2>Принципи Orca9 ${hint('Вісім правил, на яких тримається вся система. Кожне має своє місце в інтерфейсі.')}<span class="sp"><button class="btn small" data-action="in-gloss">Глосарій</button></span></h2>
    <ol class="in-pr">${IN_PRINCIPLES.map(p => `<li><b>${p[0]}</b><span>${p[1]}</span></li>`).join('')}</ol></div>`;
}
function inHud(html) {
  const add = `<div class="grid g2 sec-gap">
      <div class="panel" data-tour="hud-flow"><h2>Потік пакетів ${hint('Усі пакети змін: конвеєри, рекомендації, групи сторінок і пакети кампаній. Показує, де зараз накопичується робота.')}<span class="sp small muted">${inPackets().length} пакетів</span></h2>${inFunnel()}${inFunnelNote()}</div>
      <div class="panel"><h2>Застрягло ${hint('П’ять речей, які найдовше чекають або блокують інших: прострочені апруви, черги ресурсів, тести без висновку, розбіжності фактів, дрейф агентів.')}</h2>${inStuck()}</div>
    </div>`;
  const anchor = '<div class="panel sec-gap" data-tour="score">';
  return (html.includes(anchor) ? html.replace(anchor, add + anchor) : html + add) + inPrinciples();
}

/* ---------- Апруви: терміни, причини, пакетне погодження ---------- */
function inWhyHuman(a) {
  if (a.risk === 'R3') return `гроші (R3): $${a.amount} у ліміті ролі`;
  if (a.cmp) return 'новий ресурс кампанії: публікація або незворотна дія';
  if (a.land) return a.phase === 'rollout' ? 'розгортання зміни сторінки з високим впливом' : 'тест зміни сторінки з високим впливом';
  if (a.ch === 'SMM') return 'публічний пост від імені бренду (R2)';
  return 'публічна зміна (R2)';
}
function inApprovals(html) {
  const p = pending();
  const batch = p.filter(a => canApprove(a) && a.risk === 'R2' && !a.land && !a.cmp);
  const buckets = [['< 8 год', 0, 8], ['8–24 год', 8, 24], ['24–48 год', 24, 48], ['> 48 год', 48, 1e9]].map(b => [b[0], p.filter(a => (a.age || 0) >= b[1] && (a.age || 0) < b[2]).length]);
  const mx = Math.max(1, ...buckets.map(b => b[1]));
  const add = `<div class="grid g2" style="margin-bottom:16px">
    <div class="panel"><h2>Терміни рішень ${hint('Смужка — скільки часу запит уже чекає відносно SLA. R3 (гроші) — 8 год, R2 — 24 год. Після SLA менеджер проєкту нагадує, далі ескалація.')}</h2>
      ${p.length ? p.map(a => { const age = a.age || 0, s = sla(a), pc = Math.min(100, age / s * 100); return `<div class="row"><span class="grow"><b>${a.id}</b> ${esc(a.title)}<br><span class="small muted">Чому людина: ${esc(inWhyHuman(a))} · затверджує ${approverOf(a)}</span>
        <div class="bar" style="margin-top:4px"><i style="width:${pc}%;background:${age > s ? 'var(--veto)' : age > s * 0.7 ? 'var(--hold)' : 'var(--pass)'}"></i></div></span><span class="small ${age > s ? 'down' : 'muted'}" style="min-width:86px;text-align:right">${age} / ${s} год${age > s ? '<br>прострочено' : ''}</span></div>`; }).join('') : '<p class="empty">Черга порожня.</p>'}</div>
    <div class="panel"><h2>Вік черги ${hint('Скільки запитів у якому віці. Хвіст праворуч — сигнал, що люди стали «пляшковим горлом».')}</h2>
      <div class="in-hist">${buckets.map(b => `<div><span class="v">${b[1]}</span><i style="height:${b[1] / mx * 90 + 4}px;background:${b[0].startsWith('>') ? 'var(--veto)' : 'var(--act)'}"></i><span>${b[0]}</span></div>`).join('')}</div>
      <p class="small muted" style="margin:10px 0">Пакетне погодження — лише для R2 без впливу на сторінки, у межах вашої ролі. Гроші, сторінки й кампанії завжди по одному.</p>
      <button class="btn small" data-action="in-batch" aria-disabled="${!batch.length}">Погодити пакетом: ${batch.length}</button></div>
  </div>`;
  return add + html;
}

/* ---------- Рекомендації: пріоритети, завантаження, тест-гейт, стани ---------- */
const POD_COL = { SEO: '#3442A8', PPC: '#B86E00', 'AI Visibility': '#7B3FA0' };
function inScatter() {
  const items = [...S.recs.map(r => ({ id: r.id, pod: r.pod, conf: r.conf ?? 75, imp: r.imp, st: r.status, t: r.title })), ...(S.gps || []).map(g => ({ id: g.id, pod: g.pod, conf: g.conf ?? 75, imp: g.imp, st: g.status, t: g.title }))];
  const W = inFit(640), H = 300, L = 46, R = 16, T = 16, B = 40;
  const x = c => L + (c - 50) / 50 * (W - L - R);
  const y = (imp, id) => { const base = imp === 'high' ? 0.25 : 0.75; const j = ((inHash(id) % 100) / 100 - 0.5) * 0.3; return T + (base + j) * (H - T - B); };
  const midX = x(75), midY = T + 0.5 * (H - T - B);
  let s = `<rect x="${L}" y="${T}" width="${midX - L}" height="${midY - T}" style="fill:var(--hold-soft);opacity:.6"/><rect x="${midX}" y="${T}" width="${W - R - midX}" height="${midY - T}" style="fill:var(--pass-soft);opacity:.7"/>
    <rect x="${L}" y="${midY}" width="${midX - L}" height="${H - B - midY}" style="fill:var(--mist)"/><rect x="${midX}" y="${midY}" width="${W - R - midX}" height="${H - B - midY}" style="fill:var(--act-soft);opacity:.6"/>`;
  s += inT(L + 8, T + 16, 'Високий вплив, мало доказів → більше даних, людина', 'b') + inT(W - R - 8, T + 16, 'Високий вплив, впевнено → людина, першими', 'b', 'end');
  s += inT(L + 8, H - B - 8, 'Низький вплив, мало доказів → відкласти', 'b') + inT(W - R - 8, H - B - 8, 'Низький вплив, впевнено → авто-смуга', 'b', 'end');
  [50, 60, 70, 80, 90, 100].forEach(c => { s += `<line x1="${x(c)}" x2="${x(c)}" y1="${H - B}" y2="${H - B + 4}" style="stroke:var(--ink-3)"/>` + inT(x(c), H - B + 16, c + '%', '', 'middle'); });
  s += inT((W + L) / 2, H - 4, 'Впевненість автора (O2 перевіряє докази)', '', 'middle');
  s += inT(14, (T + H - B) / 2, 'Вплив', '', 'middle', ` transform="rotate(-90 14 ${(T + H - B) / 2})"`);
  items.forEach(it => { const cx = x(it.conf), cy = y(it.imp, it.id), done = ['deployed', 'rolledback', 'rejected'].includes(it.st);
    s += `<g class="hl" data-action="in-open" data-id="${it.id}" data-hint="${it.id} · ${esc(it.t)}\n${it.pod} · впевненість ${it.conf}% · вплив ${it.imp === 'high' ? 'високий' : 'низький'}\nстатус: ${esc((REC_ST[it.st] || GP_ST[it.st] || [it.st])[0])}\nнатисніть, щоб відкрити"><circle cx="${cx}" cy="${cy}" r="${it.id.startsWith('GP') ? 11 : 8}" style="fill:${POD_COL[it.pod] || 'var(--ink-2)'};opacity:${done ? .35 : .9};stroke:#fff;stroke-width:2"/>${inT(cx + 13, cy + 4, it.id, 'b')}</g>`; });
  return inSvg(W, H, 'Рекомендації: впевненість проти впливу', s, 560) + `<div class="legend">${Object.entries(POD_COL).map(([k, c]) => `<span><i class="lg" style="background:${c};border-radius:50%"></i>${k}</span>`).join('')}<span>великі кола — групи сторінок, бліді — завершені · натисніть на коло, щоб відкрити пакет</span></div>`;
}
function inLoad() {
  const weeks = [41, 42, 43, 44, 45, 46, 47, 48];
  const rows = new Map();
  const add = (res, it) => { if (!rows.has(res)) rows.set(res, []); rows.get(res).push(it); };
  S.recs.forEach(r => add(r.page, { id: r.id, st: r.status, week: r.week || 0, ext: r.extWeeks || 0 }));
  (S.gps || []).forEach(g => add('група ' + g.group, { id: g.id, st: g.status, week: g.week || 0, ext: g.extWeeks || 0 }));
  (S.cmps || []).forEach(c => { if (c.updatePage) add(c.updatePage, { id: c.id + '/U', st: (c.packets.find(k => k.kind === 'update') || {}).status || 'plan', week: 0, ext: 0 }); });
  const order = { test: 0, won: 0, inconclusive: 0, rollout: 0, human: 1, ready: 1, auto: 1, review: 2, new: 3, plan: 3, queued: 4, wait: 4 };
  const lanes = [...rows.entries()].map(([res, list]) => {
    list.sort((a, b) => (order[a.st] ?? 5) - (order[b.st] ?? 5) || a.id.localeCompare(b.id));
    let cur = 42; const bars = [];
    list.forEach(it => {
      if (['deployed', 'rolledback', 'rejected', 'expired', 'done'].includes(it.st)) { bars.push({ ...it, w0: 42, w1: 42, fin: true }); return; }
      const live = ['test', 'won', 'inconclusive', 'rollout'].includes(it.st);
      const w0 = live ? 42 - it.week : Math.max(cur, 43), len = 3 + it.ext;
      bars.push({ ...it, w0, w1: w0 + len - 1, live }); cur = w0 + len;
    });
    return [res, bars];
  });
  const L = 170, W = inFit(860), cw = (W - L - 10) / weeks.length, rh = 30, T = 24, H = T + lanes.length * rh + 30;
  const x = w => L + (w - weeks[0]) * cw;
  let s = weeks.map(w => inT(x(w) + cw / 2, 15, 'W' + w, w === 42 ? 'b' : '', 'middle') + `<line x1="${x(w)}" x2="${x(w)}" y1="20" y2="${H - 24}" style="stroke:var(--line)"/>`).join('');
  s += `<rect x="${x(42)}" y="20" width="${cw}" height="${H - 44}" style="fill:var(--act);opacity:.06"/>`;
  lanes.forEach(([res, bars], i) => {
    const y = T + i * rh, busy = bars.filter(b => !b.fin).length;
    s += inT(L - 8, y + 18, esc(res.length > 24 ? res.slice(0, 23) + '…' : res), busy > 1 ? 'b' : '', 'end') + `<line x1="${L}" x2="${W - 10}" y1="${y + rh}" y2="${y + rh}" style="stroke:var(--line);opacity:.5"/>`;
    bars.forEach(b => {
      if (b.fin) { s += `<g data-hint="${b.id}: ${esc((REC_ST[b.st] || GP_ST[b.st] || [b.st])[0])}"><path d="M${x(42) + 8} ${y + 8} l6 6 l-6 6 l-6 -6 z" style="fill:${b.st === 'deployed' || b.st === 'done' ? 'var(--pass)' : 'var(--veto)'}"/></g>`; return; }
      const col = b.live ? 'var(--act)' : b.st === 'queued' || b.st === 'wait' ? '#7B3FA0' : 'var(--ink-3)';
      s += `<g class="hl" data-action="in-open" data-id="${b.id.replace(/\/U$/, '')}" data-hint="${b.id} · W${b.w0}–W${b.w1}${b.ext ? ` (+${b.ext} тиж. через зовнішню подію)` : ''}\n${b.live ? 'тест іде' : b.st === 'queued' ? 'у черзі: стартує після звільнення сторінки' : 'план: після погоджень'}">
        <rect x="${x(b.w0) + 3}" y="${y + 6}" width="${(b.w1 - b.w0 + 1) * cw - 6}" height="18" rx="5" style="fill:${b.live ? col : 'var(--paper)'};stroke:${col};stroke-width:1.5;stroke-dasharray:${b.live ? 0 : '4 3'}"/>
        ${inT(x(b.w0) + 9, y + 19, b.id, b.live ? 'w' : '')}</g>`;
    });
    if (busy > 1) s += `<circle cx="${W - 18}" cy="${y + 15}" r="6" style="fill:var(--hold)" data-hint="${busy} пакети на одному ресурсі: черга розтягує запуск"/>`;
  });
  if (S.hotfixes?.[0] && S.hotfixes[0].status !== 'done') s += inT(L, H - 6, '◆ HF-1 (швидка смуга) має пріоритет над будь-яким рядком із блоком ціни', '', 'start', ' style="fill:var(--veto)"');
  return inSvg(W, H, 'Завантаження ресурсів по тижнях', s, 700) + `<div class="legend"><span><i class="lg" style="background:var(--act)"></i>тест іде</span><span><i class="lg" style="border:1.5px dashed var(--ink-3)"></i>план після погоджень</span><span><i class="lg" style="border:1.5px dashed #7B3FA0"></i>у черзі ресурсу</span><span><i class="lg" style="background:var(--hold);border-radius:50%"></i>кілька пакетів на ресурсі</span></div>`;
}
function inGate() {
  const list = S.recs.filter(r => r.tests);
  const id = inTab('gateRec', (list.find(r => r.status === 'test') || list.find(r => r.id === 'REC-1') || list[0]).id);
  const r = list.find(x => x.id === id) || list[0];
  const live = ['test', 'won', 'inconclusive'].includes(r.status), wk = live ? Math.max(1, r.week || 0) : 3;
  const tests = recTests(r) || r.tests;
  const vals = tests.map((t, i) => { const v = live ? recVal(t, r.week || 0) : t[1]; const ci = [2.2, 3.2, 4.5][i] * Math.sqrt(3 / wk); return { n: t[0], v, ci, m: t[2] }; });
  const res = gateEvaluate(vals.map(v => ({ name: v.n, value: v.v })));
  const W = inFit(680), L = 190, R = 20, rh = 46, T = 30, H = T + vals.length * rh + 30, lo = -16, hi = 16;
  const x = v => L + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (W - L - R);
  let s = `<rect x="${x(lo)}" y="${T - 8}" width="${x(GATE.harm) - x(lo)}" height="${vals.length * rh}" style="fill:var(--veto-soft)"/>
    <rect x="${x(GATE.harm)}" y="${T - 8}" width="${x(GATE.win) - x(GATE.harm)}" height="${vals.length * rh}" style="fill:var(--mist)"/>
    <rect x="${x(GATE.win)}" y="${T - 8}" width="${x(hi) - x(GATE.win)}" height="${vals.length * rh}" style="fill:var(--pass-soft)"/>`;
  s += inT((x(lo) + x(GATE.harm)) / 2, T - 14, 'шкода → відкат', 'b', 'middle', ' style="fill:var(--veto)"') + inT((x(GATE.harm) + x(GATE.win)) / 2, T - 14, 'немає висновку', 'b', 'middle') + inT((x(GATE.win) + x(hi)) / 2, T - 14, 'виграш', 'b', 'middle', ' style="fill:var(--pass)"');
  [-15, -10, -5, -2, 0, 2, 5, 10, 15].forEach(v => { s += `<line x1="${x(v)}" x2="${x(v)}" y1="${T - 8}" y2="${T + vals.length * rh - 8}" style="stroke:${v === 0 ? 'var(--ink-3)' : 'var(--line-2)'};stroke-dasharray:${v === 0 ? 0 : '2 3'}"/>` + inT(x(v), H - 8, (v > 0 ? '+' : '') + v, '', 'middle'); });
  vals.forEach((v, i) => {
    const y = T + i * rh + 14, col = v.v < GATE.harm ? 'var(--veto)' : v.v >= GATE.win ? 'var(--pass)' : 'var(--ink-2)';
    s += inT(L - 10, y + 4, v.n, 'b', 'end') + inT(L - 10, y + 18, esc(v.m), '', 'end');
    s += `<g data-hint="${v.n}: ${fmtGate(v.n, v.v)}, інтервал ±${v.ci.toFixed(1)}"><line x1="${x(v.v - v.ci)}" x2="${x(v.v + v.ci)}" y1="${y}" y2="${y}" style="stroke:${col};stroke-width:3;stroke-linecap:round"/><circle cx="${x(v.v)}" cy="${y}" r="6" style="fill:${col};stroke:#fff;stroke-width:2"/>${inT(x(v.v), y - 10, fmtGate(v.n, v.v), 'b', 'middle')}</g>`;
  });
  const crosses = vals.filter(v => v.v - v.ci < 0 && v.v + v.ci > 0).map(v => v.n);
  const why = res.verdict === 'harm' ? `Шкода: ${String(res.why).replace(/\.+$/, '')}. Тестова група відновлюється, сторінка лишається як була.` : res.verdict === 'inconclusive' ? `Немає висновку: жоден тест не дав виграшу ≥ +${GATE.win}${crosses.length ? `, а інтервал ${crosses.join(', ')} перетинає нуль — різниця може бути шумом` : ''}. Перемогу не оголошуємо.` : `Пройшов: ${String(res.why).replace(/\.+$/, '')}. Жоден канал не гірший за −${Math.abs(GATE.harm)}.`;
  return `${inSeg('gateRec', list.map(x => [x.id, x.id]), id, 'Рекомендація')}
    <p class="small muted" style="margin:0 0 8px">${esc(r.title)} · ${live ? `тиждень ${r.week || 0} з 3` : 'прогноз на кінець тесту'} · інтервал звужується з кожним тижнем</p>
    ${inSvg(W, H, 'Тест-гейт: значення і інтервали трьох тестів', s, 560)}
    <div class="in-verdict ${res.verdict}"><b>${res.verdict === 'harm' ? 'Відкат' : res.verdict === 'inconclusive' ? 'Немає висновку' : 'Пройшов'}</b> ${esc(why)}</div>
    <div class="in-calc sec-gap"><h3 class="sub-h" style="margin-top:0">Скільки тижнів потрібно тесту ${hint('Оцінка для A/B: 80% потужності, рівень значущості 5%. Мала сторінка не набере вибірку за розумний час — для неї тест-гейт перевіряє лише відсутність шкоди.')}</h3>
      <div class="in-cg"><label>Відвідувачів на тиждень <input type="range" id="calc-tr" min="300" max="20000" step="100" value="${IN.calcTr || 1500}"><b id="calc-tr-v"></b></label>
      <label>Базова конверсія <input type="range" id="calc-cr" min="1" max="10" step="0.5" value="${IN.calcCr || 3}"><b id="calc-cr-v"></b></label>
      <label>Ефект, який хочемо побачити <input type="range" id="calc-mde" min="5" max="40" step="1" value="${IN.calcMde || 20}"><b id="calc-mde-v"></b></label></div>
      <div id="calc-out" class="in-calc-out"></div></div>`;
}
function inCalcUpdate() {
  if (typeof document === 'undefined') return;
  const g = id => document.getElementById(id); if (!g('calc-tr')) return;
  const tr = +g('calc-tr').value, cr = +g('calc-cr').value / 100, mde = +g('calc-mde').value / 100;
  IN.calcTr = tr; IN.calcCr = cr * 100; IN.calcMde = mde * 100;
  const n = Math.ceil(16 * cr * (1 - cr) / Math.pow(cr * mde, 2)), weeks = Math.ceil(2 * n / tr * 10) / 10;
  g('calc-tr-v').textContent = tr.toLocaleString('uk'); g('calc-cr-v').textContent = (cr * 100).toFixed(1).replace('.', ',') + '%'; g('calc-mde-v').textContent = '±' + Math.round(mde * 100) + '%';
  g('calc-out').innerHTML = `Потрібно ≈ <b>${n.toLocaleString('uk')}</b> відвідувачів на групу → <b>${String(weeks).replace('.', ',')} тиж.</b> ${weeks <= 3 ? '<span class="chip ok">стандартне вікно 3 тижні</span>' : weeks <= 6 ? '<span class="chip warn">подовжене вікно</span>' : '<span class="chip bad">мала сторінка: лише перевірка «без шкоди» або тест на групі сторінок</span>'}`;
}
function inStates() {
  const N = {
    new: [0, 30, 'Нова', 'автор подав'], review: [150, 30, 'Погодження каналів', 'SEO · PPC · AIV'], conflict: [150, 130, 'Конфлікт', 'компроміс v2 ≤ 2 рази'],
    triage: [300, 30, 'Тріаж Координатора', 'O2 докази · O3 політики'], auto: [450, -20, 'Авто-дозвіл', 'низький вплив'], human: [450, 80, 'Людина', 'вплив, гроші, конфлікт'],
    queued: [300, 190, 'У черзі ресурсу', 'один пакет на сторінку'], test: [600, 30, 'Тест-гейт', 'A/B · SEO · AIV'], pause: [600, 160, 'Пауза тесту', 'швидка смуга · подія'],
    won: [750, -20, 'Виграв', 'чекає розгортання'], inconc: [750, 80, 'Немає висновку', 'без змін'], rolled: [750, 180, 'Відкат', 'шкода каналу'], deployed: [900, -20, 'Розгорнуто', 'read-back ✓'],
    rejected: [450, 190, 'Відхилено', 'людина або TTL 48 год']
  };
  const cnt = st => S.recs.filter(r => st.includes(r.status)).length + (S.gps || []).filter(g => st.includes(g.status)).length;
  const map = { new: ['new'], review: ['review'], triage: ['ready'], auto: ['auto'], human: ['human'], queued: ['queued'], test: ['test', 'rollout'], won: ['won'], inconc: ['inconclusive'], rolled: ['rolledback'], deployed: ['deployed'], rejected: ['rejected', 'expired'] };
  const bw = 128, bh = 46, ox = 6, oy = 40;
  const c = k => [N[k][0] + ox + bw / 2, N[k][1] + oy + bh / 2];
  const E = [['new', 'review'], ['review', 'conflict', 'заперечення'], ['conflict', 'review', 'v2'], ['review', 'triage'], ['triage', 'auto'], ['triage', 'human'], ['auto', 'test'], ['human', 'test'], ['human', 'rejected'], ['triage', 'queued', 'ресурс зайнятий'], ['queued', 'triage', 'звільнився'], ['test', 'pause'], ['pause', 'test', 'вікно подовжено'], ['test', 'won'], ['test', 'inconc'], ['test', 'rolled'], ['won', 'deployed']];
  const edge = ([a, b, l]) => { const [x1, y1] = c(a), [x2, y2] = c(b); const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); const sx = x1 + dx / len * (Math.abs(dx) > Math.abs(dy) * 3 ? bw / 2 : bh / 1.6), sy = y1 + dy / len * bh / 1.6; const ex = x2 - dx / len * (Math.abs(dx) > Math.abs(dy) * 3 ? bw / 2 : bh / 1.6), ey = y2 - dy / len * bh / 1.6;
    const back = (a === 'conflict' && b === 'review') || (a === 'queued' && b === 'triage') || (a === 'pause' && b === 'test'); const off = back ? 16 : 0;
    const vert = Math.abs(dx) < 4; const lx = vert ? (back ? sx + off + 6 : sx - 6) : (sx + ex) / 2 + 2, ly = vert ? (sy + ey) / 2 + 4 : (sy + ey) / 2 - 5;
    return `<path d="M${sx + off} ${sy} L${ex + off} ${ey}" style="fill:none;stroke:var(--ink-2);stroke-width:1.4" marker-end="url(#in-ar)"/>${l ? inT(lx, ly, l, 'xs', vert && !back ? 'end' : vert ? 'start' : 'middle', ' style="paint-order:stroke;stroke:var(--paper);stroke-width:3px"') : ''}`; };
  let s = inArrowDefs('in-ar') + E.map(edge).join('');
  Object.entries(N).forEach(([k, n]) => { const v = map[k] ? cnt(map[k]) : 0; const x = n[0] + ox, y = n[1] + oy;
    const col = ['rolled', 'rejected'].includes(k) ? 'var(--veto)' : ['deployed', 'won'].includes(k) ? 'var(--pass)' : k === 'human' ? 'var(--hold)' : k === 'pause' || k === 'conflict' ? '#7B3FA0' : 'var(--act)';
    s += `<g><rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="9" style="fill:var(--paper);stroke:${col};stroke-width:${v ? 2.5 : 1.3}"/>${inT(x + 10, y + 19, n[2], 'b')}${inT(x + 10, y + 35, n[3], 'xs')}${v ? `<circle cx="${x + bw - 4}" cy="${y + 4}" r="10" style="fill:${col}"/>${inT(x + bw - 4, y + 8, v, 'w b', 'middle')}` : ''}</g>`; });
  return inSvg(1050, 290, 'Стани пакета зміни сторінки і переходи', s, 720) + `<p class="small muted" style="margin:8px 0 0">Канали погодили одну версію → тріаж. Низький вплив — авто-дозвіл, решта — людина. Виграш розгортає людина або авто, залежно від впливу. Число в куті — скільки пакетів зараз у цьому стані. Аварійний вимикач зупиняє будь-який перехід, що пише назовні; пакети чекають у своєму стані й продовжують після відновлення.</p>`;
}
function inRecs(html) {
  const tab = inTab('recs', 'pri');
  const body = tab === 'pri' ? inScatter() : tab === 'load' ? inLoad() : tab === 'gate' ? inGate() : inStates();
  const add = `<div class="panel sec-gap" data-tour="in-recs"><h2>Як бачити всю картину ${hint('Чотири погляди на ті самі пакети: що робити першим, де черги, як тест-гейт ухвалює рішення і через які стани проходить пакет.')}</h2>
    ${inSeg('recs', [['pri', 'Пріоритети'], ['load', 'Завантаження сторінок'], ['gate', 'Тест-гейт'], ['states', 'Стани пакета']], 'pri')}${body}</div>`;
  const anchor = '<div class="acts sec-gap"><button class="btn" data-action="page-queue">';
  const out = html.includes(anchor) ? html.replace(anchor, add + anchor) : html + add;
  if (typeof setTimeout === 'function' && tab === 'gate') setTimeout(inCalcUpdate, 0);
  return out;
}

/* ---------- AI Visibility ---------- */
function inAivHeat() {
  const stages = ['BOFU', 'MOFU', 'TOFU', 'Бренд'];
  const cell = (st, e) => { const ps = S.prompts.filter(p => p.st === st); if (!ps.length) return null; const c = ps.filter(p => p.m[e] === 'c').length / ps.length, m = ps.filter(p => p.m[e] !== '-').length / ps.length; return [Math.round(c * 100), Math.round(m * 100), ps.length]; };
  return `<div class="tbl-wrap"><table class="in-heat"><thead><tr><th>Етап воронки</th>${ENG.map(e => `<th>${e}</th>`).join('')}</tr></thead><tbody>
    ${stages.map(st => `<tr><td><b>${st}</b><br><span class="small muted">${S.prompts.filter(p => p.st === st).length} промпт(и) у вибірці</span></td>${ENG.map((e, i) => { const v = cell(st, i); if (!v) return '<td>—</td>'; const a = 0.08 + v[0] / 100 * 0.85; return `<td class="in-cell${inTab('heat', '') === st + '|' + i ? ' on' : ''}" data-action="in-sel" data-id="heat:${st}|${i}" style="background:rgba(30,138,110,${a.toFixed(2)});color:${v[0] > 55 ? '#fff' : 'var(--ink)'}" data-hint="${st} · ${e}\nцитують: ${v[0]}% промптів\nзгадують: ${v[1]}%"><b>${v[0]}%</b><br><span class="small">згадки ${v[1]}%</span></td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>${(() => { const h = inTab('heat', ''); if (!h) return '<p class="small muted" style="margin:8px 0 0">Натисніть на клітинку — побачите промпти і що робить AI-система.</p>'; const [st, i] = h.split('|'); const ps = S.prompts.filter(p => p.st === st); const lab = { c: ['цитує наш сайт', 'ok'], m: ['згадує без посилання', 'warn'], '-': ['не згадує', 'bad'] }; return `<div class="in-det"><b>${st} · ${ENG[i]}</b>${ps.map(p => `<div class="row small"><span class="grow">${esc(p.p)}<br><span class="muted">${p.page} · замість нас: ${esc(p.comp)}</span></span><span class="chip ${lab[p.m[i]][1]}">${lab[p.m[i]][0]}</span>${p.rec ? `<button class="btn small" data-action="in-open" data-id="${p.rec}">${p.rec}</button>` : ''}</div>`).join('')}</div>`; })()}<p class="small muted" style="margin:8px 0 0">Колір — частка промптів, де AI-система цитує наш сайт (вибірка — 8 показаних промптів, у продукті — 120). Найслабше місце — BOFU у ${(() => { const z = ENG.filter((e, i) => (cell('BOFU', i) || [100])[0] === 0); return z.length ? z.join(', ') : '—'; })()}: там нас не цитують зовсім, а саме там рішення про покупку.</p>`;
}
function inAivTrend() {
  const wk = Array.from({ length: 12 }, (_, i) => 30 + i);
  const v = [13.8, 14.4, 14.1, 15.0, 14.6, 15.3, 15.9, 15.2, 16.1, 16.8, 17.4, 18.0];
  const comp = [29, 29.5, 30, 30.4, 30.1, 30.6, 31, 31.2, 31.1, 31.4, 31.2, 31.0];
  const W = inFit(640), H = 230, L = 36, R = 14, T = 16, B = 28, lo = 8, hi = 36;
  const x = i => L + i * (W - L - R) / (wk.length - 1), y = val => T + (hi - val) / (hi - lo) * (H - T - B);
  const band = v.map((val, i) => `${x(i)},${y(val + 2)}`).join(' ') + ' ' + v.map((val, i) => `${x(v.length - 1 - i)},${y(v[v.length - 1 - i] - 2)}`).join(' ');
  let s = [10, 15, 20, 25, 30, 35].map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(--line)"/>` + inT(L - 6, y(t) + 4, t + '%', '', 'end')).join('');
  s += wk.map((w, i) => i % 2 === 0 ? inT(x(i), H - 8, 'W' + w, '', 'middle') : '').join('');
  s += `<polygon points="${band}" style="fill:#7B3FA0;opacity:.13"/>`;
  s += `<polyline points="${comp.map((val, i) => `${x(i)},${y(val)}`).join(' ')}" style="fill:none;stroke:var(--ink-3);stroke-width:2;stroke-dasharray:5 4"/>`;
  s += `<polyline points="${v.map((val, i) => `${x(i)},${y(val)}`).join(' ')}" style="fill:none;stroke:#7B3FA0;stroke-width:2.6"/>` + v.map((val, i) => `<circle cx="${x(i)}" cy="${y(val)}" r="3.2" style="fill:#7B3FA0" data-hint="W${wk[i]}: цитування ${String(val).replace('.', ',')}% (шум ±2 п.)"/>`).join('');
  [[40, 'Perplexity: формат цитат'], [41, 'ChatGPT: нова модель']].forEach(([w, t], k) => { const i = wk.indexOf(w); s += `<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}" style="stroke:#7B3FA0;stroke-dasharray:3 3"/>` + inT(x(i) - 4, T + 10 + k * 12, t, 'xs', 'end', ' style="fill:#7B3FA0"'); });
  return inSvg(W, H, 'Частка цитувань Acme по тижнях зі смугою шуму', s) + `<div class="legend"><span><i class="lg" style="background:#7B3FA0"></i>Acme: цитування</span><span><i class="lg" style="background:#7B3FA0;opacity:.2"></i>смуга шуму ±2 п.</span><span><i class="lg" style="border-top:2px dashed var(--ink-3);height:0"></i>Baremetrics</span><span>Зміна всередині смуги — не сигнал; висновки лише на стійких змінах</span></div>`;
}
function inAivSov() {
  const brands = [['Acme', '#7B3FA0'], ['Baremetrics', '#B9382A'], ['ProfitWell', '#B86E00'], ['Інші', '#C3CAD8']];
  const data = { ChatGPT: [24, 30, 18, 28], Perplexity: [29, 27, 17, 27], 'Google AI Overviews': [19, 34, 21, 26], Gemini: [17, 33, 22, 28], Claude: [26, 29, 18, 27], Copilot: [21, 32, 20, 27] };
  return `<div class="in-sov">${Object.entries(data).map(([e, a]) => `<div class="r"><span class="l">${e}</span><span class="b">${a.map((v, i) => `<i style="width:${v}%;background:${brands[i][1]}" data-hint="${e} · ${brands[i][0]}: ${v}% згадок"><span>${v}%</span></i>`).join('')}</span></div>`).join('')}</div>
    <div class="legend">${brands.map(b => `<span><i class="lg" style="background:${b[1]}"></i>${b[0]}</span>`).join('')}</div>`;
}
function inAiv(html) {
  const tab = inTab('aiv', 'heat');
  const body = tab === 'heat' ? inAivHeat() : tab === 'trend' ? inAivTrend() : inAivSov();
  const add = `<div class="panel sec-gap"><h2>Візуалізації AI Visibility ${hint('Теплокарта показує, де саме ми слабкі. Тренд — чи зміна справжня, а не шум. Частка голосу — з ким ділимо відповіді.')}</h2>
    ${inSeg('aiv', [['heat', 'Етапи × AI-системи'], ['trend', 'Тренд і шум'], ['sov', 'Частка голосу']], 'heat')}${body}</div>`;
  return (typeof wdContext === 'function' ? wdContext(['AI Visibility']) : '') + html + add;
}

/* ---------- SEO ---------- */
function inSeoDist() {
  const b = [['1–3', 14, 12], ['4–10', 31, 29], ['11–20', 38, 41], ['21–50', 25, 26], ['50+', 12, 12]];
  const mx = 45;
  return `<div class="in-hist wide">${b.map(x => `<div><span class="v">${x[1]} <span class="${x[1] > x[2] ? 'up' : x[1] < x[2] ? 'down' : 'muted'}">${x[1] > x[2] ? '↑' : x[1] < x[2] ? '↓' : '='}${Math.abs(x[1] - x[2]) || ''}</span></span><span class="pair"><i class="ghost" style="height:${x[2] / mx * 110}px" data-hint="тиждень тому: ${x[2]}"></i><i style="height:${x[1] / mx * 110}px;background:${x[0] === '1–3' || x[0] === '4–10' ? 'var(--pass)' : 'var(--act)'}" data-hint="зараз: ${x[1]} запитів"></i></span><span>${x[0]}</span></div>`).join('')}</div>
    <p class="small muted" style="margin:10px 0 0">120 відстежуваних запитів. Сіре — тиждень тому. Найдешевший приріст — запити на позиціях 4–15: їх бере Content Optimizer.</p>`;
}
function inCannibal() {
  const C = [['financial reporting automation', ['/smart-reports', '/blog/reporting-tools']], ['pricing analytics', ['/pricing-analytics']], ['month end close software', ['/blog/finance-close', '/features/forecasting']], ['cfo dashboard template', ['/blog/cfo-dashboard']], ['quickbooks integration saas', ['/integrations', '/integrations/quickbooks']]];
  const pages = [...new Set(C.flatMap(c => c[1]))];
  const W = 600, rh = 34, H = Math.max(C.length, pages.length) * rh + 20, xl = 215, xr = 375;
  const yl = i => 18 + i * rh * (pages.length / C.length) + 6, yr = i => 18 + i * rh;
  let s = '';
  C.forEach((c, i) => { const bad = c[1].length > 1; c[1].forEach(p => { const j = pages.indexOf(p); s += `<path d="M${xl} ${yl(i)} C${(xl + xr) / 2} ${yl(i)} ${(xl + xr) / 2} ${yr(j)} ${xr} ${yr(j)}" style="fill:none;stroke:${bad ? 'var(--veto)' : 'var(--pass)'};stroke-width:${bad ? 2.4 : 1.6};opacity:.8"/>`; });
    s += `<g class="hl" data-hint="${esc(c[0])}: ${c[1].length > 1 ? 'конкурують ' + c[1].length + ' сторінки — Keyword Researcher призначає одну цільову' : 'одна цільова сторінка'}"><circle cx="${xl}" cy="${yl(i)}" r="5" style="fill:${bad ? 'var(--veto)' : 'var(--pass)'}"/>${inT(xl - 10, yl(i) + 4, esc(c[0]), bad ? 'b' : '', 'end')}</g>`; });
  pages.forEach((p, j) => { s += `<circle cx="${xr}" cy="${yr(j)}" r="4" style="fill:var(--ink-2)"/>` + inT(xr + 10, yr(j) + 4, esc(p)); });
  return inSvg(W, H, 'Кластери запитів і сторінки, що за них конкурують', s) + `<div class="legend"><span><i class="lg" style="background:var(--pass)"></i>одна цільова сторінка</span><span><i class="lg" style="background:var(--veto)"></i>канібалізація: дві сторінки на один кластер</span></div>`;
}
function inSeo(html) {
  return (typeof wdContext === 'function' ? wdContext(['SEO']) : '') + html + `<div class="grid g2 sec-gap">
    <div class="panel"><h2>Розподіл позицій ${hint('Як змінився розподіл усіх відстежуваних запитів за тиждень. Один графік замість 120 рядків.')}</h2>${inSeoDist()}</div>
    <div class="panel"><h2>Карта канібалізації ${hint('Кластер запитів має вести на одну сторінку. Дві сторінки на один кластер ділять сигнали й позиції.')}</h2>${inCannibal()}</div></div>`;
}

/* ---------- PPC ---------- */
function inPacing() {
  const days = 31, today = 12, plan = 21700;
  const act = [0, 640, 1330, 2010, 2720, 3460, 4150, 4800, 5560, 6300, 7060, 7820, 8480];
  const W = 640, H = 230, L = 50, R = 14, T = 14, B = 28;
  const x = d => L + d / days * (W - L - R), y = v => T + (1 - v / 24000) * (H - T - B);
  const rate = act[today] / today, fc = Math.round(rate * days);
  let s = [0, 6000, 12000, 18000, 24000].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/>` + inT(L - 6, y(v) + 4, '$' + (v / 1000) + 'k', '', 'end')).join('');
  s += [1, 8, 15, 22, 29].map(d => inT(x(d), H - 8, d + '.10', '', 'middle')).join('');
  s += `<line x1="${x(0)}" y1="${y(0)}" x2="${x(days)}" y2="${y(plan)}" style="stroke:var(--ink-3);stroke-width:2;stroke-dasharray:6 4"/>`;
  s += `<polyline points="${act.map((v, d) => `${x(d)},${y(v)}`).join(' ')}" style="fill:none;stroke:var(--hold);stroke-width:2.6"/>`;
  s += `<line x1="${x(today)}" y1="${y(act[today])}" x2="${x(days)}" y2="${y(fc)}" style="stroke:var(--hold);stroke-width:2;stroke-dasharray:2 4"/>`;
  s += `<circle cx="${x(today)}" cy="${y(act[today])}" r="4" style="fill:var(--hold)"/>` + inT(x(today) + 6, y(act[today]) - 8, `$${act[today].toLocaleString('uk')} на 12.10`, 'b');
  s += inT(x(days) - 4, y(fc) - 8, `прогноз $${fc.toLocaleString('uk')}`, 'b', 'end', ' style="fill:var(--hold)"') + inT(x(days) - 4, y(plan) + 16, `план $${plan.toLocaleString('uk')}`, '', 'end');
  s += `<line x1="${x(12)}" x2="${x(12)}" y1="${T}" y2="${H - B}" style="stroke:#B86E00;stroke-dasharray:3 3"/>` + inT(x(12) + 4, T + 10, 'Columbus Day: pacing −15%', 'xs');
  return inSvg(W, H, 'PPC: накопичені витрати жовтня проти плану і прогноз', s) + `<p class="small muted" style="margin:8px 0 0">Темп ${Math.round((fc / plan - 1) * 100)}% понад план. Budget Optimizer пропонує зниження ставок у Brand UA; R3 — через O3 і власника бюджету.</p>`;
}
function inR3() {
  const rows = [['owner', 'Owner', 0], ['lead', 'Marketing lead', 5000], ['seo', 'Channel manager', 500]];
  return rows.map(([k, n, lim]) => { const used = S.r3Used?.[k] || 0; const pc = lim ? Math.min(100, used / lim * 100) : 0;
    return `<div class="row"><span class="grow"><b>${n}</b>${S.role === k ? ' <span class="chip act">ви</span>' : ''}<br><span class="small muted">${lim ? `використано $${used.toLocaleString('uk')} з $${lim.toLocaleString('uk')} на тиждень сукупно` : 'без ліміту, але кожна зміна проходить O3'}</span>${lim ? `<div class="bar" style="margin-top:4px"><i style="width:${pc}%;background:${pc > 90 ? 'var(--veto)' : pc > 70 ? 'var(--hold)' : 'var(--act)'}"></i></div>` : ''}</span></div>`; }).join('') +
    `<div class="row"><span class="grow"><b>Тижневий бюджет акаунта</b><br><span class="small muted">$${S.budgetUsed.toLocaleString('uk')} з $${S.budget.toLocaleString('uk')} — O3 ставить вето на все, що виведе за межу</span><div class="bar" style="margin-top:4px"><i style="width:${Math.min(100, S.budgetUsed / S.budget * 100)}%;background:var(--hold)"></i></div></span></div>`;
}
function inPpc(html) {
  return (typeof wdContext === 'function' ? wdContext(['PPC']) : '') + html + `<div class="grid g2 sec-gap">
    <div class="panel"><h2>Pacing місяця ${hint('Накопичені витрати проти лінійного плану. Пунктир після сьогодні — прогноз за поточним темпом.')}</h2>${inPacing()}</div>
    <div class="panel"><h2>Ліміти R3 по ролях ${hint('Ліміт рахується сукупно за тиждень: десять змін по $60 не обійдуть ліміт $500.')}</h2>${inR3()}</div></div>`;
}

/* ---------- Кампанії: календар і критичний шлях ---------- */
const IN_DUR = { landing: 5, articles: 7, ads: 3, emails: 4, posts: 2, update: 21 };
function inCmpTimeline(c) {
  let P = c.packets;
  if (!P.length) { const tmp = { ...c, slug: c.slug || '/smart-reports', slugShort: c.slugShort || 'smart-reports', updatePage: c.updatePage || '/smart-reports' }; P = cmpPackets(tmp, c.chs); }
  const start = {}, end = {}, prev = {};
  const doneSt = ['done', 'deployed'];
  const calc = k => { if (end[k.id] != null) return end[k.id]; let s0 = 0; k.deps.forEach(d => { const dk = P.find(x => x.id === d); if (dk) { const e = calc(dk); if (e > s0) { s0 = e; prev[k.id] = d; } } }); start[k.id] = s0; end[k.id] = s0 + (doneSt.includes(k.status) ? 0.5 : IN_DUR[k.kind] || 3); return end[k.id]; };
  P.forEach(calc);
  const total = Math.max(...P.map(k => end[k.id]));
  const crit = new Set(); let cur = P.find(k => end[k.id] === total); while (cur) { crit.add(cur.id); cur = P.find(k => k.id === prev[cur.id]); }
  const proj = (S.projects || []).find(p => p.id === c.epic), due = proj ? Math.round((new Date(proj.due + 'T12:00:00Z') - WD_TODAY) / 864e5) : null;
  const span = Math.max(total, due || 0) + 2, L = 210, W = inFit(860), rh = 30, T = 26, H = T + P.length * rh + 26;
  const x = d => L + d / span * (W - L - 14);
  let s = '';
  for (let d = 0; d <= span; d += 3) s += `<line x1="${x(d)}" x2="${x(d)}" y1="20" y2="${H - 22}" style="stroke:var(--line)"/>` + inT(x(d), 14, d === 0 ? 'сьогодні' : '+' + d + ' дн.', d === 0 ? 'b' : '', 'middle');
  if (due != null) s += `<line x1="${x(due)}" x2="${x(due)}" y1="20" y2="${H - 22}" style="stroke:var(--veto);stroke-width:2"/>` + inT(x(due) + 4, H - 8, `дедлайн ${proj.due.slice(8, 10)}.${proj.due.slice(5, 7)}`, 'b', 'start', ' style="fill:var(--veto)"');
  P.forEach((k, i) => {
    const y = T + i * rh, isC = crit.has(k.id), st = (CK_ST[k.status] || [k.status])[0];
    const col = doneSt.includes(k.status) ? 'var(--pass)' : ['queued', 'return', 'rejected'].includes(k.status) ? 'var(--veto)' : k.status === 'human' ? 'var(--hold)' : 'var(--act)';
    s += inT(L - 8, y + 18, esc(CK[k.kind].label.split(' (')[0]), isC ? 'b' : '', 'end');
    s += `<g class="hl" data-action="in-sel" data-id="cmpSel:${k.id}" data-hint="${k.id}: ${esc(k.title)}\n${st}${k.note ? ' — ' + esc(k.note) : ''}\nдні ${start[k.id]}–${end[k.id]}${isC ? '\nкритичний шлях' : ''}${k.deps.length ? '\nчекає: ' + k.deps.join(', ') : ''}">
      <rect x="${x(start[k.id]) + 2}" y="${y + 6}" width="${Math.max(6, x(end[k.id]) - x(start[k.id]) - 4)}" height="18" rx="5" style="fill:${col};opacity:${k.status === 'plan' || k.status === 'wait' ? .55 : .95};stroke:${isC ? 'var(--ink)' : 'none'};stroke-width:2"/>
      ${inT(x(end[k.id]) + 6, y + 19, esc(st) + (k.note ? ' · ' + esc(k.note.slice(0, 40)) : ''), 'xs')}</g>`;
    k.deps.forEach(d => { const j = P.findIndex(z => z.id === d); if (j >= 0) s += `<path d="M${x(end[d]) - 4} ${T + j * rh + 24} V${y + 15} H${x(start[k.id]) + 2}" style="fill:none;stroke:${crit.has(k.id) && crit.has(d) ? 'var(--ink)' : 'var(--ink-3)'};stroke-width:1.2;stroke-dasharray:${crit.has(k.id) && crit.has(d) ? 0 : '3 2'}"/>`; });
  });
  const late = due != null && total > due;
  const sk = P.find(k => k.id === inTab('cmpSel', ''));
  const det = sk ? `<div class="in-det"><b>${sk.id} · ${esc(sk.title)}</b> <span class="chip">${esc((CK_ST[sk.status] || [sk.status])[0])}</span>${crit.has(sk.id) ? ' <span class="chip warn">критичний шлях</span>' : ''}<br><span class="small">Хто робить: ${esc(CK[sk.kind].who)} · погоджують: ${CK[sk.kind].review.join(', ')} · затверджує: ${esc(CK[sk.kind].approver)}</span><br><span class="small muted">Ресурс ${esc(sk.res)} · дні ${start[sk.id]}–${end[sk.id]}${sk.deps.length ? ' · чекає ' + sk.deps.join(', ') : ''} · ${esc(CK[sk.kind].launch)}</span>${sk.note ? `<br><span class="small" style="color:var(--veto)">${esc(sk.note)}</span>` : ''}</div>` : '<p class="small muted" style="margin:8px 0 0">Натисніть на смугу пакета — тут з’явиться, хто його робить, хто погоджує і що він чекає.</p>';
  return inSvg(W, H, 'Календар пакетів кампанії і критичний шлях', s, 720) + det + `<div class="in-verdict ${late ? 'harm' : 'pass'}"><b>${late ? 'Дедлайн під ризиком' : 'Встигаємо'}</b> Критичний шлях: ${[...crit].reverse().map(id => P.find(k => k.id === id).title).join(' → ')} — ${total} дн.${due != null ? ` Дедлайн через ${due} дн.` : ''}${late ? ` Варіанти: позначити ${P.some(k => k.kind === 'update' && crit.has(k.id)) ? 'зміну наявної сторінки (вона йде через тест-гейт, ~3 тижні) як необов’язкову для запуску, ' : ''}писати статті паралельно на чернетці лендингу, зарезервувати сторінку наперед або перенести дедлайн.` : ''}</div>
    <div class="legend"><span><i class="lg" style="border:2px solid var(--ink)"></i>критичний шлях</span><span><i class="lg" style="background:var(--act)"></i>у плані або в роботі</span><span><i class="lg" style="background:var(--hold)"></i>чекає людину</span><span><i class="lg" style="background:var(--veto)"></i>заблоковано</span><span><i class="lg" style="background:var(--pass)"></i>готово</span></div>`;
}
function inCmps(html) {
  return html + (S.cmps || []).map(c => `<div class="panel sec-gap"><h2>${c.id}: календар і критичний шлях ${hint('Тривалість — типова для кожного типу пакета. Зміна наявної сторінки йде через тест-гейт, тому найдовша. Критичний шлях визначає дату запуску всієї кампанії.')}</h2>${inCmpTimeline(c)}</div>`).join('');
}

/* ---------- Групи: запобіжники по хвилях і сторінках ---------- */
function inGpGuard(g) {
  const el = typeof gpEligible === 'function' ? gpEligible(g) : [];
  const per = el.map(p => { const h = inHash(p + g.id) % 1000 / 1000; const base = g.canary[Math.min(2, g.wave ?? 2)] ?? 0; return [p, Math.round((base + (h - 0.5) * 6) * 10) / 10]; }).sort((a, b) => a[1] - b[1]).slice(0, 5);
  const W = 300, H = 150, L = 30, B = 26, T = 12, lo = -6, hi = 6, y = v => T + (hi - v) / (hi - lo) * (H - T - B), bw = 50;
  let s = [-4, -2, 0, 2, 4].map(v => `<line x1="${L}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" style="stroke:${v === -2 ? 'var(--veto)' : 'var(--line)'};stroke-dasharray:${v === -2 ? '5 3' : 0}"/>` + inT(L - 4, y(v) + 4, (v > 0 ? '+' : '') + v, '', 'end')).join('');
  g.canary.forEach((v, i) => { const x0 = L + 20 + i * (bw + 30), ok = v >= GATE.harm, reached = g.status === 'deployed' || (g.waveOk ?? -1) >= i || g.waveFail === i;
    s += `<g data-hint="Хвиля ${WAVES[i]}%: ${fmtGate('A/B', v)}${reached ? '' : ' (прогноз)'}"><rect x="${x0}" y="${Math.min(y(v), y(0))}" width="${bw}" height="${Math.abs(y(v) - y(0))}" rx="3" style="fill:${ok ? 'var(--pass)' : 'var(--veto)'};opacity:${reached ? .95 : .35}"/>${inT(x0 + bw / 2, H - 8, WAVES[i] + '%', '', 'middle')}${inT(x0 + bw / 2, (v >= 0 ? y(v) - 4 : y(v) + 12), fmtGate('A/B', v), 'b', 'middle')}</g>`; });
  return `<div class="in-gp"><div><b class="small">${g.id} · ${esc(g.title)}</b>${inSvg(W, H, 'Запобіжник по хвилях', s)}</div>
    <div><b class="small">Найгірші сторінки ${hint('Середнє по групі може бути в нормі, а окремі сторінки — ні. Сторінка нижче −2 виключається з групи і йде в ручну чергу.')}</b>
    ${per.map(([p, v]) => `<div class="row small"><span class="grow">${esc(p)}</span><span class="${v < GATE.harm ? 'down' : 'muted'}">${fmtGate('A/B', v)}</span>${v < GATE.harm ? '<span class="chip bad">виключити</span>' : ''}</div>`).join('')}</div></div>`;
}
function inGroups(html) {
  return html + `<div class="panel sec-gap"><h2>Запобіжники груп ${hint('Ліворуч — конверсія тестових сторінок проти контролю на кожній хвилі; бліді стовпці — прогноз, хвиля ще не пройдена. Праворуч — сторінки, які тягнуть групу вниз.')}</h2>${(S.gps || []).map(inGpGuard).join('')}</div>`;
}

/* ---------- Швидка смуга: діаграма послідовності ---------- */
function inHfSeq() {
  const lanes = ['Сканер + Citation', 'O2 + реєстр', 'O3', 'Координатор', 'Канали', 'Людина', 'Gateway', 'Тест REC-3'];
  const msgs = [[0, 1, 'ціна $49 ≠ ?', '00'], [1, 0, 'реєстр: $79 (Finance)', '03'], [1, 2, 'diff: 3 сторінки × price', '06'], [2, 3, 'лише поле з реєстру', '09'], [3, 7, 'пауза тесту', '10'], [3, 4, 'швидке погодження', '12'], [4, 3, 'ok × 3', '14'], [3, 5, 'одне рішення, SLA 1 год', '15'], [5, 6, 'застосувати', '27'], [6, 3, 'read-back ✓', '30'], [3, 7, 'rebase + нове вікно', '33']];
  const W = inFit(900), L = 20, cw = (W - 2 * L) / lanes.length, T = 40, rh = 26, H = T + msgs.length * rh + 20;
  const cx = i => L + cw * i + cw / 2;
  let s = inArrowDefs('in-sq') + lanes.map((l, i) => `<rect x="${cx(i) - cw / 2 + 4}" y="4" width="${cw - 8}" height="26" rx="6" style="fill:var(--act-soft)"/>` + inT(cx(i), 21, l, 'xs b', 'middle') + `<line x1="${cx(i)}" x2="${cx(i)}" y1="30" y2="${H - 6}" style="stroke:var(--line-2);stroke-dasharray:3 3"/>`).join('');
  msgs.forEach(([a, b, t, m], k) => { const y = T + k * rh + 8; s += `<line x1="${cx(a)}" x2="${cx(b) + (b > a ? -4 : 4)}" y1="${y}" y2="${y}" style="stroke:${b === 7 ? 'var(--hold)' : a === 5 ? 'var(--hold)' : 'var(--ink-2)'};stroke-width:1.5" marker-end="url(#in-sq)"/>` + inT((cx(a) + cx(b)) / 2, y - 4, t, 'xs', 'middle') + inT(6, y + 4, '+' + m, 'xs'); });
  return inSvg(W, H, 'Швидка смуга: послідовність повідомлень', s, 760) + `<p class="small muted" style="margin:8px 0 0">Хвилини від виявлення. Тест REC-3 не зупиняється назавжди: пауза, rebase на нову версію сторінки і нове вікно даних.</p>`;
}
function inHotfix(html) { return html + `<div class="panel sec-gap"><h2>Хто кому що передає ${hint('Діаграма послідовності: учасники зверху, час іде вниз.')}</h2>${inHfSeq()}</div>`; }

/* ---------- Агенти: зв’язки і джерела ---------- */
const IN_TARGETS = [
  ['SEO-оркестратор', /SEO-оркестратор/], ['PPC-оркестратор', /PPC-оркестратор/], ['AI Visibility-оркестратор', /AI Visibility-оркестратор/],
  ['Координатор сторінки', /Координатор сторінки/], ['Координатор групи', /Координатор групи/], ['Оркестратор кампаній', /Оркестратор кампаній/],
  ['Детектор аномалій', /Детектор аномалій/], ['O2 / O3', /\bO2\b|\bO3\b/], ['Тест-гейт', /Тест-гейт|тест-гейт/], ['Gateway', /Gateway/],
  ['Редактор', /[Рр]едактор|Editor/], ['Власник / lead', /Marketing lead|Owner|власник|людина|Автор/], ['Jira / розробка', /Jira|розробка/]
];
function inGraph() {
  const pods = S.pods.map(p => p[0]);
  const edges = new Map();
  S.pods.forEach(([pod, list]) => list.forEach(n => { const sp = AG_SPEC[n]; if (!sp) return; IN_TARGETS.forEach(([t, re]) => { if (re.test(sp.to)) { const k = pod + '→' + t; edges.set(k, (edges.get(k) || 0) + 1); } }); }));
  const tg = IN_TARGETS.map(t => t[0]).filter(t => [...edges.keys()].some(k => k.endsWith('→' + t)));
  const W = 900, rhL = 44, rhR = 30, H = Math.max(pods.length * rhL, tg.length * rhR) + 30, xl = 210, xr = 620;
  const yl = i => 24 + i * (H - 40) / Math.max(1, pods.length - 1) * (pods.length > 1 ? 1 : 0), yr = i => 24 + i * (H - 40) / Math.max(1, tg.length - 1);
  const pc = ['#3442A8', '#B86E00', '#1E8A6E', '#7B3FA0', '#2F7FC1', '#55607A', '#B9382A', '#8A6D1F', '#4A8F3A'];
  let s = '';
  [...edges.entries()].forEach(([k, v]) => { const [p, t] = k.split('→'); const i = pods.indexOf(p), j = tg.indexOf(t); if (i < 0 || j < 0) return;
    const gp = inTab('gPod', ''); s += `<path d="M${xl} ${yl(i)} C${(xl + xr) / 2} ${yl(i)} ${(xl + xr) / 2} ${yr(j)} ${xr} ${yr(j)}" style="fill:none;stroke:${pc[i % pc.length]};stroke-width:${1 + v * 1.4};opacity:${gp ? (gp === p ? .9 : .06) : .45}" data-hint="${esc(p)} → ${esc(t)}: ${v} агент(ів)"/>`; });
  pods.forEach((p, i) => { const n = S.pods[i][1].length; s += `<g class="hl" data-action="in-sel" data-id="gPod:${esc(p)}" data-hint="${esc(p)}: натисніть, щоб показати лише його потоки"><rect x="${xl - 190}" y="${yl(i) - 14}" width="180" height="28" rx="7" style="fill:${pc[i % pc.length]}"/>${inT(xl - 182, yl(i) + 5, esc(p) + ' · ' + n, 'w b')}</g><circle cx="${xl}" cy="${yl(i)}" r="4" style="fill:${pc[i % pc.length]}"/>`; });
  tg.forEach((t, j) => { const n = [...edges.entries()].filter(([k]) => k.endsWith('→' + t)).reduce((a, [, v]) => a + v, 0); s += `<circle cx="${xr}" cy="${yr(j)}" r="4" style="fill:var(--ink)"/><g><rect x="${xr + 10}" y="${yr(j) - 12}" width="220" height="24" rx="6" style="fill:var(--paper);stroke:var(--line-2)"/>${inT(xr + 18, yr(j) + 4, esc(t) + ` · ${n}`, 'b')}</g>`; });
  return inSvg(W, H, 'Кому агенти передають результат', s, 760) + `<p class="small muted" style="margin:8px 0 0">Побудовано з поля «Кому передає» паспортів агентів. Товщина лінії — кількість агентів. Натисніть на под ліворуч, щоб залишити лише його потоки. Видно, що більшість потоків сходиться на канальних оркестраторах і Координаторі: це місця, які треба масштабувати першими.</p>`;
}
const IN_SYS = [['GSC / Bing', /Search Console|GSC|Bing/], ['GA4 / BigQuery', /GA4|BigQuery|Amplitude|Hotjar/], ['Рекламні кабінети', /Google Ads|Microsoft Ads|LinkedIn|Meta|DSP|кабінет/], ['CMS', /CMS|Webflow|WordPress/], ['CRM', /CRM|HubSpot|Gong/], ['ESP', /ESP|HubSpot workflows|Postmaster/], ['AI-системи', /ChatGPT|Perplexity|AI-систем/], ['Jira', /Jira/], ['Реєстр фактів', /[Рр]еєстр фактів/], ['Docs / Gmail', /Google Docs|Gmail|Docs/], ['Реєстр ресурсів', /[Рр]еєстр ресурсів|[Рр]еєстр груп|Пакети змін|блокування/]];
function inSources() {
  const lvl = m => /запис|створює|Gateway|запуск/.test(m) ? 3 : /чернет|голос|коментар|повідом/.test(m) ? 2 : 1;
  const rows = S.pods.map(([pod, list]) => [pod, IN_SYS.map(([, re]) => { let best = 0, n = 0; list.forEach(a => { const sp = AG_SPEC[a]; if (!sp) return; AG_P(sp.src).forEach(([t, m]) => { if (re.test(t)) { n++; best = Math.max(best, lvl(m)); } }); }); return [best, n]; })]);
  const lab = ['', 'читання', 'чернетка', 'запис через Gateway'], cls = ['', 'r1', 'r2', 'r3'];
  return `<div class="tbl-wrap"><table class="in-src"><thead><tr><th>Под</th>${IN_SYS.map(s => `<th>${s[0]}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(([p, cells]) => `<tr><td><b>${esc(p)}</b></td>${cells.map(([b, n], i) => `<td>${b ? `<span class="in-acc ${cls[b]}" data-hint="${esc(p)} → ${IN_SYS[i][0]}: ${lab[b]}, агентів: ${n}">${n}</span>` : ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div><div class="legend"><span><i class="lg in-acc r1"></i>читання</span><span><i class="lg in-acc r2"></i>чернетка або голос</span><span><i class="lg in-acc r3"></i>запис лише через Gateway</span><span>Число — скільки агентів пода ходить у систему. Побудовано з паспортів.</span></div>`;
}
function inAgents(html) {
  const tab = inTab('agents', 'list');
  const head = inSeg('agents', [['list', 'Список і паспорти'], ['graph', 'Хто кому передає'], ['src', 'Куди ходять']], 'list', 'Погляд');
  if (tab === 'list') return head + '<div data-tour="agents-list">' + html + '</div>';
  return head + `<div class="panel" data-tour="agents-view">${tab === 'graph' ? `<h2>Хто кому передає результат</h2>${inGraph()}` : `<h2>Поди × системи</h2>${inSources()}`}</div>`;
}

/* ---------- Розклад: добова шкала і залежності ---------- */
function inCronChain(id, J) { const up = new Set([id]); let ch = true; while (ch) { ch = false; J.forEach(j => { if (up.has(j[0])) j[4].forEach(d => { if (!up.has(d)) { up.add(d); ch = true; } }); if (j[4].some(d => up.has(d)) && !up.has(j[0]) && j[0] !== id && inCronDown(id, J).includes(j[0])) { up.add(j[0]); ch = true; } }); } return [...up]; }
function inCronDown(id, J) { const out = new Set(); let ch = true; const seed = new Set([id]); while (ch) { ch = false; J.forEach(j => { if (!out.has(j[0]) && j[4].some(d => seed.has(d) || out.has(d))) { out.add(j[0]); ch = true; } }); } return [...out]; }
function inCronDay() {
  const mode = inTab('cron', 'time');
  const J = [['aiv', 'AI Visibility run', 4, 45, []], ['data', 'Збір даних', 5, 85, []], ['seo', 'SEO rank tracking', 6, 20, ['data']], ['anomaly', 'Пошук аномалій', 6.5, 15, ['data', 'seo']], ['news', 'News watch', 7, 10, []], ['testmon', 'Моніторинг тестів', 8, 15, ['data']], ['gate', 'Тест-гейт', 9, 20, ['testmon', 'aiv']]];
  const st = {}, en = {};
  J.forEach(([id, , h, dur, deps]) => { let s0 = h * 60; if (mode === 'deps') deps.forEach(d => { s0 = Math.max(s0, en[d] + 1); }); st[id] = s0; en[id] = s0 + dur; });
  const stale = id => mode === 'time' && J.find(j => j[0] === id)[4].some(d => st[id] < en[d]);
  const W = inFit(900), L = 170, R = 14, T = 26, rh = 30, H = T + J.length * rh + 52, h0 = 3, h1 = 12;
  const x = m => L + (m / 60 - h0) / (h1 - h0) * (W - L - R);
  let s = inArrowDefs('in-cr');
  for (let h = h0; h <= h1; h++) s += `<line x1="${x(h * 60)}" x2="${x(h * 60)}" y1="20" y2="${T + J.length * rh}" style="stroke:var(--line)"/>` + inT(x(h * 60), 14, String(h).padStart(2, '0') + ':00', '', 'middle');
  J.forEach(([id, name, , dur, deps], i) => { const y = T + i * rh, bad = stale(id);
    s += inT(L - 8, y + 18, name, bad ? 'b' : '', 'end', bad ? ' style="fill:var(--veto)"' : '');
    s += `<g class="hl${inTab('cronSel', '') && !inCronChain(inTab('cronSel', ''), J).includes(id) ? ' dim' : ''}" data-action="in-sel" data-id="cronSel:${id}" data-hint="${name}: ${String(Math.floor(st[id] / 60)).padStart(2, '0')}:${String(st[id] % 60).padStart(2, '0')}–${String(Math.floor(en[id] / 60)).padStart(2, '0')}:${String(en[id] % 60).padStart(2, '0')}${deps.length ? '\nпотребує: ' + deps.join(', ') : ''}${bad ? '\nстартував раніше, ніж закінчилась залежність: працює на вчорашніх даних' : ''}"><rect x="${x(st[id])}" y="${y + 6}" width="${Math.max(4, x(en[id]) - x(st[id]))}" height="18" rx="4" style="fill:${bad ? 'var(--veto)' : id === 'data' ? 'var(--hold)' : 'var(--act)'}"/></g>`;
    deps.forEach(d => { const j = J.findIndex(z => z[0] === d); s += `<path d="M${x(en[d])} ${T + j * rh + 15} C${x(en[d]) + 20} ${T + j * rh + 15} ${x(st[id]) - 20} ${y + 15} ${x(st[id]) - 2} ${y + 15}" style="fill:none;stroke:${stale(id) ? 'var(--veto)' : 'var(--ink-3)'};stroke-width:1.3" marker-end="url(#in-cr)"/>`; });
  });
  const y2 = T + J.length * rh + 16;
  s += inT(L - 8, y2 + 4, 'Щогодини: PPC pacing', '', 'end') + Array.from({ length: 10 }, (_, k) => `<rect x="${x((h0 + k) * 60)}" y="${y2 - 6}" width="5" height="14" rx="1" style="fill:#B86E00"/>`).join('');
  s += inT(L - 8, y2 + 26, 'Не щодня', '', 'end') + inT(L, y2 + 26, 'пн 09:00 SMM calendar · пн 10:00 Content engine · пт 16:00 Тижневий звіт · 1-ше 03:00 Tech SEO audit', 'xs');
  const bads = J.filter(j => stale(j[0])).map(j => j[1]);
  const cs = inTab('cronSel', ''), cj = J.find(j => j[0] === cs), cr = cs && S.crons.find(c => c.id === cs);
  const cdet = cj ? `<div class="in-det"><b>${cj[1]}</b> ${cr ? `<span class="chip">${cr.human}</span> <span class="chip">${cr.risk}</span>` : ''}<br><span class="small">${cr ? esc(cr.what) : ''}</span><br><span class="small muted">Потребує: ${cj[4].length ? cj[4].map(d => J.find(z => z[0] === d)[1]).join(', ') : 'нічого, стартує першим'} · від нього залежать: ${inCronDown(cs, J).map(d => J.find(z => z[0] === d)[1]).join(', ') || 'ніхто'}</span></div>` : '<p class="small muted" style="margin:8px 0 0">Натисніть на задачу — підсвітиться її ланцюжок залежностей.</p>';
  return `${inSeg('cron', [['time', 'Запуск за часом (зараз)'], ['deps', 'Запуск після успіху залежностей']], 'time', 'Режим')}
    ${inSvg(W, H, 'Добовий розклад кронів і залежності', s, 760)}${cdet}
    <div class="in-verdict ${bads.length ? 'harm' : 'pass'}"><b>${bads.length ? 'Ризик гонки' : 'Ланцюжок узгоджений'}</b> ${bads.length ? `Сьогодні збір даних тривав 85 хв замість 50. ${bads.join(', ')} ${bads.length > 1 ? 'стартували' : 'стартував'} за розкладом, ще до кінця збору, і ${bads.length > 1 ? 'працювали' : 'працював'} на вчорашніх даних. Перемкніть режим, щоб побачити запуск після успіху.` : 'Кожен крок стартує лише після успіху попереднього. Якщо збір даних запізнився, весь ланцюжок зсувається, а якщо впав — наступні кроки не стартують і приходить алерт.'}</div>`;
}
function inCrons(html) { return html + `<div class="panel sec-gap"><h2>Добова шкала ${hint('Фактична тривалість задач сьогодні. Стрілки — залежності: що чиї дані використовує.')}</h2>${inCronDay()}</div>`; }

/* ---------- Ролі: хто відповідає за рішення ---------- */
function inRaci() {
  const cols = ['Owner', 'Marketing lead', 'Channel manager', 'Project manager', 'Editor', 'Analyst', 'Власник факту'];
  const rows = [
    ['Зміна ключової сторінки (високий вплив)', 'I', 'A', 'R', 'I', 'C', 'C', ''],
    ['Зміна сторінки з низьким впливом', '', 'I', 'A', '', 'C', '', ''],
    ['Бюджет до $500 на тиждень', '', 'I', 'A', '', '', 'C', ''],
    ['Бюджет понад $500, нова кампанія', 'C', 'A', 'R', 'I', '', 'C', ''],
    ['Нова платформа або спосіб оплати', 'A', 'R', 'C', '', '', '', ''],
    ['Швидке виправлення ціни', 'A', 'R', 'I', 'I', '', '', 'C'],
    ['Значення факту в реєстрі', 'I', 'I', '', '', '', '', 'A'],
    ['Публікація статті, поста, листа', '', 'I', 'C', 'I', 'A', '', ''],
    ['Патова ситуація SEO проти PPC', 'A', 'R', 'C', 'I', '', 'C', ''],
    ['Реліз агента (промпт або модель)', 'A', 'C', 'C', '', '', 'R', ''],
    ['Аварійний вимикач', 'A', 'R', 'I', 'I', 'I', 'I', ''],
    ['Пропущений SLA апруву', 'I', 'A', 'R', 'R', '', '', '']
  ];
  const t = { R: 'виконує', A: 'відповідає і вирішує', C: 'радиться', I: 'інформується' };
  return `<div class="tbl-wrap"><table class="in-raci"><thead><tr><th>Рішення</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r[0]}</td>${r.slice(1).map((v, i) => `<td>${v ? `<span class="rc ${v}" data-hint="${cols[i]}: ${t[v]}">${v}</span>` : ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div><div class="legend">${Object.entries(t).map(([k, v]) => `<span><span class="rc ${k}">${k}</span> ${v}</span>`).join('')}<span>У кожного рішення рівно один A.</span></div>`;
}
function inEscal() {
  const st = [['Агент', 'пропонує', '—'], ['Оркестратор каналу', 'ok або заперечення', 'хвилини'], ['Координатор', 'компроміс ≤ 2 версії', '1 год'], ['Channel manager', 'рішення в каналі', 'SLA 24 год'], ['Marketing lead', 'конфлікт, понад ліміт', '+8 год'], ['Owner', 'свідомий ризик', '+24 год']];
  const W = 900, bw = 132, gap = (W - st.length * bw) / (st.length - 1), H = 96;
  let s = inArrowDefs('in-es');
  st.forEach((x, i) => { const x0 = i * (bw + gap); s += `<rect x="${x0}" y="14" width="${bw}" height="56" rx="9" style="fill:${i < 3 ? 'var(--act-soft)' : 'var(--hold-soft)'};stroke:${i < 3 ? 'var(--act)' : 'var(--hold)'}"/>` + inT(x0 + 8, 34, x[0], 'b xs') + inT(x0 + 8, 50, x[1], 'xs') + inT(x0 + 8, 64, x[2], 'xs muted');
    if (i < st.length - 1) s += `<line x1="${x0 + bw + 2}" x2="${x0 + bw + gap - 3}" y1="42" y2="42" style="stroke:var(--ink-2);stroke-width:1.5" marker-end="url(#in-es)"/>`; });
  s += inT(0, 90, 'Агенти й оркестратори ←', 'xs muted') + inT(W, 90, '→ люди: кожен крок має SLA, після нього PM нагадує, а потім рішення піднімається вище', 'xs muted', 'end');
  return inSvg(W, H, 'Ланцюжок ескалації', s, 760);
}
function inRoles(html) { return html + `<div class="panel sec-gap"><h2>Хто відповідає за рішення ${hint('Матриця для людей, а не агентів. R — робить, A — відповідає і має останнє слово, C — радиться, I — дізнається.')}</h2>${inRaci()}</div><div class="panel sec-gap"><h2>Ескалація ${hint('Що відбувається, якщо рішення не ухвалено вчасно або є конфлікт.')}</h2>${inEscal()}</div>`; }

/* ---------- Журнал: хронологія одного пакета ---------- */
function inAuditIds() {
  const ids = new Map();
  S.audit.forEach(a => (a.text.match(/\b(REC-\d+|GP-\d+|HF-\d+|CMP-\d+|MKT-\d+|AP-\d+|RL-\d+)\b/g) || []).forEach(m => ids.set(m, (ids.get(m) || 0) + 1)));
  return [...ids.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
function inAudit(html) {
  const ids = inAuditIds();
  if (!ids.length) return `<div class="panel" style="margin-bottom:16px"><h2>Хронологія пакета ${hint('Усе про один пакет в одному місці: хто запропонував, хто погодив, що сказали ворота, що записав Gateway.')}</h2><p class="empty">Запустіть приклад або симуляцію — тут з’явиться повна історія будь-якого пакета.</p></div>` + html;
  const id = ids.includes(inTab('audit', ids[0])) ? inTab('audit', ids[0]) : ids[0];
  const list = S.audit.filter(a => new RegExp('\\b' + id + '\\b').test(a.text)).slice().reverse();
  const col = { 'Людина': 'var(--hold)', 'Оркестратор': 'var(--act)', 'Агент': 'var(--ink-2)', 'Система': 'var(--ink-3)' };
  return `<div class="panel" style="margin-bottom:16px"><h2>Хронологія пакета ${hint('Усе про один пакет в одному місці. У продукті тут також версія промпту і модель кожного агента.')}</h2>
    ${inSeg('audit', ids.slice(0, 12).map(x => [x, x]), id, 'Пакет')}
    <ol class="in-tl">${list.map(a => `<li style="--c:${col[a.type] || 'var(--ink-3)'}"><time>${a.t}</time><b>${esc(a.who)}</b> <span class="chip">${a.type}</span><div class="small">${esc(a.text)}</div></li>`).join('')}</ol></div>` + html;
}

/* ---------- Аналітика: події на тижнях ---------- */
function inAnalytics(html) {
  if ((S.anTab || 'traffic') !== 'traffic' || typeof wdEvents !== 'function') return html;
  const E = wdEvents().filter(e => e.w0 <= 41).sort((a, b) => a.w0 - b.w0);
  return html + `<div class="panel sec-gap"><h2>Зовнішні події на графіку ${hint('Тижні з апдейтами, святами і збоями даних. Перш ніж шукати причину зміни на сайті, подивіться сюди.')}<button class="btn small sp" data-action="nav-to" data-screen="world">Календар подій</button></h2>
    <div class="in-wk">${E.map(e => `<div class="row small"><span class="chip">W${e.w0}${e.w1 !== e.w0 ? '–' + e.w1 : ''}</span><i class="lgd" style="background:${WD_KIND[e.kind][1]}"></i><span class="grow"><b>${esc(e.title)}</b> <span class="muted">· ${e.region === 'Global' ? 'усі ринки' : e.region} · ${esc(e.rule)}</span></span></div>`).join('')}</div></div>`;
}

/* ---------- Глосарій ---------- */
const IN_GLOSS = [
  ['Пакет', 'Одна узгоджена зміна ресурсу: що було, що стане, докази, тести. Його погоджують канали, перевіряють O2 і O3.'],
  ['Відбиток пакета', 'Хеш вмісту пакета. Погодження прив’язане до відбитка: змінили хоч слово — погодження недійсне.'],
  ['Ресурс і блокування', 'Сторінка, група сторінок, рекламна кампанія або сегмент розсилки. Один активний пакет на ресурс; блокування діє 48 год.'],
  ['Канальні оркестратори', 'SEO, PPC і AI Visibility. Кожен оцінює зміну зі свого боку і голосує ok або ні. Сам нічого не записує.'],
  ['Координатор сторінки', 'Власник ресурсу: тримає одну версію, шукає компроміс, вирішує, чи потрібна людина, запускає тест-гейт.'],
  ['O1, O2, O3', 'O1 планує, O2 перевіряє факти й докази, O3 — політики, бюджет і ліміти.'],
  ['Тест-гейт', 'A/B, SEO-тест і AI Visibility тест проти контролю. Шкода нижче −2 — відкат, виграш ≥ +2 — пройшов, інакше — немає висновку.'],
  ['Gateway', 'Єдиний компонент, який пише в зовнішні системи. Робить read-back і підтримує аварійний вимикач.'],
  ['R0–R3', 'Рівні ризику: ресерч, внутрішнє, публічне, гроші. Від рівня залежать ворота.'],
  ['Швидка смуга', 'Виправлення перевіреної помилки за хвилини: значення лише з реєстру фактів, одне поле, пріоритет над чергою.'],
  ['Група сторінок', 'Одне правило для сторінок одного шаблону. Тест 50/50, розгортання хвилями 10/50/100%.'],
  ['Rebase', 'Перенесення пакета на нову версію сторінки, якщо його поля не перетинаються зі зміною.'],
  ['Реєстр фактів', 'Єдине джерело цін, дат, цифр. Змінює лише власник факту; кожен факт має строк дії.'],
  ['Зовнішня подія', 'Апдейт пошуку, нова модель в AI-системі, свято, збій даних. Тест-гейт застосовує до неї правила.'],
  ['Еталонні кейси', 'Набір реальних задач, на яких перевіряють кожну зміну агента до релізу.'],
  ['Дрейф', 'Падіння якості агента без змін із нашого боку — наприклад, через зміну формату відповідей AI-системи.']
];
function inGlossary() {
  $('#modal-box').innerHTML = `<h2>Глосарій Orca9</h2><p class="small muted">Терміни, які зустрічаються на всіх екранах.</p><dl class="in-gl">${IN_GLOSS.map(g => `<dt>${g[0]}</dt><dd>${g[1]}</dd>`).join('')}</dl><div class="acts sec-gap"><button class="btn primary" data-action="close-modal">Закрити</button></div>`;
  openModal();
}

/* ---------- Ініціалізація ---------- */
function insightInit() {
  S.inTab = S.inTab || {};
  const W = (k, f) => { const o = VIEWS[k]; if (o) VIEWS[k] = function () { return f(o.apply(this, arguments)); }; };
  W('hud', inHud); W('approvals', inApprovals); W('recs', inRecs); W('aiv', inAiv); W('seo', inSeo); W('ppc', inPpc);
  W('cmps', inCmps); W('groups', inGroups); W('hotfix', inHotfix); W('agents', inAgents); W('crons', inCrons); W('roles', inRoles); W('audit', inAudit); W('analytics', inAnalytics);
  Object.assign(SCALE_ACTIONS, {
    'in-tab': id => { const i = id.indexOf(':'); S.inTab[id.slice(0, i)] = id.slice(i + 1); render(); },
    'in-gloss': inGlossary,
    'in-open': id => inOpen(id), 'in-sel': id => { const i = id.indexOf(':'); inSel(id.slice(0, i), id.slice(i + 1)); },
    'in-batch': () => { const list = pending().filter(a => canApprove(a) && a.risk === 'R2' && !a.land && !a.cmp); if (!list.length) { toast('Немає запитів для пакетного погодження у вашій ролі.'); return; } list.forEach(a => approve(a.id)); toast(`Погоджено пакетом: ${list.length}.`); }
  });
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('input', e => { if (e.target.id && e.target.id.startsWith('calc-')) inCalcUpdate(); });
  if (typeof window !== 'undefined' && window.addEventListener) { let t = 0; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => render(), 180); }); }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    /* ніколи не збільшувати графік більше ніж на 20% від його розміру: текст лишається читабельним на широких екранах */
    const fit = root => root.querySelectorAll('svg[viewBox]:not(.ico)').forEach(sv => { if (sv.dataset.fit) return; sv.dataset.fit = 1; const vb = sv.viewBox.baseVal; if (vb && vb.width > 60) { sv.style.maxWidth = Math.round(vb.width * 1.2) + 'px'; sv.style.marginLeft = 'auto'; sv.style.marginRight = 'auto'; } });
    ['view', 'modal-box'].forEach(id => { const el = document.getElementById(id); if (el) { fit(el); new MutationObserver(() => fit(el)).observe(el, { childList: true, subtree: true }); } });
  }
}
