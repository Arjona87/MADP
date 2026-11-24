#!/usr/bin/env python3
"""
MADP_Bot · Construcción de la base de documentos
================================================
Convierte la carpeta documentos/ + el Excel índice en los archivos de datos que usa la app.

Uso (desde la carpeta raíz de la app, en Windows o Linux):
    python herramientas/construir_base.py --excel herramientas/Base_MADP_v1.xlsx --docs documentos --salida data

Requisitos: Python 3.9+, pandas, openpyxl, pypdf (pip install pandas openpyxl pypdf).
Texto: usa `pdftotext` (Poppler) si está instalado; si no, pypdf. Word (.docx/.doc): requiere LibreOffice
(`soffice`) para convertirlo a PDF y poder abrirlo en la página exacta.

Cada resultado de búsqueda queda ligado a la página física del PDF (para el salto con un clic) y a la
página impresa del documento (la que se cita). Documentos de tipo Ley, Código, Reglamento, Constitución
o Tratado se dividen por artículo; los demás, por párrafos dentro de cada página.
"""
import argparse, json, os, re, shutil, subprocess, unicodedata, datetime
from collections import Counter, defaultdict

# ---------------------------------------------------------------- normalización (idéntica en app.js)
STOP = set("""a al algo algun alguna algunas alguno algunos ante antes asi aun bajo bien cada como con contra cual
cuales cuando de del desde donde dos e el ella ellas ello ellos en entre era es esa esas ese eso esos esta estan estas
este esto estos fue fueron ha han hasta hay la las le les lo los mas me mi mis mismo muy nada ni no nos o otra otras otro
otros para pero poco por porque que quien quienes se segun ser si sido sin sobre son su sus tal tambien tan te tiene
tienen todo todos tu tus u un una unas uno unos y ya yo dicha dicho dichos dichas mediante misma mismas mismos cuya cuyo""".split())

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def stem(w):
    if len(w) > 4 and w.endswith('es') and w[-3] not in 'aeiou':
        w = w[:-2]
    elif len(w) > 3 and w.endswith('s'):
        w = w[:-1]
    return w[:7]

def tokens(s):
    out = []
    for w in norm(s).split():
        if w in STOP or len(w) < 2 or (w.isdigit() and len(w) > 4):
            continue
        out.append(stem(w))
    return out

# ---------------------------------------------------------------- PDF: texto por página, etiquetas, índice, enlaces
def paginas_pdf(pdf):
    if shutil.which('pdftotext'):
        r = subprocess.run(['pdftotext', '-enc', 'UTF-8', pdf, '-'], capture_output=True)
        pags = r.stdout.decode('utf-8', 'ignore').split('\f')
    else:
        from pypdf import PdfReader
        pags = [(p.extract_text() or '') for p in PdfReader(pdf).pages]
    if pags and not pags[-1].strip():
        pags = pags[:-1]
    return [re.sub(r'\u00ad[ \t]*\n[ \t]*', '', p).replace('\u00ad', '').replace('\u200b', '') for p in pags]

def meta_pdf(pdf, npags):
    from pypdf import PdfReader
    r = PdfReader(pdf)
    try:
        labels = [r.page_labels[i] for i in range(len(r.pages))]
    except Exception:
        labels = [str(i + 1) for i in range(len(r.pages))]
    toc = []
    def walk(o, d=0):
        for x in o:
            if isinstance(x, list):
                walk(x, d + 1)
            else:
                try:
                    t = re.sub(r'\s+', ' ', x.title).strip()
                    if t.startswith('_') or not t:
                        continue
                    toc.append([t, r.get_destination_page_number(x) + 1, d])
                except Exception:
                    pass
    try:
        walk(r.outline)
    except Exception:
        pass
    enlaces = defaultdict(list)
    for i, p in enumerate(r.pages):
        for a in (p.get('/Annots') or []):
            try:
                A = a.get_object().get('/A')
                if A and A.get('/URI') and str(A['/URI']).startswith('http'):
                    u = str(A['/URI'])
                    if u not in enlaces[i + 1]:
                        enlaces[i + 1].append(u)
            except Exception:
                pass
    return labels[:npags] + [str(i + 1) for i in range(len(labels), npags)], toc, enlaces

