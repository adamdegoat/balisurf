// A shortboard, built from an outline: 6'2" (1.88m), a rounded-off point nose, squash tail, a little rocker, rounded rails.
import * as THREE from 'three';

export function makeBoard() {
  const L = 1.88, W = 0.49, T = 0.06, NL = 60, NW = 10;
  // outline from real shortboard proportions (share of max half-width along the board, tail 0 -> nose 1):
  // squash tail ~14" wide, widest just behind the middle, ~12" wide a foot from the nose, then a small rounded tip
  const OUT = [[0, .66], [.08, .78], [.25, .93], [.45, 1], [.62, .96], [.78, .82], [.88, .64], [.94, .48], [.975, .31], [.992, .15], [1, .02]];
  const halfWidth = (u) => {
    let i = 1; while (i < OUT.length - 1 && OUT[i][0] < u) i++;
    const [u0, w0] = OUT[i - 1], [u1, w1] = OUT[i], t = (u - u0) / (u1 - u0), s2 = t * t * (3 - 2 * t);
    return W / 2 * (w0 + (w1 - w0) * s2);
  };
  // stations bunched toward the nose so its curve stays round, not faceted
  const station = (i) => { const x = i / NL; return 1 - Math.pow(1 - x, 1.6); };
  const rocker = (u) => 0.08 * Math.pow(Math.max(0, u - 0.62) / 0.38, 2.2) + 0.03 * Math.pow(Math.max(0, 0.18 - u) / 0.18, 2);
  const pos = [], col = [], idx = [];
  // deck (top) and bottom surfaces, each a grid across the width
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NL; i++) {
      const u = station(i), hw = Math.max(0.004, halfWidth(u)), z = (u - 0.5) * L, r = rocker(u);
      for (let j = 0; j <= NW; j++) {
        const v = j / NW * 2 - 1, x = v * hw;
        const dome = (1 - v * v) * T * 0.5;       // thickest along the stringer, thin at the rails
        const y = r + side * (dome + 0.004);
        pos.push(x, y, z);
        const stringer = Math.abs(x) < 0.006 && side > 0;
        const stripe = side > 0 && u > 0.7 && u < 0.74;
        col.push(...(stringer ? [0.55, 0.42, 0.28] : stripe ? [0.9, 0.35, 0.18] : side > 0 ? [0.94, 0.93, 0.9] : [0.86, 0.87, 0.9]));
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
  const fm = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
  for (const [x, z, rot] of [[0, -L / 2 + 0.1, 0], [-0.13, -L / 2 + 0.24, 0.06], [0.13, -L / 2 + 0.24, -0.06]]) {
    const f = new THREE.Mesh(fg, fm); f.rotation.y = Math.PI / 2 + rot; f.position.set(x, 0, z); board.add(f);
  }
  board.userData.length = L;
  return board;
}
