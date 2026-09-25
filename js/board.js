// The surfboards, built from an outline: shortboard 6'2", fish 5'8", longboard 9'2" and a 9'6" gun (see SHAPES), with rocker, domed deck, rounded rails and fins.
import * as THREE from 'three';

// The four boards' shapes: length, width, thickness, outline (share of the widest point along the board, tail 0 -> nose 1),
// nose lift, fins, and their colours
const SHAPES = {
  short: { L: 1.88, W: 0.49, T: 0.062, nose: 0.085, fins: 'thruster', deck: [0.95, 0.94, 0.91], stripe: [0.9, 0.35, 0.18], pad: true,
    OUT: [[-.05, .6], [0, .66], [.08, .78], [.25, .93], [.45, 1], [.62, .96], [.78, .82], [.88, .64], [.94, .48], [.975, .31], [.992, .15], [1, .0], [1.01, -.1]] },
  fish: { L: 1.73, W: 0.54, T: 0.066, nose: 0.07, fins: 'twin', deck: [0.96, 0.9, 0.7], stripe: [0.1, 0.55, 0.55], pad: true,
    OUT: [[-.05, .74], [0, .8], [.08, .89], [.25, .97], [.45, 1], [.62, .97], [.78, .87], [.88, .72], [.94, .55], [.975, .37], [.992, .19], [1, .0], [1.01, -.1]] },
  long: { L: 2.8, W: 0.57, T: 0.075, nose: 0.11, fins: 'single', deck: [0.93, 0.9, 0.82], stripe: [0.16, 0.36, 0.62], pad: false,
    OUT: [[-.05, .62], [0, .7], [.08, .82], [.25, .95], [.45, 1], [.62, .99], [.78, .95], [.88, .87], [.94, .75], [.975, .57], [.992, .33], [1, .0], [1.01, -.1]] },
  gun: { L: 2.9, W: 0.5, T: 0.075, nose: 0.14, fins: 'thruster', deck: [0.96, 0.96, 0.95], stripe: [0.75, 0.12, 0.1], pad: true,
    OUT: [[-.05, .16], [0, .26], [.08, .45], [.25, .78], [.45, .97], [.55, 1], [.7, .92], [.82, .75], [.9, .55], [.95, .35], [.985, .14], [1, .0], [1.01, -.1]] },
};
// each board's paint job, by where you are on it: u along (tail 0 -> nose 1), v across (-1 rail .. 0 stringer .. 1 rail),
// deck or bottom. Four completely different looks, so you know your board at a glance
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const PAINT = {
  // performance shortboard: bright white deck, coral-red resin rails that fade in from the edges, coral bottom, black pad
  short: (u, v, deck) => { const WHITE = [0.95, 0.95, 0.93], CORAL = [0.93, 0.33, 0.24];
    if (!deck) return mix(CORAL, [0.98, 0.55, 0.42], sm(0.2, 0.9, u) * 0.4);
    if (Math.abs(v) < 0.02) return [0.55, 0.42, 0.28];
    const logo = Math.hypot((u - 0.62) * 9, v * 1.4) < 0.5 ? 1 : 0;
    return logo ? [0.12, 0.12, 0.14] : mix(WHITE, CORAL, sm(0.72, 0.95, Math.abs(v))); },
  // retro fish: mustard-yellow deck with a wide teal racing stripe, teal bottom
  fish: (u, v, deck) => { const MUSTARD = [0.95, 0.72, 0.22], TEAL = [0.08, 0.5, 0.5];
    if (!deck) return TEAL;
    if (Math.abs(v) < 0.22 && u > 0.3) return mix(TEAL, [0.1, 0.6, 0.58], sm(0.3, 1, u));
    if (Math.abs(Math.abs(v) - 0.27) < 0.035 && u > 0.3) return [0.97, 0.94, 0.86];   // pinlines either side of the stripe
    return MUSTARD; },
  // classic longboard: cream deck with a wide three-strip wooden stringer, pastel-blue resin rails and bottom, nose pinline
  long: (u, v, deck) => { const CREAM = [0.95, 0.91, 0.82], BLUE = [0.55, 0.74, 0.86];
    if (!deck) return BLUE;
    if (Math.abs(v) < 0.05) return Math.abs(v) < 0.015 ? [0.7, 0.55, 0.36] : [0.45, 0.3, 0.18];
    if (Math.abs(v) > 0.62) return BLUE;
    if (u > 0.9 && Math.abs(v) < 0.6 && Math.abs(v) > 0.52) return [0.2, 0.3, 0.45];
    return CREAM; },
  // big-wave gun: deep red all over (easy to spot in the whitewater), a white centre stripe, a yellow nose tip
  gun: (u, v, deck) => { const RED = [0.72, 0.1, 0.09];
    if (u > 0.94) return [0.98, 0.8, 0.12];
    if (!deck) return mix(RED, [0.5, 0.06, 0.06], sm(0.9, 1, Math.abs(v)));
    if (Math.abs(v) < 0.1 && u > 0.12) return [0.96, 0.95, 0.92];
    return RED; },
};
export const BOARD_LENGTH = (type) => (SHAPES[type] || SHAPES.short).L;
export const BOARD_WIDTH = (type) => (SHAPES[type] || SHAPES.short).W;

