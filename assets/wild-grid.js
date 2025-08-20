/* Shoppable "in the wild" grid - JS (vanilla)
   - Color first (segmented bar with left color strips)
   - Size second (large select with placeholder)
   - Live price update
   - Add-to-cart + "Black & Medium" bonus rule based on chosen variant
*/

(function () {
  /* helpers */
  const money = (cents, format) => {
    if (typeof cents === "string") cents = cents.replace(".", "");
    const value = (cents / 100).toFixed(2);
    return format
      .replace("{{amount}}", value)
      .replace("{{amount_no_decimals}}", Math.round(cents / 100))
      .replace("{{amount_with_comma_separator}}", value.replace(".", ","));
  };
  const textOnly = (html) => {
    const el = document.createElement("div");
    el.innerHTML = html || "";
    return (el.textContent || el.innerText || "").trim();
  };
  const byHandle = (handle) => fetch(`/products/${handle}.js`).then((r) => r.json());
  const optNameString = (opt) => (typeof opt === "string" ? opt : (opt && opt.name) || "");
  const optValuesArray = (product, idx) => {
    if (
      Array.isArray(product.options_with_values) &&
      product.options_with_values[idx] &&
      Array.isArray(product.options_with_values[idx].values)
    ) return product.options_with_values[idx].values;
    const key = `option${idx + 1}`;
    return Array.from(new Set(product.variants.map((v) => v[key])));
  };
  const variantImageSrc = (variant) =>
    variant && variant.featured_image && variant.featured_image.src ? variant.featured_image.src : null;

  function initOne(root) {
    if (!root || root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";

    const currencyFormat = JSON.parse(root.dataset.currencyFormat || '"${{amount}}"');
    const bonusVariantId = root.dataset.bonusId || "";

    const modal = root.querySelector(".wg-modal");
    const dlg = root.querySelector(".wg-dialog");
    const mediaEl = root.querySelector(".wg-media img");
    const titleEl = root.querySelector(".wg-title");
    const priceEl = root.querySelector(".wg-price");
    const descEl = root.querySelector(".wg-desc");
    const optsWrap = root.querySelector(".wg-options");
    const atcBtn = root.querySelector(".wg-atc");

    let product = null;
    let currentVariant = null;
    let baseVariant = null;
    let selected = {}; // by option name

    const allSelected = (p, sel) =>
      p.options.every((o) => {
        const name = optNameString(o);
        return sel[name] && String(sel[name]).length > 0;
      });

    const findVariant = (p, sel) =>
      p.variants.find((v) => {
        for (let i = 0; i < p.options.length; i++) {
          const name = optNameString(p.options[i]);
          if (String(v[`option${i + 1}`]) !== String(sel[name])) return false;
        }
        return true;
      }) || null;

    function renderOptions(p) {
      optsWrap.innerHTML = "";

      // order: Color first, Size second, then others
      const enriched = p.options.map((o, idx) => ({ name: optNameString(o), idx }));
      const rank = (n) => (n.toLowerCase() === "color" ? 0 : n.toLowerCase() === "size" ? 1 : 2);
      enriched.sort((a, b) => rank(a.name) - rank(b.name));

      enriched.forEach(({ name, idx }) => {
        const values = optValuesArray(p, idx);
        const group = document.createElement("div");
        group.className = "wg-opt-group";

        const label = document.createElement("label");
        label.className = "wg-opt-label";
        label.textContent = name;
        group.appendChild(label);

        if (/color/i.test(name)) {
          const row = document.createElement("div");
          row.className = "wg-swatches wg-swatches--bar";

          values.forEach((val, i) => {
            const id = `sw_${name}_${val}`.replace(/\s+/g, "_");
            const wrap = document.createElement("div");
            wrap.className = "wg-swatch";
            wrap.style.setProperty("--swatch-color", String(val).toLowerCase()); // left strip color

            const input = document.createElement("input");
            input.type = "radio";
            input.name = `opt_${idx}`;
            input.id = id;
            input.value = val;

            const lab = document.createElement("label");
            lab.setAttribute("for", id);
            lab.textContent = val;
            if (i > 0) lab.classList.add("with-divider"); // black divider between boxes

            input.addEventListener("change", () => {
              selected[name] = val;
              currentVariant = allSelected(p, selected) ? findVariant(p, selected) : null;
              updateVariantUI();
            });

            wrap.appendChild(input);
            wrap.appendChild(lab);
            row.appendChild(wrap);
          });

          group.appendChild(row);
        } else if (/size/i.test(name)) {
          const select = document.createElement("select");
          select.className = "wg-select";

          const ph = document.createElement("option");
          ph.value = "";
          ph.textContent = "Choose your size";
          ph.disabled = true;
          ph.selected = true;
          select.appendChild(ph);

          values.forEach((val) => {
            const o = document.createElement("option");
            o.value = val;
            o.textContent = val;
            select.appendChild(o);
          });

          select.addEventListener("change", () => {
            selected[name] = select.value;
            currentVariant = allSelected(p, selected) ? findVariant(p, selected) : null;
            updateVariantUI();
          });

          group.appendChild(select);
        } else {
          const select = document.createElement("select");
          select.className = "wg-select";

          const ph = document.createElement("option");
          ph.value = "";
          ph.textContent = `Choose ${name.toLowerCase()}`;
          ph.disabled = true;
          ph.selected = true;
          select.appendChild(ph);

          values.forEach((val) => {
            const o = document.createElement("option");
            o.value = val;
            o.textContent = val;
            select.appendChild(o);
          });

          select.addEventListener("change", () => {
            selected[name] = select.value;
            currentVariant = allSelected(p, selected) ? findVariant(p, selected) : null;
            updateVariantUI();
          });

          group.appendChild(select);
        }

        optsWrap.appendChild(group);
      });
    }

    function updateVariantUI() {
      if (currentVariant) {
        priceEl.textContent = money(currentVariant.price, currencyFormat);
        atcBtn.disabled = !currentVariant.available;
        const vImg = variantImageSrc(currentVariant);
        if (vImg) mediaEl.src = vImg;
      } else {
        priceEl.textContent = money(baseVariant.price, currencyFormat);
        atcBtn.disabled = true;
      }
    }

    function openModal(p) {
      product = p;
      selected = {};
      baseVariant = p.variants.find((v) => v.available) || p.variants[0];
      currentVariant = null;

      titleEl.textContent = p.title;
      descEl.textContent = textOnly(p.description).slice(0, 220);
      mediaEl.src = (p.images && p.images.length && p.images[0]) || p.featured_image || "";

      priceEl.textContent = money(baseVariant.price, currencyFormat);
      renderOptions(p);
      updateVariantUI();

      modal.hidden = false;
      dlg.focus();
    }

    function closeModal() { modal.hidden = true; }

   // ---------- Add to cart with bonus rule (robust) ----------
async function addToCart(e) {
  e.preventDefault();
  if (!currentVariant) return;

  // Normalize option values (so 'M' == 'medium', etc.)
  const normalize = (v) => {
    const s = String(v || '').trim().toLowerCase();

    // common size aliases
    if (s === 'xs' || s === 'x-small' || s === 'extra small') return 'extra small';
    if (s === 's'  || s === 'small')  return 'small';
    if (s === 'm'  || s === 'medium') return 'medium';
    if (s === 'l'  || s === 'large')  return 'large';
    if (s === 'xl' || s === 'x-large' || s === 'extra large') return 'x-large';
    if (s === 'xxl' || s === '2xl') return 'xx-large';

    return s; // colors etc.
  };

  // read from the actual chosen VARIANT (order/labels don’t matter)
  const opts = ['option1','option2','option3']
    .map(k => currentVariant[k])
    .filter(Boolean)
    .map(normalize);

  const hasBlack  = opts.includes('black');
  const hasMedium = opts.includes('medium');

  const addBonus = hasBlack && hasMedium && !!bonusVariantId;

  const payload = addBonus
  ? { items: [
      { id: String(currentVariant.id), quantity: 1 },
      { id: String(bonusVariantId),   quantity: 1 }
    ] }
  : { items: [
      { id: String(currentVariant.id), quantity: 1 }
    ] };


  const res = await fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    atcBtn.textContent = addBonus ? 'Added (with bonus)' : 'Added';
    setTimeout(() => { closeModal(); atcBtn.textContent = 'ADD TO CART'; }, 900);
    document.dispatchEvent(new CustomEvent('cart:refresh'));
  } else {
    atcBtn.textContent = 'Try again';
    setTimeout(() => (atcBtn.textContent = 'ADD TO CART'), 900);
    try { console.warn('Cart add failed', await res.json()); } catch(_) {}
  }
}


    /* events */
    root.addEventListener("click", async (ev) => {
      const hotspot = ev.target.closest(".wg-hotspot");
      if (!hotspot || !root.contains(hotspot)) return;
      const tile = hotspot.closest(".wg-tile");
      if (!tile || tile.dataset.enable !== "true") return;

      try {
        const p = await byHandle(tile.dataset.handle);
        openModal(p);
      } catch (err) {
        console.error("Failed to load product", err);
      }
    });

    root.querySelector(".wg-close").addEventListener("click", closeModal);
    root.querySelector(".wg-atc").addEventListener("click", addToCart);
    root.querySelector(".wg-modal").addEventListener("click", (e) => {
      if (e.target === root.querySelector(".wg-modal")) closeModal();
    });
    document.addEventListener("keydown", (e) => { if (!modal.hidden && e.key === "Escape") closeModal(); });
  }

  function initAll(){ document.querySelectorAll(".wg").forEach(initOne); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
  document.addEventListener("shopify:section:load", initAll);
})();
