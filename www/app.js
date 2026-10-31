/* Daily Fuel - daily menu, calorie/protein counter, water tracker and reminders.
   Plain JavaScript, no build step. State lives in localStorage on the device. */
(() => {
  'use strict';

  const D = window.DF_DATA;
  const KEY = 'dailyfuel.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = (x) => Math.round(x).toLocaleString('en-US');
  const n1 = (x) => String(Math.round(x * 10) / 10);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  let lnPlugin = null;
  const LN = () => {
    if (!isNative) return null;
    if (!lnPlugin) {
      const C = window.Capacitor;
      lnPlugin = (C.Plugins && C.Plugins.LocalNotifications) || (typeof C.registerPlugin === 'function' ? C.registerPlugin('LocalNotifications') : null);
    }
    return lnPlugin;
  };

  // ------------------------------------------------------------------ state
  const DEFAULTS = {
    kcal: 1700,
    protein: 120,
    water: 2500,
    quick: [200, 250, 500],
    meals: D.MEALS.map((m) => ({ id: m.id, name: m.name, time: m.time, on: true })),
    waterOn: true,
    waterStart: '08:00',
    waterEnd: '21:00',
    waterEvery: 90
  };

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    const s = Object.assign({}, DEFAULTS, (saved && saved.settings) || {});
    const savedMeals = (saved && saved.settings && saved.settings.meals) || [];
    s.meals = DEFAULTS.meals.map((m) => Object.assign({}, m, savedMeals.find((x) => x.id === m.id) || {}));
    return {
      settings: s,
      days: (saved && saved.days) || {},
      custom: (saved && saved.custom) || [],
      recent: (saved && saved.recent) || []
    };
  }
  let S = load();

  function save() {
    for (const k of Object.keys(S.days)) {
      const dd = S.days[k];
      const hasItems = Object.values(dd.slots || {}).some((a) => a.length);
      if (!hasItems && !(dd.water || []).length) delete S.days[k];
    }
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
  }

  // ------------------------------------------------------------------ dates & helpers
  const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
  const todayKey = () => dkey(new Date());
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const longDate = (k) => parseKey(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = (k) => parseKey(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  function day(k) {
    if (!S.days[k]) S.days[k] = { slots: {}, water: [] };
    const dd = S.days[k];
    dd.slots = dd.slots || {};
    dd.water = dd.water || [];
    return dd;
  }
  const allFoods = () => D.FOODS.concat(S.custom);
  const findFood = (id) => allFoods().find((f) => f.id === id);
  const meal = (id) => S.settings.meals.find((m) => m.id === id);

  function totals(k) {
    const t = { pk: 0, pp: 0, ek: 0, ep: 0, w: 0 };
    const dd = S.days[k];
    if (!dd) return t;
    for (const id of Object.keys(dd.slots || {})) {
      for (const it of dd.slots[id]) {
        const kc = it.kcal * it.qty;
        const p = it.p * it.qty;
        t.pk += kc; t.pp += p;
        if (it.eaten) { t.ek += kc; t.ep += p; }
      }
    }
    for (const e of dd.water || []) t.w += e.ml;
    return t;
  }
  function slotTotals(k, id) {
    const items = (S.days[k] && S.days[k].slots[id]) || [];
    let kc = 0, p = 0;
    for (const it of items) { kc += it.kcal * it.qty; p += it.p * it.qty; }
    return { items, kc, p, done: items.length > 0 && items.every((i) => i.eaten) };
  }

  function addItem(k, slot, food, qty = 1) {
    const dd = day(k);
    const arr = (dd.slots[slot] = dd.slots[slot] || []);
    const ex = arr.find((i) => i.foodId === food.id);
    if (ex) ex.qty += qty;
    else arr.push({ uid: uid(), foodId: food.id, name: food.name, unit: food.unit, kcal: food.kcal, p: food.p, qty, eaten: false });
    S.recent = [food.id].concat(S.recent.filter((x) => x !== food.id)).slice(0, 8);
  }

  // ------------------------------------------------------------------ icons
  const ICON = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 4 6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.500 9 7 12 3z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.500"/></svg>'
  };

  // ------------------------------------------------------------------ UI state
  let view = 'today';
  let menuDate = todayKey();
  let sheet = null;
  let armed = null, armedAt = 0;
  let perm = 'denied';
  try { perm = isNative ? 'unknown' : (typeof Notification !== 'undefined' ? Notification.permission : 'denied'); } catch (e) { perm = 'denied'; }

  const toastEl = () => $('#toast');
  let toastTimer = null;
  function toast(msg) {
    const el = toastEl();
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function confirmTap(key, msg) {
    const now = Date.now();
    if (armed === key && now - armedAt < 3500) { armed = null; return true; }
    armed = key; armedAt = now; toast(msg);
    return false;
  }

  // ------------------------------------------------------------------ view parts
  function metric(cls, label, eaten, planned, target, unit, note) {
    const pe = clamp((eaten / target) * 100, 0, 100);
    const pp = clamp((planned / target) * 100, 0, 100);
    return `<div class="metric ${cls}">
      <div class="top"><span class="label">${label}</span>
        <span class="val"><b>${n0(eaten)}</b> <span>/ ${n0(target)} ${unit}</span></span></div>
      <div class="bar" role="img" aria-label="${label}: ${n0(eaten)} of ${n0(target)} ${unit}"><i class="plan" style="width:${pp}%"></i><i class="eat" style="width:${pe}%"></i></div>
      ${note ? `<div class="note">${note}</div>` : ''}
    </div>`;
  }

  function nextMeal(k) {
    const list = S.settings.meals.slice().sort((a, b) => toMin(a.time) - toMin(b.time));
    const nm = nowMin();
    const open = list.filter((m) => !slotTotals(k, m.id).done);
    return open.find((m) => toMin(m.time) >= nm - 45) || open[0] || null;
  }

  function reminderEvents() {
    const ev = [];
    const st = S.settings;
    st.meals.forEach((m) => { if (m.on) ev.push({ min: toMin(m.time), label: m.name, kind: 'meal', id: m.id, hint: (D.MEALS.find((x) => x.id === m.id) || {}).hint || '' }); });
    if (st.waterOn) {
      const end = toMin(st.waterEnd);
      for (let t = toMin(st.waterStart), i = 0; t <= end && i < 24; t += Math.max(30, st.waterEvery), i++) ev.push({ min: t, label: 'Water', kind: 'water', id: 'w' + i });
    }
    return ev.sort((a, b) => a.min - b.min);
  }

  function nextReminderText() {
    const ev = reminderEvents();
    if (!ev.length) return 'Reminders are off';
    const nm = nowMin();
    const nx = ev.find((e) => e.min > nm) || ev[0];
    let diff = nx.min - nm; if (diff <= 0) diff += 1440;
    const h = Math.floor(diff / 60), m = diff % 60;
    return `Next reminder: ${nx.label} at ${hhmm(nx.min)} (in ${h ? h + ' h ' : ''}${m} min)`;
  }

  function gapCard(k, t) {
    const st = S.settings;
    const gapP = st.protein - t.pp;
    const gapK = st.kcal - t.pk;
    if (t.pk === 0) return '';
    if (gapP < 10 && gapK < 250) return '';
    const nm = nextMeal(k) || S.settings.meals[S.settings.meals.length - 1];
    let html = '<div class="card"><h2>Close the gap</h2>';
    if (gapP >= 10) {
      const picks = D.BOOSTERS.map(findFood).filter((f) => f && (gapP >= 25 || f.p <= gapP + 8)).slice(0, 3);
      html += `<p>You're about <b>${n0(gapP)} g protein</b> short of today's target. Adding one of these to ${esc(nm.name)} helps:</p>
        <div class="chips" style="margin-top:10px">${picks.map((f) => `<button class="chip" data-a="gap-add" data-id="${f.id}" data-slot="${nm.id}">+ ${esc(f.name.replace(' with low-fat milk', ''))} (${n0(f.p)} g)</button>`).join('')}</div>`;
    }
    if (gapK >= 250) html += `<p class="hint">Also about ${n0(gapK)} kcal under target. Rice, oats, fruit or a little olive oil add energy without a big portion.</p>`;
    return html + '</div>';
  }

  // ------------------------------------------------------------------ views
  function viewToday() {
    const k = todayKey();
    const t = totals(k);
    const st = S.settings;
    const dd = S.days[k];
    const nx = nextMeal(k);
    const water = clamp((t.w / st.water) * 100, 0, 100);
    const last = dd && dd.water.length ? dd.water[dd.water.length - 1] : null;
    const empty = t.pk === 0;

    let h = `<div class="head"><div><h1>Today</h1><div class="sub">${longDate(k)}</div></div></div>`;

    if (isNative && perm !== 'granted') {
      h += `<div class="banner"><b>Reminders are off.</b> Allow notifications so the app can remind you to eat and drink.<br><button class="btn primary small" data-a="enable-reminders">Turn on reminders</button></div>`;
    }
    if (empty) {
      h += `<div class="banner info"><b>No menu for today yet.</b> Start with a suggested day of six small mini-meals, then adjust it.<br><button class="btn primary small" data-a="template" data-date="${k}">Load suggested menu</button></div>`;
    }

    h += `<div class="card"><h2>Intake</h2>
      ${metric('m-kcal', 'Calories', t.ek, t.pk, st.kcal, 'kcal', `Planned ${n0(t.pk)} kcal`)}
      ${metric('m-prot', 'Protein', t.ep, t.pp, st.protein, 'g', `Planned ${n0(t.pp)} g`)}
      <div class="legend"><span class="l-eaten">Eaten</span><span class="l-plan">Planned</span></div></div>`;

    h += `<div class="card m-water"><h2>Water</h2>
      <div class="card-row"><div class="water-big">${n1(t.w / 1000)} <small>L of ${n1(st.water / 1000)} L</small></div>
      <button class="btn ghost small" data-a="water-undo" ${last ? '' : 'disabled'}>Undo</button></div>
      <div class="bar" style="margin:10px 0 12px"><i class="eat" style="width:${water}%"></i></div>
      <div class="chips">${st.quick.map((ml) => `<button class="chip water" data-a="water-add" data-ml="${ml}">+${ml} ml</button>`).join('')}</div>
      <div class="card-row" style="margin-top:10px;gap:8px"><input id="wcustom" type="number" inputmode="numeric" placeholder="Other amount (ml)" style="max-width:none;flex:1;min-width:0"><button class="btn small" data-a="water-custom">Add</button></div>
      ${last ? `<p class="hint">Last drink at ${new Date(last.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} (${last.ml} ml)</p>` : ''}</div>`;

    h += `<div class="card"><h2>Today's meals</h2><ul class="tl">${st.meals.slice().sort((a, b) => toMin(a.time) - toMin(b.time)).map((m) => {
      const s = slotTotals(k, m.id);
      const cls = [s.done ? 'done' : '', nx && nx.id === m.id ? 'next' : ''].join(' ');
      const sub = s.items.length ? `${s.items.length} item${s.items.length > 1 ? 's' : ''} · ${n0(s.kc)} kcal · ${n0(s.p)} g protein` : 'Nothing planned. Tap to add.';
      return `<li class="${cls}"><span class="time">${m.time}</span>
        <button class="info" data-a="open-add" data-slot="${m.id}" data-date="${k}"><b>${esc(m.name)}</b><small>${sub}</small></button>
        <button class="tick ${s.done ? 'on' : ''}" data-a="slot-eat" data-slot="${m.id}" data-date="${k}" ${s.items.length ? '' : 'disabled'} aria-label="Mark ${esc(m.name)} as eaten">${ICON.check}</button></li>`;
    }).join('')}</ul><p class="hint">${nextReminderText()}</p></div>`;

    h += gapCard(k, t);
    h += '<p class="foot">Values are estimates, not medical advice. Share your intake with your doctor or dietitian.</p>';
    return h;
  }

  function viewMenu() {
    const k = menuDate;
    const t = totals(k);
    const st = S.settings;
    const isToday = k === todayKey();
    let h = `<div class="head"><div><h1>Menu</h1><div class="sub">Plan the day, then tick items as you eat them</div></div></div>
      <div class="datenav"><button data-a="day-prev" aria-label="Previous day">&#8249;</button>
      <div class="d">${isToday ? 'Today, ' : ''}${shortDate(k)}</div>
      <button data-a="day-next" aria-label="Next day">&#8250;</button></div>`;

    h += `<div class="card">
      ${metric('m-kcal', 'Planned calories', t.pk, t.pk, st.kcal, 'kcal', t.ek ? `Eaten so far: ${n0(t.ek)} kcal` : '')}
      ${metric('m-prot', 'Planned protein', t.pp, t.pp, st.protein, 'g', t.ep ? `Eaten so far: ${n0(t.ep)} g` : '')}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn small" data-a="template" data-date="${k}">Suggested menu</button>
        <button class="btn small" data-a="copy-prev" data-date="${k}">Copy previous day</button>
        <button class="btn danger small" data-a="clear-day" data-date="${k}">Clear day</button></div></div>`;

    if (t.pk > 0 && (t.pk < 1200 || t.pp < st.protein * 0.8)) {
      const bits = [];
      if (t.pk < 1200) bits.push(`about ${n0(t.pk)} kcal`);
      if (t.pp < st.protein * 0.8) bits.push(`${n0(t.pp)} g protein`);
      h += `<div class="banner"><b>This plan is light:</b> ${bits.join(' and ')} against targets of ${n0(st.kcal)} kcal and ${n0(st.protein)} g protein. Add a mini-meal, a whey shake or a protein-rich snack.</div>`;
    }

    h += st.meals.slice().sort((a, b) => toMin(a.time) - toMin(b.time)).map((m) => {
      const s = slotTotals(k, m.id);
      return `<div class="card"><div class="slot-head"><h3>${esc(m.name)}<small>${m.time}</small></h3>
        <div class="sum">${n0(s.kc)} kcal<br>${n0(s.p)} g protein</div></div>
        ${s.items.length ? s.items.map((it) => `<div class="item ${it.eaten ? 'eaten' : ''}">
          <button class="tick ${it.eaten ? 'on' : ''}" data-a="item-eat" data-date="${k}" data-slot="${m.id}" data-uid="${it.uid}" aria-label="Mark ${esc(it.name)} as eaten">${ICON.check}</button>
          <div class="txt"><b>${esc(it.name)}</b><small>${n1(it.qty)} × ${esc(it.unit)} · ${n0(it.kcal * it.qty)} kcal · ${n1(it.p * it.qty)} g protein</small></div>
          <div class="stepper"><button data-a="qty" data-d="-0.5" data-date="${k}" data-slot="${m.id}" data-uid="${it.uid}" aria-label="Less">−</button><span>${n1(it.qty)}</span><button data-a="qty" data-d="0.5" data-date="${k}" data-slot="${m.id}" data-uid="${it.uid}" aria-label="More">+</button></div>
          <button class="x" data-a="item-del" data-date="${k}" data-slot="${m.id}" data-uid="${it.uid}" aria-label="Remove ${esc(it.name)}">×</button></div>`).join('') : '<p class="empty">Nothing planned for this mini-meal.</p>'}
        <div style="margin-top:10px"><button class="btn small" data-a="open-add" data-slot="${m.id}" data-date="${k}">+ Add food</button></div></div>`;
    }).join('');
    return h;
  }

  function viewHistory() {
    const st = S.settings;
    const keys = [];
    for (let i = 0; i < 14; i++) keys.push(addDays(todayKey(), -i));
    const rows = keys.filter((k) => S.days[k]).map((k) => ({ k, t: totals(k) })).filter((r) => r.t.pk || r.t.w);
    const last7 = rows.filter((r) => r.k >= addDays(todayKey(), -6));
    const avg = (f) => (last7.length ? last7.reduce((a, r) => a + f(r.t), 0) / last7.length : 0);
    let h = `<div class="head"><div><h1>History</h1><div class="sub">Last 14 days</div></div></div>`;
    if (!rows.length) return h + '<div class="card"><p class="empty">Nothing logged yet. Your days will appear here once you tick off meals or add water.</p></div>';
    h += `<div class="card"><h2>7-day average (${last7.length} day${last7.length === 1 ? '' : 's'} logged)</h2><div class="avg">
      <div><b style="color:var(--kcal)">${n0(avg((t) => t.ek))}</b><span>kcal eaten</span></div>
      <div><b style="color:var(--prot)">${n0(avg((t) => t.ep))} g</b><span>protein eaten</span></div>
      <div><b style="color:var(--water)">${n1(avg((t) => t.w) / 1000)} L</b><span>water</span></div></div></div>`;
    h += `<div class="card">${rows.map(({ k, t }) => `<div class="hrow"><div class="dt">${shortDate(k)}</div><div>
      <div class="nums"><b>${n0(t.ek)}</b> kcal · <b>${n0(t.ep)}</b> g protein · <b>${n1(t.w / 1000)}</b> L water</div>
      <div class="mini"><i style="width:${clamp(t.ek / st.kcal * 100, 0, 100)}%;background:var(--kcal)"></i></div>
      <div class="mini"><i style="width:${clamp(t.ep / st.protein * 100, 0, 100)}%;background:var(--prot)"></i></div>
      <div class="mini"><i style="width:${clamp(t.w / st.water * 100, 0, 100)}%;background:var(--water)"></i></div></div></div>`).join('')}</div>`;
    return h;
  }

  function permLabel() {
    if (isNative) return perm === 'granted' ? '<span class="status">Allowed</span>' : '<span class="status bad">Not allowed</span>';
    return perm === 'granted' ? '<span class="status">Allowed</span>' : '<span class="status bad">Not allowed</span>';
  }

  function viewSettings() {
    const st = S.settings;
    const wcount = reminderEvents().filter((e) => e.kind === 'water').length;
    let h = `<div class="head"><div><h1>Settings</h1><div class="sub">Targets and reminders</div></div></div>`;

    h += `<div class="card"><h2>Daily targets</h2>
      <div class="field"><label for="s-kcal">Calories<small>kcal per day</small></label><input id="s-kcal" data-s="kcal" type="number" inputmode="numeric" min="800" max="4000" value="${st.kcal}"></div>
      <div class="field"><label for="s-protein">Protein<small>grams per day</small></label><input id="s-protein" data-s="protein" type="number" inputmode="numeric" min="30" max="300" value="${st.protein}"></div>
      <div class="field"><label for="s-water">Water<small>millilitres per day</small></label><input id="s-water" data-s="water" type="number" inputmode="numeric" min="500" max="6000" step="50" value="${st.water}"></div>
      <div class="field"><label for="s-quick">Quick-add sizes<small>millilitres, comma separated</small></label><input id="s-quick" data-s="quick" type="text" style="max-width:150px" value="${st.quick.join(', ')}"></div></div>`;

    h += `<div class="card"><h2>Meal reminders</h2>${st.meals.map((m) => `<div class="field">
      <label for="mt-${m.id}">${esc(m.name)}</label>
      <input id="mt-${m.id}" type="time" data-meal="${m.id}" data-k="time" value="${m.time}">
      <span class="switch"><input type="checkbox" data-meal="${m.id}" data-k="on" ${m.on ? 'checked' : ''} aria-label="${esc(m.name)} reminder"><span></span></span></div>`).join('')}</div>`;

    h += `<div class="card"><h2>Water reminders</h2>
      <div class="field"><label for="w-on">Remind me to drink</label><span class="switch"><input id="w-on" type="checkbox" data-w="waterOn" ${st.waterOn ? 'checked' : ''}><span></span></span></div>
      <div class="field"><label for="w-start">From</label><input id="w-start" type="time" data-w="waterStart" value="${st.waterStart}"></div>
      <div class="field"><label for="w-end">Until</label><input id="w-end" type="time" data-w="waterEnd" value="${st.waterEnd}"></div>
      <div class="field"><label for="w-every">Every</label><select id="w-every" data-w="waterEvery">${[60, 90, 120, 150].map((v) => `<option value="${v}" ${st.waterEvery === v ? 'selected' : ''}>${v} minutes</option>`).join('')}</select></div>
      <p class="hint">${st.waterOn ? `${wcount} water reminders a day.` : 'Water reminders are off.'}</p></div>`;

    h += `<div class="card"><h2>Notifications</h2>
      <div class="card-row"><span>Permission</span>${permLabel()}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn primary small" data-a="enable-reminders">${isNative ? 'Allow and schedule reminders' : 'Allow browser notifications'}</button><button class="btn small" data-a="test-notif">Send a test</button></div>
      <p class="hint">${isNative
        ? 'Reminders repeat every day, even when the app is closed. On Xiaomi, Oppo, Vivo and Samsung phones, set Daily Fuel to "No restrictions" under Settings, Apps, Battery, so the system does not delay them.'
        : 'In a browser, reminders only appear while this page is open. Install the Android app for reminders in the background.'}</p></div>`;

    h += `<div class="card"><h2>Backup</h2>
      <textarea id="backup" placeholder="Tap Copy backup, then paste it somewhere safe. To restore, paste a backup here and tap Restore."></textarea>
      <div class="btn-row" style="margin-top:10px"><button class="btn small" data-a="backup-copy">Copy backup</button><button class="btn small" data-a="backup-restore">Restore</button><button class="btn danger small" data-a="reset-all">Reset everything</button></div></div>`;
    return h;
  }

  // ------------------------------------------------------------------ render
  function render() {
    const main = $('#main');
    main.innerHTML = view === 'today' ? viewToday() : view === 'menu' ? viewMenu() : view === 'history' ? viewHistory() : viewSettings();
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
  }

  // ------------------------------------------------------------------ add-food sheet
  const CATS = ['All', 'Protein', 'Eggs & dairy', 'Soups & legumes', 'Carbs', 'Fruit & veg', 'Fats & extras', 'Meals & wraps', 'Drinks', 'Custom'];

  function openSheet(slot, k) {
    sheet = { slot, k, q: '', cat: 'All', custom: false };
    const m = meal(slot);
    $('#sheet-root').innerHTML = `<div class="scrim" data-a="scrim"><div class="sheet" role="dialog" aria-label="Add food to ${esc(m.name)}">
      <div class="sh"><div class="row"><h3>Add to ${esc(m.name)}</h3><button class="btn small" data-a="close-sheet">Done</button></div>
      <input id="q" type="text" placeholder="Search foods" autocomplete="off"></div>
      <div class="cats">${CATS.map((c) => `<button class="chip ${c === 'All' ? 'on' : ''}" data-a="cat" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}<button class="chip" data-a="custom-toggle">+ New food</button></div>
      <div class="list" id="foodlist"></div></div></div>`;
    renderFoodList();
  }
  function closeSheet() { sheet = null; $('#sheet-root').innerHTML = ''; }

  function renderFoodList() {
    if (!sheet) return;
    const list = $('#foodlist');
    if (sheet.custom) {
      list.innerHTML = `<div class="custom">
        <input class="full" id="c-name" type="text" placeholder="Food name" maxlength="60">
        <input class="full" id="c-unit" type="text" placeholder="Serving (for example 1 bowl)" maxlength="40">
        <input id="c-kcal" type="number" inputmode="decimal" placeholder="Calories">
        <input id="c-p" type="number" inputmode="decimal" placeholder="Protein (g)">
        <button class="btn primary full" data-a="custom-save">Save and add</button></div>`;
      return;
    }
    const q = sheet.q.trim().toLowerCase();
    let foods = allFoods().filter((f) => (sheet.cat === 'All' || (sheet.cat === 'Custom' ? f.cat === 'Custom' : f.cat === sheet.cat)) && (!q || (f.name + ' ' + f.unit).toLowerCase().includes(q)));
    let html = '';
    if (!q && sheet.cat === 'All' && S.recent.length) {
      const rec = S.recent.map(findFood).filter(Boolean);
      if (rec.length) html += `<p class="hint" style="margin:4px 0">Recent</p>${rec.map(foodRow).join('')}<p class="hint" style="margin:14px 0 4px">All foods</p>`;
    }
    html += foods.map(foodRow).join('') || '<p class="empty">No match. Tap "+ New food" to add your own.</p>';
    list.innerHTML = html;
  }
  const foodRow = (f) => `<button class="food" data-a="add-food" data-id="${esc(f.id)}"><div class="t"><b>${esc(f.name)}</b><small>${esc(f.unit)}</small></div><div class="n">${n0(f.kcal)} kcal<br>${n1(f.p)} g protein</div><span class="add">+</span></button>`;

  // ------------------------------------------------------------------ reminders
  async function enableReminders() {
    const ln = LN();
    if (ln) {
      try {
        let p = await ln.checkPermissions();
        if (p.display !== 'granted') p = await ln.requestPermissions();
        perm = p.display;
        if (perm === 'granted') { await reschedule(); toast('Reminders are on'); }
        else toast('Notifications are blocked in Android settings');
      } catch (e) { toast('Could not enable reminders'); }
    } else if (typeof Notification !== 'undefined') {
      try { perm = await Notification.requestPermission(); } catch (e) { perm = 'denied'; }
      toast(perm === 'granted' ? 'Browser notifications are on' : 'Notifications are blocked');
    } else toast('Notifications are not supported here');
    render();
  }

  async function reschedule() {
    const ln = LN();
    if (!ln || perm !== 'granted') return;
    try {
      await ln.createChannel({ id: 'meals', name: 'Meal reminders', description: 'Reminders to eat your mini-meals', importance: 4, visibility: 1, vibration: true });
      await ln.createChannel({ id: 'water', name: 'Water reminders', description: 'Reminders to drink water', importance: 3, visibility: 1, vibration: true });
      const pending = await ln.getPending();
      if (pending.notifications && pending.notifications.length) await ln.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      const st = S.settings;
      const list = [];
      reminderEvents().forEach((e, i) => {
        const on = { hour: Math.floor(e.min / 60), minute: e.min % 60 };
        if (e.kind === 'meal') {
          list.push({ id: 1000 + parseInt(e.id.slice(1), 10), channelId: 'meals', title: `Mini-meal: ${e.label}`, body: `${e.hint ? e.hint + '. ' : ''}Small portions, protein first.`, schedule: { on, allowWhileIdle: true }, smallIcon: 'ic_stat_icon' });
        } else {
          list.push({ id: 2000 + i, channelId: 'water', title: 'Water break', body: `Sip 200-250 ml. Aim for ${n1(st.water / 1000)} L today.`, schedule: { on, allowWhileIdle: true }, smallIcon: 'ic_stat_icon' });
        }
      });
      if (list.length) await ln.schedule({ notifications: list });
    } catch (e) { /* scheduling is best effort */ }
  }
  let rsTimer = null;
  const rescheduleSoon = () => { clearTimeout(rsTimer); rsTimer = setTimeout(reschedule, 700); };

  async function testNotification() {
    const ln = LN();
    if (ln) {
      if (perm !== 'granted') { await enableReminders(); if (perm !== 'granted') return; }
      try {
        await ln.createChannel({ id: 'meals', name: 'Meal reminders', description: 'Reminders to eat your mini-meals', importance: 4, visibility: 1, vibration: true });
        await ln.schedule({ notifications: [{ id: 9999, channelId: 'meals', title: 'Daily Fuel', body: 'Test reminder: this is how your reminders will look.', schedule: { at: new Date(Date.now() + 5000).toISOString(), allowWhileIdle: true }, smallIcon: 'ic_stat_icon' }] });
        toast('Test reminder in 5 seconds. Close the app to see it arrive.');
      } catch (e) { toast('Could not send the test'); }
    } else {
      toast('Test reminder: drink some water');
      if (perm === 'granted') new Notification('Daily Fuel', { body: 'Test reminder: this is how reminders look.' });
    }
  }

  // Browser fallback: fire reminders while the page is open.
  const fired = new Set();
  function webTick() {
    if (isNative) return;
    const now = nowMin();
    const k = todayKey();
    reminderEvents().forEach((e) => {
      const id = `${k}|${e.kind}|${e.id}`;
      if (e.min === now && !fired.has(id)) {
        fired.add(id);
        const msg = e.kind === 'meal' ? `Mini-meal: ${e.label}` : 'Water break: sip 200-250 ml';
        toast(msg);
        if (perm === 'granted') { try { new Notification('Daily Fuel', { body: msg }); } catch (er) { /* ignore */ } }
      }
    });
  }

  // ------------------------------------------------------------------ actions
  const A = {
    nav: (d) => { view = d.v; window.scrollTo(0, 0); render(); },
    'water-add': (d) => { day(todayKey()).water.push({ t: Date.now(), ml: Number(d.ml) }); save(); render(); },
    'water-custom': () => {
      const v = Math.round(Number(($('#wcustom') || {}).value));
      if (!(v >= 20 && v <= 2000)) { toast('Enter an amount between 20 and 2000 ml'); return; }
      day(todayKey()).water.push({ t: Date.now(), ml: v }); save(); render();
    },
    'water-undo': () => { const dd = day(todayKey()); dd.water.pop(); save(); render(); },
    'slot-eat': (d) => {
      const items = (day(d.date).slots[d.slot]) || [];
      const all = items.length && items.every((i) => i.eaten);
      items.forEach((i) => { i.eaten = !all; }); save(); render();
    },
    'item-eat': (d) => { const it = (day(d.date).slots[d.slot] || []).find((i) => i.uid === d.uid); if (it) { it.eaten = !it.eaten; save(); render(); } },
    qty: (d) => {
      const it = (day(d.date).slots[d.slot] || []).find((i) => i.uid === d.uid);
      if (it) { it.qty = clamp(Math.round((it.qty + Number(d.d)) * 2) / 2, 0.5, 20); save(); render(); }
    },
    'item-del': (d) => { const dd = day(d.date); dd.slots[d.slot] = (dd.slots[d.slot] || []).filter((i) => i.uid !== d.uid); save(); render(); },
    'open-add': (d) => openSheet(d.slot, d.date),
    'close-sheet': () => closeSheet(),
    scrim: (d, el, e) => { if (e.target === el) closeSheet(); },
    cat: (d) => {
      sheet.cat = d.cat; sheet.custom = false;
      document.querySelectorAll('.sheet .cats .chip').forEach((b) => b.classList.toggle('on', b.dataset.cat === d.cat));
      renderFoodList();
    },
    'custom-toggle': () => { sheet.custom = !sheet.custom; renderFoodList(); },
    'add-food': (d) => {
      const f = findFood(d.id); if (!f || !sheet) return;
      addItem(sheet.k, sheet.slot, f); save(); render();
      toast(`Added to ${meal(sheet.slot).name}`);
      const list = $('#foodlist'); if (list && !sheet.q) renderFoodList();
    },
    'custom-save': () => {
      const name = ($('#c-name').value || '').trim();
      const kcal = Number($('#c-kcal').value);
      const p = Number($('#c-p').value || 0);
      if (!name || !(kcal >= 0) || $('#c-kcal').value === '') { toast('Enter a name and calories'); return; }
      const f = { id: 'c_' + uid(), cat: 'Custom', name, unit: ($('#c-unit').value || '1 serving').trim(), kcal: clamp(kcal, 0, 3000), p: clamp(p || 0, 0, 300) };
      S.custom.push(f); addItem(sheet.k, sheet.slot, f); save(); render();
      sheet.custom = false; renderFoodList(); toast(`Added ${name}`);
    },
    template: (d) => {
      const dd = day(d.date);
      const has = Object.values(dd.slots).some((a) => a.length);
      if (has && !confirmTap('tpl' + d.date, 'Tap again to replace this day with the suggested menu')) return;
      dd.slots = {};
      D.TEMPLATE.forEach(([slot, id, qty]) => addItem(d.date, slot, findFood(id), qty));
      save(); render(); toast('Suggested menu loaded');
    },
    'copy-prev': (d) => {
      const prev = S.days[addDays(d.date, -1)];
      const has = prev && Object.values(prev.slots).some((a) => a.length);
      if (!has) { toast('Nothing planned the day before'); return; }
      const dd = day(d.date);
      if (Object.values(dd.slots).some((a) => a.length) && !confirmTap('cp' + d.date, 'Tap again to replace this day')) return;
      dd.slots = JSON.parse(JSON.stringify(prev.slots));
      Object.values(dd.slots).forEach((a) => a.forEach((i) => { i.eaten = false; i.uid = uid(); }));
      save(); render(); toast('Copied from the day before');
    },
    'clear-day': (d) => {
      if (!confirmTap('clr' + d.date, 'Tap again to clear this day\'s menu')) return;
      day(d.date).slots = {}; save(); render();
    },
    'day-prev': () => { menuDate = addDays(menuDate, -1); render(); },
    'day-next': () => { menuDate = addDays(menuDate, 1); render(); },
    'gap-add': (d) => { addItem(todayKey(), d.slot, findFood(d.id)); save(); render(); toast(`Added to ${meal(d.slot).name}`); },
    'enable-reminders': () => enableReminders(),
    'test-notif': () => testNotification(),
    'backup-copy': async () => {
      const ta = $('#backup'); ta.value = JSON.stringify(S);
      try { await navigator.clipboard.writeText(ta.value); toast('Backup copied'); } catch (e) { ta.select(); toast('Select and copy the text'); }
    },
    'backup-restore': () => {
      try {
        const o = JSON.parse($('#backup').value);
        if (!o || typeof o !== 'object' || !o.settings || !o.days) throw new Error('bad');
        localStorage.setItem(KEY, JSON.stringify(o)); S = load(); save(); render(); rescheduleSoon(); toast('Backup restored');
      } catch (e) { toast('That is not a valid backup'); }
    },
    'reset-all': () => {
      if (!confirmTap('reset', 'Tap again to erase all data on this device')) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      S = load(); render(); rescheduleSoon(); toast('All data erased');
    }
  };

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('#nav button');
    if (nav) { A.nav({ v: nav.dataset.v }); return; }
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.a];
    if (fn) fn(el.dataset, el, e);
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'q' && sheet) { sheet.q = e.target.value; renderFoodList(); }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const st = S.settings;
    if (el.dataset.s) {
      const key = el.dataset.s;
      if (key === 'quick') {
        const v = el.value.split(/[ ,]+/).map(Number).filter((n) => n >= 50 && n <= 1500).slice(0, 4);
        st.quick = v.length ? v : DEFAULTS.quick;
      } else {
        const lim = { kcal: [800, 4000], protein: [30, 300], water: [500, 6000] }[key];
        const v = Number(el.value);
        st[key] = lim && v ? clamp(Math.round(v), lim[0], lim[1]) : DEFAULTS[key];
      }
      save(); rescheduleSoon(); render();
    } else if (el.dataset.meal) {
      const m = meal(el.dataset.meal);
      if (el.dataset.k === 'on') m.on = el.checked;
      else if (el.value) m.time = el.value;
      save(); rescheduleSoon(); if (el.dataset.k === 'on') render();
    } else if (el.dataset.w) {
      const key = el.dataset.w;
      if (el.type === 'checkbox') st[key] = el.checked;
      else if (key === 'waterEvery') st[key] = Number(el.value);
      else if (el.value) st[key] = el.value;
      save(); rescheduleSoon(); render();
    }
  });

  // ------------------------------------------------------------------ boot
  function boot() {
    $('#nav .in').innerHTML = [['today', 'Today'], ['menu', 'Menu'], ['history', 'History'], ['settings', 'Settings']]
      .map(([v, l]) => `<button data-v="${v}" aria-label="${l}">${ICON[v]}<span>${l}</span></button>`).join('');
    render();
    if (isNative) {
      const ln = LN();
      if (ln) ln.checkPermissions().then((p) => { perm = p.display; if (perm === 'granted') reschedule(); render(); }).catch(() => {});
    }
    setInterval(webTick, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    // Keep "today" accurate across midnight and refresh the next-reminder line.
    setInterval(() => { if (!document.hidden && !sheet && (view === 'today')) render(); }, 60000);
  }
  boot();
})();
