/* Orca9 phases: «Фаза 1» (SEO + Контент + Координація) і «Повний план».
   Логіка пайплайна не розгалужується: реєстр напрямів (DIRS у orca9-page-control.js) визначає активні канали,
   тести і поди; екрани показують лише активне, а решту — бляклою або під плашкою «наступна фаза».
   Завантажується перед основним скриптом; phaseInit() викликається після insightInit(). */

const PH_KEY = 'orca9-phase';
const PH_NEEDS = {
  'PPC': ['Конектори Google Ads, LinkedIn Ads і Meta (спершу лише читання)', 'Власники бюджету і тижневі ліміти R3', 'PPC-оркестратор у погодженні сторінок', 'Еталонні кейси для 7 PPC-агентів'],
  'AI Visibility': ['Прогони промптів у 6 AI-системах (API або збір)', 'Промпт-сет від Prompt Research Agent', 'AI Visibility-оркестратор у погодженні сторінок', 'AI Visibility тест у тест-гейті'],
  'Аналітика': ['Сховище даних і контракти даних', 'Детектор аномалій і Аналізатор сезонності', 'Атрибуція і тижневий звіт'],
  'Контроль якості': ['Еталонні кейси для агентів фази 1', 'Регресійний контролер на окремій моделі', 'Щоденна вибірка відповідей і поріг дрейфу'],
  'Групи сторінок': ['Шаблони сторінок і групи в CMS', 'Хвилі 10/50/100% і запобіжники по сторінках', 'Погодження правила всіма активними каналами'],
  'Кампанії': ['Оркестратор кампаній і граф залежностей', 'Напрями Email і SMM для пакетів листів і постів', 'Резервування ресурсів під дедлайн'],
  'SMM': ['Акаунти LinkedIn, X, Reddit з правами чернетки', 'Редактор як затверджувач публікацій'],
  'Email': ['ESP (HubSpot) і сегменти', 'Ліміти частоти й відписки', 'Тестова розсилка перед кожною відправкою']
};
function phLoad() {
  try {
    const raw = localStorage.getItem(PH_KEY);
    if (raw === null) { PHASE.mode = 'p1'; return; }
    const v = JSON.parse(raw); PHASE.mode = v.mode === 'full' ? 'full' : 'p1'; PHASE.extra = Array.isArray(v.extra) ? v.extra.filter(k => DIRS[k]) : [];
  } catch (e) { /* без localStorage — повний план */ }
}
function phSave() { try { localStorage.setItem(PH_KEY, JSON.stringify({ mode: PHASE.mode, extra: PHASE.extra })); } catch (e) {} }
const phP1 = () => PHASE.mode !== 'full';

