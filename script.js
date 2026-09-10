/* ==========================================================================
   AL SHAHEED PARK — VISITOR GUIDE
   Vanilla JS, no dependencies. Each behaviour is an isolated module that
   silently no-ops when its markup is absent, so sections can be reordered
   or removed without breaking the page.

   Modules
   -------
   headerScroll     sticky navbar: transparent → light on scroll
   mobileNav        off-canvas navigation with focus + escape handling
   scrollSpy        highlights the nav item for the section in view
   reveal           gentle fade/rise on scroll (respects reduced motion)
   lazyMedia        hydrates data-src figures into real <img loading="lazy">
   parkStatus       live "open now" state from the listed park hours
   phase3Countdown  days remaining until the announced Phase III opening
   venueDirectory   renders the café/restaurant cards from VENUES, filters
                    them, computes open/closed where hours are verified, and
                    drives the "Plan around this café" action
   eventDates       relative date labels for events that carry a real date
   eventFilters     event category filtering with live result count
   parkGuide        interactive schematic map + detail panel
   lightbox         accessible gallery viewer with keyboard navigation
   drawer           detail panel for event cards
   misc             current year, in-page anchor handling, section highlight
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ utils */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Run a callback at most once per animation frame. */
  function rafThrottle(fn) {
    let queued = false;
    return function (...args) {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        fn.apply(this, args);
      });
    };
  }

  const FOCUSABLE =
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  /** Minimal focus trap for modal surfaces. */
  function trapFocus(container, event) {
    const nodes = $$(FOCUSABLE, container).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  let scrollLocks = 0;
  function lockScroll(on) {
    scrollLocks = Math.max(0, scrollLocks + (on ? 1 : -1));
    document.body.classList.toggle("is-locked", scrollLocks > 0);
  }

  /** Build an element in one call. */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("data-") || key === "role" || key.startsWith("aria-"))
        node.setAttribute(key, value);
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children])
      .filter(Boolean)
      .forEach((child) => node.appendChild(child));
    return node;
  }

  /** An <svg><use href="#id"> pointing at one of the sprite scenes. */
  function sceneArt(id) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "media__art");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS(NS, "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
  }

  /* ------------------------------------------------------------ headerScroll */
  function headerScroll() {
    const header = $("#siteHeader");
    if (!header) return;

    const update = rafThrottle(() => {
      header.classList.toggle("is-stuck", window.scrollY > 40);
    });

    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* -------------------------------------------------------------- mobileNav */
  function mobileNav() {
    const toggle = $("#navToggle");
    const nav = $("#primaryNav");
    if (!toggle || !nav) return;

    const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;
    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      lockScroll(open);
      if (open) {
        // Wait a frame so the panel is painted before focus moves into it.
        window.requestAnimationFrame(() => {
          const firstLink = $(".nav__link", nav);
          if (firstLink) firstLink.focus();
        });
      }
    }

    toggle.addEventListener("click", () => setOpen(!isOpen()));

    nav.addEventListener("click", (e) => {
      if (e.target.closest(".nav__link") && isOpen()) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape") {
        setOpen(false);
        toggle.focus();
      } else if (e.key === "Tab") {
        trapFocus(nav, e);
      }
    });

    document.addEventListener("click", (e) => {
      if (!isOpen()) return;
      if (!nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });

    window.addEventListener(
      "resize",
      rafThrottle(() => {
        if (!isMobile() && isOpen()) setOpen(false);
      })
    );
  }

  /* --------------------------------------------------------------- scrollSpy */
  function scrollSpy() {
    const links = $$(".nav__link").filter((a) => a.hash && $(a.hash));
    if (!links.length || !("IntersectionObserver" in window)) return;

    const setCurrent = (id) => {
      links.forEach((link) => {
        const active = link.hash === "#" + id;
        link.classList.toggle("is-current", active);
        if (active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) setCurrent(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.15, 0.4] }
    );

    links.map((a) => $(a.hash)).forEach((section) => observer.observe(section));
  }

  /* ------------------------------------------------------------------ reveal */
  function reveal() {
    const items = $$("[data-reveal]");
    if (!items.length) return;

    items.forEach((node) => {
      const delay = node.getAttribute("data-reveal-delay");
      if (delay) node.style.setProperty("--reveal-delay", delay);
    });

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      items.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    items.forEach((node) => observer.observe(node));
  }

  /* --------------------------------------------------------------- lazyMedia
     Any element carrying data-src is hydrated into a real <img loading="lazy">
     as it approaches the viewport. This is the hook for dropping licensed
     photography in later — the illustrated scene stays until a file exists.
  ------------------------------------------------------------------------- */
  function lazyMedia() {
    const targets = $$("[data-src]");
    if (!targets.length) return;

    const hydrate = (node) => {
      const box = node.classList.contains("media") ? node : $(".media", node);
      if (!box || box.dataset.hydrated) return;
      box.dataset.hydrated = "true";

      const img = document.createElement("img");
      img.src = node.dataset.src;
      img.alt = node.dataset.alt || box.getAttribute("aria-label") || "";
      img.loading = "lazy";
      img.decoding = "async";
      if (node.dataset.width) img.width = node.dataset.width;
      if (node.dataset.height) img.height = node.dataset.height;

      box.classList.add("is-loading");
      img.addEventListener("load", () => {
        box.classList.remove("is-loading");
        const art = $(".media__art", box);
        if (art) art.remove();
      });
      img.addEventListener("error", () => {
        box.classList.remove("is-loading");
        img.remove(); // keep the illustrated scene if the photo is missing
      });
      box.appendChild(img);
    };

    if (!("IntersectionObserver" in window)) {
      targets.forEach(hydrate);
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          hydrate(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: "300px 0px" }
    );

    targets.forEach((node) => observer.observe(node));
  }

  /* ------------------------------------------------------------------- hours
     "HH:MM-HH:MM" → open/closed against the visitor's local clock.
     Overnight ranges (e.g. 18:00-00:30) and 24:00 closings are supported.
  ------------------------------------------------------------------------- */
  function parseHours(value) {
    if (!value) return null;
    const match = String(value).match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const open = Number(match[1]) * 60 + Number(match[2]);
    const close = Number(match[3]) * 60 + Number(match[4]);
    return { open, close, overnight: close <= open };
  }

  function isOpenNow(hours, now = new Date()) {
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (hours.overnight) return minutes >= hours.open || minutes < hours.close;
    return minutes >= hours.open && minutes < hours.close;
  }

  function formatMinutes(total) {
    const h = String(Math.floor(total / 60) % 24).padStart(2, "0");
    const m = String(total % 60).padStart(2, "0");
    return h + ":" + m;
  }

  const formatRange = (hours) =>
    formatMinutes(hours.open) + " – " + formatMinutes(hours.close);

  /* -------------------------------------------------------------- parkStatus
     Listed park hours: 5:00 AM – 12:00 AM daily; the Phase II listing shows
     Friday opening at 1:00 PM. Both are reflected here.
  ------------------------------------------------------------------------- */
  function parkStatus() {
    const target = $("[data-park-status]");
    if (!target) return;

    const update = () => {
      const now = new Date();
      const friday = now.getDay() === 5;
      const hours = parseHours(friday ? "13:00-24:00" : "05:00-24:00");
      const open = isOpenNow(hours, now);

      target.className = "park-status " + (open ? "is-open" : "is-closed");
      target.textContent = open
        ? "Open now — listed hours today " + formatRange(hours) + (friday ? " (Friday)" : "")
        : "Closed now — listed hours today " + formatRange(hours) + (friday ? " (Friday)" : "");
    };

    update();
    window.setInterval(update, 60000);
  }

  /* ---------------------------------------------------------- phase3Countdown */
  const PHASE3_OPENING = "2026-10-01";

  function phase3Countdown() {
    const targets = $$("[data-phase3-countdown]");
    const dayTargets = $$("[data-phase3-days]");
    if (!targets.length && !dayTargets.length) return;

    const opening = new Date(PHASE3_OPENING + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((opening - today) / 86400000);

    let label;
    if (days > 1) label = "opens in " + days + " days · 1 October 2026";
    else if (days === 1) label = "opens tomorrow · 1 October 2026";
    else if (days === 0) label = "opens today · 1 October 2026";
    else label = "open since 1 October 2026";

    targets.forEach((node) => {
      node.textContent = label;
    });

    // Short form for the Phase III stat tile.
    const short =
      days > 1 ? "in " + days + " days" : days === 1 ? "tomorrow" : days === 0 ? "today" : "now open";
    dayTargets.forEach((node) => {
      node.textContent = short;
    });
  }

  /* --------------------------------------------------------- venueDirectory
     Confirmed cafés and restaurants inside the park. Each entry keeps its own
     exact Google Maps URL — never a search query, never the park's general
     pin. `hours` is only present where a listing was actually checked
     (10 September 2026); venues without it show no hours rather than a guess.
     Replace this array with a fetch() when a backend exists.
  ------------------------------------------------------------------------- */
  const VENUES = [
    {
      name: "Fleur Cafe",
      category: "cafe",
      mapUrl: "https://maps.app.goo.gl/mygz3XwC95PEnL8N6?g_st=ic",
      blurb: "A calm coffee stop inside the Al Shaheed Park experience.",
      scene: "sc-dining",
      hours: "06:00-23:00",
    },
    {
      name: "OPT Coffee",
      category: "cafe",
      mapUrl: "https://maps.app.goo.gl/wp8DYBKdahLrGMkR8?g_st=ic",
      blurb: "A coffee stop within the park grounds.",
      scene: "sc-gardens",
    },
    {
      name: "Le Cafe",
      category: "cafe",
      mapUrl: "https://maps.app.goo.gl/3okhzUjwvPSUE9us7?g_st=ic",
      blurb: "A café in the park, suited to a short pause between walks.",
      scene: "sc-workshop",
    },
    {
      name: "Ciervo Cafe",
      category: "cafe",
      mapUrl: "https://maps.app.goo.gl/dHiWcrCfCuzwVSGQ8?g_st=ic",
      blurb: "A café in the park's Phase II area, with outdoor seating.",
      scene: "sc-dining",
      hours: "06:00-23:00",
    },
    {
      name: "OLE Coffee",
      category: "cafe",
      mapUrl:
        "https://maps.google.com?q=OLE%20Coffee,%20Shaheed%20Park,%20Soor%20St,%20%D9%85%D8%AF%D9%8A%D9%86%D8%A9%20%D8%A7%D9%84%D9%83%D9%88%D9%8A%D8%AA%2000000&ftid=0x3fcf856306afbaef:0xb1722f1368fa6669&entry=gps&shh=CAE&lucs=,94297699,94231188,94280568,47071704,94218641,94282134,94286869,100820247,100822504,100804976&g_st=ic",
      blurb: "A coffee stop on Soor Street, inside the park.",
      scene: "sc-museum",
      hours: "06:30-23:30",
    },
    {
      name: "% Arabica",
      category: "cafe",
      mapUrl: "https://maps.app.goo.gl/giYm1XKQuwVVywy48?g_st=ic",
      blurb: "A specialty coffee counter inside the park.",
      scene: "sc-summer",
      hours: "06:00-24:00",
    },
    {
      name: "Rukn Cafe",
      category: "cafe",
      mapUrl: "https://maps.app.goo.gl/jnwzQHJKBrNsqvvw5?g_st=ic",
      blurb: "A café within the park grounds.",
      scene: "sc-gardens",
    },
    {
      name: "ALLSO Restaurant",
      category: "restaurant",
      mapUrl: "https://maps.app.goo.gl/VHAJ9ch1yMom1SqJ7?g_st=ic",
      blurb: "A restaurant inside the park.",
      scene: "sc-dining",
      availability: "temporarily-closed",
    },
    {
      name: "Table Otto",
      category: "restaurant",
      mapUrl: "https://maps.app.goo.gl/QoMpqG4DLkk53xRx9?g_st=ic",
      blurb: "A restaurant inside the park.",
      scene: "sc-night",
      availability: "temporarily-closed",
    },
  ];

  const CATEGORY_LABEL = { cafe: "Café", restaurant: "Restaurant" };

  /* Experience categories offered by "Plan around this café". Front-end
     only — no distances are claimed, just the park sections worth pairing. */
  const PLAN_LINKS = [
    { label: "Walking", href: "#sports" },
    { label: "Family activities", href: "#family" },
    { label: "Museums", href: "#culture" },
    { label: "Events", href: "#events" },
  ];

  function pinIcon() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z");
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", "12");
    dot.setAttribute("cy", "10");
    dot.setAttribute("r", "2.6");
    svg.append(path, dot);
    return svg;
  }

  function venueCard(venue, index) {
    const media = el("div", {
      class: "venue__media media media--" + venue.category,
      role: "img",
      "aria-label": venue.name + " — illustrated view of a park " + CATEGORY_LABEL[venue.category].toLowerCase(),
    });
    media.appendChild(sceneArt(venue.scene));

    const meta = el("p", { class: "venue__meta" }, [
      el("span", { class: "tag", text: CATEGORY_LABEL[venue.category] }),
    ]);

    // Status badge only when there is something real to say.
    const hours = parseHours(venue.hours);
    if (hours || venue.availability) {
      const badge = el("span", { class: "status", "data-status": "" , text: "…" });
      meta.appendChild(badge);
    }

    const body = el("div", { class: "venue__body" }, [
      meta,
      el("h3", { class: "venue__name", text: venue.name }),
      el("p", { class: "venue__text", text: venue.blurb }),
    ]);

    if (hours) {
      body.appendChild(
        el("p", { class: "venue__hours", "data-hours-label": "", text: formatRange(hours) })
      );
    } else if (venue.availability === "temporarily-closed") {
      body.appendChild(
        el("p", { class: "venue__hours", text: "Temporarily closed in current listing" })
      );
    }

    const mapLink = el("a", {
      class: "btn btn--small btn--dark map-link",
      href: venue.mapUrl,
      target: "_blank",
      rel: "noopener noreferrer",
    });
    mapLink.appendChild(el("span", { class: "map-link__icon" }, pinIcon()));
    mapLink.appendChild(document.createTextNode("View on Google Maps"));
    mapLink.append(el("span", { "aria-hidden": "true", text: "↗" }));

    const panelId = "venue-plan-" + index;
    const planBtn = el("button", {
      class: "plan-toggle",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": panelId,
      "data-plan-toggle": "",
      text: "Plan around this " + (venue.category === "cafe" ? "café" : "restaurant"),
    });

    const panel = el("div", { class: "plan-panel", id: panelId, hidden: "hidden" }, [
      el("p", { class: "plan-panel__label", text: "Pair it with" }),
      el(
        "ul",
        { class: "plan-panel__list" },
        PLAN_LINKS.map((link) =>
          el("li", {}, [
            el("a", { href: link.href, "data-highlight": link.href.slice(1), text: link.label }),
          ])
        )
      ),
    ]);

    body.append(el("div", { class: "venue__actions" }, [mapLink, planBtn]), panel);

    return el(
      "li",
      {
        class: "venue",
        "data-venue": "",
        "data-category": venue.category,
        "data-hours": venue.hours || "",
        "data-availability": venue.availability || "",
      },
      [media, body]
    );
  }

  function venueDirectory() {
    const grid = $("#venueGrid");
    if (!grid) return;

    grid.innerHTML = "";
    VENUES.forEach((venue, i) => grid.appendChild(venueCard(venue, i)));

    const cards = $$("[data-venue]", grid);
    const buttons = $$("[data-venue-filter]");
    const counter = $("[data-venue-count]");
    const emptyNote = $("[data-venue-empty]");

    /* --- live open / closed --------------------------------------------- */
    const updateStatus = () => {
      const now = new Date();
      cards.forEach((card) => {
        const badge = $("[data-status]", card);
        if (!badge) return;

        if (card.dataset.availability === "temporarily-closed") {
          badge.textContent = "Temporarily closed";
          badge.className = "status is-closed";
          return;
        }

        const hours = parseHours(card.dataset.hours);
        if (!hours) {
          badge.remove();
          return;
        }

        const open = isOpenNow(hours, now);
        badge.textContent = open ? "Open now" : "Closed now";
        badge.className = "status " + (open ? "is-open" : "is-closed");
        badge.title = open
          ? "Listed closing " + formatMinutes(hours.close)
          : "Listed opening " + formatMinutes(hours.open);
      });
    };

    updateStatus();
    window.setInterval(updateStatus, 60000);

    /* --- filtering ------------------------------------------------------ */
    const report = (shown, value) => {
      if (counter) {
        const label =
          value === "all" ? "venues" : value === "cafe" ? "cafés" : "restaurants";
        counter.textContent =
          shown === 0
            ? "No venues match that filter."
            : "Showing " + shown + " " + label + " inside the park.";
      }
      if (emptyNote) emptyNote.hidden = shown > 0;
    };

    const select = (btn) => {
      const value = btn.dataset.venueFilter;
      buttons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });

      let shown = 0;
      cards.forEach((card) => {
        const match = value === "all" || card.dataset.category === value;
        card.classList.toggle("is-hidden", !match);
        if (match) shown += 1;
      });
      report(shown, value);
    };

    buttons.forEach((btn) => btn.addEventListener("click", () => select(btn)));
    report(cards.length, "all");

    /* --- "Plan around this café" ---------------------------------------- */
    grid.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-plan-toggle]");
      if (!toggle) return;
      const panel = $("#" + toggle.getAttribute("aria-controls"));
      if (!panel) return;
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
      toggle.classList.toggle("is-open", !open);
    });
  }

  /* -------------------------------------------------------------- eventDates
     Only events carrying a real <time datetime> get a relative label; the
     rest describe a season or cadence instead of a fabricated date.
  ------------------------------------------------------------------------- */
  function eventDates() {
    const times = $$(".event__date[datetime]");
    if (!times.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    times.forEach((time) => {
      const date = new Date(time.getAttribute("datetime") + "T00:00:00");
      if (Number.isNaN(date.getTime())) return;

      const target = time.parentElement
        ? time.parentElement.querySelector("[data-relative]")
        : null;
      if (!target) return;

      const days = Math.round((date - today) / 86400000);
      let label;
      if (days < 0) label = "Now open";
      else if (days === 0) label = "Today";
      else if (days === 1) label = "Tomorrow";
      else if (days < 14) label = "In " + days + " days";
      else if (days < 60) label = "In " + Math.round(days / 7) + " weeks";
      else label = "In " + Math.round(days / 30) + " months";

      const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
      target.textContent = days < 0 ? label : weekday + " · " + label;
    });
  }

  /* ----------------------------------------------------------- eventFilters */
  function eventFilters() {
    const buttons = $$("[data-event-filter]");
    const events = $$("[data-event]");
    const counter = $("[data-event-count]");
    if (!buttons.length || !events.length) return;

    const report = (shown, value) => {
      if (!counter) return;
      counter.textContent =
        shown === 0
          ? "No events match that filter — try another category."
          : "Showing " +
            shown +
            " of " +
            events.length +
            " event types" +
            (value === "all" ? "" : " in " + value) +
            ".";
    };

    const select = (btn) => {
      const value = btn.dataset.eventFilter;
      buttons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });

      let shown = 0;
      events.forEach((item) => {
        const match = value === "all" || item.dataset.category === value;
        item.classList.toggle("is-hidden", !match);
        if (match) shown += 1;
      });
      report(shown, value);
    };

    buttons.forEach((btn) => btn.addEventListener("click", () => select(btn)));
    report(events.length, "all");
  }

  /* --------------------------------------------------------------- parkGuide */
  const GUIDE_AREAS = {
    gardens: {
      title: "Botanical Gardens",
      text:
        "Landscaped and planted areas make up the largest share of the park — the default place to start if you arrive without a plan.",
      meta: [
        ["Best time", "Early morning or after sunset"],
        ["Good for", "Slow walks, photography, family exploration"],
        ["Pairs with", "Coffee and a museum stop"],
      ],
    },
    museums: {
      title: "Thekra &amp; Habitat Museums",
      text:
        "Thekra covers historical storytelling; Habitat is linked to Kuwait's natural environment and ecological identity. Both work regardless of the weather.",
      meta: [
        ["Best time", "Midday heat, or a late opening"],
        ["Good for", "Culture, families, students"],
        ["Note", "Each venue keeps its own hours"],
      ],
    },
    water: {
      title: "Lake &amp; Fountains",
      text:
        "The lake, fountains and water features are the visual anchors of the park and the easiest landmark to walk towards.",
      meta: [
        ["Best time", "Evening, when the fountains are lit"],
        ["Good for", "Photography, family stops, sitting"],
        ["Pairs with", "A skyline walk"],
      ],
    },
    cafes: {
      title: "Cafés",
      text:
        "Seven cafés are confirmed inside the park, several opening as early as 6:00 AM. Each has its own Google Maps pin in the directory.",
      meta: [
        ["Best time", "Morning, or golden hour"],
        ["Good for", "A pause mid-walk, slow solo visits"],
        ["See", "Coffee, Dining & Slow Moments"],
      ],
    },
    restaurants: {
      title: "Restaurants",
      text:
        "Two restaurant listings sit inside the park. Both were shown as temporarily closed when listings were last checked, so recheck before planning around them.",
      meta: [
        ["Best time", "After sunset"],
        ["Good for", "Family dinners, longer visits"],
        ["Check", "Status on the day"],
      ],
    },
    routes: {
      title: "Walkways &amp; Jogging Tracks",
      text:
        "Dedicated walkways and jogging tracks run through the park, long enough for an easy run, intervals or a steady continuous session.",
      meta: [
        ["Best time", "Sunrise, or after sunset in summer"],
        ["Good for", "Walking, jogging, running, recovery"],
        ["Surface", "Paved and stroller-friendly"],
      ],
    },
    family: {
      title: "Family Areas",
      text:
        "Open lawns, water features and activity venues give a family visit several stages — useful when attention spans are short.",
      meta: [
        ["Best time", "Late afternoon onwards"],
        ["Good for", "Play, picnicking-style time, workshops"],
        ["Nearby", "Cafés and museums"],
      ],
    },
    events: {
      title: "Events &amp; Theatres",
      text:
        "Outdoor theatres and performance spaces host public programming, and expanded substantially with Phase III's Al-Sour theatre complex.",
      meta: [
        ["Best time", "Cool-weather evenings"],
        ["Good for", "Performances, markets, festivals"],
        ["Check", "Official Instagram for dates"],
      ],
    },
    parking: {
      title: "Parking",
      text:
        "On-site parking, with 2,388 spaces announced as part of Phase III. It fills fastest on event nights and cool weekends.",
      meta: [
        ["Best time", "Before the evening peak"],
        ["Alternative", "Taxi or ride-hail drop-off"],
        ["Allow", "Extra time on event nights"],
      ],
    },
  };

  function parkGuide() {
    const controls = $$("[data-guide]");
    const titleEl = $("[data-guide-title]");
    const textEl = $("[data-guide-text]");
    const metaEl = $("[data-guide-meta]");
    if (!controls.length || !titleEl || !textEl) return;

    const select = (key) => {
      const area = GUIDE_AREAS[key];
      if (!area) return;

      controls.forEach((control) =>
        control.classList.toggle("is-active", control.dataset.guide === key)
      );

      titleEl.innerHTML = area.title;
      textEl.textContent = area.text;

      if (metaEl) {
        metaEl.innerHTML = "";
        area.meta.forEach(([label, value]) => {
          metaEl.appendChild(
            el("li", {}, [
              el("strong", { text: label }),
              el("span", { text: value }),
            ])
          );
        });
      }
    };

    controls.forEach((control) =>
      control.addEventListener("click", () => select(control.dataset.guide))
    );

    select("gardens");
  }

  /* ---------------------------------------------------------------- lightbox */
  function lightbox() {
    const root = $("#lightbox");
    const stage = $("#lightboxStage");
    const captionEl = $("#lightboxCaption");
    const countEl = $("#lightboxCount");
    const triggers = $$("[data-lightbox]");
    if (!root || !stage || !triggers.length) return;

    let index = 0;
    let opener = null;

    const render = () => {
      const trigger = triggers[index];
      stage.innerHTML = "";

      // Prefer a hydrated photo when one exists; fall back to the scene art.
      const photo = trigger.querySelector("img");
      const media = trigger.querySelector(".media");

      if (photo) {
        const img = document.createElement("img");
        img.src = photo.currentSrc || photo.src;
        img.alt = photo.alt || "";
        stage.appendChild(img);
      } else if (media) {
        const clone = media.cloneNode(true);
        clone.removeAttribute("role");
        clone.removeAttribute("aria-label");
        stage.appendChild(clone);
      }

      if (captionEl) captionEl.textContent = trigger.dataset.caption || "";
      if (countEl) countEl.textContent = index + 1 + " / " + triggers.length;
      root.setAttribute("aria-label", trigger.dataset.caption || "Gallery image");
    };

    const open = (i) => {
      index = i;
      opener = document.activeElement;
      render();
      root.hidden = false;
      lockScroll(true);
      const closeBtn = $(".lightbox__close", root);
      if (closeBtn) closeBtn.focus();
    };

    const close = () => {
      root.hidden = true;
      stage.innerHTML = "";
      lockScroll(false);
      if (opener && typeof opener.focus === "function") opener.focus();
    };

    const step = (delta) => {
      index = (index + delta + triggers.length) % triggers.length;
      render();
    };

    triggers.forEach((trigger, i) =>
      trigger.addEventListener("click", () => open(i))
    );

    $$("[data-lightbox-close]", root).forEach((node) =>
      node.addEventListener("click", close)
    );
    const prev = $("[data-lightbox-prev]", root);
    const next = $("[data-lightbox-next]", root);
    if (prev) prev.addEventListener("click", () => step(-1));
    if (next) next.addEventListener("click", () => step(1));

    document.addEventListener("keydown", (e) => {
      if (root.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Tab") trapFocus(root, e);
    });
  }

  /* ------------------------------------------------------------------ drawer
     Detail panel for event cards. It reads the data already rendered on the
     card, so nothing is invented — swap the read for a fetch() when an
     events API exists.
  ------------------------------------------------------------------------- */
  function drawer() {
    const root = $("#drawer");
    const titleEl = $("#drawerTitle");
    const kindEl = $("#drawerKind");
    const textEl = $("#drawerText");
    const noteEl = $("#drawerNote");
    const metaEl = $("#drawerMeta");
    if (!root || !titleEl) return;

    let opener = null;

    const addRow = (label, value) => {
      if (!value || !metaEl) return;
      metaEl.appendChild(
        el("div", {}, [el("dt", { text: label }), el("dd", { text: value })])
      );
    };

    const open = (trigger) => {
      const card = trigger.closest("[data-event]");
      opener = trigger;

      if (metaEl) metaEl.innerHTML = "";
      titleEl.textContent = trigger.dataset.details || "Details";
      if (kindEl) kindEl.textContent = "Event";

      if (card) {
        const text = $(".event__text", card);
        if (textEl) textEl.textContent = text ? text.textContent.trim() : "";

        const note = $(".event__note", card);
        if (noteEl) noteEl.textContent = note ? note.textContent.trim() : "";

        const tag = $(".tag", card);
        if (tag) addRow("Category", tag.textContent.trim());

        const date = $(".event__date", card);
        if (date) addRow("Date", date.textContent.trim());

        const when = $(".event__when", card);
        if (when && when.textContent.trim()) addRow("When", when.textContent.trim());

        const place = $(".event__location", card);
        if (place) addRow("Location", place.textContent.replace(/^[^\w%]+/, "").trim());

        const suits = $(".event__suits", card);
        if (suits) addRow("Suits", suits.textContent.replace(/^Suits\s*/, "").trim());
      }

      root.hidden = false;
      lockScroll(true);
      const closeBtn = $(".drawer__close", root);
      if (closeBtn) closeBtn.focus();
    };

    const close = () => {
      root.hidden = true;
      lockScroll(false);
      if (opener && typeof opener.focus === "function") opener.focus();
    };

    // Delegated so cards rendered later still work.
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-details]");
      if (trigger) open(trigger);
    });

    $$("[data-drawer-close]", root).forEach((node) =>
      node.addEventListener("click", close)
    );

    document.addEventListener("keydown", (e) => {
      if (root.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "Tab") trapFocus(root, e);
    });
  }

  /* -------------------------------------------------------------------- misc */
  function misc() {
    const year = $("[data-year]");
    if (year) year.textContent = String(new Date().getFullYear());

    /* Briefly highlight a section that was jumped to from a "plan around"
       link, so the connection between the two is visible. */
    const highlight = (section) => {
      if (!section) return;
      section.classList.remove("is-highlighted");
      // Force a reflow so the animation restarts on repeat clicks.
      void section.offsetWidth;
      section.classList.add("is-highlighted");
      window.setTimeout(() => section.classList.remove("is-highlighted"), 2200);
    };

    // Delegated: covers links rendered after init (venue cards).
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;

      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = $(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      if (history.replaceState) history.replaceState(null, "", id);

      // Keep screen readers in sync with the jump without a visible ring.
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });

      if (link.dataset.highlight) highlight($("#" + link.dataset.highlight));
    });
  }

  /* -------------------------------------------------------------------- init */
  function init() {
    headerScroll();
    mobileNav();
    scrollSpy();
    reveal();
    lazyMedia();
    parkStatus();
    phase3Countdown();
    venueDirectory();
    eventDates();
    eventFilters();
    parkGuide();
    lightbox();
    drawer();
    misc();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