# ---------------------------------------------------------------- limpieza
def repetidas(pags):
    cuenta = Counter()
    for p in pags:
        for l in set(x.strip() for x in p.split('\n') if x.strip()):
            cuenta[l] += 1
    umbral = max(4, int(len(pags) * 0.2))
    return {l for l, c in cuenta.items() if c >= umbral and len(pags) >= 6 and len(l) < 90 and len(l) >= 5}

NUM_PAG = re.compile(r'^\s*([IVXLCivxlc]{1,6}|\d{1,4})\s*$')
ABREV = [(r'Amparo Directo en Revisión', 'ADR'), (r'Amparo en Revisión', 'AR'), (r'Acción de Inconstitucionalidad', 'AI'),
         (r'Contradicción de (?:Tesis|Criterios)', 'CT'), (r'Amparo Directo', 'AD'), (r'Controversia Constitucional', 'CC'),
         (r'Recurso de Revisión', 'RR'), (r'Amparo Indirecto', 'AI')]

def corto_sentencia(t):
    s = t
    for pat, ab in ABREV:
        m = re.search(pat + r'\s+(\d{1,5}/\d{4})', s)
        if m:
            extra = re.search(r'y su acumulada\s+(\d{1,5}/\d{4})', s)
            return f'{ab} {m.group(1)}' + (f' y acumulada {extra.group(1)}' if extra else '')
    return None

def limpiar_titulo(t):
    t = re.sub(r'^(\d)\s+(\d)\.', r'\1.\2', t)            # «2 1. Elementos» → «2.1. Elementos»
    t = re.sub(r'^(\d)\s\.(\d)', r'\1.\2', t)
    t = re.sub(r'^(\d+(?:\.\d+)+)\.(?=\s)', r'\1', t)      # «1.1. Elementos» → «1.1 Elementos»
    t = re.sub(r'^(\d+)\s+(?=[A-ZÁÉÍÓÚ])', r'\1. ', t)          # «1 Control» → «1. Control»
    return re.sub(r'\s+', ' ', t).strip()

PARTES = re.compile(r'^(Hechos del caso|Problemas? jur[íi]dicos? planteados?|Criterios? de la Suprema Corte|Justificaci[óo]n de(?:l| los) criterios?(?: jur[íi]dicos?)?|Decisi[óo]n)\s*$')

def parrafos_pagina(txt, quitar):
    lineas = [l.rstrip() for l in txt.split('\n')]
    lineas = [l for l in lineas if l.strip() and l.strip() not in quitar and not NUM_PAG.match(l)]
    if not lineas:
        return []
    largo = max(len(l) for l in lineas)
    pars, buf = [], ''
    for i, l in enumerate(lineas):
        s = l.strip()
        es_parte = bool(PARTES.match(s))
        if es_parte:
            if buf: pars.append(buf); buf = ''
            pars.append('§' + s); continue
        if buf:
            if buf.endswith('-') and not buf.endswith(' -'):
                buf = buf[:-1] + s
            else:
                buf += ' ' + s
        else:
            buf = s
        corta = len(l) < largo * 0.8
        fin = re.search(r'[\.\:;"”»\)]\s*$', s) or (len(s) < 60 and not re.search(r'[,a-záéíóúñ]$', s))
        if corta and fin:
            pars.append(buf); buf = ''
    if buf:
        pars.append(buf)
    return pars

# ---------------------------------------------------------------- segmentación por página (cuadernos, libros, Word…)
def secciones(toc):
    """Índice del PDF ordenado por página: (página, tipo, título, nivel)."""
    out = []
    for t, p, d in toc:
        t = limpiar_titulo(t)
        sen = corto_sentencia(t)
        if sen and t.startswith('SCJN'):
            out.append((p, 'sen', sen, t))
        elif re.match(r'^\d+\.\s', t) or re.match(r'^Anexos?$|^Consideraciones', t):
            out.append((p, 'cap', t, t))
        elif re.match(r'^\d+\.\d+', t):
            out.append((p, 'sec', t, t))
        else:
            out.append((p, 'sec', t, t))
    orden = {'cap': 0, 'sec': 1, 'sen': 2}
    return sorted(out, key=lambda x: (x[0], orden[x[1]]))