/* Показ лише активного: на час рендера списки підміняються відфільтрованими копіями й одразу повертаються. */
function phScope(fn) {
  if (!phP1()) return fn();
  const keep = { recs: S.recs, pipelines: S.pipelines, approvals: S.approvals, gps: S.gps, pods: S.pods, cmps: S.cmps };
  S.recs = keep.recs.filter(r => podOn(r.pod));
  S.pipelines = keep.pipelines.filter(p => chOn(p.ch));
  S.approvals = keep.approvals.filter(a => chOn(a.ch) && (!a.cmp || dirOn('Кампанії'))).map(a => a.xr ? { ...a, xr: a.xr.filter(x => !CHANNEL_ALL.includes(x) || CHANNEL_OWNERS.includes(x)) } : a);
  S.gps = dirOn('Групи сторінок') ? (keep.gps || []).filter(g => podOn(g.pod)) : [];
  S.pods = keep.pods.filter(p => podOn(p[0]));
  S.cmps = dirOn('Кампанії') ? keep.cmps : [];
  try { return fn(); } finally { Object.assign(S, keep); }
}
function phHidden(kinds) {
  if (!phP1()) return [];
  const H = [];
  if (kinds.includes('recs')) S.recs.filter(r => !podOn(r.pod)).forEach(r => H.push([r.id, r.title, dirOfPod(r.pod)]));
  if (kinds.includes('pipelines')) S.pipelines.filter(p => !chOn(p.ch)).forEach(p => H.push([p.id, p.title, dirOfCh(p.ch)]));
  if (kinds.includes('approvals')) S.approvals.filter(a => a.status === 'pending' && (!chOn(a.ch) || (a.cmp && !dirOn('Кампанії')))).forEach(a => H.push([a.id, a.title, a.cmp ? 'Кампанії' : dirOfCh(a.ch)]));
  return H;
}
function phFold(kinds) {
  const H = phHidden(kinds); if (!H.length) return '';
  const open = !!S.phShowHidden, dirs = [...new Set(H.map(h => h[2]))];
  return `<div class="ph-fold"><span>◌ Ще ${H.length} ${H.length === 1 ? 'елемент' : H.length < 5 ? 'елементи' : 'елементів'} наступних фаз приховано: ${dirs.map(esc).join(', ')}. Вони не беруть участі в погодженнях і тестах.</span><button class="btn small" data-action="ph-hidden">${open ? 'сховати' : 'показати бляклими'}</button></div>
    ${open ? `<div class="panel ph-ghost" style="margin-bottom:16px">${H.map(h => `<div class="row"><span class="grow"><b>${h[0]}</b> ${esc(h[1])}</span><span class="chip ph">${esc(h[2])} · фаза ${DIRS[h[2]] ? DIRS[h[2]].phase : 2}</span></div>`).join('')}</div>` : ''}`;
}
function phLaterPods() {
  const later = S.pods.filter(p => !podOn(p[0]));
  if (!later.length) return '';
  return `<div class="panel sec-gap"><h2>Наступні фази <span class="chip ph">згорнуто</span> ${hint('Паспорти агентів уже готові: їх можна відкрити й переглянути. У погодженнях і тестах ці агенти не беруть участі, доки напрям не підключено.')}</h2>
    <div class="grid g2">${later.map(([pod, list]) => { const d = dirOfPod(pod); return `<div class="pod ph-later-pod"><h3>${esc(pod)} <span class="chip ph">фаза ${DIRS[d].phase}</span><span class="chip">${list.length} агентів</span></h3>
      <div class="small muted" style="margin-bottom:6px">${esc(DIRS[d].what)}</div>
      <div class="ph-agents">${list.map(n => `<button class="lnk small" data-action="ag-open" data-id="${esc(n)}">${esc(n.replace(' (новий)', ''))}</button>`).join(' · ')}</div>
      <div class="acts" style="margin-top:8px"><button class="btn small" data-action="ph-connect" data-id="${esc(d)}">Підключити достроково</button></div></div>`; }).join('')}</div></div>`;
}
function phLocked(k, render0) {
  const d = dirOfScreen(k), D = DIRS[d], peek = S.phPeek === k;
  const under = `<div class="ph-under${peek ? ' peek' : ''}" aria-hidden="${!peek}">${render0()}</div>`;
  if (peek) return `<div class="ph-peekbar"><span><b>Перегляд екрана фази ${D.phase}.</b> Дії вимкнені: напрям ${esc(d)} ще не бере участі в роботі.</span><button class="btn small" data-action="ph-peek" data-id="">Закрити перегляд</button><button class="btn small primary" data-action="ph-connect" data-id="${esc(d)}">Підключити ${esc(d)} зараз</button></div>${under}`;
  return `<div class="ph-lockwrap">${under}<div class="ph-lock"><div class="ph-card"><span class="chip ph">Фаза ${D.phase} · не підключено</span>
    <h3>${esc(TITLES[k] || d)} з’явиться у фазі ${D.phase}</h3>
    <p>Екран лишається в меню, щоб план не загубився. Напрям: ${esc(D.what)}. Що потрібно, щоб увімкнути:</p>
    <ul>${(PH_NEEDS[d] || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="acts"><button class="btn primary" data-action="nav-to" data-screen="roadmap">Дорожня карта</button><button class="btn" data-action="ph-peek" data-id="${k}">Подивитися екран</button><button class="btn" data-action="ph-connect" data-id="${esc(d)}">Підключити достроково</button></div></div></div></div>`;
}
function phPatch(k, html) {
  [['SEO, PPC та AI Visibility погоджують свої вимоги', 'SEO-оркестратор погоджує вимоги каналу (PPC і AI Visibility підключаються у фазі 2)'],
   ['Оркестратори SEO, PPC та AI Visibility оцінюють одну версію', 'SEO-оркестратор оцінює одну версію (PPC і AI Visibility — фаза 2)'],
   ['SEO, PPC і AI Visibility погоджують свої вимоги', 'SEO-оркестратор погоджує вимоги каналу (PPC і AI Visibility — фаза 2)']].forEach(([a, b]) => { html = html.split(a).join(b); });
  if (k === 'hud') {
    html = html.replace('<div class="metric"><div class="lbl">Бюджет PPC, тиждень', `<div class="metric ph-ghost"><div class="lbl"><span class="chip ph">фаза ${DIRS.PPC.phase}</span> Бюджет PPC, тиждень`);
    const f = phFold(['pipelines', 'approvals', 'recs']); const a = '<div class="panel sec-gap" data-tour="score">';
    return f ? (html.includes(a) ? html.replace(a, f + a) : html + f) : html;
  }
  if (k === 'recs') { const f = phFold(['recs']); const a = '<div class="acts sec-gap"><button class="btn" data-action="page-queue">'; return html.includes(a) ? html.replace(a, f + a) : f + html; }
  if (k === 'approvals') return phFold(['approvals']) + html;
  if (k === 'seo') return html + phFold(['pipelines']);
  if (k === 'agents' && (!S.inTab || !S.inTab.agents || S.inTab.agents === 'list')) return html + phLaterPods();
  return html;
}

