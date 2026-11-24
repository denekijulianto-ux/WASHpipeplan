"""Membandingkan hasil hidrolis WASHLY dengan EPANET (lewat WNTR) pada jaringan yang sama.
Jalankan: python3 banding.py  → menulis hasil.md"""
import json, os, sys, wntr
H = os.path.dirname(os.path.abspath(__file__))
cases = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(H, 'kasus.json')))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(H, 'hasil.md')
out = []; summary = []
for c in cases:
    pipes = [p for p in c['pipes'] if p['w'] and p['w'].get('inTree') and not p['w'].get('trans')]
    used = {p['from'] for p in pipes} | {p['to'] for p in pipes}
    wn = wntr.network.WaterNetworkModel(); wn.options.hydraulic.headloss = 'H-W'; wn.options.hydraulic.accuracy = 1e-7; wn.options.hydraulic.trials = 500
    for n in c['nodes']:
        if n['id'] not in used: continue
        if n['type'] == 'reservoir': wn.add_reservoir(n['id'], base_head=n['head0'])
        else: wn.add_junction(n['id'], base_demand=n['demand'] / 1000.0, elevation=n['elev'])
    for p in pipes: wn.add_pipe(p['id'], p['from'], p['to'], length=p['w']['length'], diameter=p['dIn'] / 1000.0, roughness=p['C'], minor_loss=0.0)
    r = wntr.sim.EpanetSimulator(wn).run_sim()
    pr = r.node['pressure'].iloc[0]; fl = r.link['flowrate'].iloc[0]; ve = r.link['velocity'].iloc[0]; hl = r.link['headloss'].iloc[0]
    rows = []; mx = {'P': 0, 'v': 0, 'Q': 0, 'R': 0, 'Qa': 0, 'va': 0}; h0 = max(n['head0'] for n in c['nodes'] if n['type'] == 'reservoir' and n['id'] in used)
    for p in pipes:
        w = p['w']; Qe = abs(fl[p['id']]) * 1000; ve_ = abs(ve[p['id']])
        dv = abs(w['v'] - ve_) / max(ve_, 1e-9) * 100; dq = abs(w['Q'] - Qe) / max(Qe, 1e-9) * 100
        mx['Qa'] = max(mx['Qa'], abs(w['Q'] - Qe)); mx['va'] = max(mx['va'], abs(w['v'] - ve_))
        if Qe >= 0.5: mx['v'] = max(mx['v'], dv); mx['Q'] = max(mx['Q'], dq)
        rows.append(f"| {p['id']} | {p['material']} Ø{p['D']} | {p['dIn']:.1f} | {w['length']:.1f} | {w['Q']:.3f} | {Qe:.3f} | {w['v']:.3f} | {ve_:.3f} | {abs(w['v'] - ve_):.4f} |")
    nrows = []
    for n in c['nodes']:
        if n['id'] not in used or n['type'] == 'reservoir': continue
        pw = n['w']['pressure']; pe = pr[n['id']]; d = abs(pw - pe); mx['P'] = max(mx['P'], d); lw = h0 - pw - n['elev']; le = h0 - pe - n['elev']
        if le > 0.5: mx['R'] = max(mx['R'], abs(lw - le) / le * 100)
        nrows.append(f"| {n['id']} | {n['elev']:.2f} | {pw:.2f} | {pe:.2f} | {d:.3f} |")
    summary.append(f"| {c['name']} | {len(pipes)} | {c.get('loops', 0)} | {mx['Qa']:.4f} L/dtk | {mx['Q']:.2f}% | {mx['va']:.4f} m/dtk | {mx['P']:.3f} m | {mx['R']:.2f}% |")
    if c is cases[0]:  # proyek contoh: dampak perbaikan Ø dalam (versi lama memakai Ø luar sebagai Ø dalam)
        wn2 = wntr.network.WaterNetworkModel(); wn2.options.hydraulic.headloss = 'H-W'
        for n in c['nodes']:
            if n['id'] not in used: continue
            (wn2.add_reservoir(n['id'], base_head=n['head0']) if n['type'] == 'reservoir' else wn2.add_junction(n['id'], base_demand=n['demand'] / 1000.0, elevation=n['elev']))
        for p in pipes: wn2.add_pipe(p['id'], p['from'], p['to'], length=p['w']['length'], diameter=(p['D'] if p['material'] != 'GIP' else p['D']) / 1000.0, roughness=p['C'])
        pr2 = wntr.sim.EpanetSimulator(wn2).run_sim().node['pressure'].iloc[0]
        before = "\n".join(f"| {n['id']} | {pr2[n['id']]:.2f} | {pr[n['id']]:.2f} | {pr[n['id']] - pr2[n['id']]:+.2f} |" for n in c['nodes'] if n['id'] in used and n['type'] != 'reservoir')
    out.append(f"\n### {c['name']}\n\n| Pipa | Jenis | Ø dalam (mm) | L (m) | Q WASHLY (L/dtk) | Q EPANET | v WASHLY (m/s) | v EPANET | Selisih v (m/s) |\n|---|---|---|---|---|---|---|---|---|\n" + "\n".join(rows) +
               f"\n\n| Node | Elevasi (m) | Tekanan WASHLY (mka) | Tekanan EPANET (mka) | Selisih (m) |\n|---|---|---|---|---|\n" + "\n".join(nrows) + "\n")
md = ("# Hasil uji pembanding hidrolis WASHLY vs EPANET\n\nDibuat otomatis oleh `banding.py` (EPANET 2.2 lewat WNTR " + wntr.__version__ + ").\n\n"
      "| Jaringan | Pipa | Loop | Selisih debit maks. | Selisih debit relatif (Q ≥ 0,5 L/dtk) | Selisih kecepatan maks. | Selisih tekanan maks. | Selisih relatif kehilangan tekanan |\n|---|---|---|---|---|---|---|---|\n" + "\n".join(summary) + "\n\n## Dampak perbaikan diameter dalam (proyek contoh)\n\nVersi lama memakai Ø luar pipa HDPE/PVC sebagai Ø dalam.\n\n| Node | Tekanan versi lama, Ø luar (mka) | Tekanan versi baru, Ø dalam (mka) | Perubahan |\n|---|---|---|---|\n" + before + "\n\n## Rincian per jaringan\n" + "".join(out))
open(OUT, 'w').write(md); print("\n".join(summary))