def por_pagina(pags, labels, toc):
    quitar = repetidas(pags)
    secs = secciones(toc)
    units = []
    estado = {'cap': '', 'sec': '', 'sen': '', 'parte': ''}
    for i, txt in enumerate(pags):
        p = i + 1
        pars = parrafos_pagina(txt, quitar)
        # encabezados del índice que empiezan en esta página, con la posición del párrafo donde aparecen
        cambios = []
        for (pg, tipo, val, titulo) in secs:
            if pg != p: continue
            clave = norm(titulo)[:28]
            if tipo == 'sen':
                m = re.search(r'(\d{1,5}/\d{4})', titulo); clave = norm(m.group(1)) if m else clave
            pos = 0
            for k, par in enumerate(pars):
                if clave and clave in norm(par):
                    pos = k; break
            cambios.append((pos, tipo, val))
        buf, ini_estado = [], dict(estado)
        def cerrar():
            if buf:
                texto = ' '.join(x for x in buf).strip()
                # letra capital separada del resto de la palabra («E l derecho» → «El derecho»); no toca «A la», «Y el», «O sea»
                texto = re.sub(r'(^|\s)([B-DF-NP-TV-XZÉ]|E) (l|n|s|ste|sta|sto|stos|stas|ntre|ra|xiste)\b', r'\1\2\3', texto)
                if len(texto) > 2:
                    units.append([p, labels[i], ini_estado['cap'], ini_estado['sec'], ini_estado['sen'], ini_estado['parte'], texto])
        for k, par in enumerate(pars):
            for (pos, tipo, val) in cambios:
                if pos == k:
                    cerrar(); buf = []
                    if tipo == 'cap': estado.update(cap=val, sec='', sen='', parte='')
                    elif tipo == 'sec': estado.update(sec=val, sen='', parte='')
                    else: estado.update(sen=val, parte='')
                    ini_estado = dict(estado)
            if par.startswith('§'):
                cerrar(); buf = []
                estado['parte'] = par[1:]; ini_estado = dict(estado)
                continue
            if not buf: ini_estado = dict(estado)
            buf.append(par)
            if sum(len(x) for x in buf) >= 380:
                cerrar(); buf = []
        cerrar()
    return units

def indice_ordenado(toc):
    """Índice del PDF en orden de páginas, con nivel 0 (capítulo), 1 (apartado) o 2 (sentencia)."""
    out = []
    for t, p, d in toc:
        t = limpiar_titulo(t)
        if corto_sentencia(t) and t.startswith('SCJN'): n = 2
        elif re.match(r'^\d+\.\d+', t): n = 1
        elif re.match(r'^\d+\.\s', t): n = 0
        else: n = min(d, 2)
        out.append([t, p, n])
    return [x for _, x in sorted(enumerate(out), key=lambda e: (e[1][1], e[1][2], e[0]))]

# ---------------------------------------------------------------- segmentación por artículo (leyes, códigos, reglamentos)
TIPOS_ART = ('Ley', 'Código', 'Reglamento', 'Constitución', 'Tratado', 'Convención', 'Pacto')
HEAD = re.compile(r'^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo|ARTICULO)\s+(\d{1,4})\s*(?:o\.?|º|°|\.o\.?)?\s*'
                  r'(?:-\s*)?((?i:bis|ter|qu[áa]ter|quinquies|sexies|septies|octies|nonies|decies)(?:\s*\d+)?|[A-Z](?=\s*[\.\-–—]))?'
                  r'\s*(?:[\.\-–—:]|$|(?=\s+[A-ZÁÉÍÓÚÑ]))', re.M)
TRANS = re.compile(r'^\s*(?:ART[ÍI]CULOS\s+)?TRANSITORIOS?\s*\.?\s*$', re.M | re.I)

