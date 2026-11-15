/* OC Shimeji 16.8 — beds for living together: a double bed, a bunk bed, a child's bed and a crib (original models, same toy
 * shading as models12; static pieces are fused). OC.Models.FURN[id]() returns a THREE.Group standing on y = 0.
 */
(function () {
  'use strict';
  const Mo = OC.Models, { mat, add, rbox, sphere, cyl, FURN } = Mo;
  const WOOD = '#D9A26A', WOOD_D = '#B07E4B', CREAM = '#FFF4E2', LINEN = '#F3E6D2';
  const fuse = (g) => (Mo.fuse ? Mo.fuse(g) : g);
  const pillow = (g, x, y, z, col) => { const p = add(g, sphere(4.6, 12, 8), mat(col || '#FFFFFF'), x, y, z, { cast: false }); p.scale.set(1.25, 0.5, 0.85); return p; };
  Object.assign(FURN, {
    bed2() {
      const g = new THREE.Group(), w = mat(WOOD), d = mat(WOOD_D);
      for (const [x, z] of [[-17, -16], [17, -16], [-17, 16], [17, 16]]) add(g, rbox(2.8, 6, 2.8, 0.8), d, x, 3, z);
      add(g, rbox(38, 3, 34, 1.2), w, 0, 7, 0);
      add(g, rbox(37, 5.5, 31, 2), mat(CREAM), 0, 11.2, 1);
      add(g, rbox(39, 19, 3, 1.2), d, 0, 13, -17);
      for (const x of [-12, -6, 0, 6, 12]) add(g, rbox(1.4, 10, 1.2, 0.4), w, x, 14, -15.4, { cast: false });
      add(g, rbox(39, 8, 2.6, 1.2), d, 0, 8.5, 17);
      add(g, rbox(37.6, 3.4, 19, 1.6), mat('#E8A0A8'), 0, 14.2, 6, { cast: false });
      add(g, rbox(37.8, 1.3, 3.4, 0.5), mat('#F6D6DA'), 0, 16, -3, { cast: false });
      pillow(g, -9, 15, -11); pillow(g, 9, 15, -11, LINEN);
      return fuse(g);
    },
    bunk() {
      const g = new THREE.Group(), w = mat(WOOD), d = mat(WOOD_D);
      for (const [x, z] of [[-10, -16], [10, -16], [-10, 16], [10, 16]]) add(g, rbox(2.6, 44, 2.6, 0.8), d, x, 22, z);
      for (const y of [7, 29]) { add(g, rbox(20, 3, 34, 1.2), w, 0, y, 0); add(g, rbox(19, 4.5, 31, 1.8), mat(CREAM), 0, y + 3.6, 1); }
      add(g, rbox(19.6, 3, 19, 1.4), mat('#8FA9B8'), 0, 13, 6, { cast: false }); add(g, rbox(19.6, 3, 19, 1.4), mat('#F2B33D'), 0, 35, 6, { cast: false });
      pillow(g, 0, 12.6, -11); pillow(g, 0, 34.6, -11, LINEN);
      add(g, rbox(2, 7, 24, 0.8), d, 10.5, 38, 2);                                           /* guard rail upstairs */
      for (let i = 0; i < 4; i++) add(g, rbox(1.4, 1.4, 7, 0.4), w, 12.5, 9 + i * 6.5, 14);  /* ladder rungs */
      for (const z of [10.5, 17.5]) add(g, rbox(1.4, 34, 1.4, 0.4), d, 12.5, 17, z);
      return fuse(g);
    },
    kidbed() {
      const g = new THREE.Group(), w = mat('#F7C873'), d = mat('#E0A15A');
      for (const [x, z] of [[-7, -12], [7, -12], [-7, 12], [7, 12]]) add(g, rbox(2.2, 5, 2.2, 0.7), d, x, 2.5, z);
      add(g, rbox(16, 2.6, 26, 1), w, 0, 6, 0); add(g, rbox(15, 4.5, 24, 1.6), mat(CREAM), 0, 9.5, 1);
      add(g, rbox(17, 14, 2.6, 1.2), d, 0, 10, -13); add(g, rbox(17, 7, 2.4, 1), d, 0, 7.5, 13);
      const star = add(g, cyl(3.2, 3.2, 1, 5), mat('#FFD23F'), 0, 15, -13.6, { cast: false }); star.rotation.x = Math.PI / 2;
      add(g, rbox(15.4, 3, 14, 1.3), mat('#9FD8C8'), 0, 12, 5, { cast: false }); pillow(g, 0, 12.4, -8);
      return fuse(g);
    },
    crib() {
      const g = new THREE.Group(), w = mat('#FFFFFF'), d = mat('#E7DCCB');
      for (const [x, z] of [[-9, -7], [9, -7], [-9, 7], [9, 7]]) add(g, rbox(2.2, 22, 2.2, 0.7), d, x, 11, z);
      add(g, rbox(20, 2.4, 16, 0.9), w, 0, 7, 0); add(g, rbox(18.5, 3.5, 14.5, 1.4), mat('#FDE8EF'), 0, 9.6, 0);
      for (const z of [-7.4, 7.4]) { add(g, rbox(20, 1.6, 1.4, 0.5), w, 0, 21, z); for (let i = -3; i <= 3; i++) add(g, rbox(1, 12, 1, 0.3), w, i * 2.6, 15, z, { cast: false }); }
      for (const x of [-9.4, 9.4]) { add(g, rbox(1.4, 1.6, 16, 0.5), w, x, 21, 0); for (let i = -2; i <= 2; i++) add(g, rbox(1, 12, 1, 0.3), w, x, 15, i * 2.6, { cast: false }); }
      add(g, rbox(12, 2.4, 8, 1), mat('#BFE3F2'), 0, 12, 2, { cast: false });
      for (const [x, c] of [[-4, '#FFD23F'], [4, '#F28DB2']]) add(g, sphere(1.8, 10, 8), mat(c), x, 27, 0, { cast: false });
      add(g, rbox(10, 0.8, 0.8, 0.3), d, 0, 29, 0, { cast: false });
      return fuse(g);
    },
  });
})();
