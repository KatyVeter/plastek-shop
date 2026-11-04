/* ==========================================================
   Общая логика сайта PLASTEK
   — загрузка каталога из data/catalog.xlsx
   — шапка, подвал, корзина с оптовыми ценами, кабинет
   ========================================================== */

/* ---------- Настройки магазина (заглушки — заменить на реальные) ---------- */
window.SITE = {
  brand: "PLASTEK",
  phone: "+86 755 0000 0000",
  email: "hello@plastek.shop",
  telegram: "https://t.me/plastek_shop",
  telegramName: "@plastek_shop",
  instagram: "https://instagram.com/plastek.shop",
  instagramName: "@plastek.shop",
  optManager: "Анна",
  optPhone: "+86 755 0000 0001",
  optTelegram: "https://t.me/plastek_opt",
  optTelegramName: "@plastek_opt",
  hours: "Пн–Пт, 9:00–18:00 по Пекину (UTC+8)",
  office: "Китай, Шэньчжэнь, район Лунган, ул. Бантянь, 18",
  seller: "PLASTEK Trading Co., Ltd.",
  regNo: "91440300XXXXXXXXXX",  // единый код социального кредита компании (Китай)
  countries: ["Казахстан", "Беларусь", "Узбекистан", "Армения", "Кыргызстан"],
  noCardCountries: ["Беларусь"],  // Stripe не обслуживает Беларусь — только банковский перевод
  payProvider: "Stripe",
  currency: "USD",
  freeFrom: 0,                 // бесплатная доставка — выключена (по тарифу службы)
  tiers: [10, 50],             // пороги оптовых цен: от 10 и от 50 катушек в заказе
  metrikaId: ""                // номер счётчика Яндекс Метрики, например "98765432"
};

