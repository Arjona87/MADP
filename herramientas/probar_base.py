#!/usr/bin/env python3
"""
MADP_Bot · Prueba automática de la base
Revisa, antes de publicar:
  1. Que cada documento tenga su PDF en la carpeta y que sus páginas existan.
  2. Que cada fragmento apunte a una página válida y que su texto esté de verdad en esa página del PDF.
  3. Que cada cita de las preguntas frecuentes sea texto literal de la página que indica.
  4. Que búsquedas de control encuentren la página esperada.
Uso:  python herramientas/probar_base.py --datos data
Si termina con «RESULTADO: REVISAR», no publiques hasta corregir lo que señala.
"""
import argparse, json, os, re, shutil, subprocess, unicodedata, sys
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from construir_base import norm, tokens, paginas_pdf

# búsqueda de control → (documento, página física del PDF que debe aparecer entre los 5 primeros resultados)
CONTROLES = [
    ('actitud nerviosa', '001', 52), ('grados de intensidad', '001', 31), ('niveles de contacto', '001', 36),
    ('mochila segura', '001', 101), ('juicio de urgencia', '001', 78), ('denuncia informal', '001', 63),
    ('flagrancia control preventivo distincion', '001', 33), ('domicilio', '001', 88),
]

def bm25(idx, q, docs, ids):
    import math
    k1, b = 1.2, 0.6
    sc = defaultdict(float); cub = Counter()
    base = list(dict.fromkeys(tokens(q)))
    for t in base:
        pl = idx['p'].get(t)
        if not pl: continue
        df = len(pl) / 2; idf = math.log(1 + (idx['N'] - df + 0.5) / (df + 0.5))
        for i in range(0, len(pl), 2):
            k, tf = pl[i], pl[i + 1]
            sc[k] += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * idx['dl'][k] / idx['avgdl'])); cub[k] += 1
    out = sorted(((s * (0.25 + 0.75 * min(1, cub[k] / len(base))), k) for k, s in sc.items()), reverse=True)
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--datos', default='data'); a = ap.parse_args()
    raiz = os.path.abspath(os.path.join(a.datos, '..'))
    docs = json.load(open(os.path.join(a.datos, 'docs.json'), encoding='utf-8'))['docs']
    textos = json.load(open(os.path.join(a.datos, 'textos.json'), encoding='utf-8'))
    faq = json.load(open(os.path.join(a.datos, 'faq.json'), encoding='utf-8'))['faq']
    idx = json.load(open(os.path.join(a.datos, 'indice.json'), encoding='utf-8'))
    errores, avisos = [], []
    paginas = {}
    for d in docs:
        ruta = os.path.join(raiz, d['pdf'])
        if not os.path.exists(ruta):
            errores.append(f"#{d['id']}: falta el PDF {d['pdf']}"); continue
        pags = [norm(p) for p in paginas_pdf(ruta)]
        paginas[d['id']] = pags
        if len(pags) != d['paginas']:
            errores.append(f"#{d['id']}: el PDF tiene {len(pags)} páginas y la base dice {d['paginas']}")
        malos = 0
        for u in textos[d['id']]:
            p, txt = u[0], u[6]
            if not 1 <= p <= len(pags):
                errores.append(f"#{d['id']}: fragmento con página inexistente {p}"); continue
            # muestra de 6 palabras del inicio del fragmento: debe estar en esa página del PDF
            pal = norm(txt).split()[:6]
            if len(pal) >= 4 and ' '.join(pal[:4]) not in pags[p - 1].replace('  ', ' '):
                if ' '.join(pal[:3]) not in pags[p - 1]:
                    malos += 1
        if malos > len(textos[d['id']]) * 0.03:
            errores.append(f"#{d['id']}: {malos} fragmentos cuyo texto no coincide con la página asignada")
        elif malos:
            avisos.append(f"#{d['id']}: {malos} fragmentos con diferencias menores de extracción (guiones, notas)")
        for t, p, n in d['toc']:
            if not 1 <= p <= d['paginas']:
                errores.append(f"#{d['id']}: entrada del índice «{t}» apunta a la página {p}")
    # citas de preguntas frecuentes
    for f in faq:
        for b in f['bloques']:
            pag = ' '.join(paginas.get(b['d'], [])[b['p'] - 1: b.get('p2', b['p'])])
            n = norm(b['texto'])
            if norm(b['texto'])[:60] not in pag:
                errores.append(f"faq «{f['id']}»: la cita no empieza en la pág. PDF {b['p']}")
            pal = n.split()
            if len(pal) > 12 and ' '.join(pal[-6:]) not in pag:
                errores.append(f"faq «{f['id']}»: la cita no termina en la pág. PDF {b.get('p2', b['p'])}")
    # búsquedas de control
    ok = 0
    for q, did, p in CONTROLES:
        res = bm25(idx, q, docs, None)
        vistos = []
        for s, k in res:
            di, ui = idx['ref'][2 * k], idx['ref'][2 * k + 1]
            pg = textos[docs[di]['id']][ui][0]
            if pg not in vistos: vistos.append(pg)
            if len(vistos) >= 5: break
        if p in vistos: ok += 1
        else: errores.append(f"búsqueda «{q}»: esperaba la pág. PDF {p} entre las 5 primeras y obtuve {vistos}")
    print(f"Documentos: {len(docs)} · fragmentos: {sum(len(v) for v in textos.values())} · preguntas frecuentes: {len(faq)} "
          f"({sum(len(f['bloques']) for f in faq)} citas) · búsquedas de control: {ok}/{len(CONTROLES)}")
    for x in avisos: print('AVISO', x)
    for x in errores: print('ERROR', x)
    print('RESULTADO:', 'REVISAR' if errores else 'OK')
    sys.exit(1 if errores else 0)

if __name__ == '__main__':
    main()
