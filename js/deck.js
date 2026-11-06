// Плавная навигация по разделам: нижний бегунок, клавиатура и свайпы.
(function () {
  const deck = document.getElementById("deck");
  if (!deck) return;
  const track = deck.querySelector(".deck__track");
  const slides = [...track.children];
  const range = deck.querySelector(".deck-range");
  const title = deck.querySelector(".deck-current-title");
  const position = deck.querySelector(".deck-position");
  const stops = deck.querySelector(".deck-stops");
  const interlude = deck.querySelector(".deck-interlude");
  const words = [["欢迎", "Добро пожаловать"], ["合作", "Сотрудничество"], ["旅程", "Путь"], ["交流", "Общение"]];
  let frame = 0;
  function veil(value, wordIndex = Math.floor(value), strength) {
    const word = words[Math.max(0, Math.min(words.length - 1, wordIndex))];
    interlude.querySelector(".deck-interlude__han").textContent = word[0];
    interlude.querySelector(".deck-interlude__meaning").textContent = word[1];
    const amount = strength === undefined ? Math.sin((value - Math.floor(value)) * Math.PI) : strength;
    interlude.style.opacity = reduced ? 0 : Math.min(1, Math.max(0, amount * 1.6));
  }
  function followTransition(from, to) {
    cancelAnimationFrame(frame);
    if (reduced || Math.abs(from - to) < .001) { veil(to, 0, 0); return; }
    const started = performance.now();
    const tick = now => {
      const x = -new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 / track.clientWidth;
      const progress = Math.max(0, Math.min(1, (x - from) / (to - from)));
      veil(x, Math.min(Math.round(to), Math.round(from)), Math.sin(progress * Math.PI));
      if (now - started < 700 && progress < .9999) frame = requestAnimationFrame(tick);
      else veil(to, 0, 0);
    };
    frame = requestAnimationFrame(tick);
  }
  range.max = slides.length - 1;
  const buttons = slides.map((slide, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = slide.dataset.title;
    button.addEventListener("click", () => go(i));
    stops.append(button);
    return button;
  });
  function preview(value) {
    track.style.transform = `translateX(${-100 * value}%)`;
    range.style.setProperty("--progress", `${value / (slides.length - 1) * 100}%`);
    const i = Math.round(value);
    title.textContent = slides[i].dataset.title;
    position.textContent = `${pad(i + 1)} / ${pad(slides.length)}`;
    range.setAttribute("aria-valuetext", `${slides[i].dataset.title}, ${i + 1} из ${slides.length}`);
  }
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
    const from = current < 0 ? i : -new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 / track.clientWidth;
    deck.classList.remove("is-scrubbing");
    const changed = i !== current;
    current = i;
    lockUntil = Date.now() + (reduced ? 150 : 700);
    range.value = i;
    preview(i);
    followTransition(from, i);
    slides.forEach((s, k) => {
      const on = k === i;
      s.classList.toggle("is-current", on);
      s.toggleAttribute("inert", !on); // скрытые слайды не получают фокус с клавиатуры
      s.setAttribute("aria-hidden", String(!on));
    });
    if (changed) slides[i].scrollTop = 0;

    buttons.forEach((button, k) => button.setAttribute("aria-current", String(k === i)));
    document.body.dataset.slide = slides[i].id;
    if (updateHash && location.hash.slice(1) !== slides[i].id) history.replaceState(null, "", `#${slides[i].id}`);
  }

  range.addEventListener("input", () => {
    cancelAnimationFrame(frame);
    deck.classList.add("is-scrubbing");
    preview(Number(range.value));
    veil(Number(range.value));
  });
  const settle = () => go(Math.round(Number(range.value)));
  range.addEventListener("change", settle);
  range.addEventListener("pointerup", settle);
  range.addEventListener("pointercancel", settle);
  range.addEventListener("blur", settle);
  range.addEventListener("keydown", e => {
    const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: 1, PageUp: -1 };
    if (e.key in steps || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      go(e.key === "Home" ? 0 : e.key === "End" ? slides.length - 1 : current + steps[e.key]);
    }
  });

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
    if (e.target.closest(".deck-scrubber") || e.ctrlKey || matchMedia("(max-width: 860px)").matches) return;
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
  deck.addEventListener("touchstart", e => { if (e.target.closest(".deck-scrubber")) { st = 0; return; } const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  deck.addEventListener("touchend", e => {
    if (!st) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - st < 700) go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  go(indexOf(location.hash.slice(1)), { updateHash: false });
  requestAnimationFrame(() => deck.classList.add("is-ready")); // анимация только после первого показа
})();