/* ---------- Дорожня карта ---------- */
function phRoadmap() {
  const allPods = S.pods;
  const agentsOf = d => DIRS[d].pods.reduce((t, p) => t + ((allPods.find(x => x[0] === p) || [0, []])[1].length), 0);
  const st = d => DIRS[d].phase === 1 ? ['працює', 'ok'] : !phP1() ? ['працює (повний план)', 'act'] : PHASE.extra.includes(d) ? ['підключено достроково', 'act'] : ['чекає фази', 'ph'];
  const col = ph => { const ds = Object.keys(DIRS).filter(d => DIRS[d].phase === ph); const n = ds.reduce((t, d) => t + agentsOf(d), 0);
    return `<div class="ph-col${ph === 1 ? ' now' : ''}"><span class="chip ${ph === 1 ? 'act' : 'ph'}">${ph === 1 ? 'зараз' : ph === 2 ? 'далі' : 'потім'}</span><h3>Фаза ${ph}</h3><p class="small muted">${ph === 1 ? 'SEO і контент через один контур: Координатор, O2, O3, тест-гейт, Gateway' : ph === 2 ? 'Гроші, цитування в AI, аналітика, групи сторінок, контроль якості' : 'Повний оркестр: кампанії, соцмережі, розсилки'} · агентів: ${n}</p>
      ${ds.map(d => { const s = st(d); return `<div class="ph-dir"><div class="grow"><b>${esc(d)}</b> <span class="chip ${s[1]}">${s[0]}</span><br><span class="small muted">${esc(DIRS[d].what)}${agentsOf(d) ? ` · ${agentsOf(d)} агентів` : ''}${DIRS[d].channel ? ' · канал погодження' : ''}${DIRS[d].test ? ` · ${DIRS[d].test}` : ''}</span></div>${ph > 1 && phP1() ? `<button class="btn small" data-action="ph-connect" data-id="${esc(d)}">${PHASE.extra.includes(d) ? 'Відключити' : 'Підключити'}</button>` : ''}</div>`; }).join('')}</div>`; };
  return `${intro('<b>Дорожня карта.</b> Розробку починаємо з фази 1: SEO, Контент і Координація. Інші напрями вже описані — агенти мають паспорти, екрани є в меню, — але не беруть участі в погодженнях і тестах, доки напрям не підключено. Підключення — один запис у реєстрі напрямів: канал, тест, поди й екрани вмикаються разом, без змін у логіці пайплайна.')}
    <div class="ph-mode-big"><span>Режим демо:</span><button data-action="ph-mode" data-id="p1" class="${phP1() ? 'on' : ''}">Фаза 1: SEO + Контент</button><button data-action="ph-mode" data-id="full" class="${phP1() ? '' : 'on'}">Повний план</button></div>
    <div class="ph-road" data-tour="road">${[1, 2, 3].map(col).join('')}</div>
    <div class="grid g2 sec-gap">
      ${rights('Що змінюється в логіці у фазі 1', [
        ['Погодження', 'Пакет сторінки погоджує SEO-оркестратор', 'PPC і AI Visibility на пакеті позначені «не підключено»'],
        ['Тест-гейт', 'A/B тест і SEO-тест', 'AI Visibility тест вимкнено; правило шкоди й виграшу те саме'],
        ['Людина', 'Високий вплив, низька впевненість, конфлікт', 'Editor або Channel manager, як і раніше'],
        ['Платформа', 'Координатор, блокування, черга, O2, O3, Gateway', 'працюють повністю'],
        ['Платформа', 'Реєстр фактів, Світ і події, швидка смуга', 'працюють повністю'],
        ['Відкладено', 'Рекомендації і задачі авторів з інших напрямів', 'видно бляклими, у роботу не йдуть']
      ], 'Ті самі функції пайплайна працюють в обох режимах. Різниця лише в тому, які канали і тести активні.')}
      <div class="panel"><h2>Як підключити новий напрям ${hint('Контракт напряму. Так само пізніше додаються й зовсім нові напрями, яких ще немає в плані.')}</h2>
        <ol class="ph-steps"><li><b>Запис у реєстрі напрямів</b><span>фаза, поди, канал погодження, тест, екрани</span></li>
          <li><b>Под агентів із паспортами</b><span>тригер, джерела, права, вихід, кому передає</span></li>
          <li><b>Канальний оркестратор</b><span>голосує за одну версію пакета; без права запису</span></li>
          <li><b>Свій тест у тест-гейті</b><span>необов’язково; оцінюється тим самим правилом</span></li>
          <li><b>Конектори і права Gateway</b><span>спершу лише читання, запис — після еталонів</span></li>
          <li><b>Еталонні кейси</b><span>агенти напряму проходять Регресійний контролер</span></li>
          <li><b>Ролі і ліміти</b><span>хто затверджує, ліміти R3 для грошей</span></li></ol>
<pre class="ph-pre">DIRS['PPC'] = {
  phase: 2, pods: ['PPC'],
  channel: 'PPC',            // голос у пакеті сторінки
  test: null,                // свій тест у тест-гейті, якщо є
  screens: ['ppc']
}</pre></div>
    </div>`;
}

