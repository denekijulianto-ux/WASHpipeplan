// Mengekspor jaringan uji + hasil hidrolis WASHLY (dihitung oleh kode aplikasi asli di browser) ke kasus.json
// Jalankan: (cd www && python3 -m http.server 8767) lalu: node tests/verifikasi-hidrolis/export.js
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route('**/*', r => r.request().url().startsWith('http://localhost') && !r.request().url().endsWith('/auth-config.js') ? r.continue() : r.request().url().endsWith('/auth-config.js') ? r.fulfill({ contentType: 'application/javascript', body: 'window.TIRTAPLAN_AUTH = null;' }) : r.abort());
  await p.goto('http://localhost:8767/index.html'); await p.waitForFunction(() => typeof computeHydraulics === 'function');
  const cases = await p.evaluate(() => {
    // Generator acak deterministik
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const mats = ['HDPE', 'PVC', 'GIP'];
    function synth(name, nNodes, lat0, lng0, elev0) {
      const ex = createExampleProject(); const nodes = [{ id: 'R', label: 'R', type: 'reservoir', lat: lat0, lng: lng0, elev: elev0, waterLevel: 3, demand: 0, elevAuto: false, elevSrc: 'manual' }];
      const pipes = [];
      for (let i = 1; i < nNodes; i++) {
        const par = nodes[Math.floor(rnd() * nodes.length)]; const ang = rnd() * Math.PI * 2, dist = 80 + rnd() * 420;
        const lat = par.lat + Math.cos(ang) * dist / 111000, lng = par.lng + Math.sin(ang) * dist / 111000;
        const elev = par.elev - 2 - rnd() * 9; const id = 'J' + i;
        nodes.push({ id, label: id, type: 'junction', lat, lng, elev, demand: +(0.05 + rnd() * 0.6).toFixed(2), elevAuto: false, elevSrc: 'manual' });
        const mat = mats[Math.floor(rnd() * 3)]; const D = [32, 40, 50, 63, 75, 90, 110][Math.floor(rnd() * 7)];
        pipes.push({ id: 'P' + i, label: 'P' + i, from: par.id, to: id, material: mat, diameter: D });
      }
      return { ...ex, meta: { ...ex.meta, name }, nodes, pipes, structures: [] };
    }
    // Jaringan loop: grid kota dengan 1 atau 2 reservoir, + cabang mati
    function grid(name, nx, ny, twoRes, branches) {
      const ex = createExampleProject(); const lat0 = -6.9, lng0 = 107.6, st = 150 / 111000; const nodes = [], pipes = []; let k = 0;
      const N = (id, type, lat, lng, elev, demand, wl = 0) => nodes.push({ id, label: id, type, lat, lng, elev, demand, waterLevel: wl, elevAuto: false, elevSrc: 'manual' });
      const P = (a, b, mat, D) => pipes.push({ id: 'P' + (++k), label: 'P' + k, from: a, to: b, material: mat, diameter: D });
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) N(`G${i}_${j}`, 'junction', lat0 - j * st, lng0 + i * st, 760 - i * 3.5 - j * 2.5 - rnd() * 2, +(0.1 + rnd() * 0.5).toFixed(2));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { if (i < nx - 1) P(`G${i}_${j}`, `G${i + 1}_${j}`, mats[(i + j) % 2], [63, 75, 90, 110][Math.floor(rnd() * 4)]); if (j < ny - 1) P(`G${i}_${j}`, `G${i}_${j + 1}`, mats[(i + j + 1) % 2], [50, 63, 75, 90][Math.floor(rnd() * 4)]); }
      N('R1', 'reservoir', lat0 + 2 * st, lng0 - st, 800, 0, 3); P('R1', 'G0_0', 'HDPE', 160);
      if (twoRes) { N('R2', 'reservoir', lat0 - (ny + 1) * st, lng0 + nx * st, 792, 0, 2.5); P('R2', `G${nx - 1}_${ny - 1}`, 'HDPE', 110); }
      for (let b = 0; b < branches; b++) { let prev = `G${Math.floor(rnd() * nx)}_${Math.floor(rnd() * ny)}`; const pn = nodes.find(n => n.id === prev);
        for (let d = 1; d <= 3; d++) { const id = `B${b}_${d}`; N(id, d === 3 ? 'hydrant' : 'junction', pn.lat - d * 0.0008, pn.lng + d * 0.0006 * (b % 2 ? 1 : -1), pn.elev - d * 1.5, +(0.05 + rnd() * 0.2).toFixed(2)); P(prev, id, 'PVC', [32, 40, 50][d - 1]); prev = id; } }
      return { ...ex, meta: { ...ex.meta, name }, nodes, pipes, structures: [] };
    }
    const exLoop = (() => { const ex = createExampleProject(); const a = ex.nodes.find(n => n.type === 'hydrant'), b = ex.nodes.find(n => n.type === 'wash_out');
      return { ...ex, meta: { ...ex.meta, name: 'Proyek contoh + pipa penghubung (1 loop)' }, pipes: [...ex.pipes, { id: 'pLoop', label: 'PL', from: a.id, to: b.id, material: 'HDPE', diameter: 63 }] }; })();
    const projects = [createExampleProject(), synth('Acak A (12 node)', 12, -6.84, 107.50, 900), synth('Acak B (25 node)', 25, -7.10, 110.40, 650), synth('Acak C (40 node)', 40, -8.20, 116.10, 420),
      exLoop, grid('Loop: grid 4x3, 1 reservoir', 4, 3, false, 2), grid('Loop: grid 6x5, 2 reservoir', 6, 5, true, 4), grid('Loop: grid 12x10, 2 reservoir, 10 cabang', 12, 10, true, 10)];
    return projects.map(pr => {
      const h = computeHydraulics(pr); const s = pr.settings;
      return { name: pr.meta.name, loops: h.net ? h.net.loops : 0, iters: h.net ? h.net.iters : 0, ok: h.net ? h.net.ok : true,
        nodes: pr.nodes.map(n => ({ id: n.id, type: n.type, elev: +n.elev || 0, head0: n.type === 'reservoir' ? (+n.elev || 0) + (+n.waterLevel || 0) : null, demand: nodeDemand(n, s), w: h.nodes[n.id] })),
        pipes: pr.pipes.map(x => ({ id: x.id, from: x.from, to: x.to, material: x.material, D: +x.diameter, dIn: pipeID(x), C: pipeC(x), w: h.pipes[x.id] })) };
    });
  });
  fs.writeFileSync(__dirname + '/kasus.json', JSON.stringify(cases, null, 1)); console.log('kasus', cases.map(c => c.name + ' · ' + c.pipes.length + ' pipa').join(' | ')); await b.close();
})();
