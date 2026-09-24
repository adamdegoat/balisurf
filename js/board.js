// A shortboard, built from an outline: 6'2" (1.88m), pointed nose, squash tail, a little rocker, rounded rails.
import * as THREE from 'three';

export function makeBoard() {
  const L = 1.88, W = 0.49, T = 0.06, NL = 28, NW = 10;
  const halfWidth = (u) => {                      // u 0 = tail, 1 = nose
    const nose = Math.pow(Math.max(0, 1 - u), 0.55), tail = Math.pow(Math.min(1, u / 0.12), 0.35);
    return W / 2 * Math.min(1, Math.sin(Math.PI * Math.pow(u, 0.85)) * 1.25) * nose ** 0.4 * (0.55 + 0.45 * tail);
  };
  const rocker = (u) => 0.08 * Math.pow(Math.max(0, u - 0.62) / 0.38, 2.2) + 0.03 * Math.pow(Math.max(0, 0.18 - u) / 0.18, 2);
  const pos = [], col = [], idx = [];
  // deck (top) and bottom surfaces, each a grid across the width
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NL; i++) {
      const u = i / NL, hw = Math.max(0.004, halfWidth(u)), z = (u - 0.5) * L, r = rocker(u);
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