/* ---------- Тур для фази 1 ---------- */
let TOUR_FULL = null;
function phTourP1() {
  const base = TOUR_FULL.filter(s => screenOn(s.screen) && !String(s.sel || '').includes('REC-3'));
  const out = [];
  base.forEach((s, i) => {
    out.push(s);
    if (i === 0) out.push({ screen: 'hud', sel: '[data-tour=phase-mode]', h: 'Фаза 1: SEO + Контент', p: 'Розробку починаємо з SEO, Контенту і Координації. Інші напрями лишаються в меню бляклими з міткою фази: їх видно, але вони не беруть участі в погодженнях і тестах. Перемикач повертає повний план одним кліком.' });
    if (s.sel === '[data-tour=page-control]') {
      out.push({ screen: 'recs', sel: '#rec-REC-7', h: 'Пакет контенту у фазі 1', p: 'REC-7: кейс клієнта на /customers. Пакет погоджує SEO-оркестратор; PPC і AI Visibility показані як «не підключено». Високий вплив, тож далі — людина. Цифра береться з реєстру фактів.' });
      out.push({ screen: 'recs', sel: '#rec-REC-6', h: 'Низький вплив — авто-смуга', p: 'REC-6: розділ і FAQ у статті. SEO погодив, вплив низький — Координатор сам дає дозвіл на тест. Тест-гейт рахує A/B і SEO-тест; AI Visibility тест вимкнено до фази 2.' });
    }
  });
  out.push({ screen: 'roadmap', sel: '[data-tour=road]', h: 'Дорожня карта', p: 'Три фази й усі напрями. Будь-який напрям можна підключити достроково: його канал, тест, поди й екрани вмикаються разом, без змін у логіці пайплайна. Внизу — контракт підключення нового напряму.' });
  out.push({ screen: 'recs', sel: '#rec-REC-7', h: 'Спробуйте сценарій фази 1', p: 'REC-7: «Узгодити єдиний пакет» → дозволити тест → три тижні → розгорнути. REC-6 пройде сам. Архітектура з таким самим перемикачем фаз — посилання внизу меню.' });
  return out;
}
function phTour() {
  if (typeof TOUR === 'undefined') return;
  if (!TOUR_FULL) TOUR_FULL = TOUR.slice();
  const list = phP1() ? phTourP1() : TOUR_FULL;
  TOUR.length = 0; list.forEach(x => TOUR.push(x));
}

