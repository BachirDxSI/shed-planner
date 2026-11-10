// 3D viewer: builds framing, sheathing, siding, trim and roofing from the same engine as the plans.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MAT = {};
function mats() {
  if (MAT.frame) return MAT;
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide, ...o });
  Object.assign(MAT, {
    frame: std('#dcb984'),
    king: std('#cfa56a'),
    header: std('#c39457'),
    pt: std('#9fbb8e'),
    deck: std('#c9b48e'),
    osb: std('#d2b47c'),
    siding: std('#f3f2ec'),
    trim: std('#ffffff', { roughness: 0.6 }),
    door: std('#2b2f33', { roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: '#8fb3c9', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    roof: std('#3d4146', { map: shingleTexture() }),
    vent: std('#e8e8e8'),
    gravel: std('#b9b4aa', { roughness: 1 }),
    edge: new THREE.LineBasicMaterial({ color: '#6b5636', transparent: true, opacity: 0.45 }),
  });
  return MAT;
}

function shingleTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#4a4e54';
  g.fillRect(0, 0, 256, 128);
  for (let row = 0; row < 4; row++) {
    const y = row * 32;
    const off = row % 2 ? 32 : 0;
    for (let x = -64 + off; x < 256; x += 64) {
      const v = 60 + Math.floor(Math.random() * 30);
      g.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
      g.fillRect(x + 1, y + 1, 62, 30);
    }
    g.fillStyle = '#25272a';
    g.fillRect(0, y + 30, 256, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function basis(pl) {
  const m = new THREE.Matrix4();
  m.makeBasis(new THREE.Vector3(...pl.ex), new THREE.Vector3(...pl.ey), new THREE.Vector3(...pl.ez));
  m.setPosition(...pl.o);
  return m;
}

function extrude(poly, depth, d0, pl, holes = []) {
  const sh = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  holes.forEach((h) => sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  geo.translate(0, 0, d0);
  geo.applyMatrix4(basis(pl));
  return geo;
}

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export class ShedViewer {
  constructor(el) {
    this.el = el;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(2, window.devicePixelRatio));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(r.domElement);
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color('#dfe8ee');
    s.fog = new THREE.Fog('#dfe8ee', 60, 140);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    s.add(new THREE.HemisphereLight('#ffffff', '#8d8a7d', 1.4));
    const sun = (this.sun = new THREE.DirectionalLight('#fff6e6', 2.2));
    sun.position.set(-25, 40, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 120 });
    sun.shadow.bias = -0.0005;
    s.add(sun);
    s.add(sun.target);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshStandardMaterial({ color: '#8fae6f', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.36;
    ground.receiveShadow = true;
    s.add(ground);
    this.root = new THREE.Group();
    this.root.scale.setScalar(1 / 12); // inches -> feet
    s.add(this.root);
    this.layers = {};
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => {
      this.controls.update();
      r.render(s, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  resize() {
    const w = this.el.clientWidth || 800;
    const h = this.el.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  layer(name) {
    if (!this.layers[name]) {
      this.layers[name] = new THREE.Group();
      this.layers[name].name = name;
      this.root.add(this.layers[name]);
    }
    return this.layers[name];
  }

  mesh(layer, geo, mat, edges = false) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    this.layer(layer).add(m);
    if (edges) this.layer(layer).add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), MAT.edge));
    return m;
  }

  build(g, { keepCamera = false } = {}) {
    mats();
    const vis = Object.fromEntries(Object.entries(this.layers).map(([k, v]) => [k, v.visible]));
    Object.values(this.layers).forEach((grp) => {
      grp.traverse((o) => o.geometry && o.geometry.dispose());
      this.root.remove(grp);
    });
    this.layers = {};
    const { W, L, H, floorTop, planes } = g;

    // gravel pad
    const pad = new THREE.Mesh(new THREE.BoxGeometry(L + 24, 4, W + 24), MAT.gravel);
    pad.position.set(L / 2, -2, W / 2);
    pad.receiveShadow = true;
    this.layer('site').add(pad);

    // framing members
    g.members.forEach((m) => {
      if (m.box) {
        const [x0, y0, z0, x1, y1, z1] = m.box;
        const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
        geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        this.mesh('floor', geo, MAT.pt, true);
        return;
      }
      const layer = m.group === 'roof' ? (m.kind === 'Gusset' ? 'roofFraming' : 'roofFraming') : 'walls';
      const mat = m.kind === 'Gusset' ? MAT.osb : m.kind === 'Header' || m.kind === 'Rough sill' ? MAT.header : m.kind.startsWith('King') || m.kind.startsWith('Jack') ? MAT.king : MAT.frame;
      this.mesh(layer, extrude(m.poly, m.depth, m.d0, m.plane), mat, true);
    });

    // subfloor
    const deck = new THREE.BoxGeometry(L, g.deckT, W);
    deck.translate(L / 2, floorTop - g.deckT / 2, W / 2);
    this.mesh('deck', deck, MAT.deck, true);

    // siding
    const sT = 0.6;
    const sb = g.sidingBottom;
    const holes = (face) => g.openings[face].map((o) => rect(o.xL, o.bottom === 0 ? 0 : o.bottom, o.xL + o.w, o.top));
    ['front', 'back'].forEach((f) => this.mesh('siding', extrude(rect(-sT, sb, L + sT, H), sT, -sT, planes[f], holes(f)), MAT.siding));
    const gablePoly = [[0, sb], [W, sb], [W, g.yt(W)], [g.run, g.peakTop], [0, g.yt(0)]];
    ['left', 'right'].forEach((f) => this.mesh('siding', extrude(gablePoly, sT, -sT, planes[f], holes(f)), MAT.siding));

    // trim on faces
    const tD = 0.75;
    g.trim.forEach((tr) => {
      if (tr.face && tr.x0 !== undefined) {
        const pl = planes[tr.face];
        if (tr.door) {
          let poly;
          if (tr.diag) {
            const ang = Math.atan2(tr.y1 - tr.y0, tr.x1 - tr.x0);
            const nx = -Math.sin(ang) * 1.75;
            const ny = Math.cos(ang) * 1.75;
            poly = [[tr.x0 - nx, tr.y0 - ny], [tr.x1 - nx, tr.y1 - ny], [tr.x1 + nx, tr.y1 + ny], [tr.x0 + nx, tr.y0 + ny]];
          } else poly = rect(tr.x0, tr.y0, tr.x1, tr.y1);
          this.mesh('openings', extrude(poly, tD, -sT - tD, pl), MAT.door);
        } else {
          this.mesh('trim', extrude(rect(tr.x0, tr.y0, tr.x1, tr.y1), tD, -sT - tD, pl), MAT.trim);
        }
      }
    });
    // corner boards
    [['front', [-sT - 0.75, 2.75]], ['front', [L - 2.75, L + sT + 0.75]], ['back', [-sT - 0.75, 2.75]], ['back', [L - 2.75, L + sT + 0.75]]].forEach(([f, [a, b]]) =>
      this.mesh('trim', extrude(rect(a, sb, b, H), tD, -sT - tD, planes[f]), MAT.trim)
    );
    ['left', 'right'].forEach((f) => {
      this.mesh('trim', extrude(rect(-sT - tD, sb, 3.5 - sT - tD, H), tD, -sT - tD, planes[f]), MAT.trim);
      this.mesh('trim', extrude(rect(W - 3.5 + sT + tD, sb, W + sT + tD, H), tD, -sT - tD, planes[f]), MAT.trim);
    });

    // doors & windows
    Object.entries(g.openings).forEach(([face, ops]) => {
      const pl = planes[face];
      ops.forEach((o) => {
        if (o.type === 'door') {
          const lw = (o.w - 0.5) / o.leaves;
          for (let k = 0; k < o.leaves; k++) {
            const lx = o.xL + 0.25 + k * lw;
            this.mesh('openings', extrude(rect(lx + 0.1, 0.5, lx + lw - 0.1, o.top - 0.5), 1.4, -sT, pl), MAT.door);
            if (o.build === 'prehung') {
              const gy0 = o.top * 0.58;
              this.mesh('openings', extrude(rect(lx + 4, gy0, lx + lw - 4, o.top - 5), 0.3, -sT - 0.2, pl), MAT.glass);
              const mx = lx + lw / 2;
              this.mesh('openings', extrude(rect(mx - 0.5, gy0, mx + 0.5, o.top - 5), 0.6, -sT - 0.4, pl), MAT.door);
              const my = (gy0 + o.top - 5) / 2;
              this.mesh('openings', extrude(rect(lx + 4, my - 0.5, lx + lw - 4, my + 0.5), 0.6, -sT - 0.4, pl), MAT.door);
            }
          }
        } else {
          this.mesh('openings', extrude(rect(o.xL, o.bottom, o.xL + o.w, o.top), 1.5, 0.5, pl, [rect(o.xL + 1.5, o.bottom + 1.5, o.xL + o.w - 1.5, o.top - 1.5)]), MAT.door);
          this.mesh('openings', extrude(rect(o.xL + 1.5, o.bottom + 1.5, o.xL + o.w - 1.5, o.top - 1.5), 0.25, 1, pl), MAT.glass);
          const mx = o.xL + o.w / 2;
          this.mesh('openings', extrude(rect(mx - 0.4, o.bottom + 1.5, mx + 0.4, o.top - 1.5), 0.6, 0.8, pl), MAT.door);
          [1, 2].forEach((k) => {
            const y = o.bottom + 1.5 + (k * (o.top - o.bottom - 3)) / 3;
            this.mesh('openings', extrude(rect(o.xL + 1.5, y - 0.4, o.xL + o.w - 1.5, y + 0.4), 0.6, 0.8, pl), MAT.door);
          });
        }
      });
    });
    if (g.p.gableVents) {
      const vy = g.yb(g.run) - 20;
      ['left', 'right'].forEach((f) => {
        this.mesh('openings', extrude(rect(g.run - 7, vy - 7, g.run + 7, vy + 7), 0.8, -sT - 0.8, planes[f]), MAT.trim);
        for (let k = -4.5; k <= 4.5; k += 1.8) this.mesh('openings', extrude(rect(g.run - 5.5, vy + k - 0.35, g.run + 5.5, vy + k + 0.35), 0.4, -sT - 1.2, planes[f]), MAT.door);
      });
    }

    // roof slabs (sheathing + shingles) and fascia
    const { O, R, t, D, c, s } = g;
    const thk = g.roofT;
    const tailTop = g.yt(-O);
    const S = g.slopeLen + 0.75 / c;
    const len = L + 2 * R + 1.5;
    [1, -1].forEach((side) => {
      const geo = new THREE.BoxGeometry(len, thk, S);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 36, (uv.getY(i) * S) / 10);
      const m = this.mesh('roof', geo, MAT.roof);
      const zA = -O - 0.75;
      const yA = tailTop - 0.75 * t;
      const zB = g.run;
      const yB = g.peakTop;
      const cz = (zA + zB) / 2 - s * (thk / 2);
      const cy = (yA + yB) / 2 + c * (thk / 2);
      m.position.set(L / 2, floorTop + cy, side === 1 ? cz : W - cz);
      m.rotation.x = side === 1 ? -g.theta : g.theta;
    });
    const fasc = (mirror) => {
      const top = tailTop - 1.5 * t + g.sheathT;
      let poly = rect(-O - 2.25, top - 5.5, -O - 1.5, top);
      if (mirror) poly = poly.map(([x, y]) => [W - x, y]).reverse();
      return poly;
    };
    [false, true].forEach((mir) => {
      const pl = { o: [-R - 0.75, floorTop, 0], ex: [0, 0, 1], ey: [0, 1, 0], ez: [1, 0, 0] };
      this.mesh('trim', extrude(fasc(mir), L + 2 * R + 1.5, 0, pl), MAT.trim);
    });
    const rakeBand = [];
    const rb = 5.5 / c;
    [[-O - 2.25, tailTop - (2.25) * t + g.sheathT], [g.run, g.peakTop + g.sheathT], [W + O + 2.25, tailTop - 2.25 * t + g.sheathT]].forEach((q) => rakeBand.push(q));
    const rakePoly = [...rakeBand, ...rakeBand.slice().reverse().map(([x, y]) => [x, y - rb])];
    [-R - 0.75, L + R].forEach((X) => {
      const pl = { o: [X, floorTop, 0], ex: [0, 0, 1], ey: [0, 1, 0], ez: [1, 0, 0] };
      this.mesh('trim', extrude(rakePoly, 0.75, 0, pl), MAT.trim);
    });

    Object.entries(vis).forEach(([k, v]) => this.layers[k] && (this.layers[k].visible = v));
    if (!keepCamera) this.frame(g);
    this.g = g;
  }

  frame(g) {
    const cx = g.L / 24;
    const cz = g.W / 24;
    const size = Math.max(g.L, g.W) / 12;
    this.controls.target.set(cx, g.heights.peak / 24, cz);
    this.camera.position.set(cx - size * 1.1, size * 0.85, cz - size * 1.8);
    this.controls.update();
  }

  view(name) {
    const g = this.g;
    if (!g) return;
    const cx = g.L / 24;
    const cz = g.W / 24;
    const size = Math.max(g.L, g.W) / 12;
    const ty = g.heights.peak / 24;
    const pos = {
      front: [cx, ty, cz - size * 2.1],
      back: [cx, ty, cz + size * 2.1],
      left: [cx - size * 2.1, ty, cz],
      right: [cx + size * 2.1, ty, cz],
      top: [cx, size * 2.6, cz + 0.01],
      iso: [cx - size * 1.1, size * 0.85, cz - size * 1.8],
    }[name];
    this.controls.target.set(cx, ty, cz);
    this.camera.position.set(...pos);
  }

  setVisible(map) {
    Object.entries(map).forEach(([k, v]) => this.layers[k] && (this.layers[k].visible = v));
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
