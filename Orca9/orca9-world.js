/* Orca9 control layer: fact registry, external events by country, agent quality control.
   Prototype only: fixed demo dates, no real external calls. Loaded before the main script; worldInit() runs after scaleInit(). */

const WD_TODAY = new Date('2026-10-13T12:00:00Z');
const WD_NOW_W = 42;                 // поточний тиждень (дані повні до W41)
const WD_WEEKS = [39, 40, 41, 42, 43, 44, 45, 46, 47, 48];
const wdDays = iso => Math.round((WD_TODAY - new Date(iso + 'T12:00:00Z')) / 864e5);
const wdDate = iso => iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4);

/* ================= Реєстр фактів ================= */
const FR_ST = { ok: ['актуальний', 'ok'], soon: ['перевірити скоро', 'warn'], expired: ['термін вийшов', 'bad'], conflict: ['розбіжність із джерелом', 'bad'] };
function frStatus(f) {
  if (f.srcVal && f.srcVal !== f.value) return 'conflict';
  const age = wdDays(f.ver);
  if (age > f.ttl) return 'expired';
  if (age > f.ttl * 0.8) return 'soon';
  return 'ok';
}
function frSite(f) {
  if (f.key === 'price.smart_reports') return (S.hotfixes?.[0]?.status === 'done') ? 'ok' : 'mismatch';
  if (f.key === 'trial.days' && S.frTrial === 'approved') return 'updating';
  if (f.key === 'trial.days' && S.frTrial === 'done') return 'ok';
  if (f.key === 'trial.days' && S.frTrial === 'conflict') return 'old';
  return 'ok';
}
function frSyncFacts() { S.facts = S.factReg.map(f => [f.key, f.value, f.src, f.owner]); }
function frRegistry() {
  const PRICE = GROUPS['G-PRICE'] ? GROUPS['G-PRICE'].members : [];
  return [
    { key: 'price.smart_reports', value: 'Smart Reports: від $79/міс', src: 'billing-system, 01.10.2026', sys: 'Білінг', owner: 'Finance', ver: '2026-10-01', ttl: 30, pages: PRICE,
      ai: 'mismatch', aiNote: 'Perplexity цитує «від $49/міс» зі старої версії /pricing', uses: 'G-PRICE, PPC-оголошення, листи CMP-482' },
    { key: 'price.pricing_analytics', value: 'Pricing Analytics: від $129/міс', src: 'billing-system, 01.10.2026', sys: 'Білінг', owner: 'Finance', ver: '2026-10-01', ttl: 30, pages: ['/pricing', '/pricing-analytics', '/compare/baremetrics'],
      ai: 'ok', aiNote: 'AI-системи не називають ціну або називають правильно', uses: 'сторінки ціни' },
    { key: 'trial.days', value: 'Пробний період 14 днів', src: 'billing-system, 15.09.2026', sys: 'Білінг', owner: 'Finance', ver: '2026-09-15', ttl: 30,
      pages: ['/pricing', '/smart-reports', '/signup', '/features/forecasting', '/features/cohorts', '/features/billing'],
      ai: 'ok', aiNote: '«14 днів» — збігається з реєстром', uses: 'CTA, листи онбордингу, оголошення' },
    { key: 'integration.quickbooks', value: 'Інтеграція QuickBooks доступна з березня 2026', src: 'changelog #412', sys: 'Changelog', owner: 'Product', ver: '2026-09-20', ttl: 90, pages: ['/integrations/quickbooks', '/integrations'],
      ai: 'stale', aiNote: 'ChatGPT і Gemini: «інтеграції немає» (огляд на G2 за 2024 рік)', rec: 'REC-4', uses: 'G-INTEG, AI Visibility' },
    { key: 'integration.xero', value: 'Інтеграція Xero доступна з січня 2025', src: 'changelog #298', sys: 'Changelog', owner: 'Product', ver: '2026-09-20', ttl: 90, pages: ['/integrations/xero'],
      ai: 'ok', aiNote: 'Згадується правильно', uses: 'G-INTEG' },
    { key: 'customers.count', value: '1 200+ компаній', src: 'CRM, 30.09.2026', sys: 'CRM', owner: 'RevOps', ver: '2026-09-30', ttl: 30, pages: ['/', '/about', '/customers'],
      ai: 'ok', aiNote: 'Не згадується в AI-відповідях', uses: 'головна, кейси, пости' },
    { key: 'result.close_days', value: 'Клієнти скорочують закриття місяця з 6 до 2 днів', src: 'опитування 120 клієнтів, Q3 2026', sys: 'Дослідження', owner: 'Marketing', ver: '2026-10-02', ttl: 180, pages: ['/smart-reports', '/blog/finance-close'],
      ai: 'none', aiNote: 'AI-системи ще не знають цю цифру', uses: 'CMP-482: статті, листи, лендинг' },
    { key: 'sla.uptime', value: '99,9% доступності за 12 місяців', src: 'status page, 05.07.2026', sys: 'Status page', owner: 'Engineering', ver: '2026-07-05', ttl: 90, pages: ['/security', '/enterprise'],
      ai: 'ok', aiNote: 'Не згадується', uses: 'enterprise-сторінки, тендерні відповіді' },
    { key: 'security.soc2', value: 'SOC 2 Type II', src: 'аудиторський звіт, березень 2026', sys: 'Legal', owner: 'Legal', ver: '2026-03-20', ttl: 365, pages: ['/security', '/enterprise', '/pricing'],
      ai: 'ok', aiNote: 'Згадується правильно', uses: 'безпека, enterprise' },
    { key: 'icp.size', value: 'Для SaaS-компаній на 50–500 людей', src: 'brand-context.md', sys: 'Бренд', owner: 'Marketing', ver: '2026-08-01', ttl: 180, pages: ['/', '/about'],
      ai: 'ok', aiNote: 'Усі шість AI-систем кажуть правильно', uses: 'усі агенти як контекст' }
  ];
}
const frFind = k => S.factReg.find(f => f.key === k);
function frSyncRun() {
  if (S.frTrial) { toast('Синхронізацію вже виконано сьогодні.'); return; }
  const f = frFind('trial.days');
  f.srcVal = 'Пробний період 21 день'; S.frTrial = 'conflict';
  ev('', 'Синхронізація реєстру', 'щоденна звірка з білінгом, changelog, CRM і status page: 9 фактів збігаються, 1 розбіжність');
  ev('warn', 'Синхронізація реєстру', 'trial.days: у білінгу з 12.10 — 21 день, у реєстрі — 14 днів. Нове значення не застосовано: потрібне рішення власника (Finance)');
  slack('<b>Реєстр фактів</b>: білінг каже «пробний період 21 день», реєстр — «14 днів». Поки власник не підтвердить, O2 не пропускає нові тексти з цим фактом.', [{ label: 'Відкрити реєстр', action: 'nav-to', screen: 'facts', primary: true }]);
  render();
}
async function frApproveTrial() {
  if (S.frTrial !== 'conflict') return;
  if (!['owner', 'lead'].includes(S.role)) { toast('Значення факту підтверджує його власник (у демо — Owner або Marketing lead).'); return; }
  const f = frFind('trial.days');
  f.hist = [...(f.hist || []), { t: '13.10.2026', from: f.value, to: f.srcVal, who: ROLES[S.role].name }];
  f.value = f.srcVal; f.ver = '2026-10-13'; f.src = 'billing-system, 13.10.2026'; S.frTrial = 'approved'; frSyncFacts();
  ev('h', ROLES[S.role].name, 'підтвердив нове значення trial.days: 21 день (версія 2)');
  ev('o', 'Сканер сторінок', `trial.days: знайдено ${f.pages.length} сторінок зі старим «14 днів»; пакет іде швидкою смугою — одне поле, значення з реєстру`);
  render(); await wait(700);
  for (const ch of CHANNEL_OWNERS) ev('ok', `${ch}-оркестратор`, 'trial.days: швидке погодження — значення з реєстру');
  ev('ok', 'Gateway', `trial.days: ${f.pages.length} сторінок оновлено; read-back ✓`);
  ev('', 'Email Lifecycle Architect', 'trial.days: 2 листи онбордингу оновлено в чернетках; відправка — після апруву Editor');
  ev('', 'Citation Analyst', 'trial.days: перевірка AI-відповідей запланована через 7 і 14 днів');
  S.frTrial = 'done'; render();
}
function frReverify(key) {
  const f = frFind(key); if (!f) return;
  if (!['owner', 'lead'].includes(S.role)) { toast('Перевірку факту підтверджує власник (у демо — Owner або Marketing lead).'); return; }
  f.ver = '2026-10-13'; f.src = f.src.replace(/, \d\d\.\d\d\.\d{4}$/, '') + ', 13.10.2026';
  ev('h', ROLES[S.role].name, `${key}: факт перевірено зі status page, значення без змін; строк дії оновлено`);
  frSyncFacts(); render();
}
function frDetail(key) {
  const f = frFind(key); if (!f) return;
  const st = frStatus(f), site = frSite(f);
  $('#modal-box').innerHTML = `<h2><code>${esc(f.key)}</code></h2><p class="small muted">Власник: ${esc(f.owner)} · джерело: ${esc(f.src)}</p>
    <p style="font-size:16px"><b>${esc(f.value)}</b> <span class="chip ${FR_ST[st][1]}">${FR_ST[st][0]}</span></p>
    <dl class="kv"><dt>Перевірено</dt><dd>${wdDate(f.ver)} · ${wdDays(f.ver)} дн. тому, строк дії ${f.ttl} дн.</dd>
      <dt>Де використовується</dt><dd>${esc(f.uses)}</dd>
      <dt>Сторінки (${f.pages.length})</dt><dd class="small">${f.pages.map(esc).join(', ')}</dd>
      <dt>Сайт</dt><dd>${site === 'ok' ? 'збігається' : site === 'mismatch' ? 'на 3 сторінках стара ціна — швидка смуга HF-1' : site === 'old' ? 'стоїть старе значення, чекає рішення власника' : 'оновлюється швидкою смугою'}</dd>
      <dt>AI-системи</dt><dd>${esc(f.aiNote)}</dd></dl>
    ${f.hist?.length ? `<h3 class="sub-h">Історія</h3>${f.hist.map(h => `<div class="row small"><span class="grow">${h.t}: «${esc(h.from)}» → «${esc(h.to)}»</span><span class="muted">${esc(h.who)}</span></div>`).join('')}` : ''}
    <div class="acts sec-gap">${f.rec ? `<button class="btn" data-action="open-rec" data-id="${f.rec}">Відкрити ${f.rec}</button>` : ''}<button class="btn primary" data-action="close-modal">Закрити</button></div>`;
  openModal();
}
function frLayer(f, layer) {
  if (layer === 'src') return f.srcVal && f.srcVal !== f.value ? ['bad', 'інше значення'] : ['ok', 'збігається'];
  if (layer === 'reg') { const st = frStatus(f); return st === 'ok' ? ['ok', 'актуальний'] : st === 'soon' ? ['warn', 'скоро перевірка'] : st === 'expired' ? ['bad', 'термін вийшов'] : ['warn', 'чекає власника']; }
  if (layer === 'site') { const s = frSite(f); return s === 'ok' ? ['ok', 'збігається'] : s === 'updating' ? ['warn', 'оновлюється'] : ['bad', s === 'old' ? 'старе значення' : 'розбіжність']; }
  return f.ai === 'ok' ? ['ok', 'правильно'] : f.ai === 'none' ? ['', 'не знає'] : f.ai === 'stale' ? ['warn', 'застаріло'] : ['bad', 'помилка'];
}
function frFresh() {
  const rows = S.factReg, W = 640, rowH = 26, L = 190, H = rows.length * rowH + 34, max = 120;
  const x = d => L + Math.min(d, max) / max * (W - L - 20);
  return `<div class="ins-scroll"><svg class="ins-svg" viewBox="0 0 ${W} ${H}" style="min-width:520px" role="img" aria-label="Свіжість фактів: днів від перевірки проти строку дії">
    ${[0, 30, 60, 90, 120].map(d => `<line x1="${x(d)}" x2="${x(d)}" y1="8" y2="${H - 22}" style="stroke:var(--line)"/><text x="${x(d)}" y="${H - 6}" text-anchor="middle" class="ins-t">${d}${d === 120 ? '+' : ''} дн.</text>`).join('')}
    ${rows.map((f, i) => { const y = 12 + i * rowH, age = wdDays(f.ver), st = frStatus(f), col = st === 'ok' ? 'var(--pass)' : st === 'soon' ? 'var(--hold)' : 'var(--veto)';
      return `<g data-hint="${esc(f.key)}: перевірено ${age} дн. тому, строк дії ${f.ttl} дн.">
        <text x="${L - 8}" y="${y + 13}" text-anchor="end" class="ins-t">${esc(f.key)}</text>
        <rect x="${L}" y="${y + 3}" width="${Math.max(2, x(age) - L)}" height="14" rx="3" style="fill:${col};opacity:.85"/>
        <line x1="${x(f.ttl)}" x2="${x(f.ttl)}" y1="${y}" y2="${y + 20}" style="stroke:var(--ink);stroke-width:2"/></g>`; }).join('')}
  </svg></div><div class="legend"><span><i class="lg" style="background:var(--pass)"></i>у строку</span><span><i class="lg" style="background:var(--hold)"></i>понад 80% строку</span><span><i class="lg" style="background:var(--veto)"></i>строк вийшов або розбіжність</span><span><i class="lg" style="background:var(--ink);width:3px"></i>строк дії факту</span></div>`;
}
function frIssues() {
  const R = S.factReg;
  const issues = [];
  const price = frFind('price.smart_reports');
  if (frSite(price) === 'mismatch') issues.push(['bad', 'Ціна Smart Reports: 3 сторінки показують $49, Perplexity цитує стару ціну', 'Швидка смуга HF-1 бере значення лише з реєстру', `<button class="btn small" data-action="nav-to" data-screen="hotfix">Швидка смуга</button>`]);
  if (S.frTrial === 'conflict') issues.push(['bad', 'trial.days: білінг — 21 день, реєстр — 14 днів', 'Поки власник не вирішить, O2 повертає нові тексти з цим фактом', `<button class="btn small primary" data-action="fr-approve" aria-disabled="${!['owner', 'lead'].includes(S.role)}">Підтвердити 21 день</button>`]);
  R.filter(f => frStatus(f) === 'expired').forEach(f => issues.push(['bad', `${f.key}: перевірено ${wdDays(f.ver)} дн. тому при строку ${f.ttl}`, 'Факт не можна використовувати в нових текстах, доки власник не перевірить', `<button class="btn small" data-action="fr-reverify" data-id="${f.key}" aria-disabled="${!['owner', 'lead'].includes(S.role)}">Перевірено</button>`]));
  R.filter(f => f.ai === 'stale').forEach(f => issues.push(['warn', `${f.key}: AI-системи кажуть застаріле`, f.aiNote, f.rec ? `<button class="btn small" data-action="open-rec" data-id="${f.rec}">${f.rec}</button>` : '']));
  return issues;
}
function frView() {
  const R = S.factReg, st = R.map(frStatus);
  const pagesN = new Set(R.flatMap(f => f.pages)).size;
  const issues = frIssues();
  return `${intro('<b>Реєстр фактів</b> — єдине джерело правди для цін, дат, назв і цифр. Агенти тільки читають: змінює значення лише власник факту. O2 звіряє з реєстром кожну цифру в тексті, швидка смуга бере значення лише звідси, а Citation Analyst перевіряє, що кажуть AI-системи. Кожен факт має джерело, власника і строк дії.')}
    <div class="grid g4">
      <div class="metric"><div class="lbl">Фактів у реєстрі</div><div class="val">${R.length}</div><div class="sub">${new Set(R.map(f => f.owner)).size} власників</div></div>
      <div class="metric"><div class="lbl">Актуальні ${hint('Значення збігається з джерелом, строк дії не вийшов.')}</div><div class="val" style="color:var(--pass)">${st.filter(s => s === 'ok').length}</div><div class="sub">${st.filter(s => s === 'soon').length} скоро на перевірку</div></div>
      <div class="metric"><div class="lbl">Потребують рішення</div><div class="val" style="color:${issues.length ? 'var(--veto)' : 'inherit'}">${issues.length}</div><div class="sub">розбіжності, прострочені, AI</div></div>
      <div class="metric"><div class="lbl">Сторінок посилаються</div><div class="val">${pagesN}</div><div class="sub">сканер сайту щодня 05:30</div></div>
    </div>
    ${flow('Як рухається факт', 'Від системи-джерела до сторінки і до відповіді AI. Агент не може вигадати значення — лише взяти з реєстру.', [
      ['Джерело', 'Білінг, changelog, CRM, status page, Legal'],
      ['05:30 · Звірка', 'Синхронізація: значення джерела проти реєстру'],
      ['Власник', 'Розбіжність не застосовується сама: рішення Finance, Product, RevOps…'],
      ['Реєстр', 'Нова версія з датою, причиною і автором'],
      ['Сайт', 'Сканер знаходить сторінки зі старим значенням → швидка смуга'],
      ['Тексти', 'O2 повертає будь-яку цифру без факту або з простроченим строком'],
      ['AI-системи', 'Citation Analyst перевіряє відповіді через 7 і 14 днів']
    ])}
    <div class="panel sec-gap" data-tour="fr-layers"><h2>Чотири шари правди ${hint('Факт правильний лише тоді, коли всі чотири шари збігаються. Червона клітинка — місце, де треба діяти.')}<span class="sp"><button class="btn small" data-action="fr-sync">Звірити з джерелами зараз</button></span></h2>
      <div class="tbl-wrap"><table class="fr-m"><thead><tr><th>Факт</th><th>Джерело</th><th>Реєстр</th><th>Сайт</th><th>AI-системи</th></tr></thead><tbody>
      ${R.map(f => `<tr><td><button class="lnk" data-action="fr-open" data-id="${f.key}"><code>${esc(f.key)}</code></button><br><span class="small muted">${esc(f.value)}</span></td>${['src', 'reg', 'site', 'ai'].map(l => { const [c, t] = frLayer(f, l); return `<td><span class="fr-c ${c}">${t}</span></td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="panel sec-gap"><h2>Свіжість фактів ${hint('Довжина — скільки днів тому факт перевіряли. Чорна риска — строк дії. За рискою факт блокується для нових текстів.')}</h2>${frFresh()}</div>
    <div class="grid g2 sec-gap">
          <div class="panel"><h2>Що треба вирішити <span class="chip ${issues.length ? 'bad' : 'ok'}">${issues.length}</span></h2>
        ${issues.length ? issues.map(i => `<div class="row"><span class="dot-s ${i[0]}"></span><span class="grow"><b>${esc(i[1])}</b><br><span class="small muted">${esc(i[2])}</span></span>${i[3]}</div>`).join('') : '<p class="empty">Усі шари збігаються.</p>'}
        ${S.frTrial === 'done' ? `<p class="small muted sec-gap">trial.days: версія 2 застосована, ${frFind('trial.days').pages.length} сторінок оновлено швидкою смугою, листи — у чернетках для Editor.</p>` : ''}</div>
      ${rights('Хто що може з фактом', [
        ['Власник', 'Змінити значення, підтвердити перевірку', 'Finance, Product, RevOps, Legal, Engineering'],
        ['R1', 'Синхронізація знаходить розбіжність', 'лише сигнал, без автоматичної заміни'],
        ['R2', 'Оновити сторінки після зміни факту', 'швидка смуга: одне поле, read-back'],
        ['O2', 'Повернути текст із цифрою без факту', 'або з простроченим строком дії'],
        ['Ніколи', 'Агент змінює значення факту', 'агенти мають лише читання']
      ], 'Правила однакові для всіх каналів: сторінки, реклама, листи, пости.')}
      <div class="panel"><h2>Чому це важливо ${hint('Без реєстру швидка смуга могла б «виправити» правильну ціну на неправильну.')}</h2>
        <div class="row"><span class="grow">Швидка смуга довіряє лише реєстру: якщо реєстр застарів, помилка поширюється на всі сторінки за хвилини.</span></div>
        <div class="row"><span class="grow">Тому розбіжність з джерелом ніколи не застосовується автоматично — тільки рішенням власника.</span></div>
        <div class="row"><span class="grow">Строк дії робить «тихе старіння» видимим: uptime за липень не потрапить у тендерну відповідь у жовтні.</span></div></div>
    </div>`;
}

/* ================= Зовнішні події і країни ================= */
const WD_KIND = { search: ['Пошук', '#3442A8'], ai: ['AI-системи', '#7B3FA0'], data: ['Дані', '#55607A'], competitor: ['Конкуренти', '#B9382A'], holiday: ['Свято', '#B86E00'], season: ['Сезон', '#1E8A6E'] };
const WD_C = [['US', 'США', 46, 52, 'UTC−5…−8'], ['UK', 'Велика Британія', 14, 13, 'UTC+1'], ['DE', 'Німеччина', 9, 7, 'UTC+2'], ['CA', 'Канада', 7, 8, 'UTC−4…−8'], ['AU', 'Австралія', 5, 4, 'UTC+11'], ['UA', 'Україна', 4, 3, 'UTC+3'], ['PL', 'Польща', 3, 3, 'UTC+2'], ['—', 'Інші', 12, 10, '—']];
function wdEvents() {
  return [
    { id: 'E1', kind: 'search', region: 'Global', title: 'Google: core update', short: 'Core update', w0: 41, w1: 43, dates: '08.10 — орієнт. 22.10', ch: ['SEO', 'AI Visibility'], tests: ['SEO'],
      rule: 'SEO-тести у вікні не дають висновку до завершення апдейту; вікно +7 днів після завершення', src: 'Google Search Status Dashboard' },
    { id: 'E2', kind: 'ai', region: 'Global', title: 'ChatGPT: нова модель за замовчуванням', short: 'ChatGPT', w0: 41, w1: 41, dates: '09.10', ch: ['AI Visibility'], tests: ['AIV'],
      rule: 'Нова базова лінія для ChatGPT за 3 дні прогонів; дані до і після не порівнюємо', src: 'release notes OpenAI' },
    { id: 'E3', kind: 'ai', region: 'Global', title: 'Perplexity: новий формат цитат', short: 'Perplexity', w0: 40, w1: 40, dates: '29.09', ch: ['AI Visibility'], tests: ['AIV'],
      rule: 'Парсер Citation Analyst оновлено, базова лінія перерахована', src: 'changelog Perplexity' },
    { id: 'E4', kind: 'data', region: 'Global', title: 'GSC: дані за 10–11.10 неповні', short: 'GSC: збій', w0: 41, w1: 41, dates: '10–11.10', ch: ['SEO'], tests: ['SEO'],
      rule: 'Тест-гейт не рахує ці дні; Детектор аномалій дивиться на T−3', src: 'MarTech Stack Strategist' },
    { id: 'E5', kind: 'competitor', region: 'Global', title: 'Baremetrics: −20% на річні плани', short: 'Baremetrics −20%', w0: 41, w1: 42, dates: '07.10', ch: ['PPC', 'SEO'], tests: [],
      rule: 'Гіпотеза для Детектора аномалій; PPC перевіряє CPC у Competitor EN', src: 'News & Algorithm Watcher' },
    { id: 'E6', kind: 'holiday', region: 'US', title: 'Columbus Day (США), Thanksgiving (Канада)', short: 'Columbus', w0: 42, w1: 42, dates: '12.10', ch: ['PPC', 'Email'], tests: ['AB'], also: 'CA',
      rule: 'PPC: pacing −15% на день; листи в цей день не надсилаємо; день виключено з A/B', src: 'календар свят' },
    { id: 'E7', kind: 'holiday', region: 'UA', title: 'День захисників і захисниць', short: 'Свято UA', w0: 40, w1: 40, dates: '01.10', ch: ['Email', 'SMM'], tests: [],
      rule: 'Пости і листи для UA — за окремим планом', src: 'календар свят' },
    { id: 'E8', kind: 'holiday', region: 'DE', title: 'День єдності Німеччини', short: 'Свято DE', w0: 40, w1: 40, dates: '03.10', ch: ['PPC'], tests: [],
      rule: 'Частка DE 9% — лише позначка на графіках', src: 'календар свят' },
    { id: 'E9', kind: 'season', region: 'UK', title: 'Шкільні канікули (half-term), орієнтовно', short: 'Half-term', w0: 44, w1: 44, dates: '26–30.10', ch: ['PPC'], tests: ['AB'],
      rule: 'Частка UK 14%: A/B не стартує в цей тиждень, ставки — без змін', src: 'календар свят' },
    { id: 'E10', kind: 'season', region: 'Global', title: 'Закриття місяця у фінкоманд (ICP)', short: 'Закриття', w0: 44, w1: 44, dates: '28.10–03.11', ch: ['SEO', 'PPC', 'Email'], tests: ['AB', 'SEO'],
      rule: 'Трафік ICP −8–12%: це сезон, не аномалія. Тести, що перетинають тиждень, подовжуються на тиждень', src: 'Аналізатор сезонності' },
    { id: 'E11', kind: 'holiday', region: 'PL', title: 'День усіх святих', short: 'Свято PL', w0: 44, w1: 44, dates: '01.11', ch: ['Email'], tests: [],
      rule: 'Частка PL 3% — лише позначка', src: 'календар свят' },
    { id: 'E12', kind: 'holiday', region: 'PL', title: 'День незалежності Польщі', short: 'Свято PL', w0: 46, w1: 46, dates: '11.11', ch: ['Email'], tests: [],
      rule: 'Частка PL 3% — лише позначка', src: 'календар свят' },
    { id: 'E14', kind: 'season', region: 'US', title: 'Thanksgiving, Black Friday і Cyber Monday', short: 'Black Fri', w0: 48, w1: 48, dates: '26–30.11', ch: ['PPC'], tests: ['AB', 'PPC'],
      rule: 'CPC +25–40%: нові тести ставок не запускаємо; O3 знижує крок ставки до 10%; листи 26.11 не надсилаємо', src: 'Аналізатор сезонності' }
  ].concat(S.wdExtra || []);
}
const wdSt = e => e.w1 < WD_NOW_W ? 'past' : e.w0 > WD_NOW_W ? 'next' : 'active';
const wdShare = r => (WD_C.find(c => c[0] === r) || [0, 0, 100])[2];
/* Тести та їхні вікна: факт для запущених, план для тих, що чекають */
function wdTestItems() {
  const out = [];
  (S.recs || []).forEach(r => {
    if (['deployed', 'rolledback', 'rejected', 'expired'].includes(r.status)) return;
    const live = ['test', 'won', 'inconclusive'].includes(r.status);
    const w0 = live ? WD_NOW_W - (r.week || 0) : WD_NOW_W + 1;
    out.push({ id: r.id, page: r.page, live, w0, w1: w0 + 2, kinds: ['AB', 'SEO', 'AIV'], ext: r.extWeeks || 0, obj: r });
  });
  (S.gps || []).forEach(g => {
    if (['deployed', 'rolledback', 'rejected', 'expired'].includes(g.status)) return;
    const live = ['test', 'won', 'inconclusive', 'rollout'].includes(g.status);
    const w0 = live ? WD_NOW_W - (g.week || 0) : WD_NOW_W + 2;
    out.push({ id: g.id, page: g.group, live, w0, w1: w0 + 2, kinds: ['AB', 'SEO', 'AIV'], ext: g.extWeeks || 0, obj: g });
  });
  return out;
}
function wdTestImpacts(t) {
  const hits = [];
  wdEvents().forEach(e => {
    if (e.w1 < t.w0 || e.w0 > t.w1 + (t.ext || 0)) return;
    if (!e.tests.length) return;
    const k = e.tests.filter(x => t.kinds.includes(x) || x === 'PPC');
    if (!k.length) return;
    if (e.kind === 'holiday' || (e.kind === 'season' && e.region !== 'Global')) { if (wdShare(e.region) < 10) return; }
    hits.push({ e, k });
  });
  return hits;
}
function wdImpactsFor(id) { const t = wdTestItems().find(x => x.id === id); return t ? wdTestImpacts(t) : []; }
function wdTimeline() {
  const lanes = [['search', 'Пошук'], ['ai', 'AI-системи'], ['data', 'Дані'], ['competitor', 'Конкуренти'], ['US', 'США'], ['CA', 'Канада'], ['UK', 'Велика Британія'], ['DE', 'Німеччина'], ['UA', 'Україна'], ['PL', 'Польща'], ['ICP', 'Сезон ICP']];
  const laneOf = e => ['search', 'ai', 'data', 'competitor'].includes(e.kind) ? e.kind : e.region === 'Global' ? 'ICP' : e.region;
  const tests = wdTestItems();
  const L = 150, W = 900, cw = (W - L - 10) / WD_WEEKS.length, rh = 24, top = 26;
  const H = top + lanes.length * rh + 18 + tests.length * 22 + 14;
  const x = w => L + (w - WD_WEEKS[0]) * cw;
  const ev2 = wdEvents();
  let s = `<div class="ins-scroll"><svg class="ins-svg" viewBox="0 0 ${W} ${H}" style="min-width:760px" role="img" aria-label="Зовнішні події по тижнях і країнах, нижче — вікна тестів">`;
  WD_WEEKS.forEach(w => { s += `<text x="${x(w) + cw / 2}" y="16" text-anchor="middle" class="ins-t${w === WD_NOW_W ? ' b' : ''}">W${w}</text><line x1="${x(w)}" x2="${x(w)}" y1="22" y2="${H - 6}" style="stroke:var(--line)"/>`; });
  s += `<rect x="${x(WD_NOW_W)}" y="22" width="${cw}" height="${H - 28}" style="fill:var(--act);opacity:.06"/><text x="${x(WD_NOW_W) + cw / 2}" y="${H - 2}" text-anchor="middle" class="ins-t b">зараз</text>`;
  lanes.forEach(([k, label], i) => {
    const y = top + i * rh;
    s += `<text x="${L - 8}" y="${y + 15}" text-anchor="end" class="ins-t">${label}${WD_C.find(c => c[0] === k) ? ` · ${wdShare(k)}%` : ''}</text><line x1="${L}" x2="${W - 10}" y1="${y + rh}" y2="${y + rh}" style="stroke:var(--line);opacity:.5"/>`;
    ev2.filter(e => laneOf(e) === k || e.also === k).forEach(e => {
      const c = WD_KIND[e.kind][1], st = wdSt(e);
      s += `<g data-hint="${esc(e.title)} (${e.dates})\n${esc(e.rule)}"><rect x="${x(e.w0) + 3}" y="${y + 4}" width="${(e.w1 - e.w0 + 1) * cw - 6}" height="${rh - 8}" rx="4" style="fill:${c};opacity:${st === 'past' ? .35 : .9}"/>
        <text x="${x(e.w0) + 7}" y="${y + 15.5}" class="ins-t w xs">${esc((() => { const mx = Math.floor(((e.w1 - e.w0 + 1) * cw - 14) / 6.1); const t = e.w1 > e.w0 && e.title.length <= mx ? e.title : (e.short || e.title); return t.length > mx ? t.slice(0, mx - 1) + '…' : t; })())}</text></g>`;
    });
  });
  const ty = top + lanes.length * rh + 14;
  s += `<text x="${L - 8}" y="${ty}" text-anchor="end" class="ins-t b">Вікна тестів</text>`;
  tests.forEach((t, i) => {
    const y = ty + 6 + i * 22, hits = wdTestImpacts(t);
    const w1 = t.w1 + (t.ext || 0);
    s += `<g data-hint="${t.id} · ${esc(t.page)}\n${t.live ? 'тест іде' : 'план: старт після погоджень'}${hits.length ? '\n' + hits.map(h => '• ' + h.e.title + ': ' + h.e.rule).join('\n') : '\nзовнішніх подій у вікні немає'}">
      <text x="${L - 8}" y="${y + 13}" text-anchor="end" class="ins-t">${t.id}</text>
      <rect x="${x(t.w0) + 3}" y="${y + 2}" width="${(w1 - t.w0 + 1) * cw - 6}" height="15" rx="7" style="fill:${t.live ? 'var(--act)' : 'var(--paper)'};stroke:var(--act);stroke-dasharray:${t.live ? '0' : '4 3'};opacity:.9"/>
      ${hits.map(h => `<circle cx="${x(Math.max(h.e.w0, t.w0)) + cw / 2}" cy="${y + 9.5}" r="5" style="fill:var(--veto);stroke:#fff;stroke-width:1.5"/>`).join('')}</g>`;
  });
  return s + '</svg></div>' + `<div class="legend">${Object.entries(WD_KIND).map(([, v]) => `<span><i class="lg" style="background:${v[1]}"></i>${v[0]}</span>`).join('')}<span><i class="lg" style="background:var(--act);border-radius:6px"></i>тест іде</span><span><i class="lg" style="border:1px dashed var(--act)"></i>тест у плані</span><span><i class="lg" style="background:var(--veto);border-radius:50%"></i>подія у вікні тесту</span></div>`;
}
function wdSim(kind) {
  const already = (S.wdExtra || []).some(e => e.sim === kind);
  if (already) { toast('Цю подію вже додано.'); return; }
  const e = kind === 'search'
    ? { id: 'E15', sim: 'search', kind: 'search', region: 'Global', title: 'Google: spam update (щойно оголошено)', short: 'Spam update', w0: 42, w1: 43, dates: '13.10 — орієнт. 20.10', ch: ['SEO'], tests: ['SEO'], rule: 'Запущені тести: поточний тиждень не зараховується, вікно +1 тиждень; нові SEO-тести — після завершення', src: 'Google Search Status Dashboard' }
    : { id: 'E16', sim: 'ai', kind: 'ai', region: 'Global', title: 'Gemini: оновлення моделі (щойно)', short: 'Gemini', w0: 42, w1: 42, dates: '13.10', ch: ['AI Visibility'], tests: ['AIV'], rule: 'AI Visibility тести: тиждень не зараховується для Gemini, нова базова лінія за 3 дні', src: 'release notes Google' };
  S.wdExtra = [...(S.wdExtra || []), e];
  const live = wdTestItems().filter(t => t.live);
  live.forEach(t => { t.obj.extWeeks = (t.obj.extWeeks || 0) + 1; t.obj.extWhy = e.title; });
  ev('warn', 'News & Algorithm Watcher', `${e.title}: ${e.rule}`);
  if (live.length) ev('o', 'Тест-гейт', `${live.map(t => t.id).join(', ')}: поточний тиждень не зараховується, вікно подовжено на тиждень`);
  else ev('', 'Тест-гейт', 'запущених тестів немає; нові тести цього типу стартують після завершення події');
  slack(`<b>Зовнішня подія</b>: ${esc(e.title)}. ${esc(e.rule)}.${live.length ? ` Зачеплено тести: ${live.map(t => t.id).join(', ')}.` : ''}`, [{ label: 'Календар подій', action: 'nav-to', screen: 'world', primary: true }], kind === 'search' ? 'seo' : 'ai-visibility');
  toast(`Подію додано. ${live.length ? 'Зачеплено тестів: ' + live.length : 'Запущених тестів немає'}.`);
  render();
}
function wdContext(chs) {
  const list = wdEvents().filter(e => wdSt(e) !== 'past' && e.ch.some(c => chs.includes(c)) && e.w0 <= WD_NOW_W + 2);
  if (!list.length) return '';
  return `<div class="wd-ctx"><b>Зовнішній контекст</b>${list.map(e => `<span class="wd-pill" data-hint="${esc(e.rule)}"><i style="background:${WD_KIND[e.kind][1]}"></i>${esc(e.title)} <span class="muted">· ${e.dates}${wdSt(e) === 'next' ? ' · скоро' : ''}</span></span>`).join('')}<button class="btn small" data-action="nav-to" data-screen="world">Календар</button></div>`;
}
function wdStrip() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('world-strip'); if (!el) return;
  const act = wdEvents().filter(e => wdSt(e) === 'active' && e.kind !== 'holiday');
  const next = wdEvents().filter(e => wdSt(e) === 'next' && e.w0 <= WD_NOW_W + 2);
  const html = act.length ? `<span class="ws-l">Зараз у світі</span>${act.map(e => `<button class="ws-i" data-action="nav-to" data-screen="world" data-hint="${esc(e.rule)}"><i style="background:${WD_KIND[e.kind][1]}"></i>${esc(e.title)}</button>`).join('')}${next.length ? `<span class="ws-n">+${next.length} найближчим часом</span>` : ''}` : '';
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; el.hidden = !html; }
}
function wdView() {
  const E = wdEvents(), act = E.filter(e => wdSt(e) === 'active'), next = E.filter(e => wdSt(e) === 'next');
  const items = wdTestItems(), hit = items.filter(t => wdTestImpacts(t).length);
  const rows = WD_C.map(c => { const ev3 = E.filter(e => (e.region === c[0] || e.also === c[0]) && wdSt(e) !== 'past'); return [c, ev3]; });
  return `${intro('<b>Світ і події.</b> Тест показує різницю між тестовою і контрольною групою, але апдейт Google, нова модель у ChatGPT або свято в країні з великою часткою трафіку можуть зсунути обидві групи по-різному. News & Algorithm Watcher щодня збирає такі події, а тест-гейт застосовує до них правила: не зарахувати тиждень, подовжити вікно або перезапустити базову лінію. Подію видно всюди: у стрічці під шапкою, на екранах каналів, на картках тестів.')}
    <div class="grid g4">
      <div class="metric"><div class="lbl">Діють зараз</div><div class="val">${act.length}</div><div class="sub">апдейтів пошуку й AI: ${act.filter(e => e.kind === 'search' || e.kind === 'ai').length}</div></div>
      <div class="metric"><div class="lbl">Найближчі 6 тижнів</div><div class="val">${next.length}</div><div class="sub">свята, сезони, розпродажі</div></div>
      <div class="metric"><div class="lbl">Тестів під впливом ${hint('Тести (запущені й заплановані), у вікні яких є подія з правилом для цього типу тесту.')}</div><div class="val" style="color:${hit.length ? 'var(--hold)' : 'inherit'}">${hit.length}</div><div class="sub">з ${items.length} тестів</div></div>
      <div class="metric"><div class="lbl">Країн з подіями</div><div class="val">${new Set(E.filter(e => wdSt(e) !== 'past' && e.region !== 'Global').map(e => e.region)).size}</div><div class="sub">трафік 8 ринків</div></div>
    </div>
    <div class="panel sec-gap" data-tour="world-tl"><h2>Календар: події і вікна тестів ${hint('Кожен рядок — джерело подій або країна з часткою трафіку. Нижче — вікна тестів. Червона точка — подія з правилом для цього тесту.')}
      <span class="sp"><button class="btn small" data-action="wd-sim" data-id="search">Симулювати апдейт Google</button> <button class="btn small" data-action="wd-sim" data-id="ai">Симулювати оновлення Gemini</button></span></h2>
      ${wdTimeline()}</div>
    <div class="grid g2 sec-gap">
      <div class="panel"><h2>Вплив на тести ${hint('Що тест-гейт зробить із кожним тестом. Правило бере тип події і тип тесту.')}</h2>
        ${(() => { const by = new Map(); hit.forEach(t => wdTestImpacts(t).forEach(h => { if (!by.has(h.e.id)) by.set(h.e.id, [h.e, []]); by.get(h.e.id)[1].push(t); }));
          return by.size ? [...by.values()].map(([e, ts]) => `<div class="row"><i class="lgd" style="background:${WD_KIND[e.kind][1]}"></i><span class="grow"><b>${esc(e.title)}</b> <span class="small muted">${e.dates}</span><br><span class="small">${esc(e.rule)}</span><br>${ts.map(t => `<span class="chip ${t.live ? 'act' : ''}" style="margin:4px 4px 0 0" data-hint="${esc(t.page)} · ${t.live ? 'тест іде' : 'у плані'}${t.ext ? ' · вікно +' + t.ext + ' тиж.' : ''}">${t.id}${t.live ? ' · іде' : ''}</span>`).join('')}</span></div>`).join('') : '<p class="empty">Жоден тест не перетинається з подіями.</p>'; })()}</div>
      ${rights('Правила реакції тест-гейту', [
        ['Пошук', 'Апдейт ядра або спаму', 'SEO-тест: тиждень не зараховується, вікно +7 днів після завершення'],
        ['AI', 'Нова модель в AI-системі', 'AI Visibility: нова базова лінія для цієї системи, дані до/після не змішуємо'],
        ['Дані', 'Збій або затримка джерела', 'дні з неповними даними не рахуються; Детектор дивиться на T−3'],
        ['Свято', 'Країна з часткою ≥ 10%', 'день виключається з A/B, PPC знижує pacing, листи не йдуть'],
        ['Сезон', 'Закриття місяця, Black Friday', 'це не аномалія; нові тести не стартують, запущені подовжуються'],
        ['Конкурент', 'Ціни, реліз, кампанія', 'гіпотеза для Детектора, без зміни вікна тесту']
      ], 'Правила застосовує тест-гейт автоматично і пише в журнал, чому тиждень не зараховано.')}
    </div>
    <div class="panel sec-gap"><h2>Країни ${hint('Частка трафіку і реєстрацій визначає, чи свято в країні впливає на тести. Нижче 10% — лише позначка на графіках.')}</h2>
      <div class="tbl-wrap"><table><thead><tr><th>Країна</th><th>Трафік</th><th>Реєстрації</th><th>Час</th><th>Події зараз і далі</th><th>Що змінюється</th></tr></thead><tbody>
      ${rows.map(([c, l]) => `<tr><td><b>${c[1]}</b></td><td style="min-width:110px">${c[2]}%<div class="bar"><i style="width:${c[2] * 2}%"></i></div></td><td>${c[3]}%</td><td class="small muted">${c[4]}</td><td class="small">${l.length ? l.map(e => `${esc(e.title)} <span class="muted">(${e.dates})</span>`).join('<br>') : '<span class="muted">—</span>'}</td><td class="small">${c[2] >= 10 ? (l.length ? 'pacing, листи, вікна A/B' : 'стандартний режим') : 'лише позначки на графіках'}</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="grid g2 sec-gap">
      <div class="panel"><h2>Звідки беремо події</h2>
        ${[['Google Search Status Dashboard', 'апдейти ядра, спаму, інциденти пошуку', 'щодня 07:00'], ['Release notes AI-компаній', 'нові моделі за замовчуванням, зміни формату цитат', 'щодня 07:00'], ['Календарі свят 8 країн', 'державні свята, канікули', 'раз на місяць на 90 днів уперед'], ['Аналізатор сезонності', 'закриття місяця, розпродажі, бюджетні цикли ICP', 'щотижня'], ['Новини ніші і конкурентів', 'ціни, релізи, кампанії', 'щодня 07:00'], ['Стан конекторів', 'затримки і збої GSC, GA4, Ads', 'щогодини']].map(r => `<div class="row"><span class="grow"><b>${r[0]}</b><br><span class="small muted">${r[1]}</span></span><span class="chip">${r[2]}</span></div>`).join('')}</div>
      <div class="panel"><h2>Де видно подію ${hint('Подія не живе лише на цьому екрані: її бачать усі, хто ухвалює рішення.')}</h2>
        <div class="row"><span class="grow">Стрічка «Зараз у світі» під шапкою на кожному екрані</span></div>
        <div class="row"><span class="grow">Блок «Зовнішній контекст» на SEO, PPC і AI Visibility</span></div>
        <div class="row"><span class="grow">Позначка на картці тесту в «Рекомендаціях» і «Групах»</span></div>
        <div class="row"><span class="grow">Мітки тижнів на графіку трафіку в «Аналітиці»</span></div>
        <div class="row"><span class="grow">Гіпотеза «Апдейт» у діагностиці Детектора аномалій</span></div>
        <div class="row"><span class="grow">Повідомлення в Slack каналу, якого стосується подія</span></div></div>
    </div>`;
}

/* ================= Контроль якості агентів ================= */
const AQ_CHECKS = [['acc', 'Точність'], ['src', 'Факти з джерелом'], ['fmt', 'Формат і схема'], ['pol', 'Політики'], ['stab', 'Стабільність'], ['inj', 'Стійкість до ін’єкцій'], ['cost', 'Вартість']];
function aqData() {
  const A = (n, ver, base, cells, drift) => ({ n, ver, base, cells, drift });
  return {
    agents: [
      A('Narrative Strategist (новий)', 'промпт p12 · LLM-A', 40, ['ok', 'ok', 'ok', 'ok', 'warn', 'ok', 'ok'], [95, 94, 95, 96, 95, 94, 95, 95, 96, 95, 94, 95, 95, 96]),
      A('Citation Analyst (новий)', 'промпт p7 · LLM-A · парсер v3.1', 36, ['warn', 'ok', 'bad', 'ok', 'ok', 'ok', 'ok'], [94, 95, 94, 94, 95, 94, 93, 94, 95, 94, 88, 86, 87, 86]),
      A('Budget Optimizer', 'промпт p8 · LLM-A', 32, ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'], [97, 96, 97, 97, 96, 97, 97, 96, 97, 97, 96, 97, 97, 97]),
      A('Content Copywriter', 'промпт p21 · LLM-B', 44, ['ok', 'warn', 'ok', 'ok', 'ok', 'ok', 'warn'], [92, 93, 92, 92, 93, 91, 92, 93, 92, 92, 93, 92, 92, 93]),
      A('Детектор аномалій (новий)', 'промпт p5 · LLM-A + модель прогнозу', 28, ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'], [96, 96, 95, 96, 96, 97, 96, 96, 95, 96, 96, 96, 95, 96]),
      A('Technical SEO Auditor', 'промпт p9 · LLM-A', 24, ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'], [95, 95, 96, 95, 95, 95, 96, 95, 95, 96, 95, 95, 96, 95]),
      A('PPC Strategist', 'промпт p11 · LLM-A', 30, ['ok', 'ok', 'ok', 'warn', 'ok', 'ok', 'ok'], [93, 93, 94, 93, 93, 94, 93, 93, 94, 93, 93, 94, 93, 94]),
      A('Email Copywriter', 'промпт p6 · LLM-B', 26, ['ok', 'ok', 'ok', 'ok', 'ok', 'warn', 'ok'], [94, 94, 93, 94, 94, 94, 93, 94, 94, 93, 94, 94, 94, 93])
    ],
    rel: [
      { id: 'RL-7', agent: 'Narrative Strategist (новий)', change: 'Модель LLM-A → LLM-B (дешевша на 38%)', cases: 40, status: 'new',
        res: [['Точність', 91, 93, '−2', 'ok'], ['Факти з джерелом', 98, 91, '−1', 'bad'], ['Формат і схема', 100, 100, '0', 'ok'], ['Політики', 0, 0, '0', 'ok'], ['Стабільність', 88, 90, '−3', 'ok'], ['Стійкість до ін’єкцій', 100, 100, '0', 'ok'], ['Вартість, $ на 100 задач', 4.1, 2.5, '+20%', 'ok']] },
      { id: 'RL-8', agent: 'Budget Optimizer', change: 'Промпт p8 → p9: враховує граничний CAC за 28 днів', cases: 32, status: 'new',
        res: [['Точність', 90, 94, '−2', 'ok'], ['Факти з джерелом', 100, 100, '−1', 'ok'], ['Формат і схема', 100, 100, '0', 'ok'], ['Політики', 0, 0, '0', 'ok'], ['Стабільність', 93, 94, '−3', 'ok'], ['Стійкість до ін’єкцій', 100, 100, '0', 'ok'], ['Вартість, $ на 100 задач', 1.9, 2.0, '+20%', 'ok']] }
    ],
    drift: 'alert'
  };
}
const AQ_RST = { new: ['нова зміна', ''], eval: ['еталонні кейси', 'act'], blocked: ['заблоковано', 'bad'], shadow: ['тіньовий режим', 'act'], canary: ['канарка 10%', 'act'], live: ['у роботі', 'ok'] };
async function aqRun(id) {
  const r = S.aq.rel.find(x => x.id === id); if (!r || r.status !== 'new') return;
  r.status = 'eval'; r.done = 0; render();
  ev('o', 'Регресійний контролер', `${r.id}: ${r.agent} — ${r.change}. Запуск ${r.cases} еталонних кейсів на старій і новій версії`);
  for (let i = 1; i <= 4; i++) { await wait(350); r.done = Math.round(r.cases * i / 4); render(); }
  const bad = r.res.filter(x => x[4] === 'bad');
  if (bad.length) {
    r.status = 'blocked';
    ev('bad', 'Регресійний контролер', `${r.id}: регресія — ${bad.map(b => `${b[0]} ${b[1]} → ${b[2]}`).join('; ')}. Зміну не застосовано, ${r.agent.replace(' (новий)', '')} лишається на старій версії`);
    slack(`<b>${r.id} заблоковано</b>: ${esc(r.agent)} — ${esc(r.change)}. Регресія: ${bad.map(b => `${b[0]} ${b[1]}% → ${b[2]}%`).join(', ')}. Дешевша модель частіше ставить цифри без джерела.`, [{ label: 'Якість агентів', action: 'nav-to', screen: 'agentqa', primary: true }], 'ai-visibility');
    render(); return;
  }
  r.status = 'shadow'; ev('ok', 'Регресійний контролер', `${r.id}: еталони пройдено без регресій. Тіньовий режим 48 год: нова версія працює паралельно, її результати не використовуються`); render(); await wait(900);
  r.agree = 96; ev('', 'Аудитор відповідей', `${r.id}: тіньовий режим — збіг рішень зі старою версією 96%; 2 розбіжності переглянуто, нова версія права`);
  r.status = 'canary'; render(); await wait(800);
  ev('ok', 'Регресійний контролер', `${r.id}: канарка 10% задач — порушень немає`);
  r.status = 'live'; ev('ok', 'Регресійний контролер', `${r.id}: нова версія у роботі; стару збережено для відкату однією кнопкою`); render();
}
function aqDriftFix() {
  if (S.aq.drift !== 'alert') return;
  S.aq.drift = 'fixed';
  const a = S.aq.agents.find(x => x.n.startsWith('Citation Analyst')); a.drift = [...a.drift, 92, 95]; a.cells[0] = 'ok'; a.cells[2] = 'ok'; a.ver = 'промпт p7 · LLM-A · парсер v3.2';
  ev('o', 'Аудитор відповідей', 'Citation Analyst: причина дрейфу — ChatGPT після оновлення моделі віддає твердження списками, парсер v3.1 їх пропускав');
  ev('ok', 'Регресійний контролер', 'Citation Analyst: парсер v3.2 пройшов 36 еталонних кейсів і 12 нових кейсів зі списками; якість 95, нагляд людини знято');
  render();
}
function aqDriftSvg() {
  const list = S.aq.agents.slice(0, 4), W = 900, H = 240, L = 34, R = 12, T = 14, B = 26;
  const n = Math.max(...list.map(a => a.drift.length)), lo = 80, hi = 100;
  const x = i => L + i * (W - L - R) / (n - 1), y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const cols = ['#3442A8', '#B9382A', '#1E8A6E', '#B86E00'];
  const days = Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(2026, 8, 30 + i)); return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0'); });
  return `<div class="ins-scroll"><svg class="ins-svg" viewBox="0 0 ${W} ${H}" style="min-width:600px" role="img" aria-label="Якість агентів за днями: щоденна вибірка 5% відповідей">
    ${[80, 85, 90, 95, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ins-t">${v}</text>`).join('')}
    <line x1="${L}" x2="${W - R}" y1="${y(90)}" y2="${y(90)}" style="stroke:var(--veto);stroke-dasharray:5 4"/><text x="${W - R}" y="${y(90) - 5}" text-anchor="end" class="ins-t" style="fill:var(--veto)">поріг 90</text>
    <line x1="${x(9.5)}" x2="${x(9.5)}" y1="${T}" y2="${H - B}" style="stroke:#7B3FA0;stroke-dasharray:3 3"/><text x="${x(9.5) + 4}" y="${T + 10}" class="ins-t" style="fill:#7B3FA0">09.10 нова модель ChatGPT</text>
    ${days.map((d, i) => i % 2 === 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="ins-t">${d}</text>` : '').join('')}
    ${list.map((a, k) => `<polyline points="${a.drift.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" style="fill:none;stroke:${cols[k]};stroke-width:2.2"/>${a.drift.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" style="fill:${cols[k]}" data-hint="${esc(a.n.replace(' (новий)', ''))}, ${days[i]}: ${v}"/>`).join('')}`).join('')}
  </svg></div><div class="legend">${list.map((a, k) => `<span><i class="lg" style="background:${cols[k]}"></i>${esc(a.n.replace(' (новий)', ''))}</span>`).join('')}</div>`;
}
function aqView() {
  const A = S.aq.agents, cell = { ok: ['ok', '✓'], warn: ['warn', '!'], bad: ['bad', '✕'] };
  const relCard = r => `<div class="ap"><div class="t">${r.id} · ${esc(r.agent.replace(' (новий)', ''))} <span class="chip ${AQ_RST[r.status][1]}">${AQ_RST[r.status][0]}</span></div>
      <p class="small muted" style="margin:4px 0 8px">${esc(r.change)} · ${r.cases} еталонних кейсів${r.status === 'eval' ? ` · пройдено ${r.done}/${r.cases}` : ''}${r.agree ? ` · збіг у тіньовому режимі ${r.agree}%` : ''}</p>
      ${['blocked', 'shadow', 'canary', 'live'].includes(r.status) ? `<div class="tbl-wrap"><table class="aq-t"><thead><tr><th>Метрика</th><th>Було</th><th>Стало</th><th>Допуск</th><th></th></tr></thead><tbody>${r.res.map(m => `<tr class="${m[4] === 'bad' ? 'aq-bad' : ''}"><td>${m[0]}</td><td>${m[1]}</td><td><b>${m[2]}</b></td><td class="small muted">${m[3]}</td><td>${m[4] === 'bad' ? '<span class="chip bad">регресія</span>' : '<span class="chip ok">ок</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${r.status === 'blocked' ? '<p class="small" style="margin:8px 0 0">Агент лишається на старій версії. Щоб повторити реліз, автор зміни додає кейси або правки промпту, і контролер запускає всі еталони знову.</p>' : ''}
      ${r.status === 'new' ? `<div class="acts"><button class="btn small primary" data-action="aq-run" data-id="${r.id}">Запустити перевірку релізу</button></div>` : ''}</div>`;
  return `${intro('<b>Якість агентів.</b> Оновлення промпту, моделі або інструмента може тихо зламати агента: він почне ставити цифри без джерела або гірше розбирати відповіді AI. Тому агент ніколи не оцінює себе сам. Регресійний контролер перевіряє кожну зміну на еталонних кейсах до релізу, а Аудитор відповідей щодня бере вибірку реальних результатів і стежить за дрейфом. Обидва працюють на іншій моделі, ніж агенти, яких перевіряють.')}
    <div class="grid g4">
      <div class="metric"><div class="lbl">Агентів під контролем</div><div class="val">87</div><div class="sub">у демо показано ${A.length}</div></div>
      <div class="metric"><div class="lbl">Еталонних кейсів ${hint('Реальні кейси з історії: типові, складні й пастки. Зростають із кожним інцидентом.')}</div><div class="val">2 140</div><div class="sub">у середньому 25 на агента</div></div>
      <div class="metric"><div class="lbl">Релізів за 30 днів</div><div class="val">11</div><div class="sub">2 заблоковано регресією</div></div>
      <div class="metric"><div class="lbl">Дрейф зараз</div><div class="val" style="color:${S.aq.drift === 'alert' ? 'var(--veto)' : 'var(--pass)'}">${S.aq.drift === 'alert' ? 1 : 0}</div><div class="sub">${S.aq.drift === 'alert' ? 'Citation Analyst нижче порогу' : 'усі агенти вище порогу'}</div></div>
    </div>
    ${flow('Як зміна агента потрапляє в роботу', 'Будь-яка зміна — промпт, модель, інструмент, парсер — іде цим шляхом. Пропустити крок не можна.', [
      ['Зміна', 'Автор описує, що змінив і навіщо; версія фіксується'],
      ['Еталонні кейси', 'Стара і нова версія на тих самих кейсах, по 3 прогони'],
      ['Порівняння', 'Жодна метрика не гірша за допуск; порушень політик — 0'],
      ['Тіньовий режим', '48 год паралельно з робочою версією, результати не використовуються'],
      ['Канарка', '10% реальних задач; Аудитор перевіряє кожну'],
      ['Робота', 'Стара версія зберігається: відкат однією кнопкою'],
      ['Щодня', 'Вибірка 5% відповідей: дрейф нижче порогу — алерт і нагляд людини']
    ])}
    <div class="panel sec-gap" data-tour="aq-rel"><h2>Релізи агентів ${hint('Запустіть обидва: RL-7 зупиниться на регресії, RL-8 пройде всі кроки.')}</h2><div class="grid g2">${S.aq.rel.map(relCard).join('')}</div></div>
      <div class="panel sec-gap"><h2>Дрейф у роботі ${hint('Аудитор відповідей щодня оцінює 5% реальних результатів кожного агента. Нижче порогу — алерт, агент переходить під нагляд людини.')}
        ${S.aq.drift === 'alert' ? '<span class="sp"><button class="btn small primary" data-action="aq-drift">Розібрати дрейф Citation Analyst</button></span>' : '<span class="sp chip ok">дрейф усунено</span>'}</h2>
        ${aqDriftSvg()}
        <p class="small muted" style="margin:8px 0 0">${S.aq.drift === 'alert' ? 'Після оновлення моделі ChatGPT (зовнішня подія E2) якість Citation Analyst впала до 86. Поки причину не усунено, людина перевіряє 100% його висновків.' : 'Причина: новий формат відповідей ChatGPT. Парсер v3.2 пройшов еталони, нагляд людини знято. Кейси зі списками додано до еталонів.'}</p></div>
    <div class="panel sec-gap"><h2>Остання перевірка по агентах ${hint('Результат останнього прогону еталонів і щоденної вибірки. Наведіть на клітинку, щоб побачити пояснення.')}</h2>
      <div class="tbl-wrap"><table class="aq-h"><thead><tr><th>Агент</th><th>Версія</th>${AQ_CHECKS.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>
      ${A.map(a => `<tr><td><button class="lnk" data-action="ag-open" data-id="${esc(a.n)}">${esc(a.n.replace(' (новий)', ''))}</button><br><span class="small muted">${a.base} кейсів</span></td><td class="small">${esc(a.ver)}</td>${a.cells.map((c, i) => `<td><span class="aq-c ${cell[c][0]}" data-hint="${AQ_CHECKS[i][1]}: ${c === 'ok' ? 'у межах допуску' : c === 'warn' ? 'близько до межі допуску, під наглядом' : 'нижче допуску — алерт'}">${cell[c][1]}</span></td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="grid g2 sec-gap">
      <div class="panel"><h2>Що в еталонних кейсах</h2>
        ${[['Типові задачі', 45, 'звичайні запуски з історії'], ['Складні випадки', 20, 'конфлікт каналів REC-3, сезонне падіння, мала вибірка'], ['Пастки на факти', 15, 'цифра без джерела, застаріла ціна, вигадана інтеграція'], ['Ін’єкції', 10, 'команда в огляді G2 або листі: «ignore previous instructions»'], ['Регресії з інцидентів', 10, 'кожен інцидент у роботі стає новим кейсом']].map(r => `<div class="row"><span class="grow"><b>${r[0]}</b><br><span class="small muted">${r[2]}</span></span><span style="min-width:120px">${r[1]}%<div class="bar"><i style="width:${r[1] * 2}%"></i></div></span></div>`).join('')}</div>
      ${rights('Правила контролю', [
        ['Завжди', 'Агент не оцінює сам себе', 'контролер — інша модель і інший промпт'],
        ['Завжди', 'Версія промпту і моделі — у журналі кожної дії', 'видно, яка версія ухвалила рішення'],
        ['Блок', 'Регресія будь-якої метрики понад допуск', 'реліз не застосовується'],
        ['Блок', 'Хоч одне порушення політик або успішна ін’єкція', 'реліз не застосовується'],
        ['Алерт', 'Дрейф нижче порогу 2 дні поспіль', 'людина перевіряє 100% результатів агента'],
        ['Owner', 'Зміна моделі для агентів R3', 'додатково апрув Owner']
      ])}
    </div>`;
}

/* ================= Паспорти нових агентів ================= */
if (typeof A === 'function') {
  A('Регресійний контролер (новий)', {
    scr: 'agentqa',
    p: 'Перевіряє кожну зміну агента — промпт, модель, інструмент — на еталонних кейсах і не пускає в роботу версію, яка гірша за попередню.',
    tr: 'Будь-яка зміна промпту, моделі, інструмента або парсера агента; нічний перепрогін еталонів раз на тиждень',
    src: `Репозиторій промптів і конфігурацій агентів — читання
      Набір еталонних кейсів — читання, запис нових
      Журнал аудиту — читання
      Реєстр версій агентів — запис через Gateway`,
    col: `Відповіді старої і нової версії на тих самих кейсах, по 3 прогони
      Метрики: точність, факти з джерелом, формат, політики, стабільність, ін’єкції, вартість
      Розбіжності рішень у тіньовому режимі`,
    how: `Отримує зміну з описом автора
      Проганяє стару і нову версію на всіх еталонах агента
      Порівнює кожну метрику з допуском; порушення політик — нуль
      Без регресій — тіньовий режим 48 год, потім канарка 10%
      Регресія — блок релізу, звіт автору і в Slack`,
    out: 'Рішення по релізу: пропустити, заблокувати або відкотити — з таблицею метрик',
    sample: `{ "release": "RL-7", "agent": "Narrative Strategist",
  "change": "LLM-A → LLM-B", "cases": 40,
  "regression": { "Факти з джерелом": [98, 91] },
  "decision": "blocked" }`,
    to: 'Автор зміни, Owner; у журнал аудиту',
    no: `Не змінює промпти сам — лише пропускає або блокує
      Не оцінює себе: його власні зміни перевіряє Аудитор відповідей
      Не пропускає реліз без еталонних кейсів`,
    kpi: `Регресії, що потрапили в роботу: 0
      Час перевірки релізу ≤ 30 хв`,
    ex: `10:02 — RL-7: Narrative Strategist, модель LLM-A → LLM-B
      10:03 — 40 кейсів × 2 версії × 3 прогони
      10:21 — Факти з джерелом: 98% → 91%, допуск −1
      10:21 — Реліз заблоковано, агент лишається на LLM-A
      10:22 — Звіт автору і в #ai-visibility`
  });
  A('Аудитор відповідей (новий)', {
    scr: 'agentqa',
    p: 'Щодня перевіряє вибірку реальних результатів усіх агентів і ловить дрейф: якість, що падає без жодної зміни з нашого боку.',
    tr: 'Щодня о 02:30 — вибірка за минулу добу; позачергово після зовнішньої події з AI-системами',
    src: `Журнал результатів агентів — читання
      Реєстр фактів — читання
      Календар зовнішніх подій — читання
      Slack — алерти`,
    col: `5% результатів кожного агента за добу
      Оцінки за тими самими метриками, що й еталони
      Зовнішні події, що могли змінити вхідні дані`,
    how: `Бере випадкову вибірку результатів кожного агента
      Оцінює їх іншою моделлю за єдиною шкалою
      Рахує денну якість і порівнює з порогом 90
      Нижче порогу 2 дні поспіль — алерт і нагляд людини над агентом
      Шукає причину: зміна вхідних даних, зовнішня подія, новий тип задач`,
    out: 'Денна якість агентів, алерти дрейфу і причина',
    sample: `{ "agent": "Citation Analyst", "date": "2026-10-11",
  "sample": 42, "quality": 86, "threshold": 90,
  "suspect": "E2: нова модель ChatGPT — твердження списками",
  "action": "людина перевіряє 100% висновків" }`,
    to: 'Регресійний контролер (для фіксу), Owner, власник агента',
    no: `Не виправляє агента сам
      Не бачить PII: вибірка маскується
      Не оцінює власні результати — його перевіряє людина щомісяця`,
    kpi: `Дрейф виявлено ≤ 2 дні
      Хибні алерти ≤ 10%`,
    ex: `02:30 — Вибірка 5% за 12.10: 1 860 результатів
      02:52 — Citation Analyst: 86 при порозі 90, другий день поспіль
      02:53 — Збіг у часі з подією E2: нова модель ChatGPT
      02:53 — Алерт; людина перевіряє 100% висновків агента
      02:54 — Задача Регресійному контролеру: кейси зі списками`
  });
}
if (typeof AG_POD !== 'undefined') AG_POD['Контроль якості'] = { gate: 'Перевіряє інших агентів, нічого не змінює на сайті, в рекламі чи листах; блокує лише релізи агентів', screen: 'agentqa',
  no: 'Не змінює промпти й налаштування агентів\nНе оцінює сам себе\nНе пропускає реліз без еталонних кейсів' };

function wdCounts() {
  if (typeof document === 'undefined') return;
  const set = (id, n, bad) => { const el = document.getElementById(id); if (!el) return; el.textContent = n || ''; el.style.display = n ? '' : 'none'; el.style.background = bad ? 'var(--veto)' : ''; };
  set('cnt-fr', frIssues().length, frIssues().some(i => i[0] === 'bad'));
  set('cnt-wd', wdEvents().filter(e => wdSt(e) === 'active' && e.kind !== 'holiday').length, false);
  set('cnt-aq', (S.aq.drift === 'alert' ? 1 : 0) + S.aq.rel.filter(r => r.status === 'blocked').length, true);
}
/* ================= Ініціалізація ================= */
function worldInit() {
  S.factReg = frRegistry(); frSyncFacts();
  S.frTrial = null; S.wdExtra = [];
  S.aq = aqData();
  if (!S.pods.some(p => p[0] === 'Контроль якості')) S.pods.push(['Контроль якості', ['Регресійний контролер (новий)', 'Аудитор відповідей (новий)']]);
  Object.assign(TITLES, { facts: 'Реєстр фактів', world: 'Світ і події', agentqa: 'Якість агентів' });
  Object.assign(VIEWS, { facts: frView, world: wdView, agentqa: aqView });
  Object.assign(SCALE_ACTIONS, {
    'fr-sync': frSyncRun, 'fr-approve': () => frApproveTrial(), 'fr-reverify': id => frReverify(id), 'fr-open': id => frDetail(id),
    'wd-sim': id => wdSim(id), 'aq-run': id => aqRun(id), 'aq-drift': aqDriftFix
  });
  /* зовнішня подія під час тесту: тиждень не зараховується */
  const wrapWeek = (orig, label) => function (x) {
    if (x && x.status === 'test' && x.extWeeks > 0) {
      x.extWeeks--; x.extDone = (x.extDone || 0) + 1;
      ev('warn', 'Тест-гейт', `${x.id}: тиждень не зараховано — ${x.extWhy || 'зовнішня подія'}; вікно тесту подовжено`);
      render(); return;
    }
    return orig.apply(this, arguments);
  };
  recWeek = wrapWeek(recWeek); gpWeek = wrapWeek(gpWeek);
  const oc = counts; counts = function () { oc.apply(this, arguments); wdStrip(); wdCounts(); };
}
