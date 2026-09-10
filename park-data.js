/* ==========================================================================
   AL SHAHEED PARK — PARK DATA
   ==========================================================================
   Permanent park data: boundary, places and routes. This is the single data
   layer for the live map. It is deliberately shaped like the intended
   Supabase schema so it can be swapped for a query without touching map.js
   (see ParkData.getPlaces / getRoutes at the bottom of this file).

   PROVENANCE — every coordinate here is verified, none are estimated.
     source: "osm"    — OpenStreetMap, confirmed inside the park polygons
                        (© OpenStreetMap contributors, ODbL).
     source: "google" — read from the place's own Google Maps entry
                        (authoritative !3d/!4d place coordinates).
   Boundary polygons are OSM relations 18067175-18067178 (Phases 1-4) and
   way 1451022213 (Al Soor Gardens), stitched into closed rings.

   NOT YET MAPPED — intentionally empty rather than invented. OpenStreetMap
   has no parking, entrance, family_area, event_area or running_route nodes
   inside the park boundary, so those categories carry no pins. Add them here
   with real coordinates and they appear on the map automatically.
   ========================================================================== */

(function (global) {
  "use strict";

  /* --- Park boundary (real OSM geometry) -------------------------------- */
  const PARK_BOUNDARY = {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "name": "Shaheed Park - Phase 1",
          "phase": 1,
          "osm": "relation/18067178"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [
                47.994013,
                29.375345
              ],
              [
                47.994229,
                29.375331
              ],
              [
                47.994464,
                29.37528
              ],
              [
                47.99489,
                29.375208
              ],
              [
                47.995124,
                29.375142
              ],
              [
                47.995333,
                29.375048
              ],
              [
                47.995575,
                29.374917
              ],
              [
                47.995801,
                29.374794
              ],
              [
                47.996338,
                29.374458
              ],
              [
                47.996605,
                29.374422
              ],
              [
                47.995734,
                29.371067
              ],
              [
                47.995395,
                29.369791
              ],
              [
                47.995291,
                29.369476
              ],
              [
                47.995068,
                29.368873
              ],
              [
                47.995032,
                29.3688
              ],
              [
                47.994937,
                29.368585
              ],
              [
                47.99467,
                29.368058
              ],
              [
                47.994526,
                29.367799
              ],
              [
                47.994374,
                29.367544
              ],
              [
                47.994049,
                29.367042
              ],
              [
                47.993876,
                29.366797
              ],
              [
                47.993696,
                29.366556
              ],
              [
                47.993509,
                29.366318
              ],
              [
                47.993316,
                29.366085
              ],
              [
                47.99291,
                29.365631
              ],
              [
                47.992697,
                29.365411
              ],
              [
                47.99228,
                29.364964
              ],
              [
                47.991843,
                29.365245
              ],
              [
                47.990237,
                29.366479
              ],
              [
                47.991382,
                29.367634
              ],
              [
                47.991972,
                29.368216
              ],
              [
                47.992248,
                29.368492
              ],
              [
                47.992503,
                29.368828
              ],
              [
                47.992954,
                29.370007
              ],
              [
                47.993508,
                29.371385
              ],
              [
                47.993697,
                29.371961
              ],
              [
                47.993833,
                29.372625
              ],
              [
                47.993902,
                29.373419
              ],
              [
                47.993984,
                29.374142
              ],
              [
                47.994007,
                29.374969
              ],
              [
                47.994013,
                29.375345
              ]
            ]
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "name": "Shaheed Park - Phase 2",
          "phase": 2,
          "osm": "relation/18067177"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [
                47.985439,
                29.363089
              ],
              [
                47.988015,
                29.364695
              ],
              [
                47.988236,
                29.364835
              ],
              [
                47.988453,
                29.36498
              ],
              [
                47.988665,
                29.36513
              ],
              [
                47.988873,
                29.365285
              ],
              [
                47.989469,
                29.365776
              ],
              [
                47.989658,
                29.365948
              ],
              [
                47.990237,
                29.366479
              ],
              [
                47.991843,
                29.365245
              ],
              [
                47.99228,
                29.364964
              ],
              [
                47.991813,
                29.36459
              ],
              [
                47.991489,
                29.364321
              ],
              [
                47.990488,
                29.363543
              ],
              [
                47.990145,
                29.363292
              ],
              [
                47.989798,
                29.363047
              ],
              [
                47.989447,
                29.362807
              ],
              [
                47.988782,
                29.362366
              ],
              [
                47.988469,
                29.362166
              ],
              [
                47.987293,
                29.361447
              ],
              [
                47.986863,
                29.361217
              ],
              [
                47.986578,
                29.361602
              ],
              [
                47.986104,
                29.362192
              ],
              [
                47.985689,
                29.362767
              ],
              [
                47.985439,
                29.363089
              ]
            ]
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "name": "Shaheed Park - Phase 3",
          "phase": 3,
          "osm": "relation/18067176"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [
                47.986863,
                29.361217
              ],
              [
                47.985716,
                29.36063
              ],
              [
                47.985393,
                29.360484
              ],
              [
                47.985068,
                29.360344
              ],
              [
                47.984739,
                29.36021
              ],
              [
                47.984071,
                29.359961
              ],
              [
                47.983733,
                29.359846
              ],
              [
                47.982799,
                29.359581
              ],
              [
                47.982483,
                29.359505
              ],
              [
                47.981847,
                29.35937
              ],
              [
                47.981202,
                29.359263
              ],
              [
                47.980878,
                29.359219
              ],
              [
                47.980226,
                29.359146
              ],
              [
                47.979899,
                29.359117
              ],
              [
                47.976574,
                29.35903
              ],
              [
                47.974143,
                29.358947
              ],
              [
                47.974568,
                29.361788
              ],
              [
                47.975047,
                29.361761
              ],
              [
                47.97698,
                29.361743
              ],
              [
                47.979669,
                29.361697
              ],
              [
                47.980431,
                29.36169
              ],
              [
                47.980937,
                29.361715
              ],
              [
                47.981442,
                29.361764
              ],
              [
                47.981693,
                29.361798
              ],
              [
                47.982203,
                29.361901
              ],
              [
                47.982456,
                29.361962
              ],
              [
                47.982706,
                29.362029
              ],
              [
                47.982954,
                29.362104
              ],
              [
                47.983442,
                29.362271
              ],
              [
                47.983768,
                29.362387
              ],
              [
                47.98409,
                29.362509
              ],
              [
                47.98441,
                29.362638
              ],
              [
                47.984727,
                29.362772
              ],
              [
                47.985439,
                29.363089
              ],
              [
                47.985689,
                29.362767
              ],
              [
                47.986104,
                29.362192
              ],
              [
                47.986578,
                29.361602
              ],
              [
                47.986863,
                29.361217
              ]
            ]
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "name": "Shaheed Park - Phase 4",
          "phase": 4,
          "osm": "relation/18067175"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [
                47.966748,
                29.360904
              ],
              [
                47.966502,
                29.360883
              ],
              [
                47.964588,
                29.360746
              ],
              [
                47.964188,
                29.360724
              ],
              [
                47.963567,
                29.360713
              ],
              [
                47.962896,
                29.360712
              ],
              [
                47.962631,
                29.360244
              ],
              [
                47.962493,
                29.359975
              ],
              [
                47.962405,
                29.359792
              ],
              [
                47.962672,
                29.359719
              ],
              [
                47.963031,
                29.35962
              ],
              [
                47.964613,
                29.359343
              ],
              [
                47.966265,
                29.359069
              ],
              [
                47.967451,
                29.358948
              ],
              [
                47.968772,
                29.358832
              ],
              [
                47.968969,
                29.358831
              ],
              [
                47.970066,
                29.358824
              ],
              [
                47.971208,
                29.358857
              ],
              [
                47.974143,
                29.358947
              ],
              [
                47.974568,
                29.361788
              ],
              [
                47.973494,
                29.36161
              ],
              [
                47.972447,
                29.361456
              ],
              [
                47.969774,
                29.361174
              ],
              [
                47.969435,
                29.361137
              ],
              [
                47.969093,
                29.361101
              ],
              [
                47.966748,
                29.360904
              ]
            ]
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "name": "Al Soor Gardens | Al Shaheed park",
          "phase": null,
          "osm": "way/1451022213"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [
                47.975553,
                29.361309
              ],
              [
                47.975314,
                29.359665
              ],
              [
                47.979508,
                29.359459
              ],
              [
                47.981776,
                29.359736
              ],
              [
                47.985426,
                29.361121
              ],
              [
                47.984891,
                29.362183
              ],
              [
                47.982188,
                29.361348
              ],
              [
                47.979879,
                29.361189
              ],
              [
                47.975553,
                29.361309
              ]
            ]
          ]
        }
      }
    ]
  };

  /* --- Categories ------------------------------------------------------- */
  const CATEGORIES = {
    cafe:          { label: "Coffee",      plural: "Cafés",        icon: "cup",    color: "#6b5b4a" },
    restaurant:    { label: "Restaurant",  plural: "Restaurants",  icon: "fork",   color: "#7a5a4a" },
    museum:        { label: "Museum",      plural: "Museums",      icon: "temple", color: "#4a5a6b" },
    garden:        { label: "Garden",      plural: "Gardens",      icon: "leaf",   color: "#4c5a48" },
    attraction:    { label: "Attraction",  plural: "Attractions",  icon: "star",   color: "#6b5a4a" },
    parking:       { label: "Parking",     plural: "Parking",      icon: "parking",color: "#5a5a57" },
    entrance:      { label: "Entrance",    plural: "Entrances",    icon: "door",   color: "#5a5a57" },
    restroom:      { label: "Restroom",    plural: "Restrooms",    icon: "wc",     color: "#5a5a57" },
    family_area:   { label: "Family area", plural: "Family areas", icon: "family", color: "#5a6a4c" },
    event_area:    { label: "Event area",  plural: "Event areas",  icon: "stage",  color: "#5a4a5a" },
    running_route: { label: "Running",     plural: "Running",      icon: "run",    color: "#4c5a48" },
    facility:      { label: "Facility",    plural: "Facilities",   icon: "info",   color: "#5a5a57" }
  };

  /* --- Places ----------------------------------------------------------
     Field names match the intended `places` table:
       id, name, category, latitude, longitude, google_maps_url,
       description, image_url, is_active, display_order
     Extra local fields: name_ar, phase, source, scene (illustration key).
  --------------------------------------------------------------------- */
  const PLACES = [
    /* ---------- Cafés ---------- */
    {
      id: "fleur-cafe", name: "Fleur Cafe", category: "cafe",
      latitude: 29.362512, longitude: 47.987535, phase: 2, source: "osm",
      google_maps_url: "https://maps.app.goo.gl/mygz3XwC95PEnL8N6?g_st=ic",
      description: "A calm coffee stop inside the Al Shaheed Park experience.",
      hours: "06:00-23:00", image_url: null, scene: "sc-dining",
      is_active: true, display_order: 10
    },
    {
      id: "opt-coffee", name: "OPT Coffee", category: "cafe",
      latitude: 29.363115, longitude: 47.98663, phase: 2, source: "osm",
      google_maps_url: "https://maps.app.goo.gl/wp8DYBKdahLrGMkR8?g_st=ic",
      description: "A coffee stop within the park grounds.",
      hours: null, image_url: null, scene: "sc-gardens",
      is_active: true, display_order: 20
    },
    {
      id: "le-cafe", name: "Le Cafe by Folio", category: "cafe",
      latitude: 29.3635997, longitude: 47.9878011, phase: 2, source: "google",
      google_maps_url: "https://maps.app.goo.gl/3okhzUjwvPSUE9us7?g_st=ic",
      description: "A café in the park, suited to a short pause between walks.",
      hours: null, image_url: null, scene: "sc-workshop",
      is_active: true, display_order: 30
    },
    {
      id: "ciervo-cafe", name: "Ciervo Cafe", category: "cafe",
      latitude: 29.363419, longitude: 47.989367, phase: 2, source: "osm",
      google_maps_url: "https://maps.app.goo.gl/dHiWcrCfCuzwVSGQ8?g_st=ic",
      description: "A café in the park's Phase II area, with outdoor seating.",
      hours: "06:00-23:00", image_url: null, scene: "sc-dining",
      is_active: true, display_order: 40
    },
    {
      id: "ole-coffee", name: "OLE Coffee", category: "cafe",
      latitude: 29.3645813, longitude: 47.9883615, phase: 2, source: "google",
      google_maps_url: "https://maps.google.com?q=OLE%20Coffee,%20Shaheed%20Park,%20Soor%20St,%20%D9%85%D8%AF%D9%8A%D9%86%D8%A9%20%D8%A7%D9%84%D9%83%D9%88%D9%8A%D8%AA%2000000&ftid=0x3fcf856306afbaef:0xb1722f1368fa6669&entry=gps&shh=CAE&lucs=,94297699,94231188,94280568,47071704,94218641,94282134,94286869,100820247,100822504,100804976&g_st=ic",
      description: "A coffee stop on Soor Street, inside the park.",
      hours: "06:30-23:30", image_url: null, scene: "sc-museum",
      is_active: true, display_order: 50
    },
    {
      id: "arabica", name: "% Arabica", category: "cafe",
      name_full: "% Arabica Kuwait Al-Shaheed Roastery",
      latitude: 29.36504, longitude: 47.989738, phase: 2, source: "google",
      google_maps_url: "https://maps.app.goo.gl/giYm1XKQuwVVywy48?g_st=ic",
      description: "A specialty coffee counter inside the park.",
      hours: "06:00-24:00", image_url: null, scene: "sc-summer",
      is_active: true, display_order: 60
    },
    {
      id: "rukn-cafe", name: "Rukn Al-Shaheed Cafe", name_ar: "كافية ركن الشهيد",
      category: "cafe",
      latitude: 29.36856, longitude: 47.9940282, phase: 1, source: "google",
      google_maps_url: "https://maps.app.goo.gl/jnwzQHJKBrNsqvvw5?g_st=ic",
      description: "A café within the park grounds.",
      hours: null, image_url: null, scene: "sc-gardens",
      is_active: true, display_order: 70
    },
    {
      id: "kelly-coffee", name: "Kelly Coffee", category: "cafe",
      latitude: 29.363586, longitude: 47.987772, phase: 2, source: "osm",
      google_maps_url: "https://www.google.com/maps?q=29.363586,47.987772",
      description: "A coffee kiosk mapped in the Phase II area.",
      hours: null, image_url: null, scene: "sc-dining",
      is_active: true, display_order: 80
    },
    {
      id: "starbucks", name: "Starbucks", category: "cafe",
      latitude: 29.368833, longitude: 47.994082, phase: 1, source: "osm",
      google_maps_url: "https://www.google.com/maps?q=29.368833,47.994082",
      description: "A familiar quick stop in the Phase I area.",
      hours: "06:30-23:30", image_url: null, scene: "sc-museum",
      is_active: true, display_order: 90
    },

    /* ---------- Restaurants ---------- */
    {
      id: "allso", name: "ALLSO Restaurant", name_ar: "مطعم اولسو", category: "restaurant",
      latitude: 29.36616, longitude: 47.992432, phase: 1, source: "osm",
      google_maps_url: "https://maps.app.goo.gl/VHAJ9ch1yMom1SqJ7?g_st=ic",
      description: "A restaurant inside the park.",
      hours: null, availability: "temporarily-closed", image_url: null, scene: "sc-dining",
      is_active: true, display_order: 100
    },
    {
      id: "table-otto", name: "Table Otto", name_ar: "تيبل اوتو", category: "restaurant",
      latitude: 29.372683, longitude: 47.9953473, phase: 1, source: "google",
      google_maps_url: "https://maps.app.goo.gl/QoMpqG4DLkk53xRx9?g_st=ic",
      description: "A restaurant in front of the Habitat Museum.",
      hours: null, availability: "temporarily-closed", image_url: null, scene: "sc-night",
      is_active: true, display_order: 110
    },
    {
      id: "ayyame", name: "Ayyame", category: "restaurant",
      latitude: 29.364778, longitude: 47.989801, phase: 2, source: "osm",
      google_maps_url: "https://www.google.com/maps?q=29.364778,47.989801",
      description: "A restaurant mapped in the Phase II area.",
      hours: null, image_url: null, scene: "sc-dining",
      is_active: true, display_order: 120
    },

    /* ---------- Museums ---------- */
    {
      id: "habitat-museum", name: "Habitat Museum", name_ar: "متحف الموطن", category: "museum",
      latitude: 29.3728451, longitude: 47.9949889, phase: 1, source: "google",
      google_maps_url: "https://www.google.com/maps?q=29.3728451,47.9949889",
      description: "Linked to Kuwait's natural environment and ecological identity.",
      hours: null, image_url: null, scene: "sc-museum",
      is_active: true, display_order: 130
    },
    {
      id: "memorial-museum", name: "Memorial Museum", category: "museum",
      latitude: 29.36644, longitude: 47.992189, phase: 1, source: "osm",
      google_maps_url: "https://www.google.com/maps?q=29.36644,47.992189",
      description: "Historical storytelling within the Phase I museum cluster.",
      hours: null, image_url: null, scene: "sc-museum",
      is_active: true, display_order: 140,
      note: "The park's Thekra Museum is not separately mapped; this is the museum OpenStreetMap records here."
    },

    /* ---------- Gardens ---------- */
    {
      id: "al-soor-gardens", name: "Al Soor Gardens", category: "garden",
      latitude: 29.360821, longitude: 47.98037, phase: 3, source: "osm",
      google_maps_url: "https://www.google.com/maps?q=29.360821,47.98037",
      description: "Landscaped gardens on the Phase III side of the park.",
      hours: null, image_url: null, scene: "sc-gardens",
      is_active: true, display_order: 150
    },

    /* ---------- Facilities ---------- */
    {
      id: "restroom-p2", name: "Restrooms — Phase II", category: "restroom",
      latitude: 29.364388, longitude: 47.989542, phase: 2, source: "osm",
      google_maps_url: "https://www.google.com/maps?q=29.364388,47.989542",
      description: "Public toilets mapped in the Phase II area.",
      hours: null, image_url: null, scene: null,
      is_active: true, display_order: 160
    },
    {
      id: "restroom-p1", name: "Restrooms — Phase I", category: "restroom",
      latitude: 29.36903, longitude: 47.99435, phase: 1, source: "osm",
      google_maps_url: "https://www.google.com/maps?q=29.36903,47.99435",
      description: "Public toilets mapped in the Phase I area.",
      hours: null, image_url: null, scene: null,
      is_active: true, display_order: 170
    },
    {
      id: "mosque-p1", name: "Mosque", category: "facility",
      latitude: 29.373149, longitude: 47.994439, phase: 1, source: "osm",
      google_maps_url: "https://www.google.com/maps?q=29.373149,47.994439",
      description: "Mosque in the Phase I area.",
      hours: null, image_url: null, scene: null,
      is_active: true, display_order: 180
    }
  ];

  /* --- Routes ----------------------------------------------------------
     Shaped like the intended `routes` table. Routes are stored as ordered
     waypoints rather than a hand-drawn line: the actual path is produced by
     the pedestrian routing service at request time, so nothing here claims a
     walking distance that has not been measured. distance_meters and
     estimated_minutes are therefore null until routing computes them — they
     are never estimated in this file.

     A route with available: false has no mapped waypoints in the park yet.
     Add the waypoint places above and flip the flag.
  --------------------------------------------------------------------- */
  const ROUTES = [
    {
      id: "coffee-walk", name: "Coffee Walk", category: "coffee",
      description: "The Phase II café cluster, in walking order.",
      waypoints: ["opt-coffee", "le-cafe", "kelly-coffee", "ciervo-cafe", "ole-coffee", "arabica"],
      distance_meters: null, estimated_minutes: null, geojson: null,
      is_active: true, available: true
    },
    {
      id: "museum-route", name: "Museum Route", category: "culture",
      description: "Both mapped museums, north through Phase I.",
      waypoints: ["memorial-museum", "habitat-museum"],
      distance_meters: null, estimated_minutes: null, geojson: null,
      is_active: true, available: true
    },
    {
      id: "quick-visit", name: "Quick Visit", category: "quick",
      description: "One coffee and one museum, then out.",
      waypoints: ["ciervo-cafe", "memorial-museum"],
      distance_meters: null, estimated_minutes: null, geojson: null,
      is_active: true, available: true
    },
    {
      id: "full-park-walk", name: "Full Park Walk", category: "full",
      description: "Al Soor Gardens through Phase II to the Phase I museums.",
      waypoints: ["al-soor-gardens", "ciervo-cafe", "memorial-museum", "habitat-museum"],
      distance_meters: null, estimated_minutes: null, geojson: null,
      is_active: true, available: true
    },
    {
      id: "family-walk", name: "Family Walk", category: "family",
      description: "Needs mapped family areas and playgrounds before it can be routed.",
      waypoints: [], distance_meters: null, estimated_minutes: null, geojson: null,
      is_active: true, available: false,
      unavailable_reason: "No family areas or playgrounds are mapped inside the park yet."
    },
    {
      id: "running-route", name: "Running Route", category: "fitness",
      description: "Needs the park's jogging track geometry before it can be routed.",
      waypoints: [], distance_meters: null, estimated_minutes: null, geojson: null,
      is_active: true, available: false,
      unavailable_reason: "The park's jogging track is not mapped as a route in OpenStreetMap yet."
    }
  ];

  /* --- Supabase-backed data adapter ------------------------------------
     map.js only ever calls these four methods. They read the park content
     tables over Supabase's REST endpoint using plain fetch — no client
     library, so the page stays dependency-free.

     The key below is the PUBLISHABLE key. It is designed to sit in a browser:
     every one of these tables has row level security enabled with a single
     SELECT-only policy on active rows and no insert/update/delete policy at
     all, so this key cannot write anything. The service-role key is never
     used here and must never appear in this repository.

     If Supabase is unreachable — offline, project paused, network blocked —
     each call falls back to the arrays above, which are the same verified
     data. The map keeps working either way.

     No visitor coordinates are ever passed into these functions, so the
     backend never receives a user position. Distance and "near me" maths
     stay in map.js on the device.
  --------------------------------------------------------------------- */
  const SUPABASE = {
    url: "https://zsdjlvhidarnszsmrule.supabase.co",
    key: "sb_publishable_R7WMf55kS7_C_BhZJK-Nhg_vcNRi7Sd",
    timeoutMs: 6000
  };

  let usedFallback = false;

  async function restSelect(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUPABASE.timeoutMs);
    try {
      const res = await fetch(SUPABASE.url + "/rest/v1/" + path, {
        headers: {
          apikey: SUPABASE.key,
          Authorization: "Bearer " + SUPABASE.key,
          Accept: "application/json"
        },
        signal: controller.signal
      });
      if (!res.ok) throw new Error("supabase " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Map a places row onto the shape map.js expects. */
  function rowToPlace(r) {
    return {
      id: r.slug,
      name: r.name,
      name_ar: r.name_ar || undefined,
      name_full: r.name_full || undefined,
      category: r.category,
      latitude: r.latitude,
      longitude: r.longitude,
      google_maps_url: r.google_maps_url,
      description: r.description,
      hours: r.opening_hours || null,
      availability: r.availability === "unverified" ? undefined : r.availability,
      phase: r.phase,
      source: r.coord_source,
      note: r.note || undefined,
      image_url: r.image_url || null,
      scene: null,
      is_active: r.is_active,
      display_order: r.display_order
    };
  }

  function rowToRoute(r) {
    return {
      id: r.slug,
      name: r.name,
      category: r.category,
      description: r.description,
      waypoints: r.waypoint_slugs || [],
      distance_meters: r.distance_meters,
      estimated_minutes: r.estimated_minutes,
      geojson: r.geojson,
      is_active: r.is_active,
      available: r.is_available,
      unavailable_reason: r.unavailable_reason || undefined
    };
  }

  let cachedPlaces = null;

  const ParkData = {
    /** True once any call has had to use the bundled fallback data. */
    isUsingFallback() {
      return usedFallback;
    },

    async getBoundary() {
      try {
        const rows = await restSelect("park_areas?select=slug,name,phase,osm_ref,geojson&is_active=eq.true");
        if (!rows.length) throw new Error("no park areas");
        return {
          type: "FeatureCollection",
          features: rows.map(r => ({
            type: "Feature",
            properties: { name: r.name, phase: r.phase, osm: r.osm_ref },
            geometry: r.geojson
          }))
        };
      } catch (e) {
        usedFallback = true;
        console.warn("park boundary: using bundled data (" + e.message + ")");
        return PARK_BOUNDARY;
      }
    },

    async getPlaces() {
      try {
        const rows = await restSelect("places?select=*&is_active=eq.true&order=display_order.asc");
        if (!rows.length) throw new Error("no places");
        cachedPlaces = rows.map(rowToPlace);
        return cachedPlaces;
      } catch (e) {
        usedFallback = true;
        console.warn("places: using bundled data (" + e.message + ")");
        cachedPlaces = PLACES.filter(p => p.is_active)
                             .sort((a, b) => a.display_order - b.display_order);
        return cachedPlaces;
      }
    },

    async getRoutes() {
      try {
        const rows = await restSelect("routes?select=*&is_active=eq.true&order=display_order.asc");
        if (!rows.length) throw new Error("no routes");
        return rows.map(rowToRoute);
      } catch (e) {
        usedFallback = true;
        console.warn("routes: using bundled data (" + e.message + ")");
        return ROUTES.filter(r => r.is_active);
      }
    },

    getCategories() {
      return CATEGORIES;
    },

    getPlace(id) {
      const list = cachedPlaces || PLACES;
      return list.find(p => p.id === id) || null;
    }
  };

  global.ParkData = ParkData;
})(window);
