/* ==========================================================
   Главная как слайды. Переходы:
   — чёрная панель у правого края: стрелки → ← и подпись следующего раздела
     (на телефоне — панель снизу);
   — клавиши ← → PageUp PageDown Home End; колесо мыши; свайп.
   Счётчик «01 —— 07» показывает текущий слайд.
   Адрес текущего слайда — в хэше: index.html#opt
   ========================================================== */
(function () {
  const deck = document.getElementById("deck");
  if (!deck) return;
  const track = deck.querySelector(".deck__track");
  const slides = [...track.children];
  const prev = deck.querySelector(".deck-prev");
  const next = deck.querySelector(".deck-next");
  const nextLabel = deck.querySelector(".deck-next-label");
  const count = deck.querySelector(".deck-count");
  const [countFrom, countTo] = count.querySelectorAll("b");
  const countBar = count.querySelector("span");
  // старые ссылки на блоки, которые теперь живут внутри слайдов
  // (старые ссылки на убранные слайды: «Материалы» → «Главная», «Популярное» → «Знакомство», «О нас» → «Опт»)
  const ALIASES = { materials: "home", colors: "welcome", popular: "welcome", about: "opt", club: "faq" };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  let current = -1, lockUntil = 0;

  const indexOf = hash => {
    const id = ALIASES[hash] || hash;
    const i = slides.findIndex(s => s.id === id);
    return i < 0 ? 0 : i;
  };

  function go(i, { updateHash = true } = {}) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === current) return;
    current = i;
    lockUntil = Date.now() + (reduced ? 150 : 700);
    track.style.transform = `translateX(${-100 * i}%)`;
    slides.forEach((s, k) => {
      const on = k === i;
      s.classList.toggle("is-current", on);
      s.toggleAttribute("inert", !on); // скрытые слайды не получают фокус с клавиатуры
      s.setAttribute("aria-hidden", String(!on));
    });
    slides[i].scrollTop = 0;

    const p = slides[i - 1], n = slides[i + 1];
    prev.disabled = !p; next.disabled = !n;
    prev.setAttribute("aria-label", p ? `Назад: ${p.dataset.title}` : "Это первый раздел");
    next.setAttribute("aria-label", n ? `Далее: ${n.dataset.title}` : "Это последний раздел");
    // подпись под стрелками ведёт вперёд; на последнем слайде — назад к началу
    nextLabel.querySelector("span").textContent = n ? `Далее: ${n.dataset.title}` : "↺ В начало";
    nextLabel.setAttribute("aria-label", n ? `Далее: ${n.dataset.title}` : "Вернуться к началу");

    countFrom.textContent = pad(i + 1);
    countTo.textContent = pad(slides.length);
    countBar.style.width = `${((i + 1) / slides.length) * 100}%`;
    document.body.dataset.slide = slides[i].id;
    if (updateHash && location.hash.slice(1) !== slides[i].id) history.replaceState(null, "", `#${slides[i].id}`);
  }

  prev.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));
  nextLabel.addEventListener("click", () => go(current === slides.length - 1 ? 0 : current + 1));

  // ссылки вида index.html#opt внутри страницы
  addEventListener("hashchange", () => go(indexOf(location.hash.slice(1)), { updateHash: false }));

  // клавиатура (кроме полей ввода)
  addEventListener("keydown", e => {
    const el = e.target instanceof Element ? e.target : null;
    if ((el && el.closest("input, textarea, select, [contenteditable]")) || e.altKey || e.ctrlKey || e.metaKey) return;
    const map = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 };
    if (e.key in map) { e.preventDefault(); go(current + map[e.key]); }
    if (e.key === "Home") { e.preventDefault(); go(0); }
    if (e.key === "End") { e.preventDefault(); go(slides.length - 1); }
  });

  // колесо: сначала прокручивается содержимое слайда (если не влезло), потом — следующий слайд
  deck.addEventListener("wheel", e => {
    if (e.ctrlKey || matchMedia("(max-width: 860px)").matches) return;
    const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(d) < 18) return;
    const s = slides[current];
    const atTop = s.scrollTop <= 0, atBottom = s.scrollTop + s.clientHeight >= s.scrollHeight - 2;
    if ((d > 0 && !atBottom) || (d < 0 && !atTop)) return;
    e.preventDefault();
    if (Date.now() < lockUntil) return;
    go(current + (d > 0 ? 1 : -1));
  }, { passive: false });

  // свайп влево-вправо (вертикальный жест оставляем прокрутке слайда)
  let sx = 0, sy = 0, st = 0;
  deck.addEventListener("touchstart", e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  deck.addEventListener("touchend", e => {
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - st < 700) go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  go(indexOf(location.hash.slice(1)), { updateHash: false });
  requestAnimationFrame(() => deck.classList.add("is-ready")); // анимация только после первого показа
})();