export function makeBoard(type = 'short') {
  const S = SHAPES[type] || SHAPES.short;
  const L = S.L, W = S.W, T = S.T, NL = 90, NW = 24;
  // outline from real shortboard proportions (share of max half-width along the board, tail 0 -> nose 1):
  // squash tail ~14" wide, widest just behind the middle, ~12" a foot from the nose, then a small rounded tip.
  // Joined with one smooth (Catmull-Rom) curve so the rail line has no bumps.
  const OUT = S.OUT;
  const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const halfWidth = (u) => {
    let i = 2; while (i < OUT.length - 2 && OUT[i][0] < u) i++;
    const a = OUT[i - 2], b = OUT[i - 1], c = OUT[i], d = OUT[i + 1], t = (u - b[0]) / (c[0] - b[0]);
    return W / 2 * Math.max(0, cr(a[1], b[1], c[1], d[1], Math.min(1, Math.max(0, t))));
  };
  // thickest just behind the middle, thinning toward the nose and tail
  const thick = (u) => T * (0.32 + 0.68 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.96 + 0.02))), 0.6));
  const rocker = (u) => S.nose * Math.pow(Math.max(0, u - 0.6) / 0.4, 2.2) + 0.03 * Math.pow(Math.max(0, 0.18 - u) / 0.18, 2);
  // lengthwise stations bunched toward the nose (so its round tip stays smooth); across, bunched toward the rails
  const station = (i) => { const x = i / NL; return 1 - Math.pow(1 - x, 1.7) * 0.999; };
  const across = (j) => Math.sin((j / NW * 2 - 1) * Math.PI / 2);
  const pos = [], col = [], idx = [];
  // deck (domed) and bottom (flatter), meeting in a rounded rail
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NL; i++) {
      const u = station(i), hw = Math.max(0.0015, halfWidth(u)), z = (u - 0.5) * L, r = rocker(u), th = thick(u);
      for (let j = 0; j <= NW; j++) {
        const v = across(j), x = v * hw, e = Math.max(0, 1 - v * v);
        const notch = type === 'fish' && u < 0.09 ? 0.13 * Math.max(0, 1 - Math.abs(v) / 0.55) * (1 - u / 0.09) : 0;   // the fish's swallow tail
        const y = r + (side > 0 ? th * 0.62 * Math.pow(e, 0.55) : -th * 0.38 * Math.pow(e, 0.3));
        pos.push(x, y, z + notch);
        // tail pad: a dark grooved traction pad on the deck over the fins, with a raised kick at the very back
        const pad = S.pad && side > 0 && u > 0.05 && u < 0.3 && Math.abs(v) < 0.86, groove = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(u * 110));   // (soft grooves: finer than the mesh can show turned to blotches)
        const wax = 0.965 + 0.035 * Math.sin(x * 97 + z * 131) * Math.sin(x * 53 - z * 71);   // waxed deck: faintly mottled
        const pc = PAINT[type in PAINT ? type : 'short'](u, v, side > 0);
        col.push(...(pad ? [0.12 * groove, 0.12 * groove, 0.13 * groove] : [pc[0] * wax, pc[1] * wax, pc[2] * wax]));
      }
    }
    for (let i = 0; i < NL; i++) for (let j = 0; j < NW; j++) {
      const a = base + i * (NW + 1) + j, b = a + 1, c = a + NW + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const board = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide }));
  // three fins under the tail
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.quadraticCurveTo(0.02, -0.1, 0.07, -0.11); fin.lineTo(0.09, 0); fin.lineTo(0, 0);
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.006, bevelEnabled: false });
  const fm = new THREE.MeshStandardMaterial({ color: { long: 0x8a5a32, fish: 0x7a4a2a }[type] || 0x1c1c1e, roughness: 0.4 });   // (wooden keels and single fin on the retro boards)
  const FINS = { thruster: [[0, -L / 2 + 0.1, 0, 1], [-0.13, -L / 2 + 0.24, 0.06, 1], [0.13, -L / 2 + 0.24, -0.06, 1]],
    twin: [[-0.15, -L / 2 + 0.16, 0.05, 1.35], [0.15, -L / 2 + 0.16, -0.05, 1.35]],   // two big keel fins
    single: [[0, -L / 2 + 0.22, 0, 1.9]] };                                            // one tall fin
  for (const [x, z, rot, sc] of FINS[S.fins]) {
    const f = new THREE.Mesh(fg, fm); f.rotation.y = Math.PI / 2 + rot; f.position.set(x, 0, z); f.scale.setScalar(sc); board.add(f);
  }
  board.userData.length = L;
  return board;
}