/* ---------- Перемикання ---------- */
function phSet(mode) {
  if (PHASE.mode === mode) return;
  PHASE.mode = mode; syncChannels(); phTour(); phSave(); S.phPeek = null;
  ev('h', ROLES[S.role].name, mode === 'p1' ? 'увімкнув режим «Фаза 1: SEO + Контент»: активні канали — ' + CHANNEL_OWNERS.join(', ') : 'увімкнув повний план: активні канали — ' + CHANNEL_OWNERS.join(', '));
  toast(mode === 'p1' ? 'Фаза 1: працюють SEO, Контент і Координація.' : 'Повний план: усі напрями активні.');
  render();
}
function phConnect(d) {
  if (!DIRS[d] || DIRS[d].phase === 1) return;
  if (!phP1()) { toast('У повному плані всі напрями вже активні.'); return; }
  const on = PHASE.extra.includes(d);
  PHASE.extra = on ? PHASE.extra.filter(x => x !== d) : [...PHASE.extra, d];
  syncChannels(); phTour(); phSave(); S.phPeek = null;
  ev('h', ROLES[S.role].name, `${on ? 'відключив' : 'підключив достроково'} напрям ${d}; активні канали погодження: ${CHANNEL_OWNERS.join(', ')}`);
  toast(on ? `${d} відключено.` : `${d} підключено: нові пакети проходитимуть і його.`);
  render();
}
function phDecor() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.nav[data-screen]').forEach(b => {
    const d = dirOfScreen(b.dataset.screen), off = phP1() && d && !dirOn(d);
    b.classList.toggle('ph-later', !!off);
    let t = b.querySelector('.ph-badge');
    if (off) { if (!t) { t = document.createElement('span'); t.className = 'ph-badge'; b.appendChild(t); } t.textContent = 'фаза ' + DIRS[d].phase; }
    else if (t) t.remove();
  });
  document.querySelectorAll('[data-action="ph-mode"]').forEach(b => b.classList.toggle('on', b.dataset.id === PHASE.mode));
  const el = document.getElementById('phase-strip');
  if (el) {
    const html = phP1() ? `<span class="ps-l">Фаза 1</span><span>Працюють SEO, Контент і Координація${PHASE.extra.length ? ` + достроково: ${PHASE.extra.map(esc).join(', ')}` : ''}. Канали погодження: ${CHANNEL_OWNERS.join(', ')}. Інші напрями бляклі — видно, але не в роботі.</span><button class="lnk" data-action="nav-to" data-screen="roadmap">Дорожня карта →</button>` : '';
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; el.hidden = !html; }
  }
}

