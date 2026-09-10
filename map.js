/* ==========================================================================
   AL SHAHEED PARK — LIVE PARK MAP
   ==========================================================================
   MapLibre GL JS. No access token, no account, no tracking.

   PRIVACY MODEL — read this before changing anything here.
   The visitor's position lives in one module-local variable (`userPos`) for
   the lifetime of the page. It is:
     • never written to localStorage, sessionStorage, cookies or IndexedDB
     • never sent to Supabase or any analytics endpoint
     • never accumulated into a history array
     • discarded on stopLocating() and when the page unloads
   The single exception, which is disclosed in the UI: when the visitor asks
   for walking directions, the origin and destination are sent to the
   pedestrian routing service to compute the path. Nothing else leaves the
   device.

   Modules
   -------
   buildMap        MapLibre instance + park boundary layers
   loadIcons       category pin icons, rendered from inline SVG
   addPlaces       clustered place source, symbol layer, labels
   locating        watchPosition lifecycle, "You are here" marker, heading
   geometry        haversine distance, point-in-polygon, bearing
   nearby          nearest place per category, computed on demand
   routing         pedestrian routing with an honest fallback
   ui              filters, routes, bottom sheet, navigation bar, panels
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ config */
  const CONFIG = {
    // Keyless vector tiles (OpenFreeMap). Light grey base that suits the
    // site palette. To move to Mapbox GL later, swap this for your style URL
    // and set mapboxgl.accessToken — the rest of this file is unchanged.
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    // Public Valhalla instance, pedestrian profile. No key required.
    routingUrl: "https://valhalla1.openstreetmap.de/route",
    fallbackCenter: [47.9885, 29.3655],
    fallbackZoom: 14.1,
    walkingSpeedMs: 1.35, // 4.9 km/h, only used for clearly-labelled estimates
    maxAccuracyForNav: 100 // metres; above this we warn the fix is coarse
  };

  const CATEGORY_ORDER = [
    "cafe", "restaurant", "museum", "garden", "restroom", "facility",
    "attraction", "family_area", "event_area", "parking", "entrance", "running_route"
  ];

  /* ------------------------------------------------------------------- state */
  let map = null;
  let places = [];
  let boundary = null;
  let routes = [];
  let categories = {};

  /** Transient visitor position. Never persisted. */
  let userPos = null;           // { lat, lon, accuracy, heading, speed }
  let watchId = null;
  let followMe = false;
  let userMarker = null;
  let headingFromDevice = null;

  let activeCategories = new Set();
  let selectedPlaceId = null;
  let navTarget = null;         // { place, mode: "walking" | "approximate" }

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- geometry */
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;

  function haversine(a, b) {
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function bearing(a, b) {
    const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
    const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
              Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function formatDistance(m) {
    if (m == null) return null;
    if (m < 1000) return Math.round(m / 10) * 10 + " m";
    return (m / 1000).toFixed(m < 10000 ? 1 : 0) + " km";
  }

  function formatDuration(seconds) {
    if (seconds == null) return null;
    const min = Math.round(seconds / 60);
    if (min < 1) return "under a minute";
    if (min < 60) return min + " min";
    const h = Math.floor(min / 60);
    return h + " h " + (min % 60) + " min";
  }

  function inRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) &&
          (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  /** Which park polygon (if any) contains this point. Never stored. */
  function parkFeatureAt(lon, lat) {
    if (!boundary) return null;
    for (const f of boundary.features) {
      const rings = f.geometry.type === "Polygon"
        ? [f.geometry.coordinates[0]]
        : f.geometry.coordinates.map(c => c[0]);
      if (rings.some(r => inRing(lon, lat, r))) return f;
    }
    return null;
  }

  function boundaryBounds() {
    let mnx = 180, mny = 90, mxx = -180, mxy = -90;
    for (const f of boundary.features) {
      const rings = f.geometry.type === "Polygon"
        ? [f.geometry.coordinates[0]]
        : f.geometry.coordinates.map(c => c[0]);
      for (const r of rings) for (const [x, y] of r) {
        if (x < mnx) mnx = x; if (x > mxx) mxx = x;
        if (y < mny) mny = y; if (y > mxy) mxy = y;
      }
    }
    return [[mnx, mny], [mxx, mxy]];
  }

  /* ------------------------------------------------------------------- icons
     Category pins drawn as inline SVG, rasterised once and registered with
     the map. Keeps the marker set consistent with the site's line-icon style.
  --------------------------------------------------------------------- */
  const GLYPHS = {
    cup:     '<path d="M8 11h11v6a5.5 5.5 0 0 1-11 0z"/><path d="M19 12h2.2a2.2 2.2 0 0 1 0 4.4H19"/><path d="M7 23h13"/>',
    fork:    '<path d="M10 8v7a2.5 2.5 0 0 1-5 0V8"/><path d="M7.5 15v8"/><path d="M19 8v15"/><path d="M17 8c0 3 4 3 4 0"/>',
    temple:  '<path d="M6 13 14 8l8 5"/><path d="M8 14v8M12 14v8M16 14v8M20 14v8M6 23h16"/>',
    leaf:    '<path d="M20 8c0 7-4 11-9 11-2 0-3-1-3-3 0-6 5-8 12-8z"/><path d="M8 23c1-5 4-9 9-11"/>',
    star:    '<path d="M14 7l2.4 5 5.6.7-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.7z"/>',
    parking: '<path d="M11 22V9h4.2a3.9 3.9 0 0 1 0 7.8H11"/>',
    door:    '<path d="M9 8h10v15H9z"/><path d="M15.5 15.5h.01"/>',
    wc:      '<circle cx="10" cy="9.5" r="1.8"/><path d="M8 14h4l1 6h-1.5l-.5 3h-2l-.5-3H7z"/><circle cx="19" cy="9.5" r="1.8"/><path d="M19 13.5 16.5 20h5z"/><path d="M18 20l-.4 3h2.8l-.4-3"/>',
    family:  '<circle cx="10" cy="10" r="2.2"/><circle cx="18" cy="11.5" r="1.7"/><path d="M6 22c0-3 1.8-4.5 4-4.5s4 1.5 4 4.5M15 22c0-2 1-3.2 2.5-3.2S20 19.9 20 22"/>',
    stage:   '<path d="M6 20h16"/><path d="M9 20V13l5-4 5 4v7"/><path d="M14 20v-4"/>',
    run:     '<circle cx="16" cy="8" r="2"/><path d="M15 11l-3 3 2.2 2.6-.8 5.4M15 11l3.4 1.7 1.3 3.4M12 14l-3.6-.8"/>',
    info:    '<circle cx="14" cy="15" r="7"/><path d="M14 12v.01M14 15v4"/>'
  };

  function pinSvg(color, glyphKey) {
    const glyph = GLYPHS[glyphKey] || GLYPHS.info;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="70" viewBox="0 0 56 70">' +
      '<g filter="url(#s)">' +
      '<path d="M28 4a22 22 0 0 1 22 22c0 14-22 40-22 40S6 40 6 26A22 22 0 0 1 28 4z" fill="#ffffff" stroke="' + color + '" stroke-width="2.5"/>' +
      '</g>' +
      '<circle cx="28" cy="26" r="15.5" fill="' + color + '" opacity="0.10"/>' +
      '<g transform="translate(14,12) scale(1.0)" fill="none" stroke="' + color + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      glyph + '</g>' +
      '<defs><filter id="s" x="-30%" y="-20%" width="160%" height="150%">' +
      '<feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#252525" flood-opacity="0.28"/>' +
      '</filter></defs></svg>';
  }

  /**
   * Rasterise one SVG pin. Races against a timeout: a data: URL that never
   * fires load or error (blocked by a policy, or simply slow) must not be
   * able to stall map start-up. Pins are decoration — the circle layer
   * underneath keeps every place visible either way.
   */
  function loadImage(svg, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => reject(new Error("icon load timed out")), timeoutMs);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error("icon failed to decode")); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  /** Categories whose pin image is available. Drives the symbol filter. */
  const loadedIcons = new Set();

  async function loadIcons() {
    const jobs = Object.entries(categories).map(async ([key, meta]) => {
      try {
        const img = await loadImage(pinSvg(meta.color, meta.icon));
        if (!map.hasImage("pin-" + key)) map.addImage("pin-" + key, img, { pixelRatio: 2 });
        loadedIcons.add(key);
      } catch (e) {
        console.warn("pin icon unavailable for", key, "-", e.message);
      }
    });
    await Promise.allSettled(jobs);
  }

  /* -------------------------------------------------------------- placesData */
  function placesGeoJSON(filterSet) {
    const use = filterSet && filterSet.size ? places.filter(p => filterSet.has(p.category)) : places;
    return {
      type: "FeatureCollection",
      // Feature ids must be numeric for clustering/feature-state; the real
      // string id travels in properties.
      features: use.map((p, i) => ({
        type: "Feature",
        id: i + 1,
        properties: {
          id: p.id,
          name: p.name,
          category: p.category,
          icon: "pin-" + p.category,
          color: (categories[p.category] && categories[p.category].color) || "#4c5a48",
          label: categories[p.category] ? categories[p.category].label : p.category
        },
        geometry: { type: "Point", coordinates: [p.longitude, p.latitude] }
      }))
    };
  }

  function refreshPlaces() {
    const src = map.getSource("places");
    if (src) src.setData(placesGeoJSON(activeCategories));
  }

  /* ---------------------------------------------------------------- buildMap */
  async function buildMap() {
    map = new maplibregl.Map({
      container: "parkMap",
      style: CONFIG.styleUrl,
      center: CONFIG.fallbackCenter,
      zoom: CONFIG.fallbackZoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false
    });

    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution:
        'Park boundary &amp; places from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> (ODbL)'
    }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-left");
    map.touchZoomRotate.disableRotation();

    // Manual pan should quietly switch Follow Me off — the visitor is
    // choosing to look elsewhere.
    map.on("dragstart", () => { if (followMe) setFollowMe(false); });

    // Surface map errors instead of swallowing them: a silent failure here
    // used to leave the visitor on "Loading the park map…" forever.
    let lastMapError = null;
    map.on("error", e => {
      lastMapError = (e && e.error && e.error.message) || (e && e.message) || "unknown map error";
      console.warn("map error:", lastMapError);
    });

    // Wait for the first render, but never wait forever — and only count
    // time while the page is actually visible. MapLibre fires "load" after
    // its first frame, and requestAnimationFrame is paused in a hidden or
    // background tab, so a page opened in the background would otherwise be
    // declared broken when it is merely waiting to be looked at.
    await new Promise((resolve, reject) => {
      let settled = false;
      let visibleMs = 0;
      const LIMIT = 15000;

      const finish = () => { if (!settled) { settled = true; clearInterval(tick); resolve(); } };
      map.once("load", finish);

      const tick = setInterval(() => {
        if (settled) { clearInterval(tick); return; }
        if (document.visibilityState === "visible") visibleMs += 500;
        if (visibleMs >= LIMIT) {
          settled = true;
          clearInterval(tick);
          reject(new Error("the map did not finish its first render" +
            (lastMapError ? " (" + lastMapError + ")" : "")));
        }
      }, 500);
    });

    // A map first sized in a hidden tab can mis-measure; re-measure when the
    // visitor comes back to it.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && map) map.resize();
    });

    /* --- park boundary --- */
    map.addSource("park", { type: "geojson", data: boundary });
    map.addLayer({
      id: "park-fill", type: "fill", source: "park",
      paint: { "fill-color": "#4c5a48", "fill-opacity": 0.09 }
    });
    map.addLayer({
      id: "park-line", type: "line", source: "park",
      paint: {
        "line-color": "#4c5a48", "line-width": 1.6,
        "line-opacity": 0.55, "line-dasharray": [3, 2]
      }
    });
    map.addLayer({
      id: "park-label", type: "symbol", source: "park",
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-letter-spacing": 0.08,
        "text-transform": "uppercase",
        "text-max-width": 12
      },
      paint: {
        "text-color": "#4d4d4a", "text-halo-color": "#faf9f6", "text-halo-width": 1.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 0.85]
      }
    });

    /* --- walking route line (populated on demand) --- */
    map.addSource("nav", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "nav-halo", type: "line", source: "nav",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#faf9f6", "line-width": 9, "line-opacity": 0.9 }
    });
    // line-dasharray is not data-driven in MapLibre, so a real walking route
    // and an approximate direction get their own layer. The dashed one is the
    // only style used for a line that is not an actual pedestrian path.
    map.addLayer({
      id: "nav-line", type: "line", source: "nav",
      filter: ["==", ["get", "mode"], "walking"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#252525", "line-width": 3.4 }
    });
    map.addLayer({
      id: "nav-line-approx", type: "line", source: "nav",
      filter: ["==", ["get", "mode"], "approximate"],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: { "line-color": "#4d4d4a", "line-width": 3, "line-dasharray": [2, 2] }
    });

    /* --- places, clustered --- */
    await loadIcons();
    map.addSource("places", {
      type: "geojson",
      data: placesGeoJSON(activeCategories),
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 16
    });
    map.addLayer({
      id: "clusters", type: "circle", source: "places",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#ffffff",
        "circle-stroke-color": "#4c5a48",
        "circle-stroke-width": 1.6,
        "circle-radius": ["step", ["get", "point_count"], 17, 4, 21, 8, 25]
      }
    });
    map.addLayer({
      id: "cluster-count", type: "symbol", source: "places",
      filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
      paint: { "text-color": "#252525" }
    });
    // A plain circle sits under every pin. If an icon image failed to load,
    // the place is still visible and still tappable.
    map.addLayer({
      id: "place-dots", type: "circle", source: "places",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 6,
        "circle-color": "#ffffff",
        "circle-stroke-color": ["coalesce", ["get", "color"], "#4c5a48"],
        "circle-stroke-width": 2
      }
    });
    map.addLayer({
      id: "place-pins", type: "symbol", source: "places",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": 0.5,
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-offset": [0, 0.6],
        "text-anchor": "top",
        "text-max-width": 9,
        "text-optional": true
      },
      paint: {
        "text-color": "#252525",
        "text-halo-color": "#faf9f6",
        "text-halo-width": 1.8,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.5, 0, 15.4, 1]
      }
    });

    ["place-pins", "place-dots"].forEach(layer => {
      map.on("click", layer, e => {
        selectPlace(e.features[0].properties.id, { fly: false });
      });
    });
    map.on("click", "clusters", e => {
      const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
      map.getSource("places").getClusterExpansionZoom(f.properties.cluster_id)
        .then(z => map.easeTo({ center: f.geometry.coordinates, zoom: z }))
        .catch(() => {});
    });
    ["place-pins", "place-dots", "clusters"].forEach(layer => {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    });

    map.fitBounds(boundaryBounds(), { padding: 48, duration: 0 });
  }

  /* --------------------------------------------------------------- locating */
  function userMarkerEl() {
    const wrap = document.createElement("div");
    wrap.className = "user-dot";
    wrap.innerHTML =
      '<span class="user-dot__heading" hidden></span>' +
      '<span class="user-dot__pulse"></span>' +
      '<span class="user-dot__core"></span>' +
      '<span class="user-dot__label">You are here</span>';
    return wrap;
  }

  function startLocating() {
    if (!("geolocation" in navigator)) {
      setLocationState("unsupported");
      return;
    }
    setLocationState("locating");

    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000
    });
  }

  function stopLocating() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    userPos = null;                    // discard the position
    headingFromDevice = null;
    if (userMarker) { userMarker.remove(); userMarker = null; }
    setFollowMe(false);
    clearNav();
    setLocationState("off");
    renderNearby();
    updateInsidePill(null);
  }

  function onPosition(pos) {
    const c = pos.coords;
    userPos = {
      lat: c.latitude,
      lon: c.longitude,
      accuracy: c.accuracy,
      heading: Number.isFinite(c.heading) ? c.heading : null,
      speed: Number.isFinite(c.speed) ? c.speed : null
    };

    if (!userMarker) {
      userMarker = new maplibregl.Marker({ element: userMarkerEl(), pitchAlignment: "map" })
        .setLngLat([userPos.lon, userPos.lat])
        .addTo(map);
      map.easeTo({
        center: [userPos.lon, userPos.lat],
        zoom: Math.max(map.getZoom(), 16.2),
        duration: reduceMotion() ? 0 : 700
      });
      setFollowMe(true);
    } else {
      userMarker.setLngLat([userPos.lon, userPos.lat]);
    }

    const acc = $(".user-dot__pulse");
    if (acc) acc.style.setProperty("--acc", Math.min(90, Math.max(18, userPos.accuracy || 30)) + "px");

    applyHeading();
    setLocationState("on");
    updateInsidePill(parkFeatureAt(userPos.lon, userPos.lat));
    renderNearby();
    updateNavProgress();

    if (followMe) {
      map.easeTo({
        center: [userPos.lon, userPos.lat],
        duration: reduceMotion() ? 0 : 600,
        essential: true
      });
    }
  }

  function onPositionError(err) {
    if (err.code === err.PERMISSION_DENIED) setLocationState("denied");
    else if (err.code === err.TIMEOUT) setLocationState("timeout");
    else setLocationState("unavailable");
  }

  function applyHeading() {
    const el = $(".user-dot__heading");
    if (!el) return;
    const deg = (userPos && userPos.heading != null) ? userPos.heading : headingFromDevice;
    if (deg == null) { el.hidden = true; setCompass(null); return; }
    el.hidden = false;
    el.style.transform = "rotate(" + deg + "deg)";
    setCompass(deg);
  }

  /** Device compass, only wired after an explicit tap (iOS requires it). */
  async function enableCompass() {
    try {
      if (typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return false;
      }
      window.addEventListener("deviceorientation", e => {
        const deg = e.webkitCompassHeading != null
          ? e.webkitCompassHeading
          : (e.alpha != null ? 360 - e.alpha : null);
        if (deg != null) { headingFromDevice = deg; applyHeading(); }
      }, { passive: true });
      return true;
    } catch (_) {
      return false;
    }
  }

  function setFollowMe(on) {
    followMe = Boolean(on) && Boolean(userPos);
    const btn = $("[data-follow]");
    if (btn) {
      btn.classList.toggle("is-active", followMe);
      btn.setAttribute("aria-pressed", String(followMe));
    }
  }

  /* ----------------------------------------------------------------- routing */
  /** Decode a Valhalla polyline6 shape. */
  function decodeShape(str, precision = 6) {
    const factor = Math.pow(10, precision);
    let index = 0, lat = 0, lon = 0;
    const out = [];
    while (index < str.length) {
      let shift = 0, result = 0, byte;
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0; result = 0;
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
      lon += (result & 1) ? ~(result >> 1) : (result >> 1);
      out.push([lon / factor, lat / factor]);
    }
    return out;
  }

  /**
   * Ask the pedestrian router for a real walking path.
   * Returns { coords, meters, seconds, mode:"walking" } or null on any failure.
   * This is the one call that transmits the visitor's coordinates, and only
   * when they explicitly request directions.
   */
  async function fetchWalkingRoute(waypoints) {
    try {
      const res = await fetch(CONFIG.routingUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: waypoints.map(w => ({ lat: w.lat, lon: w.lon, type: "break" })),
          costing: "pedestrian",
          directions_options: { units: "kilometers" }
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      const trip = data && data.trip;
      if (!trip || !trip.legs || !trip.legs.length) return null;
      const coords = trip.legs.flatMap(l => decodeShape(l.shape));
      if (coords.length < 2) return null;
      return {
        coords,
        meters: Math.round((trip.summary.length || 0) * 1000),
        seconds: Math.round(trip.summary.time || 0),
        mode: "walking"
      };
    } catch (_) {
      return null;
    }
  }

  function straightLine(waypoints) {
    let meters = 0;
    for (let i = 1; i < waypoints.length; i++) meters += haversine(waypoints[i - 1], waypoints[i]);
    return {
      coords: waypoints.map(w => [w.lon, w.lat]),
      meters: Math.round(meters),
      seconds: null,
      mode: "approximate"
    };
  }

  function drawNav(result, label) {
    map.getSource("nav").setData({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { mode: result.mode, label: label || "" },
        geometry: { type: "LineString", coordinates: result.coords }
      }]
    });
  }

  function clearNav() {
    navTarget = null;
    if (map && map.getSource("nav")) {
      map.getSource("nav").setData({ type: "FeatureCollection", features: [] });
    }
    const bar = $("#navBar");
    if (bar) bar.hidden = true;
  }

  async function walkTo(place) {
    if (!userPos) { openPermissionSheet(); return; }

    const bar = $("#navBar");
    bar.hidden = false;
    $("#navName").textContent = place.name;
    $("#navMeta").textContent = "Finding a walking route…";
    $("#navMode").hidden = true;

    const dest = { lat: place.latitude, lon: place.longitude };
    let result = await fetchWalkingRoute([{ lat: userPos.lat, lon: userPos.lon }, dest]);
    let honest = true;

    if (!result) {
      result = straightLine([{ lat: userPos.lat, lon: userPos.lon }, dest]);
      honest = false;
    }

    navTarget = { place, mode: result.mode };
    drawNav(result, place.name);

    if (result.mode === "walking") {
      $("#navMeta").textContent = formatDistance(result.meters) + " · about " + formatDuration(result.seconds) + " on foot";
      $("#navMode").hidden = true;
    } else {
      // Never present a straight line as a pedestrian route.
      $("#navMeta").textContent = formatDistance(result.meters) + " in a straight line";
      $("#navMode").hidden = false;
      $("#navMode").textContent = "Approximate direction — no pedestrian route available";
    }

    if (userPos.accuracy > CONFIG.maxAccuracyForNav) {
      $("#navMeta").textContent += " · location accurate to ~" + Math.round(userPos.accuracy) + " m";
    }

    const bounds = result.coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(result.coords[0], result.coords[0])
    );
    map.fitBounds(bounds, { padding: { top: 90, bottom: 220, left: 40, right: 40 }, duration: reduceMotion() ? 0 : 700 });
    closeSheet();
    void honest;
  }

  function updateNavProgress() {
    if (!navTarget || !userPos) return;
    const remaining = haversine(
      { lat: userPos.lat, lon: userPos.lon },
      { lat: navTarget.place.latitude, lon: navTarget.place.longitude }
    );
    const el = $("#navRemaining");
    if (el) el.textContent = formatDistance(remaining) + " to go";
    if (remaining < 25) {
      $("#navMeta").textContent = "You have arrived at " + navTarget.place.name;
    }
  }

  async function showRoute(route) {
    const pts = route.waypoints.map(id => {
      const p = places.find(x => x.id === id);
      return p ? { lat: p.latitude, lon: p.longitude } : null;
    }).filter(Boolean);

    if (pts.length < 2) return;

    const panel = $("#routeStatus");
    panel.textContent = "Building " + route.name + "…";

    let result = await fetchWalkingRoute(pts);
    if (!result) result = straightLine(pts);
    drawNav(result, route.name);

    panel.textContent = result.mode === "walking"
      ? route.name + " · " + formatDistance(result.meters) + " · about " + formatDuration(result.seconds) + " on foot"
      : route.name + " · " + formatDistance(result.meters) + " straight-line — approximate direction only";

    const bounds = result.coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(result.coords[0], result.coords[0])
    );
    map.fitBounds(bounds, { padding: 60, duration: reduceMotion() ? 0 : 700 });
  }

  /* ------------------------------------------------------------------ nearby */
  const NEARBY_CATEGORIES = ["cafe", "restaurant", "restroom", "museum", "garden"];

  function nearestByCategory() {
    if (!userPos) return [];
    const here = { lat: userPos.lat, lon: userPos.lon };
    return NEARBY_CATEGORIES.map(cat => {
      const inCat = places.filter(p => p.category === cat);
      if (!inCat.length) return null;
      let best = null;
      for (const p of inCat) {
        const d = haversine(here, { lat: p.latitude, lon: p.longitude });
        if (!best || d < best.meters) best = { place: p, meters: d };
      }
      return best;
    }).filter(Boolean).sort((a, b) => a.meters - b.meters);
  }

  function renderNearby() {
    const list = $("#nearbyList");
    const empty = $("#nearbyEmpty");
    if (!list) return;
    list.innerHTML = "";

    if (!userPos) {
      empty.hidden = false;
      empty.textContent = "Turn on your location to see what is closest to you.";
      return;
    }

    const rows = nearestByCategory();
    if (!rows.length) { empty.hidden = false; empty.textContent = "No mapped places to compare yet."; return; }
    empty.hidden = true;

    for (const row of rows) {
      const meta = categories[row.place.category] || {};
      const li = document.createElement("li");
      li.className = "nearby__item";
      li.innerHTML =
        '<button type="button" class="nearby__btn">' +
          '<span class="nearby__cat">' + (meta.label || row.place.category) + '</span>' +
          '<span class="nearby__name"></span>' +
          '<span class="nearby__dist">' + formatDistance(row.meters) + '</span>' +
        '</button>';
      li.querySelector(".nearby__name").textContent = row.place.name;
      li.querySelector("button").addEventListener("click", () => {
        selectPlace(row.place.id, { fly: true });
        closePanels();
      });
      list.appendChild(li);
    }
  }

  /* ---------------------------------------------------------------------- ui */
  function setLocationState(state) {
    const pill = $("#locState");
    const btn = $("[data-locate]");
    const messages = {
      off:         { text: "Location off", cls: "" },
      locating:    { text: "Finding you…", cls: "is-busy" },
      on:          { text: "Location on", cls: "is-on" },
      denied:      { text: "Location access is off. You can still explore the park map manually.", cls: "is-warn" },
      timeout:     { text: "Could not get a fix. You can still explore the map manually.", cls: "is-warn" },
      unavailable: { text: "Location unavailable. You can still explore the map manually.", cls: "is-warn" },
      unsupported: { text: "This browser has no location support. The map still works.", cls: "is-warn" }
    };
    const m = messages[state] || messages.off;
    if (pill) {
      pill.textContent = m.text;
      pill.className = "loc-state " + m.cls;
      pill.hidden = false;
    }
    if (btn) {
      btn.classList.toggle("is-active", state === "on");
      btn.setAttribute("aria-pressed", String(state === "on"));
    }
    const stopBtn = $("[data-stop-location]");
    if (stopBtn) stopBtn.hidden = state !== "on";
  }

  function updateInsidePill(feature) {
    const pill = $("#insidePill");
    if (!pill) return;
    if (!userPos) { pill.hidden = true; return; }
    pill.hidden = false;
    if (feature) {
      pill.textContent = "You are inside Al Shaheed Park" +
        (feature.properties.phase ? " · Phase " + feature.properties.phase : "");
      pill.className = "inside-pill is-inside";
    } else {
      pill.textContent = "You are currently outside Al Shaheed Park";
      pill.className = "inside-pill is-outside";
    }
  }

  function buildFilters() {
    const wrap = $("#filterList");
    if (!wrap) return;
    const counts = {};
    for (const p of places) counts[p.category] = (counts[p.category] || 0) + 1;

    for (const cat of CATEGORY_ORDER) {
      const meta = categories[cat];
      if (!meta) continue;
      const n = counts[cat] || 0;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.cat = cat;
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = '<span class="chip__swatch" style="background:' + meta.color + '"></span>' +
        '<span></span><span class="chip__n">' + n + '</span>';
      btn.querySelector("span:nth-child(2)").textContent = meta.plural;
      if (!n) {
        btn.disabled = true;
        btn.title = "Not mapped inside the park yet";
        btn.classList.add("is-empty");
      }
      btn.addEventListener("click", () => {
        if (activeCategories.has(cat)) activeCategories.delete(cat);
        else activeCategories.add(cat);
        btn.setAttribute("aria-pressed", String(activeCategories.has(cat)));
        btn.classList.toggle("is-active", activeCategories.has(cat));
        refreshPlaces();
        const reset = $("[data-filter-reset]");
        if (reset) reset.hidden = activeCategories.size === 0;
      });
      li.appendChild(btn);
      wrap.appendChild(li);
    }
  }

  function buildRoutes() {
    const wrap = $("#routeList");
    if (!wrap) return;
    for (const r of routes) {
      const li = document.createElement("li");
      li.className = "route-item";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "route-btn";
      btn.disabled = !r.available;
      btn.innerHTML =
        '<span class="route-btn__name"></span>' +
        '<span class="route-btn__desc"></span>' +
        (r.available ? '<span class="route-btn__go">Show route →</span>' : '<span class="route-btn__na">Not available yet</span>');
      btn.querySelector(".route-btn__name").textContent = r.name;
      btn.querySelector(".route-btn__desc").textContent = r.available ? r.description : (r.unavailable_reason || r.description);
      if (r.available) {
        btn.addEventListener("click", () => { showRoute(r); });
      }
      li.appendChild(btn);
      wrap.appendChild(li);
    }
  }

  function selectPlace(id, opts = {}) {
    const place = places.find(p => p.id === id);
    if (!place) return;
    selectedPlaceId = id;

    $("#sheetName").textContent = place.name + (place.name_ar ? " · " + place.name_ar : "");
    const meta = categories[place.category] || {};
    $("#sheetCat").textContent = meta.label || place.category;
    $("#sheetDesc").textContent = place.description || "";

    // Distance only when it has actually been computed from a real fix.
    const distEl = $("#sheetDist");
    if (userPos) {
      const d = haversine({ lat: userPos.lat, lon: userPos.lon }, { lat: place.latitude, lon: place.longitude });
      distEl.textContent = formatDistance(d) + " away";
      distEl.hidden = false;
    } else {
      distEl.hidden = true;
    }

    const hours = $("#sheetHours");
    if (place.availability === "temporarily-closed") {
      hours.textContent = "Temporarily closed in current listing";
      hours.hidden = false;
    } else if (place.hours) {
      hours.textContent = "Listed hours " + place.hours.replace("-", " – ");
      hours.hidden = false;
    } else {
      hours.hidden = true;
    }

    const note = $("#sheetNote");
    note.textContent = place.note || "";
    note.hidden = !place.note;

    const gm = $("#sheetMaps");
    gm.href = place.google_maps_url;

    // "View details" points at the section of the guide that covers this
    // kind of place, so the button always lands somewhere real.
    const detailTargets = {
      cafe: "index.html#dining",
      restaurant: "index.html#dining",
      museum: "index.html#culture",
      garden: "index.html#family",
      family_area: "index.html#family",
      event_area: "index.html#events",
      running_route: "index.html#sports",
      attraction: "index.html#experiences"
    };
    $("#sheetDetails").href = detailTargets[place.category] || "index.html#location";

    const walk = $("#sheetWalk");
    walk.textContent = userPos ? "Walk there" : "Walk there (needs location)";

    $("#sheetSource").textContent = place.source === "google"
      ? "Coordinates from its Google Maps entry"
      : "Coordinates from OpenStreetMap";

    $("#placeSheet").hidden = false;

    if (opts.fly !== false) {
      map.easeTo({
        center: [place.longitude, place.latitude],
        zoom: Math.max(map.getZoom(), 16.6),
        offset: [0, -90],
        duration: reduceMotion() ? 0 : 600
      });
    }
  }

  function closeSheet() {
    const s = $("#placeSheet");
    if (s) s.hidden = true;
    selectedPlaceId = null;
  }

  function openPermissionSheet() { $("#permSheet").hidden = false; }
  function closePermissionSheet() { $("#permSheet").hidden = true; }

  function openPanel(name) {
    closePanels();
    const p = $('[data-panel="' + name + '"]');
    if (p) p.hidden = false;
    $$("[data-panel-open]").forEach(b =>
      b.classList.toggle("is-active", b.dataset.panelOpen === name && p && !p.hidden));
  }
  function closePanels() {
    $$("[data-panel]").forEach(p => { p.hidden = true; });
    $$("[data-panel-open]").forEach(b => b.classList.remove("is-active"));
  }

  function setCompass(deg) {
    const c = $("#compass");
    if (!c) return;
    if (deg == null) { c.hidden = true; return; }
    c.hidden = false;
    $("#compassNeedle").style.transform = "rotate(" + (-deg) + "deg)";
    $("#compassDeg").textContent = Math.round(deg) + "°";
  }

  function wireUI() {
    $("[data-locate]").addEventListener("click", () => {
      if (userPos) { map.easeTo({ center: [userPos.lon, userPos.lat], zoom: Math.max(map.getZoom(), 16.4) }); setFollowMe(true); }
      else openPermissionSheet();
    });

    $("[data-use-location]").addEventListener("click", () => {
      closePermissionSheet();
      startLocating();
      enableCompass();
    });
    $$("[data-perm-dismiss]").forEach(b => b.addEventListener("click", closePermissionSheet));

    $("[data-stop-location]").addEventListener("click", stopLocating);
    $("[data-follow]").addEventListener("click", () => setFollowMe(!followMe));
    $("[data-recenter]").addEventListener("click", () => {
      if (userPos) map.easeTo({ center: [userPos.lon, userPos.lat], zoom: Math.max(map.getZoom(), 16.4) });
      else map.fitBounds(boundaryBounds(), { padding: 48 });
    });

    $$("[data-panel-open]").forEach(btn => btn.addEventListener("click", () => {
      const name = btn.dataset.panelOpen;
      const panel = $('[data-panel="' + name + '"]');
      if (panel && !panel.hidden) { closePanels(); return; }
      if (name === "nearby") renderNearby();
      openPanel(name);
    }));
    $$("[data-panel-close]").forEach(b => b.addEventListener("click", closePanels));

    $("[data-filter-reset]").addEventListener("click", () => {
      activeCategories.clear();
      $$("#filterList .chip").forEach(c => { c.classList.remove("is-active"); c.setAttribute("aria-pressed", "false"); });
      refreshPlaces();
      $("[data-filter-reset]").hidden = true;
    });

    $("[data-sheet-close]").addEventListener("click", closeSheet);
    $("#sheetWalk").addEventListener("click", () => {
      const p = places.find(x => x.id === selectedPlaceId);
      if (p) walkTo(p);
    });
    $("[data-nav-exit]").addEventListener("click", clearNav);
    $("[data-route-clear]").addEventListener("click", () => {
      clearNav();
      $("#routeStatus").textContent = "";
    });

    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (!$("#placeSheet").hidden) closeSheet();
      else if (!$("#permSheet").hidden) closePermissionSheet();
      else closePanels();
    });

    // Positions are never persisted; make the discard explicit on unload.
    window.addEventListener("pagehide", () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      userPos = null;
    });
  }

  /* -------------------------------------------------------------------- init */
  async function init() {
    const fail = msg => {
      const el = $("#mapFallback");
      if (el) { el.hidden = false; $("#mapFallbackText").textContent = msg; }
    };

    if (typeof maplibregl === "undefined") {
      fail("The map library could not be loaded. Check your connection and reload — the rest of the guide still works.");
      return;
    }
    if (typeof window.ParkData === "undefined") {
      fail("Park data could not be loaded.");
      return;
    }

    try {
      categories = ParkData.getCategories();
      [boundary, places, routes] = await Promise.all([
        ParkData.getBoundary(), ParkData.getPlaces(), ParkData.getRoutes()
      ]);
      buildFilters();
      buildRoutes();
      wireUI();
      await buildMap();
      renderNearby();
      setLocationState("off");
      $("#mapLoading").hidden = true;
    } catch (err) {
      console.error(err);
      fail("The map failed to start: " + (err && err.message ? err.message : "unknown error"));
      const l = $("#mapLoading");
      if (l) l.hidden = true;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
