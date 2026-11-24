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
    const projects = [createExampleProject(), synth('Acak A (12 node)', 12, -6.84, 107.50, 900), synth('Acak B (25 node)', 25, -7.10, 110.40, 650), synth('Acak C (40 node)', 40, -8.20, 116.10, 420)];
    return projects.map(pr => {
      const h = computeHydraulics(pr); const s = pr.settings;
      return { name: pr.meta.name,
        nodes: pr.nodes.map(n => ({ id: n.id, type: n.type, elev: +n.elev || 0, head0: n.type === 'reservoir' ? (+n.elev || 0) + (+n.waterLevel || 0) : null, demand: nodeDemand(n, s), w: h.nodes[n.id] })),
        pipes: pr.pipes.map(x => ({ id: x.id, from: x.from, to: x.to, material: x.material, D: +x.diameter, dIn: pipeID(x), C: pipeC(x), w: h.pipes[x.id] })) };
    });
  });
  fs.writeFileSync(__dirname + '/kasus.json', JSON.stringify(cases, null, 1)); console.log('kasus', cases.map(c => c.name + ' · ' + c.pipes.length + ' pipa').join(' | ')); await b.close();
})();