/* ---------- Ініціалізація ---------- */
function phaseInit() {
  phLoad(); syncChannels();
  /* приклади фази 1: SEO і Контент */
  if (!S.recs.some(r => r.id === 'REC-6')) S.recs.push(
    { id: 'REC-6', page: '/blog/cfo-dashboard', pod: 'SEO', agent: 'Content Optimizer', imp: 'low', impWhy: 'стаття блогу, 4% органіки', conf: 86,
      title: 'Розділ «Шаблон для SaaS» і 4 FAQ у статті про CFO-дашборд',
      why: 'Кліки −22% за 4 тижні. Топ-3 конкурентів мають розділ із шаблоном. Пропозиція не чіпає H1 і title.',
      before: 'Стаття без шаблону і без FAQ.', after: 'Новий розділ «Шаблон CFO-дашборду для SaaS» і 4 FAQ зі schema.org. H1 і title без змін.',
      patch: { details: 'Розділ «Шаблон CFO-дашборду для SaaS» і 4 FAQ зі schema.org. H1 і title без змін.' },
      rv: { SEO: ['ok', 'H1 і title збережено, розділ додає long-tail запити'], PPC: ['ok', 'сторінка не в рекламі'], 'AI Visibility': ['ok', 'FAQ корисний для цитування'] },
      tests: [['A/B тест', 1.2, 'клік на шаблон'], ['SEO-тест', 5, 'кліки до контролю'], ['AI Visibility тест', 4, 'цитування, п. на 40 промптах']], status: 'new' },
    { id: 'REC-7', page: '/customers', pod: 'Контент', agent: 'Case Study Producer', imp: 'high', impWhy: 'сторінка кейсів веде 9% запитів на демо', conf: 79,
      title: 'Кейс Northwind на /customers із цифрою з реєстру фактів',
      why: 'Сторінка кейсів має лише логотипи. Клієнти на дзвінках питають про реальний результат. Цифра «з 6 до 2 днів» є в реєстрі фактів (result.close_days), клієнт погодив текст.',
      before: 'Список логотипів без історій і цифр.', after: 'Кейс Northwind: закриття місяця з 6 до 2 днів, цитата CFO, CTA «Переглянути демо».',
      patch: { details: 'Кейс Northwind: закриття місяця з 6 до 2 днів (факт result.close_days), цитата CFO, CTA «Переглянути демо».' },
      rv: { SEO: ['ok', 'нова секція з ключем «month end close», H1 без змін'], PPC: ['ok', 'посадкові сторінки реклами не зачеплено'], 'AI Visibility': ['ok', 'цифра з джерелом підходить для цитування'] },
      tests: [['A/B тест', 3.4, 'запит демо'], ['SEO-тест', 2.1, 'кліки до контролю'], ['AI Visibility тест', 6, 'цитування, п. на 40 промптах']], status: 'new' });
  Object.assign(TITLES, { roadmap: 'Дорожня карта' });
  VIEWS.roadmap = phRoadmap;
  Object.keys(VIEWS).forEach(k => {
    if (k === 'roadmap' || k === 'analyticsAnom') return;
    const o = VIEWS[k];
    VIEWS[k] = function () {
      if (!phP1()) return o.apply(this, arguments);
      if (!screenOn(k)) return phLocked(k, () => o.apply(this, arguments));
      return phPatch(k, phScope(() => o.apply(this, arguments)));
    };
  });
  const oc = counts; counts = function () { phScope(() => oc.apply(this, arguments)); phDecor(); };
  /* дії інших напрямів у фазі 1 не стартують */
  const orv = reviewRec; reviewRec = function (r) {
    if (r && !podOn(r.pod)) { const d = dirOfPod(r.pod); ev('', 'Координатор сторінки', `${r.id}: напрям ${d} ще не підключено (фаза ${DIRS[d].phase}); пакет не береться в роботу`); return Promise.resolve(); }
    return orv.apply(this, arguments);
  };
  const ocr = cmpRun; cmpRun = function (c) {
    if (!dirOn('Кампанії')) { ev('', 'Orca9', `${c && c.id || 'Кампанія'}: оркестратор кампаній — фаза ${DIRS['Кампанії'].phase}; пропущено`); return; }
    return ocr.apply(this, arguments);
  };
  if (typeof ppcAlert === 'function') { const opa = ppcAlert; ppcAlert = function () {
    if (!dirOn('PPC')) { const r = S.recs.find(x => x.id === 'REC-6' && x.status === 'new'); ev('', 'Orca9', 'фаза 1: PPC pacing не працює — напрям не підключено'); if (r) { ev('o', 'Content Optimizer', 'REC-6: пакет для /blog/cfo-dashboard подано Координатору сторінки'); reviewRec(r); } return; }
    return opa.apply(this, arguments);
  }; }
  if (typeof EX !== 'undefined' && EX['rec-all']) { const ra = EX['rec-all']; EX['rec-all'] = () => phScope(ra); }
  Object.assign(SCALE_ACTIONS, {
    'ph-mode': id => phSet(id === 'full' ? 'full' : 'p1'),
    'ph-connect': id => phConnect(id),
    'ph-peek': id => { S.phPeek = id || null; render(); },
    'ph-hidden': () => { S.phShowHidden = !S.phShowHidden; render(); }
  });
  phTour();
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', e => { if (e.key === PH_KEY) { phLoad(); syncChannels(); phTour(); render(); } });
}