(function () {
  const S = window.SITE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // Цены в долларах: $13.90, $1,250 (копейки показываем, только если они есть)
  const money = n => {
    const v = Math.round(n * 100) / 100;
    return "$" + v.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  };
  const num = v => (v === "" || v == null) ? 0 : +String(v).replace(",", ".").replace(/[^\d.]/g, "") || 0;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  /* ---------- Иконки ---------- */
  const icon = {
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    chevron: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>',
    burger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    truck: '<svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 5h13v11H1zM14 9h5l3 3v4h-8"/><circle cx="5.5" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/></svg>',
    box: '<svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
    tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 3.6L2.9 10.8c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.8c.3-1.3-.5-1.9-1.5-1.4zM8.6 13.4l9.6-6c.5-.3.9-.1.5.2l-8.1 7.3-.3 3.4-1.7-4.9z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 19V8a3 3 0 016 0v11M11 8a3 3 0 016 0v11M17 8v11"/></svg>',
    spoolLine: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="3.5"/></svg>',
    grid: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="10" height="10" rx="2"/><rect x="18" y="4" width="10" height="10" rx="2"/><rect x="4" y="18" width="10" height="10" rx="2"/><rect x="18" y="18" width="10" height="10" rx="2"/></svg>'
  };

  /* ---------- Катушка филамента (SVG) ---------- */
  let uid = 0;
  // Светлая катушка: цвет пластика занимает большую часть круга
  function spool(color = "#c9a24a") {
    const id = "g" + (++uid);
    let rings = "";
    for (let r = 38; r <= 88; r += 3) rings += `<circle cx="100" cy="100" r="${r}" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1"/>`;
    let spokes = "";
    for (let i = 0; i < 3; i++) spokes += `<rect x="96" y="6" width="8" height="62" rx="4" fill="#f3f3f3" stroke="#d4d4d4" stroke-width="1" transform="rotate(${i * 120 + 30} 100 100)"/>`;
    return `<svg class="spool" viewBox="0 0 200 200" aria-hidden="true">
      <defs><radialGradient id="${id}" cx="32%" cy="28%" r="82%">
        <stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/>
      </radialGradient></defs>
      <circle cx="100" cy="100" r="97" fill="#f3f3f3" stroke="#d4d4d4" stroke-width="1.5"/>
      <circle cx="100" cy="100" r="90" fill="${color}"/>
      ${rings}
      <circle cx="100" cy="100" r="90" fill="url(#${id})"/>
      ${spokes}
      <circle cx="100" cy="100" r="34" fill="#f3f3f3" stroke="#d4d4d4" stroke-width="1.5"/>
      <circle cx="100" cy="100" r="14" fill="#111111"/>
      <text x="100" y="80" text-anchor="middle" font-family="Manrope,Arial" font-size="7" font-weight="800" letter-spacing="1.5" fill="#9a9a9a">${S.brand}</text>
    </svg>`;
  }

  /* ---------- Загрузка каталога из Excel ---------- */
  const slug = s => s.toLowerCase().replace(/\+/g, "-plus").replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "");

  async function loadCatalog() {
    const res = await fetch("data/catalog.xlsx", { cache: "no-cache" });
    if (!res.ok) throw new Error("Не найден data/catalog.xlsx");
    const wb = XLSX.read(await res.arrayBuffer(), { type: "array" });
    const rowsOf = name => XLSX.utils.sheet_to_json(wb.Sheets[name] || {}, { defval: "" });

    const materials = rowsOf("Материалы").filter(r => r["Материал"]).map(r => ({
      id: String(r["Материал"]).trim(), tag: r["Кратко"], desc: r["Описание"],
      nozzle: r["Сопло, °C"], bed: r["Стол, °C"], speed: r["Скорость, мм/с"],
      chamber: r["Закрытая камера"], dry: r["Сушка перед печатью"], use: r["Применение"],
      group: String(r["Группа"] || "Другие").trim()
    }));

    const map = new Map();
    rowsOf("Товары").filter(r => r["Товар"] && r["Артикул"]).forEach(r => {
      const name = String(r["Товар"]).trim();
      if (!map.has(name)) {
        const matId = String(r["Материал"]).trim();
        map.set(name, { id: slug(name), name, mat: matId, material: materials.find(m => m.id === matId) || {}, variants: [], badge: "" });
      }
      const p = map.get(name);
      const v = {
        sku: String(r["Артикул"]).trim(), color: r["Цвет"], hex: r["HEX"] || "#999",
        d: num(r["Диаметр, мм"]), w: num(r["Вес, кг"]),
        price: num(r["Цена, $"]), opt1: num(r["Опт от 10 шт., $"]), opt2: num(r["Опт от 50 шт., $"]),
        stock: num(r["Остаток, шт."]), badge: r["Метка"], photo: r["Фото"], product: p
      };
      if (v.badge && !p.badge) p.badge = v.badge;
      p.variants.push(v);
    });

    const products = [...map.values()];
    products.forEach(p => {
      p.price = Math.min(...p.variants.map(v => v.price));
      p.inStock = p.variants.some(v => v.stock > 0);
    });
    const bySku = new Map(products.flatMap(p => p.variants.map(v => [v.sku, v])));
    return { materials, products, bySku };
  }

  // Каталог загружается один раз. На страницах без библиотеки Excel она подгружается по требованию (меню)
  let dataPromise = null;
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  // Настройки оплаты с сервера (/api/payment-config). Без сервера — режим «счёт от менеджера»
  let payPromise = null;
  function payConfig() {
    if (!payPromise) {
      const fallback = { mode: "invoice", cardCountries: S.countries.filter(c => !S.noCardCountries.includes(c)), shipping: {} };
      payPromise = fetch("/api/payment-config").then(r => r.ok ? r.json() : fallback).catch(() => fallback);
    }
    return payPromise;
  }

  function getData() {
    if (!dataPromise) {
      dataPromise = (typeof XLSX === "undefined" ? loadScript("js/vendor/xlsx.full.min.js") : Promise.resolve()).then(loadCatalog);
      dataPromise.catch(() => { dataPromise = null; });
    }
    return dataPromise;
  }

  /* ---------- Цены и наличие ---------- */
  function unitPrice(v, totalQty) {
    if (totalQty >= S.tiers[1] && v.opt2) return v.opt2;
    if (totalQty >= S.tiers[0] && v.opt1) return v.opt1;
    return v.price;
  }
  function stockLabel(n) {
    if (n <= 0) return `<span class="stock stock--none">Под заказ</span>`;
    if (n <= 5) return `<span class="stock stock--low">Мало — ${n} шт.</span>`;
    return `<span class="stock stock--ok">В наличии</span>`;
  }
  const fmtD = d => String(d).replace(".", ",");

  /* ---------- Корзина ---------- */
  const Cart = {
    key: "plastek-cart",
    read() { return store.get(this.key, []).filter(i => i && i.sku); },
    write(items) { store.set(this.key, items); updateCount(); },
    add(sku, qty = 1) {
      const items = this.read();
      const it = items.find(i => i.sku === sku);
      it ? (it.qty += qty) : items.push({ sku, qty });
      this.write(items);
    },
    set(sku, qty) { this.write(this.read().map(i => i.sku === sku ? { ...i, qty: Math.max(1, Math.min(999, qty)) } : i)); },
    remove(sku) { this.write(this.read().filter(i => i.sku !== sku)); },
    count() { return this.read().reduce((s, i) => s + i.qty, 0); },
    clear() { this.write([]); }
  };
  function updateCount() { $$(".cart-btn__count").forEach(el => { const c = Cart.count(); el.textContent = c; el.style.display = c ? "" : "none"; }); }

  /* ---------- Пользователь и заказы (демо: хранятся в браузере до подключения сервера) ---------- */
  const Account = {
    user() { return store.get("plastek-user", null); },
    login(u) { store.set("plastek-user", u); },
    logout() { try { localStorage.removeItem("plastek-user"); } catch {} },
    orders() { return store.get("plastek-orders", []); },
    addOrder(o) { const list = this.orders(); list.unshift(o); store.set("plastek-orders", list); }
  };

  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("is-show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("is-show"), 2400);
  }

  /* ---------- Шапка и подвал ---------- */
  function renderChrome() {
    const page = document.body.dataset.page;
    const act = p => page === p ? "is-active" : "";
    // Шапка: логотип слева, меню, поле поиска, кабинет и корзина. Верхней полосы больше нет —
    // доставка и опт видны в меню и на первом экране
    const q = new URLSearchParams(location.search).get("q") || "";
    const top = `
    <header class="header"><div class="wrap">
      <button class="burger" aria-label="Меню" aria-expanded="false">${icon.burger}</button>
      <a class="logo" href="index.html" aria-label="${S.brand} — на главную"><span class="logo__mark">${S.brand[0]}</span>${S.brand}</a>
      <nav class="nav nav--left" aria-label="Основное меню">
        <a href="catalog.html" class="nav__drop ${act("catalog")}" data-mega="catalog" aria-haspopup="true" aria-expanded="false">Каталог ${icon.chevron}</a>
        <a href="index.html#materials">Подбор пластика</a>
        <a href="opt.html" class="nav__drop ${act("opt")}" data-mega="opt" aria-haspopup="true" aria-expanded="false">Опт ${icon.chevron}</a>
        <a href="delivery.html" class="nav__drop ${act("delivery")}" data-mega="delivery" aria-haspopup="true" aria-expanded="false">Доставка ${icon.chevron}</a>
        <a href="about.html" class="${act("about")}">О компании</a>
      </nav>
      <form class="hsearch" action="catalog.html" role="search">
        ${icon.search}<input name="q" value="${esc(q)}" placeholder="PLA, PETG, цвет…" aria-label="Поиск по каталогу">
      </form>
      <div class="hicons">
        <button class="icon-btn search-toggle" aria-label="Поиск">${icon.search}</button>
        <a class="icon-btn ${act("account")}" href="account.html" aria-label="Личный кабинет">${icon.user}</a>
        <a class="icon-btn ${act("cart")}" href="cart.html" aria-label="Корзина">${icon.cart}<span class="cart-btn__count"></span></a>
      </div>
    </div>
    <div class="mega" id="mega">
      <div class="mega__panel wrap" data-panel="catalog"><div class="loading">Загружаем каталог…</div></div>
      <div class="mega__panel wrap" data-panel="opt">${optPanel()}</div>
      <div class="mega__panel wrap" data-panel="delivery">${deliveryPanel()}</div>
    </div>
    <div class="mnav" id="mnav">
      <details class="mnav__cat"><summary>Каталог ${icon.chevron}</summary><div id="mnav-cat"><div class="loading" style="padding:20px">Загружаем…</div></div></details>
      <a href="index.html#materials">Подбор пластика</a>
      <a href="opt.html">Опт и оптовые цены</a>
      <a href="delivery.html">Доставка и оплата</a>
      <a href="about.html">О компании</a>
      <a href="account.html">Личный кабинет</a>
      <a href="${S.telegram}" target="_blank" rel="noopener">Telegram ${esc(S.telegramName)}</a>
    </div></header>`;

    const foot = `
    <footer class="footer"><div class="wrap">
      <div class="footer__grid">
        <div>
          <a class="logo" href="index.html"><span class="logo__mark">${icon.logo}</span>${S.brand}</a>
          <p class="footer__about">Филамент для 3D-печати с заводов Шэньчжэня. Розница и опт.</p>
          <div class="social">
            <a href="${S.telegram}" target="_blank" rel="noopener" aria-label="Telegram">${icon.tg}</a>
            <a href="${S.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${icon.ig}</a>
          </div>        </div>
        <div><h4>Каталог</h4><ul>
          <li><a href="catalog.html">Все товары</a></li>
          ${["PLA", "PLA+", "PETG", "ABS", "TPU 95A"].map(m => `<li><a href="catalog.html?mat=${encodeURIComponent(m)}">${m}</a></li>`).join("")}
        </ul></div>
        <div><h4>Покупателям</h4><ul>
          <li><a href="delivery.html">Доставка и оплата</a></li>
          <li><a href="delivery.html#return">Возврат</a></li>
          <li><a href="opt.html">Оптовые цены</a></li>
          <li><a href="account.html">Личный кабинет</a></li>
          <li><a href="about.html">О компании</a></li>
        </ul></div>
        <div><h4>Контакты</h4><ul>
          <li><a href="tel:${S.phone.replace(/[^\d+]/g, "")}">${S.phone}</a></li>
          <li><a href="mailto:${S.email}">${S.email}</a></li>
          <li><a href="${S.telegram}" target="_blank" rel="noopener">Telegram ${S.telegramName}</a></li>
          <li>${S.hours}</li>
        </ul></div>
      </div>
      <div class="paybar">
        <span>Оплата:</span><b>Visa</b><b>Mastercard</b><b>Apple Pay</b><b>Google Pay</b><b>Банковский перевод</b>
        <small>Платежи картой обрабатывает ${S.payProvider} — мы не видим и не храним данные карт</small>
      </div>
      <div class="footer__bottom">
        <span>© ${new Date().getFullYear()} ${S.brand} · ${S.seller}, Шэньчжэнь</span>
        <span><a href="offer.html">Публичная оферта</a> · <a href="privacy.html">Политика конфиденциальности</a></span>
      </div>
    </div></footer>`;

    document.body.insertAdjacentHTML("afterbegin", top);
    document.body.insertAdjacentHTML("beforeend", foot);
    setupMenus();
    updateCount();
  }

  /* ---------- Мега-меню ---------- */
  function optPanel() {
    const [t1, t2] = S.tiers;
    return `<div class="mega__grid mega__grid--3">
      <div class="mega__col">
        <h4>Цена за катушку</h4>
        <div class="mega__tiers" id="mega-tiers">
          <div><span>1–${t1 - 1} шт.</span><b>розница</b></div>
          <div><span>от ${t1} шт.</span><b>опт 1</b></div>
          <div><span>от ${t2} шт.</span><b>опт 2</b></div>
        </div>
      </div>
      <div class="mega__col">
        <h4>Условия</h4>
        <ul class="mega__list">
          <li>Цена снижается сама в корзине</li>
          <li>Цвета и материалы можно смешивать</li>
          <li>Оплата по счёту для компаний и ИП</li>
          <li>От 200 катушек — цена по запросу</li>
        </ul>
      </div>
      <div class="mega__promo">
        <b>Менеджер по опту — ${esc(S.optManager)}</b>
        <p>${esc(S.optTelegramName)} · ${esc(S.optPhone)}</p>
        <div class="mega__btns"><a class="btn btn--gold btn--sm" href="opt.html">Оптовые цены</a><a class="btn btn--light btn--sm" href="opt.html#download">Скачать прайс</a></div>
      </div>
    </div>`;
  }
  function deliveryPanel() {
    const items = [
      ["delivery.html", "Доставка", `${S.countries.join(", ")}. Стоимость — по тарифу службы.`],
      ["delivery.html#pay", "Оплата", "Цены в долларах. Картой по ссылке или банковским переводом."],
      ["delivery.html#return", "Возврат и обмен", "14 дней на возврат. Брак заменим за свой счёт."],
      ["account.html", "Мои заказы", "Статус заказа и повтор прошлых покупок в личном кабинете."]
    ];
    return `<div class="mega__grid mega__grid--4">${items.map(([h, t, d]) => `<a class="mega__info" href="${h}"><b>${t} ${icon.arrow}</b><span>${d}</span></a>`).join("")}</div>`;
  }
  function groupsOf(data) {
    const groups = new Map();
    data.materials.forEach(m => {
      const ps = data.products.filter(p => p.mat === m.id);
      if (!ps.length) return;
      if (!groups.has(m.group)) groups.set(m.group, []);
      groups.get(m.group).push(...ps);
    });
    return groups;
  }
  const dots = p => { const seen = new Set(); return p.variants.filter(v => !seen.has(v.hex) && seen.add(v.hex)).slice(0, 6).map(v => `<i style="background:${esc(v.hex)}"></i>`).join(""); };
  function catalogPanel(data) {
    const groups = groupsOf(data);
    const colors = new Set(data.products.flatMap(p => p.variants.map(v => v.hex.toLowerCase()))).size;
    const cols = [...groups].map(([g, ps]) => `<div class="mega__col"><h4>${esc(g)}</h4>${ps.map(p => `
      <a class="mega__item" href="product.html?id=${p.id}&sku=${encodeURIComponent(showcase(p).sku)}">
        <span class="mega__name">${esc(p.name)}<span class="mega__dots">${dots(p)}</span></span>
        <span class="mega__meta">от ${money(p.price)} · ${p.variants.length} ${plural(p.variants.length, "цвет", "цвета", "цветов")}</span>
      </a>`).join("")}</div>`).join("");
    const t1 = S.tiers[0];
    return `<div class="mega__grid" style="grid-template-columns:repeat(${groups.size}, minmax(0,1fr)) minmax(0,1.25fr)">
        ${cols}
        <div class="mega__promo">
          <b>Опт от ${t1} катушек</b>
          <p>Цена снижается сама в корзине. Цвета и материалы можно смешивать.</p>
          <div class="mega__btns"><a class="btn btn--gold btn--sm" href="opt.html">Оптовые цены</a></div>
        </div>
      </div>
      <div class="mega__foot">
        <span>Быстро:</span>
        <a class="chip" href="catalog.html?badge=${encodeURIComponent("Новинка")}">Новинки</a>
        <a class="chip" href="catalog.html?badge=${encodeURIComponent("Хит")}">Хиты</a>
        <a class="chip" href="catalog.html?stock=1">В наличии</a>
        <a class="chip" href="index.html#colors">Все ${colors} ${plural(colors, "цвет", "цвета", "цветов")}</a>
        <a class="link" href="catalog.html" style="margin-left:auto">Весь каталог</a>
      </div>`;
  }
  function mobileCatalog(data) {
    return [...groupsOf(data)].map(([g, ps]) => `<div class="mnav__group">${esc(g)}</div>` + ps.map(p => `
      <a class="mnav__item" href="product.html?id=${p.id}&sku=${encodeURIComponent(showcase(p).sku)}"><span>${esc(p.name)} <span class="mega__dots">${dots(p)}</span></span><small>от ${money(p.price)}</small></a>`).join("")).join("") +
      `<a class="mnav__item" href="catalog.html"><b>Весь каталог</b></a>`;
  }

  function setupMenus() {
    const header = $(".header"), mega = $("#mega");
    let openT, closeT, filled = false;
    const fill = () => {
      if (filled) return;
      filled = true;
      getData().then(data => {
        $('[data-panel="catalog"]').innerHTML = catalogPanel(data);
        $("#mnav-cat").innerHTML = mobileCatalog(data);
        const v = data.products[0] && data.products[0].variants[0];
        if (v) $("#mega-tiers").innerHTML = `
          <div><span>1–${S.tiers[0] - 1} шт.</span><b>${money(v.price)}</b></div>
          <div><span>от ${S.tiers[0]} шт.</span><b>${money(v.opt1)}</b></div>
          <div><span>от ${S.tiers[1]} шт.</span><b>${money(v.opt2)}</b></div>
          <small>на примере ${esc(data.products[0].name)}</small>`;
      }).catch(() => { filled = false; $('[data-panel="catalog"]').innerHTML = `<div class="loading">Каталог не загрузился. <a class="link" href="catalog.html">Открыть каталог</a></div>`; });
    };
    const open = name => {
      clearTimeout(closeT); fill();
      $$("[data-panel]", mega).forEach(p => p.classList.toggle("is-on", p.dataset.panel === name));
      $$("[data-mega]").forEach(a => { const on = a.dataset.mega === name; a.classList.toggle("is-open", on); a.setAttribute("aria-expanded", on); });
      mega.classList.add("is-open");
    };
    const close = () => {
      mega.classList.remove("is-open");
      $$("[data-mega]").forEach(a => { a.classList.remove("is-open"); a.setAttribute("aria-expanded", "false"); });
    };
    $$("[data-mega]").forEach(a => a.addEventListener("focus", () => open(a.dataset.mega)));
    // Следим, над чем мышь: пункт меню — открыть его панель, панель — держать открытой,
    // остальное — закрыть с задержкой, чтобы меню не мигало при движении мыши к панели
    let hoverName = null;
    document.addEventListener("mouseover", e => {
      if (innerWidth <= 1040) return;
      const a = e.target.closest("[data-mega]");
      const name = a ? a.dataset.mega : null;
      if (name) {
        clearTimeout(closeT);
        if (name !== hoverName) { clearTimeout(openT); openT = setTimeout(() => open(name), mega.classList.contains("is-open") ? 0 : 120); }
      } else if (mega.contains(e.target)) {
        clearTimeout(closeT); clearTimeout(openT);
      } else {
        clearTimeout(openT);
        if (mega.classList.contains("is-open")) { clearTimeout(closeT); closeT = setTimeout(close, 220); }
      }
      hoverName = name;
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    document.addEventListener("focusin", e => { if (!header.contains(e.target)) close(); });

    $(".burger").addEventListener("click", () => {
      const on = header.classList.toggle("is-open");
      header.classList.remove("is-search");
      $(".burger").setAttribute("aria-expanded", on);
      if (on) fill();
    });
    // на телефоне поиск открывается отдельной строкой под шапкой
    $(".search-toggle").addEventListener("click", () => {
      const on = header.classList.toggle("is-search");
      header.classList.remove("is-open");
      if (on) $(".hsearch input").focus();
    });
    // пункты меню в бургере закрывают его (например, якорь «Подбор пластика» на той же странице)
    $$("#mnav a").forEach(a => a.addEventListener("click", () => header.classList.remove("is-open")));
  }

  /* ---------- Карточка товара в сетке ---------- */
  // Вариант для иллюстрации: яркий цвет в наличии, а не чёрный, белый или серый
  function showcase(p) {
    return p.variants.find(x => x.stock > 0 && !/чёрн|черн|бел|сер|прозр|граф/i.test(x.color))
      || p.variants.find(x => x.stock > 0) || p.variants[0];
  }

  // colors — выбранные в фильтре цвета: тогда карточка показывает именно этот цвет
  function card(p, colors) {
    const v = (colors && colors.size && p.variants.find(x => colors.has(x.color))) || showcase(p);
    const dots = p.variants.slice(0, 8).map(x => `<span style="background:${esc(x.hex)}" title="${esc(x.color)}"></span>`).join("");
    const more = p.variants.length > 8 ? `<small class="muted">+${p.variants.length - 8}</small>` : "";
    return `<a class="card" href="product.html?id=${p.id}&sku=${encodeURIComponent(v.sku)}">
      <div class="card__media">${p.badge ? `<span class="card__badge">${esc(p.badge)}</span>` : ""}${spool(v.hex)}</div>
      <div class="card__body">
        <span class="card__mat">${esc(p.mat)}</span>
        <span class="card__title">${esc(p.name)}</span>
        <div class="card__dots">${dots}${more}</div>
        <span class="card__spec">${p.variants.length} ${plural(p.variants.length, "цвет", "цвета", "цветов")} · ${fmtD(v.d)} мм · ${fmtD(v.w)} кг</span>
        <div class="card__foot">
          <span class="price">${money(p.price)}</span>
          ${p.inStock ? stockLabel(99) : stockLabel(0)}
        </div>
      </div>
    </a>`;
  }
  function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; }

  /* ---------- Cookie-уведомление и Яндекс Метрика ---------- */
  function cookieNotice() {
    if (store.get("plastek-cookie", false)) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="cookie"><span>Сайт использует cookie и Яндекс Метрику для статистики. <a href="privacy.html">Подробнее</a></span><button class="btn btn--sm">Понятно</button></div>`);
    $(".cookie .btn").onclick = () => { store.set("plastek-cookie", true); $(".cookie").remove(); };
  }
  function metrika() {
    if (!S.metrikaId) return;
    (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); }; m[i].l = 1 * new Date(); k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a); })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    ym(S.metrikaId, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }

  /* ---------- Запуск ---------- */
  renderChrome();
  cookieNotice();
  metrika();

  // Библиотека чтения Excel подключается только на страницах с каталогом
  const ready = typeof XLSX === "undefined" ? Promise.resolve(null) : getData().catch(err => {
    console.error(err);
    $$("[data-catalog]").forEach(el => el.innerHTML = `<div class="empty">Не удалось загрузить каталог (data/catalog.xlsx). Откройте сайт через сервер: node server.js</div>`);
    throw err;
  });

  window.App = { $, $$, money, esc, icon, spool, card, showcase, stockLabel, unitPrice, fmtD, plural, Cart, Account, toast, ready, store, payConfig };
})();