def por_articulo(pags, labels):
    quitar = repetidas(pags)
    limpias, offs, todo = [], [], ''
    for t in pags:
        t = '\n'.join(l for l in t.split('\n') if l.strip() not in quitar and not NUM_PAG.match(l))
        offs.append(len(todo)); todo += t + '\n'
    pag_de = lambda pos: max(i for i, o in enumerate(offs) if o <= pos) + 1
    ms = list(HEAD.finditer(todo))
    ini = next((i for i, m in enumerate(ms) if int(m.group(1)) == 1), None)
    if ini is None:
        return None
    fin_txt = TRANS.search(todo, ms[ini].start()); limite = fin_txt.start() if fin_txt else len(todo)
    acept, prev = [], 0
    for m in ms[ini:]:
        if m.start() >= limite: break
        n = int(m.group(1))
        if prev <= n <= prev + 15:
            acept.append(m); prev = n
    if len(acept) < 5:
        return None
    units, vistos = [], {}
    for i, m in enumerate(acept):
        fin = acept[i + 1].start() if i + 1 < len(acept) else limite
        cuerpo = re.sub(r'\s+', ' ', re.sub(r'(\w)-\n(\w)', r'\1\2', todo[m.end():fin])).strip(' .-–—:')
        suf = (' ' + m.group(2).strip().capitalize()) if m.group(2) else ''
        et = f'Artículo {int(m.group(1))}{suf}'
        vistos[et] = vistos.get(et, 0) + 1
        if vistos[et] > 1: et += f' [{vistos[et]}]'
        p = pag_de(m.start())
        units.append([p, labels[p - 1], '', et, '', '', cuerpo])
    if fin_txt:
        p = pag_de(fin_txt.start())
        units.append([p, labels[p - 1], '', 'Transitorios', '', '', re.sub(r'\s+', ' ', todo[fin_txt.start():]).strip()])
    return units

# ---------------------------------------------------------------- Excel
def leer_excel(ruta):
    import pandas as pd
    d = pd.read_excel(ruta, sheet_name='Base_MADP', header=3)
    d = d[pd.to_numeric(d['#'], errors='coerce').notna()].copy()
    col = lambda k: [c for c in d.columns if str(c).startswith(k)][0]
    filas = []
    for _, r in d.iterrows():
        g = lambda k: ('' if str(r[col(k)]) in ('nan', 'None') else str(r[col(k)]).strip())
        filas.append(dict(n=int(r['#']), nombre=g('Título'), autor=g('Autor'), tipo=g('Tipo'), fecha=g('Fecha'),
                          estatus=g('Estatus'), url=g('URL'), cita=g('Citación'), corto=g('Nombre corto'),
                          alias=g('Alias'), archivo=g('Archivo')))
    return filas

def a_pdf(origen, carpeta):
    destino = os.path.splitext(origen)[0] + '.pdf'
    if not os.path.exists(destino) or os.path.getmtime(destino) < os.path.getmtime(origen):
        soffice = shutil.which('soffice') or shutil.which('libreoffice') or r'C:\Program Files\LibreOffice\program\soffice.exe'
        subprocess.run([soffice, '--headless', '--convert-to', 'pdf', '--outdir', carpeta, origen], capture_output=True)
    return destino if os.path.exists(destino) else None

