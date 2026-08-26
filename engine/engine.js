/* Claude Power Show, canvas engine.
   Spec: ../../stages/04_engine-spec/output/engine-spec.md

   The engine is content-blind. It knows a canvas, a camera and six layouts.
   It knows nothing about contracts, CRM or Business Central. */

(() => {
  "use strict";

  const CFG = window.DECK_CONFIG;
  if (!CFG) { document.body.textContent = "No config. Run _system/build-config.py"; return; }

  const SECTION_PITCH = 2400;   // horizontal distance between adjacent Sections
  const SUBVIEW_PITCH = 1500;   // vertical distance between stacked Sub-views
  const TRACK_Y = 430;          // the spine, in canvas coordinates
  const DESIGN_W = 1920, DESIGN_H = 1080;
  const LOCK_TAIL = 60;         // ms of lock after the move, per motion-language.md

  const S = CFG.sections;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = {
    viewport: document.getElementById("viewport"),
    ground: document.getElementById("ground"),
    camera: document.getElementById("camera"),
    canvas: document.getElementById("canvas"),
    track: document.getElementById("track"),
    stage: document.getElementById("stage"),
    held: document.getElementById("held"),
    badge: document.getElementById("badge"),
    hint: document.getElementById("hint")
  };

  document.documentElement.style.setProperty("--easing", CFG.meta.easing);

  const x = i => i * SECTION_PITCH;
  const y = j => j * SUBVIEW_PITCH;

  // The journey starts at the first stop and ends at the last, so those two stations
  // sit off-centre: the first to the left with the line running away ahead of it, the
  // last to the right with the line arriving behind it. Every other station is centred.
  const STATION_OFFSET = 620;
  const stationX = i =>
    i === 0 ? x(i) - STATION_OFFSET :
    i === S.length - 1 ? x(i) + STATION_OFFSET : x(i);

  /* ---------- render ---------------------------------------------------- */

  const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // A clip is anything that plays: a video, or a .gif, which plays in an <img> and so
  // cannot be told to wait. Marked here, started on arrival by startMedia().
  const isClip = asset => asset.type === "video" || /\.gif$/i.test(asset.src || "");

  function frame(asset) {
    if (!asset) return "";
    const media = asset.type === "video"
      ? `<video class="clip" src="${esc(asset.src)}" muted playsinline${asset.autoplay ? " loop" : ""}></video>`
      : `<img class="${isClip(asset) ? "clip" : ""}" src="${esc(asset.src)}" alt="">`;
    return `<div class="frame">${media}</div>` +
           (asset.caption ? `<p class="caption">${esc(asset.caption)}</p>` : "");
  }

  /* Clips start at the stop, not at page load and not during the move.
     The src stays on the element from the start so the frame is the right size and the
     picture is already decoded when the camera lands.

     A video rewinds. A .gif has no currentTime, and the obvious tricks do not work:
     the browser keeps one animation clock per decoded image and shares it with every
     element showing that URL, so neither re-setting the same src nor replacing the
     element with a copy of itself rewinds one. A URL it has not seen before is a new
     decode and a new clock, which is what the counter on the query buys. Checked from a
     file URL as well as from a served one, because the deck is opened by double-clicking
     show.html and a query on a file URL is not obviously legal. */
  let clipTick = 0;

  function startMedia(sv) {
    const root = sv._inner;
    if (!root) return;
    root.querySelectorAll("video.clip").forEach(v => {
      v.currentTime = 0;
      const played = v.play();
      if (played) played.catch(() => {});
    });
    clipTick++;
    root.querySelectorAll("img.clip").forEach(img => {
      const base = img.dataset.clip || (img.getAttribute("src") || "").split("?")[0];
      img.dataset.clip = base;
      img.src = base + "?r=" + clipTick;
    });
  }

  function stopMedia() {
    document.querySelectorAll("video.clip").forEach(v => v.pause());
  }

  function head(sv) {
    return (sv.eyebrow ? `<p class="eyebrow">${esc(sv.eyebrow)}</p>` : "") +
           `<h2>${esc(sv.heading)}</h2>`;
  }

  /* ---------- animations ---------------------------------------------------
     Each entry is markup plus a timed script of class changes, driven the way the
     reference artifact drives its demo: setTimeout over CSS transitions. An
     animation shows a mechanism a still cannot show, and carries almost no text.
     The ids here must match the catalogue in _shared/layouts.md, which the
     generator parses, so neither can drift from the other. */
  const ANIMATIONS = {
    "sharepoint-drop": {
      html:
        '<div class="stage-a">' +
          '<div class="afile"><span class="aico">PDF</span>' +
            '<span class="aname">SwoDP-Export.pdf</span></div>' +
          '<div class="aripple"></div>' +
          '<div class="afolder">' +
            '<svg viewBox="0 0 48 38" fill="none" stroke="currentColor" stroke-width="1.6">' +
              '<path d="M1.5 7.5a4 4 0 0 1 4-4h11.2l4.4 5.6h21.4a4 4 0 0 1 4 4v19.4a4 4 0 0 1-4 4H5.5a4 4 0 0 1-4-4z"/>' +
              '<path d="M1.5 14.4h45" opacity="0.5"/>' +
            '</svg>' +
            '<span class="alabel">Input</span>' +
          '</div>' +
          '<div class="aspark">Run started</div>' +
        '</div>',
      loop: 7400,
      script: [
        [700,  r => r.querySelector(".afile").classList.add("drop")],
        [1500, r => { r.querySelector(".afolder").classList.add("hit");
                      r.querySelector(".aripple").classList.add("go"); }],
        [1750, r => r.querySelector(".afile").classList.add("gone")],
        [2400, r => r.querySelector(".aspark").classList.add("go")]
      ]
    },
    "crm-direct": {
      html:
        '<div class="stage-a">' +
          '<div class="arec">' +
            '<span class="alabel cased">CRM / SwoDP</span>' +
            '<i></i><i class="w2"></i><i class="w3"></i>' +
            '<span class="achip">Ready for contract</span>' +
          '</div>' +
          '<div class="aripple wide"></div>' +
          '<div class="aspark">Run started</div>' +
        '</div>',
      loop: 7400,
      script: [
        [900,  r => r.querySelector(".achip").classList.add("on")],
        [1400, r => r.querySelector(".aripple").classList.add("go")],
        [2400, r => r.querySelector(".aspark").classList.add("go")]
      ]
    },

    /* Eleven labelled values off one document, into twenty-two places in another.
       The count is the argument, so it is counted on screen rather than claimed.
       Fields and placeholders are built from one list, so an index cannot go out
       of step with the row it fills. */
    "extract-fill": (() => {
      // the same run Allan captured for Sub-view a: Nordic Fjord Solutions ApS,
      // reference CIS-2026-0149. A and B are one arrow apart, so they cannot
      // disagree about which contract is on screen.
      const F = [
        ["Company Name",      "Nordic Fjord Solutions ApS"],
        ["Address",           "Vesterbrogade 34, 2. sal, 1620 Kobenhavn V"],
        ["Country",           "Denmark"],
        ["Contact Person",    "Anna Kristensen"],
        ["Email",             "anna.kristensen@nordicfjord.dk"],
        ["Phone",             "+45 33 15 27 89"],
        ["Pricing",           "DKK 8,500 / month"],
        ["Payment Terms",     "Net 30"],
        ["Invoice Frequency", "Monthly"],
        ["Contract Length",   "12 months"],
        ["Total Value",       "DKK 102,000"]
      ];
      const row = (f, n) => '<div class="xrow" data-f="' + n + '">' +
        '<span>' + f[0] + '</span><b>' + f[1] + '</b></div>';
      const ph = n => '<span class="xph" data-p="' + n + '">' +
        '<i>[' + F[n][0] + ']</i><em>' + F[n][1] + '</em></span>';
      return {
        html:
          '<div class="stage-a xf">' +
            '<div class="xcard">' +
              '<span class="xcap">SwoDP Export</span>' +
              '<div class="xrow xref"><span>Reference</span><b>CIS-2026-0149</b></div>' +
              F.map(row).join("") +
            '</div>' +
            '<div class="xcard xdoc">' +
              '<span class="xcap">Final Customer Document</span>' +
              '<div class="xtext">' +
                '<p>Made between the supplier and ' + ph(0) + ' of ' + ph(1) +
                  ', ' + ph(2) + '.</p>' +
                '<p>Contact ' + ph(3) + ', at ' + ph(4) + ' or ' + ph(5) + '.</p>' +
                '<p>Priced ' + ph(6) + ', invoiced ' + ph(8) + ' on ' + ph(7) +
                  ' terms, for ' + ph(9) + ', totalling ' + ph(10) + '.</p>' +
              '</div>' +
              '<div class="xfoot">' +
                '<span class="xcount"><b>0</b> of 22 places filled</span>' +
                '<span class="xchip">PDF</span>' +
              '</div>' +
            '</div>' +
          '</div>',
        loop: 8800,
        reset: r => { r.querySelector(".xcount b").textContent = "0"; },
        script: [[500, r => r.querySelector(".xref").classList.add("lit")]].concat(
          F.map((f, n) => [900 + n * 300, r => {
            r.querySelector('[data-f="' + n + '"]').classList.add("lit");
            r.querySelector('[data-p="' + n + '"]').classList.add("fill");
            r.querySelector(".xcount b").textContent = String((n + 1) * 2);
          }]),
          [[4700, r => r.querySelector(".xchip").classList.add("in")]])
      };
    })(),

    /* They sign by hand. The stroke is the whole beat, so nothing else on the
       card moves while it is being drawn. */
    "sign-by-hand": {
      html:
        '<div class="stage-a sg">' +
          '<div class="scard">' +
            '<div class="schrome"><i></i><i></i><i></i>' +
              '<span class="surl">one-time signing link</span></div>' +
            '<div class="sbody">' +
              '<p class="sfield">Full name</p>' +
              '<div class="sname"><span class="sval"></span><span class="scaret"></span></div>' +
              '<p class="sfield">Signature</p>' +
              '<div class="spad"><div class="spadline"></div>' +
                '<svg viewBox="0 0 240 80" preserveAspectRatio="xMidYMid meet">' +
                  '<path class="sigpath" pathLength="1" d="M14 60 C 24 30, 34 18, 41 27 ' +
                    'C 48 36, 38 58, 31 55 C 24 52, 34 33, 52 34 C 70 35, 63 57, 74 54 ' +
                    'C 85 51, 88 34, 101 36 C 114 38, 106 58, 118 54 C 130 50, 131 33, 146 38 ' +
                    'C 158 42, 150 56, 163 50 C 176 44, 182 34, 196 40 C 206 44, 210 48, 226 42"/>' +
                '</svg>' +
              '</div>' +
              '<span class="sbtn">Sign the contract</span>' +
            '</div>' +
          '</div>' +
        '</div>',
      loop: 9400,
      reset: r => { r.querySelector(".sval").textContent = ""; },
      script: [
        [500, r => {
          r.querySelector(".sname").classList.add("active");
          r.querySelector(".scaret").classList.add("on");
          typeInto(r.querySelector(".sval"), "Anna Kristensen", 72);
        }],
        [2100, r => {
          r.querySelector(".scaret").classList.remove("on");
          r.querySelector(".sname").classList.remove("active");
          r.querySelector(".spad").classList.add("active");
          r.querySelector(".sigpath").classList.add("draw");
        }],
        [4800, r => r.querySelector(".sbtn").classList.add("armed")],
        [5400, r => r.querySelector(".sbtn").classList.add("press")]
      ]
    },

    /* The other way to sign: a photograph of ink on paper. Three moves, because
       the beat is three things: the photograph arrives, the paper is keyed off it,
       and what is left lands in a box that was already the right shape.
       The ink stays over a light surface at every step. Dark ink on a transparent
       background over a dark deck is invisible, which is the failure the brief
       calls dark-on-dark. */
    "signature-upload": {
      html:
        '<div class="stage-a up">' +
          '<div class="uphoto"><div class="uchecker"></div><div class="upaper"></div></div>' +
          '<span class="ucap">signature_photo.jpg</span>' +
          '<span class="uread">otsu 68</span>' +
          '<div class="udoc">' +
            '<i class="ul"></i><i class="ul w2"></i><i class="ul w3"></i>' +
            '<div class="ubox"><span class="uboxl">SIGNATURE_CUSTOMER</span></div>' +
            '<span class="udim">6.00 x 2.00 cm</span>' +
          '</div>' +
          '<div class="uink">' +
            '<svg viewBox="0 0 240 80" preserveAspectRatio="xMidYMid meet">' +
              '<path d="M14 60 C 24 30, 34 18, 41 27 C 48 36, 38 58, 31 55 ' +
                'C 24 52, 34 33, 52 34 C 70 35, 63 57, 74 54 C 85 51, 88 34, 101 36 ' +
                'C 114 38, 106 58, 118 54 C 130 50, 131 33, 146 38 C 158 42, 150 56, 163 50 ' +
                'C 176 44, 182 34, 196 40 C 206 44, 210 48, 226 42"/>' +
            '</svg>' +
          '</div>' +
        '</div>',
      loop: 8200,
      script: [
        [700,  r => { r.querySelector(".upaper").classList.add("gone");
                      r.querySelector(".uread").classList.add("go"); }],
        [2200, r => { r.querySelector(".uink").classList.add("land");
                      r.querySelector(".uphoto").classList.add("gone"); }],
        [3300, r => r.querySelector(".ubox").classList.add("in")]
      ]
    }
  };

  // Every layout renders legibly with no asset, so the deck is walkable before
  // any capture exists.
  const LAYOUT = {
    "title": sv => head(sv) + (sv.body ? `<p class="body">${esc(sv.body)}</p>` : ""),

    "text-only": sv => head(sv) + (sv.body ? `<p class="body">${esc(sv.body)}</p>` : ""),

    "single-asset": sv => `<div class="row">
        <div class="col">${head(sv)}${sv.body ? `<p class="body">${esc(sv.body)}</p>` : ""}</div>
        <div class="art">${frame(sv.asset)}</div>
      </div>`,

    // the same two-column rhythm as single-asset and animation: heading block on the
    // left, docked assets on the right. A pair that put its heading on top sat the
    // words in a different place from every deck around it, which reads as a stumble
    "asset-pair": sv => `<div class="row">
        <div class="col">${head(sv)}${sv.body ? `<p class="body">${esc(sv.body)}</p>` : ""}</div>
        <div class="art">
          <div class="pair">` + (sv.assets || [sv.asset]).map(a =>
            `<div>${frame(a)}</div>`).join("") + `</div>
        </div>
      </div>`,

    "split-lane": sv => head(sv) + `<div class="lanes">` + (sv.lanes || []).map(l =>
        `<div class="lane">
           <div class="lane-label">${esc(l.label)}</div>
           <p class="body">${esc(l.body)}</p>
           <div class="art">${frame(l.asset)}</div>
         </div>`).join("") + `</div>`,

    "agenda": sv => head(sv) + `<ol class="agenda-list">` +
      (sv.items || []).map(it => `<li>${esc(it)}</li>`).join("") + `</ol>`,

    // one dot per frame, this frame's lit. Each frame draws its own, so the stack
    // needs no shared state and no engine bookkeeping.
    "image-stack": sv => `<div class="row">
        <div class="col">${head(sv)}${sv.body ? `<p class="body">${esc(sv.body)}</p>` : ""}</div>
        <div class="art stack-art">
          <div class="dots">${Array.from({ length: sv.stackCount || 1 }, (_, k) =>
            `<i class="${k === sv.stackIndex ? "on" : ""}"></i>`).join("")}</div>
          <div>${frame(sv.asset)}</div>
        </div>
      </div>`,

    // same two-column rhythm as single-asset: the animation docks where a
    // screenshot would, so the deck does not change shape when one replaces the other
    "animation": sv => `<div class="row">
        <div class="col">${head(sv)}${sv.body ? `<p class="body">${esc(sv.body)}</p>` : ""}</div>
        <div class="art">
          <div class="anim">${(ANIMATIONS[sv.animation] || { html: "" }).html}</div>
        </div>
      </div>`,

    // a heading and a few short parallel statements. Not numbered: these are
    // alternatives, and a number would claim an order that is not there
    "points": sv => head(sv) + `<ul class="points-list">` +
      (sv.items || []).map(it => `<li>${esc(it)}</li>`).join("") + `</ul>`,

    "figure": sv => (sv.eyebrow ? `<p class="eyebrow">${esc(sv.eyebrow)}</p>` : "") +
      `<div class="figure">${esc(sv.heading)}</div>` +
      (sv.body ? `<div class="figure-label">${esc(sv.body)}</div>` : "")
  };

  S.forEach((section, i) => section.subviews.forEach((sv, j) => {
    const node = document.createElement("section");
    // A stack Section's Sub-views are frames, not stops: they share one canvas
    // position and cross-fade, so the camera has nowhere to travel to.
    node.className = section.stack ? "section stack-frame" : "section";
    node.style.left = (x(i) - DESIGN_W / 2) + "px";
    node.style.top = ((section.stack ? 0 : y(j)) - DESIGN_H / 2) + "px";

    const inner = document.createElement("div");
    // tall: this capture is a whole scrolling page, so the docked ceiling is raised
    // to the edge of the box. Still content-blind, the engine only knows "docked tall".
    inner.className = `inner l-${sv.layout}${sv.tall ? " tall" : ""}` +
                      (sv.tall === "full" ? " full" : "");
    inner.innerHTML = (LAYOUT[sv.layout] || LAYOUT["text-only"])(sv);
    // holdText: counter-scale by exactly the camera's pull-back, so the words stay
    // the same size on screen while the world shrinks away behind them.
    if (section.holdText) el.held.appendChild(inner);   // screen space, not canvas
    else node.appendChild(inner);
    sv._inner = inner;
    el.stage.appendChild(node);
    sv._node = node;
  }));

  /* ---------- the track -------------------------------------------------- */
  // A spine along y = 0 with a station tick per Section, a spur down every
  // Section that has Sub-views (so the track stays in frame during a descent),
  // and a real fork at the heightened Section.

  function drawTrack() {
    const NS = "http://www.w3.org/2000/svg";
    const x0 = stationX(0), x1 = stationX(S.length - 1);
    const deepest = Math.max(...S.map(s => s.subviews.length)) - 1;

    el.track.setAttribute("viewBox", `${x0} ${TRACK_Y - 300} ${x1 - x0} ${y(deepest) + 600}`);
    el.track.style.left = x0 + "px";
    el.track.style.top = (TRACK_Y - 300) + "px";
    el.track.style.width = (x1 - x0) + "px";
    el.track.style.height = (y(deepest) + 600) + "px";

    const add = (tag, attrs, cls) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      n.setAttribute("class", cls);
      return n;
    };

    // Two identical layers. The lit one is revealed through a mask whose edge follows
    // the current station, so the deck burns in behind you.
    //
    // This was a clip rect starting at x0, and that was wrong twice over. Its left edge
    // sat exactly on the first station, so half of the first ball fell outside the clip
    // and rendered dim: the ball was half gold. And its right edge was a hard cut, so the
    // dim line began abruptly against the ball at every stop and read as a separate
    // segment lying next to it rather than as one continuous track.
    //
    // A gradient mask fixes both: it starts far enough left that no ball can straddle it,
    // and it fades out over a fixed on-screen distance so the gold hands over to the dim
    // line instead of stopping dead against it.
    const PAD = 4000;                 // mask margin, well clear of the first station
    const FADE = 190;                 // on-screen px the handover takes
    const my = TRACK_Y - 400, mh = y(deepest) + 800;

    const defs = document.createElementNS(NS, "defs");
    const grad = document.createElementNS(NS, "linearGradient");
    grad.setAttribute("id", "travelled-fade");
    grad.setAttribute("gradientUnits", "userSpaceOnUse");
    for (const [offset, colour] of [["0", "#fff"], ["1", "#000"]]) {
      const stop = document.createElementNS(NS, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", colour);
      grad.appendChild(stop);
    }
    const mask = document.createElementNS(NS, "mask");
    mask.setAttribute("id", "travelled");
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    mask.setAttribute("x", x0 - PAD);
    mask.setAttribute("y", my);
    mask.setAttribute("width", (x1 - x0) + PAD * 2);
    mask.setAttribute("height", mh);
    mask.appendChild(add("rect", {
      x: x0 - PAD, y: my, width: (x1 - x0) + PAD * 2, height: mh,
      fill: "url(#travelled-fade)"
    }, ""));
    defs.appendChild(grad);
    defs.appendChild(mask);
    el.track.appendChild(defs);

    // The track forks where the content actually forks, which is a split-lane
    // Sub-view. It used to key off `heightened`, which was true only by coincidence
    // in the prototype: a heightened beat that does not split (a pull-back, say)
    // was drawing a fork under a single line of argument.
    const fork = S.findIndex(s => s.subviews.some(sv => sv.layout === "split-lane"));

    function geometry(g, cls) {
      // spine, broken around the fork
      if (fork >= 0) {
        const a = stationX(fork) - SECTION_PITCH * 0.42, b = stationX(fork) + SECTION_PITCH * 0.42;
        g.appendChild(add("path", { d: `M${x0} ${TRACK_Y} H${a}` }, cls));
        for (const dy of [-132, 132]) {
          g.appendChild(add("path", {
            d: `M${a} ${TRACK_Y} C${a + 130} ${TRACK_Y} ${a + 130} ${TRACK_Y + dy} ${a + 260} ${TRACK_Y + dy}` +
               ` H${b - 260}` +
               ` C${b - 130} ${TRACK_Y + dy} ${b - 130} ${TRACK_Y} ${b} ${TRACK_Y}`
          }, cls));
        }
        g.appendChild(add("path", { d: `M${b} ${TRACK_Y} H${x1}` }, cls));
      } else {
        g.appendChild(add("path", { d: `M${x0} ${TRACK_Y} H${x1}` }, cls));
      }

      S.forEach((s, i) => {
        const n = s.stack ? 1 : s.subviews.length;
        if (n > 1) {
          g.appendChild(add("path", { d: `M${stationX(i)} ${TRACK_Y} V${y(n - 1) + TRACK_Y}` }, cls));
          for (let j = 1; j < n; j++)
            g.appendChild(add("circle", { cx: stationX(i), cy: y(j) + TRACK_Y },
              (cls === "track-dim" ? "tick-dim" : "tick-lit") + " tick-sub"));
        }
        g.appendChild(add("circle", { cx: stationX(i), cy: TRACK_Y },
          (cls === "track-dim" ? "tick-dim" : "tick-lit") + (s.heightened ? " tick-big" : "")));
      });
    }

    const dim = document.createElementNS(NS, "g");
    geometry(dim, "track-dim");
    el.track.appendChild(dim);

    const lit = document.createElementNS(NS, "g");
    lit.setAttribute("mask", "url(#travelled)");
    geometry(lit, "track-lit");
    el.track.appendChild(lit);

    return { grad, FADE };
  }

  const travelled = drawTrack();

  /* ---------- camera ----------------------------------------------------- */

  let i = 0, j = 0, locked = false, lockTimer = 0, arriveTimer = 0;

  const fit = () => Math.min(innerWidth / DESIGN_W, innerHeight / DESIGN_H);

  function apply(ms) {
    const dur = reduced ? 0 : ms;
    document.documentElement.style.setProperty("--dur", dur + "ms");

    const scale = fit() * (S[i].scale || 1);
    const cx = x(i), cy = S[i].stack ? 0 : y(j);

    el.camera.style.transform = `scale(${scale})`;
    el.canvas.style.transform = `translate(${-cx}px, ${-cy}px)`;
    // background-position, not transform: a 40,000px pan would slide a
    // transformed element clean off the viewport. A tiled background cannot.
    const gx = -cx * 0.35 * scale, gy = -cy * 0.35 * scale;
    el.ground.style.backgroundPosition = `${gx}px ${gy}px, ${gx}px ${gy}px, ${gx}px ${gy}px`;

    // Follows the station rather than the camera: at the last stop the station is
    // right of the camera, and it still has to be lit.
    // The handover starts just past the current ball and fades over a fixed on-screen
    // distance, so it looks the same at every zoom.
    const edge = stationX(i) + 16 / scale;
    travelled.grad.setAttribute("x1", String(edge));
    travelled.grad.setAttribute("x2", String(edge + travelled.FADE / scale));

    // the track keeps a constant apparent weight at every zoom
    el.track.style.setProperty("--inv", String(1 / scale));
    el.held.style.setProperty("--fit", String(fit()));

    document.querySelectorAll(".here").forEach(n => n.classList.remove("here"));
    const sv = S[i].subviews[j];
    sv._node.classList.add("here");
    sv._inner.classList.add("here");

    resetAnims();
    // resetAnims puts the classes back; the text an animation writes is its own to put
    // back, and it has to happen now rather than at arrival, or the stop shows the end
    // of the last run for the length of the move.
    if (sv.layout === "animation") {
      const spec = ANIMATIONS[sv.animation];
      if (spec && spec.reset) spec.reset(sv._inner.querySelector(".anim"));
    }
    stopMedia();
    // Nothing plays while the camera is moving. An animation that runs through the
    // travel is half over by the time anyone can read it, and a clip that starts
    // early is a clip the audience joins in the middle.
    clearTimeout(arriveTimer);
    const arrive = () => {
      if (sv.layout === "animation") playAnim(sv._inner.querySelector(".anim"), sv.animation);
      startMedia(sv);
    };
    if (dur) arriveTimer = setTimeout(arrive, dur); else arrive();
    markPlaceholder(sv);
  }

  /* A badge that says "placeholder" over a real screenshot is a lie in the other
     direction. With data-when="dummy" it shows only on the stops that are still
     standing in for a capture, which is exactly when it is true. */
  function markPlaceholder(sv) {
    if (!el.badge || el.badge.dataset.when !== "dummy") return;
    const srcs = (sv.assets || [sv.asset]).filter(Boolean).map(a => a.src);
    el.badge.classList.toggle("gone", !srcs.some(s => s.includes("dummy")));
  }

  /* Only the current Sub-view animates. Nothing runs off-screen. */
  let animTimers = [];

  function resetAnims() {
    animTimers.forEach(clearTimeout);
    animTimers = [];
    document.querySelectorAll(".anim").forEach(root => {
      root.querySelectorAll("*").forEach(n => n.classList.remove(
        "drop", "gone", "hit", "go", "on", "lit", "fill", "in", "active",
        "draw", "armed", "press", "land"));
    });
  }

  /* The name is typed rather than appearing, because typing your own name is the
     act. Its timers go on the same list as the script, so leaving the stop stops
     them mid-word like everything else. */
  function typeInto(node, text, step) {
    if (reduced) { node.textContent = text; return; }
    node.textContent = "";
    for (let k = 1; k <= text.length; k++) {
      animTimers.push(setTimeout(() => { node.textContent = text.slice(0, k); }, k * step));
    }
  }

  function playAnim(root, id) {
    const a = ANIMATIONS[id];
    if (!a || !root) return;
    const run = () => {
      resetAnims();
      // classes are a shared vocabulary; text content is not, so an animation that
      // writes text says here how to put it back
      if (a.reset) a.reset(root);
      // reduced motion gets the resting state, which is the end of the script
      if (reduced) { a.script.forEach(step => step[1](root)); return; }
      a.script.forEach(step => animTimers.push(setTimeout(() => step[1](root), step[0])));
      animTimers.push(setTimeout(run, a.loop));
    };
    run();
  }

  function duration(from, to) {
    // Vertical first. The heightened rule is about arriving at the beat, so it must
    // not slow the Sub-views inside it: four 900ms descents in a row reads as lag.
    if (from.i === to.i) return CFG.meta.subviewMs;
    if (S[from.i].heightened || S[to.i].heightened) return CFG.meta.heightenedMs;
    return CFG.meta.transitionMs;
  }

  function go(ni, nj) {
    if (locked) return;
    if (ni === i && nj === j) return;              // no move, no lock
    const ms = duration({ i, j }, { i: ni, j: nj });
    i = ni; j = nj;
    apply(ms);
    // Never gate on transitionend: it does not fire on an interrupted or
    // no-op transform, which would strand the presenter mid-deck.
    locked = true;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => { locked = false; }, (reduced ? 0 : ms) + LOCK_TAIL);
  }

  // Right and Left always reset j to 0, and the move is direct: from (5,2) Right
  // animates straight to (6,0) as one diagonal move, never up then across.
  const next = () => go(Math.min(i + 1, S.length - 1), i + 1 <= S.length - 1 ? 0 : j);
  const prev = () => go(Math.max(i - 1, 0), i - 1 >= 0 ? 0 : j);
  const down = () => go(i, Math.min(j + 1, S[i].subviews.length - 1));
  const up = () => go(i, Math.max(j - 1, 0));

  addEventListener("keydown", e => {
    const k = e.key;
    if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "PageDown", "PageUp", " "].includes(k))
      e.preventDefault();
    if (k === "ArrowRight" || k === "PageDown" || k === " ") next();
    else if (k === "ArrowLeft" || k === "PageUp") prev();
    else if (k === "ArrowDown") down();
    else if (k === "ArrowUp") up();
    else if (k === "f" || k === "F") {
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    } else return;
    el.hint.classList.add("gone");
  });

  // scroll mirrors the arrows, subject to the same lock. Never required.
  let wheelIdle = true;
  addEventListener("wheel", e => {
    if (!wheelIdle) return;
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (horizontal) (e.deltaX > 0 ? next : prev)();
    else (e.deltaY > 0 ? next : prev)();
    wheelIdle = false;
    setTimeout(() => { wheelIdle = true; }, 220);
    el.hint.classList.add("gone");
  }, { passive: true });

  addEventListener("resize", () => apply(0));

  apply(0);
})();