# ---------------------------------------------------------------- principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--excel', required=True); ap.add_argument('--docs', required=True); ap.add_argument('--salida', required=True)
    a = ap.parse_args()
    raiz = os.path.abspath(os.path.join(a.salida, '..'))
    filas = leer_excel(a.excel)
    os.makedirs(a.salida, exist_ok=True)
    docs, textos, lista, avisos = [], {}, [], []
    for f in filas:
        nid = f'{f["n"]:03d}'
        if f['cita'].lower().startswith('excluido'):
            continue
        arch = f['archivo'] or next((x for x in os.listdir(a.docs) if x.startswith(nid + '_') and not x.endswith('.pdf')
                                     or x.startswith(nid + '_') and x.endswith('.pdf')), '')
        ruta = os.path.join(a.docs, arch)
        if not arch or not os.path.exists(ruta):
            avisos.append(f'#{nid}: está en el Excel pero no encontré el archivo «{arch}» en {a.docs}'); continue
        original = None
        if ruta.lower().endswith(('.docx', '.doc', '.odt', '.rtf')):
            original = ruta
            ruta = a_pdf(ruta, a.docs)
            if not ruta:
                avisos.append(f'#{nid}: no pude convertir el Word a PDF (¿está instalado LibreOffice?)'); continue
        pags = paginas_pdf(ruta)
        labels, toc, enlaces = meta_pdf(ruta, len(pags))
        modo = 'art' if (f['cita'].lower().startswith('por art') or (not f['cita'] and f['tipo'].startswith(TIPOS_ART))) else 'pag'
        units = por_articulo(pags, labels) if modo == 'art' else None
        if modo == 'art' and not units:
            avisos.append(f'#{nid}: es de tipo «{f["tipo"]}» pero no encontré sus artículos; se indexa por página')
            modo = 'pag'
        if units is None:
            units = por_pagina(pags, labels, toc)
        vacias = sum(1 for t in pags if len(t.strip()) < 40)
        if vacias > len(pags) * 0.3:
            avisos.append(f'#{nid}: {vacias} de {len(pags)} páginas sin texto (¿PDF escaneado? requiere OCR)')
        # enlaces oficiales a sentencias: el primero que aparece en la página donde empieza cada sentencia del índice
        sents = {}
        for (pg, tipo, val, titulo) in secciones(toc):
            if tipo == 'sen' and val not in sents and enlaces.get(pg):
                sents[val] = enlaces[pg][0]
        rel = lambda x: os.path.relpath(x, raiz).replace(os.sep, '/')
        docs.append(dict(id=nid, n=f['n'], nombre=f['nombre'], corto=f['corto'] or f['nombre'], autor=f['autor'], tipo=f['tipo'],
                         fecha=f['fecha'], estatus=f['estatus'], url=f['url'], modo=modo, pdf=rel(ruta),
                         original=rel(original) if original else '', paginas=len(pags), etiquetas=labels,
                         toc=indice_ordenado(toc), sentencias=sents,
                         alias=sorted({norm(x) for x in (f['alias'].split('|') + [f['corto'], f['nombre']]) if norm(x)}),
                         nu=len(units)))
        textos[nid] = units
        di = len(docs) - 1
        for ui, u in enumerate(units):
            p, lp, cap, sec, sen, parte, txt = u
            lista.append((di, ui, tokens(txt) + tokens(sec + ' ' + sen)))
        print(f'#{nid}  {modo}  {len(pags)} páginas  ·  {len(units)} fragmentos  ·  {len(toc)} entradas de índice  ·  {len(sents)} sentencias enlazadas')
    post = defaultdict(list); dl = []; ref = []
    for k, (di, ui, toks) in enumerate(lista):
        ref += [di, ui]; dl.append(len(toks))
        for t, c in Counter(toks).items():
            post[t] += [k, c]
    idx = dict(N=len(dl), avgdl=round(sum(dl) / max(1, len(dl)), 2), dl=dl, ref=ref, p=post)
    json.dump(idx, open(os.path.join(a.salida, 'indice.json'), 'w', encoding='utf-8'), separators=(',', ':'))
    json.dump(textos, open(os.path.join(a.salida, 'textos.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    hoy = datetime.date.today().strftime('%d/%m/%Y'); v = datetime.datetime.now().strftime('%Y%m%d%H%M')
    json.dump({'corte': hoy, 'docs': docs}, open(os.path.join(a.salida, 'docs.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump({'version': v, 'corte': hoy}, open(os.path.join(a.salida, 'version.json'), 'w'), separators=(',', ':'))
    sw = os.path.join(raiz, 'sw.js')
    if os.path.exists(sw):
        s = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{v}';", open(sw, encoding='utf-8').read())
        s = re.sub(r"const DOCUMENTOS = \[[^\]]*\];", 'const DOCUMENTOS = ' + json.dumps([d['pdf'] for d in docs] + [d['original'] for d in docs if d['original']]) + ';', s)
        open(sw, 'w', encoding='utf-8').write(s)
    print(f'Documentos: {len(docs)}  ·  fragmentos indexados: {len(lista)}')
    for x in avisos: print('AVISO', x)

if __name__ == '__main__':
    main()
