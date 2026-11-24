/* MADP_Bot · Buscador privado de los documentos de la Maestría en Alta Dirección Policial.
   Todo sale del texto de los documentos cargados (data/): no se inventa nada. Si no hay coincidencias, lo dice.
   Cada resultado lleva su página y un botón para abrir el documento en esa página dentro del visor integrado.
   No se guardan búsquedas. */
'use strict';

const CONFIG = { version: '1.1', porTanda: 8 };
const SALUDO = '¡Hola! Soy MADP_Bot, tu asistente para encontrar información en los documentos de la Maestría en Alta Dirección Policial.';

const $ = (s, el = document) => el.querySelector(s);
const E = { docs: [], docMap: {}, faq: [], cats: [], corte: '', facil: false, esc: 1, idx: null, textos: null, sel: new Set(), instalarEvt: null, instaladoMostrado: false };

/* ---------- Normalización (idéntica a construir_base.py) ---------- */
const STOP = new Set(`a al algo algun alguna algunas alguno algunos ante antes asi aun bajo bien cada como con contra cual
cuales cuando de del desde donde dos e el ella ellas ello ellos en entre era es esa esas ese eso esos esta estan estas
este esto estos fue fueron ha han hasta hay la las le les lo los mas me mi mis mismo muy nada ni no nos o otra otras otro
otros para pero poco por porque que quien quienes se segun ser si sido sin sobre son su sus tal tambien tan te tiene
tienen todo todos tu tus u un una unas uno unos y ya yo dicha dicho dichos dichas mediante misma mismas mismos cuya cuyo`.split(/\s+/));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function stem(w) {
  if (w.length > 4 && w.endsWith('es') && !'aeiou'.includes(w[w.length - 3])) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  return w.slice(0, 7);
}
function tokens(s) {
  const out = [];
  for (const w of norm(s).split(' ')) {
    if (!w || STOP.has(w) || w.length < 2 || (/^\d+$/.test(w) && w.length > 4)) continue;
    out.push(stem(w));
  }
  return out;
}
const QSTOP = new Set(['hacer','saber','quiero','quisiera','puedo','pued','necesito','necesit','ayuda','informacion','informac','tengo','dice','decir',
  'favor','gracia','hola','buena','tarde','noche','dia','duda','pregunta','pregunt','explica','explic','debo','deb','busca','buscar','encuentra',
  'documento','document','cuaderno','tema','habla','hable','sobre'].map(stem));
const MAPA = { 'á':'a','à':'a','ä':'a','â':'a','é':'e','è':'e','ë':'e','ê':'e','í':'i','ì':'i','ï':'i','î':'i','ó':'o','ò':'o','ö':'o','ô':'o','ú':'u','ù':'u','ü':'u','û':'u','ñ':'n' };
const plano = s => Array.from(s.toLowerCase(), c => MAPA[c] || c).join('');   // misma longitud que el original
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ---------- Utilidades de interfaz ---------- */
const chat = () => $('#chat');
function burbuja(html, { usuario = false, clase = '' } = {}) {
  const m = document.createElement('div');
  m.className = 'msg ' + (usuario ? 'usr ' : '') + clase;
  m.innerHTML = usuario ? `<div class="burbuja">${html}</div>`
    : `<img class="av" src="assets/violeta-96.webp" alt="MADP_Bot" width="40" height="40"><div class="burbuja">${html}</div>`;
  chat().appendChild(m);
  m.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return m;
}
function escribiendo() {
  return burbuja('<span class="cargando" aria-label="Buscando en los documentos"><span></span><span></span><span></span></span>');
}
const aclaracion = () => `<p class="aclara">Resultados tomados literalmente ${E.docs.length === 1 ? 'del documento cargado' : `de los ${E.docs.length} documentos cargados`} (base al ${esc(E.corte)}). Verifica siempre en la página indicada.</p>`;

/* ---------- Páginas y citas ---------- */
const etq = (d, p) => (d.etiquetas && d.etiquetas[p - 1]) || String(p);
function pagTxt(d, p, p2) {
  const a = etq(d, p), b = p2 ? etq(d, p2) : null;
  const imp = b && b !== a ? `Págs. ${a}-${b}` : `Pág. ${a}`;
  return String(a) === String(p) ? imp : `${imp} (PDF ${p}${b && b !== a ? '-' + p2 : ''})`;
}
function ruta(d, u) {             // documento › capítulo › apartado › sentencia
  const partes = [d.corto];
  if (u.sec) partes.push(u.sec); else if (u.cap) partes.push(u.cap);
  if (u.sen) partes.push(u.sen);
  return partes.map(esc).join(' › ');
}
const unidad = (d, i) => { const x = E.textos[d.id][i]; return { p: x[0], lp: x[1], cap: x[2], sec: x[3], sen: x[4], parte: x[5], txt: x[6], cont: x[7] ?? -1, i }; };

/* ---------- Carga de datos ---------- */
async function json(url) { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); }
async function asegurarBase() {
  if (!E.idx) E.idx = await E.idxPromise;
  if (!E.textos) E.textos = await E.txtPromise;
}

/* ---------- Consulta: frases exactas, exclusiones y palabras ---------- */
function analizar(texto) {
  const frases = [], excl = [];
  let resto = texto.replace(/[“”«»]/g, '"').replace(/"([^"]{2,})"/g, (_, f) => { frases.push(f.trim()); return ' '; });
  resto = resto.replace(/(^|\s)-([^\s-][^\s]*)/g, (_, a, w) => { excl.push(w); return ' '; });
  const libres = [...new Set(tokens(resto))].filter(t => !QSTOP.has(t));
  const deFrase = [...new Set(frases.flatMap(tokens))];
  const palabrasVisor = [...frases, ...norm(resto).split(' ').filter(w => w.length > 2 && !STOP.has(w) && !QSTOP.has(stem(w)))];
  // frase sin comillas («exceso de velocidad»): si aparece así, junta y en ese orden, esos párrafos van primero
  const libre = resto.replace(/[¿?¡!.,;:]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const fraseLibre = libres.length >= 2 && libre.length <= 8 ? libre.join(' ') : '';
  return { frases, fn: frases.map(norm), excl: excl.map(norm).filter(Boolean), libres, base: [...new Set([...libres, ...deFrase])], palabrasVisor,
    fraseLibre, fl: norm(fraseLibre) };
}

/* ---------- Búsqueda BM25 ---------- */
let vocabPref = null;
function dist1(a, b) {
  if (a === b) return true;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}
function difusos(t, idx) {
  if (t.length < 5) return [];
  if (!vocabPref) { vocabPref = {}; for (const k of Object.keys(idx.p)) (vocabPref[k.slice(0, 2)] ||= []).push(k); }
  const cand = [];
  for (const k of vocabPref[t.slice(0, 2)] || []) if (Math.abs(k.length - t.length) <= 1 && dist1(k, t)) cand.push([k, idx.p[k].length]);
  return cand.sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
}
function bm25(idx, pesos, filtro) {
  const k1 = 1.2, b = 0.6, sc = new Map(), cub = new Map();
  for (const [t, w] of pesos) {
    const pl = idx.p[t]; if (!pl) continue;
    const df = pl.length / 2, idf = Math.log(1 + (idx.N - df + 0.5) / (df + 0.5));
    for (let i = 0; i < pl.length; i += 2) {
      const k = pl[i], tf = pl[i + 1];
      if (filtro && !filtro(idx.ref[2 * k])) continue;
      sc.set(k, (sc.get(k) || 0) + w * idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * idx.dl[k] / idx.avgdl)));
      cub.set(k, (cub.get(k) || 0) + (w >= 0.9 ? 1 : 0.5));
    }
  }
  return { sc, cub };
}
async function buscar(texto) {
  await asegurarBase();
  const q = analizar(texto);
  if (!q.base.length) return { q, res: [], corregidos: [] };
  const pesos = new Map(q.base.map(t => [t, 1]));
  const corregidos = [];
  for (const t of q.base) if (!E.idx.p[t]) for (const c of difusos(t, E.idx)) if (!pesos.has(c)) { pesos.set(c, 0.85); corregidos.push(c); }
  const ids = new Set(E.sel);
  const { sc, cub } = bm25(E.idx, pesos, di => ids.has(E.docs[di].id));
  const necesarios = q.base.length;
  const expedientes = (texto.match(/\d{1,5}\/\d{4}/g) || []);
  const crudos = [];
  for (const [k, s] of sc) {
    const d = E.docs[E.idx.ref[2 * k]], ui = E.idx.ref[2 * k + 1];
    const u = unidad(d, ui);
    const n = norm(u.txt);
    if (q.fn.length && !q.fn.every(f => n.includes(f))) continue;                 // frase exacta obligatoria
    if (q.excl.length && q.excl.some(x => (' ' + n + ' ').includes(' ' + x))) continue;
    const cov = Math.min(1, (cub.get(k) || 0) / necesarios);
    if (necesarios >= 2 && cov < 0.5 && !q.fn.length) continue;                  // relevancia mínima
    // índices, anexos y páginas preliminares (numeración romana) repiten términos: van después del cuerpo del documento
    const sec = u.sec || u.cap || '';
    const secundario = /^(Anexo|Contenido|Índice|Glosario)/i.test(sec) || /^[IVXLC]+$/i.test(String(u.lp));
    // número de expediente (p. ej. «ADR 1596/2014»): primero el estudio de esa sentencia
    const exp = expedientes.length && u.sen && expedientes.some(x => u.sen.includes(x)) ? 2.5 : 1;
    const frase = !!q.fl && (' ' + n + ' ').includes(' ' + q.fl + ' ');
    crudos.push({ d, u, v: s * (0.25 + 0.75 * cov) * (cov === 1 ? 1.3 : 1) * (secundario ? 0.45 : 1) * exp * (frase ? 1.8 : 1), cov, frase });
  }
  // páginas (o artículos, en leyes): su relevancia es la de su mejor párrafo; los párrafos se muestran en orden de lectura
  const grupos = new Map();
  for (const r of crudos) {
    const clave = r.d.id + '|' + (r.d.modo === 'art' ? 'u' + r.u.i : r.u.p);
    if (!grupos.has(clave)) grupos.set(clave, { d: r.d, p: r.u.p, v: 0, us: [], frase: false, tambien: [] });
    const g = grupos.get(clave);
    g.vs = (g.vs || []).concat(r.v); g.us.push(r.u); g.frase = g.frase || r.frase;
  }
  // relevancia de la página: su mejor párrafo más la mitad de los demás (más coincidencias, más relevante)
  for (const g of grupos.values()) { g.vs.sort((a, b) => b - a); g.v = g.vs[0] + 0.5 * g.vs.slice(1).reduce((a, x) => a + x, 0); }
  const lista = [...grupos.values()].sort((a, b) => b.v - a.v || a.p - b.p);
  for (const g of lista) g.us.sort((a, b) => a.i - b.i);
  const tope = lista.length ? lista[0].v : 0;
  // texto repetido (el documento resume el mismo caso en dos apartados): se agrupa en un solo resultado
  const res = [];
  for (const g of lista.filter(x => x.v >= tope * 0.12)) {
    const igual = res.find(x => x.d === g.d && parecidos(x.us.map(y => y.txt).join(' '), g.us.map(y => y.txt).join(' ')));
    if (!igual) { g.firma = g.us[0].txt; res.push(g); continue; }
    const copia = { p: g.p, u: g.us[0] };
    if (g.p < igual.p) {                                    // el texto principal es el que aparece primero en el documento
      igual.tambien.push({ p: igual.p, u: igual.us[0] });
      Object.assign(igual, { p: g.p, us: g.us, frase: igual.frase || g.frase });
    } else igual.tambien.push(copia);
  }
  for (const g of res) g.tambien.sort((a, b) => a.p - b.p);
  return { q, res, pesos, corregidos, agrupados: res.reduce((a, g) => a + g.tambien.length, 0) };
}
function palabrasDe(t) { return new Set(norm(t).split(' ').filter(w => w.length > 2)); }
// mismo texto: al menos el 90% de las palabras del texto más corto están en el otro (mínimo 15 palabras distintas) y el largo no difiere más del doble
function parecidos(a, b) {
  if (Math.min(a.length, b.length) < 80 || Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.5) return false;
  const A = palabrasDe(a), B = palabrasDe(b);
  if (Math.min(A.size, B.size) < 15) return false;          // celdas de tablas o títulos sueltos no se agrupan
  let comun = 0; for (const w of A) if (B.has(w)) comun++;
  return comun / Math.min(A.size, B.size) >= 0.9;
}

/* ---------- Fragmento con términos resaltados ---------- */
function marcas(texto, terms, frases) {
  const p = plano(texto), pos = [];
  for (const m of p.matchAll(/[a-z0-9]+/g)) if (terms.has(stem(m[0]))) pos.push([m.index, m.index + m[0].length]);
  for (const f of frases) {
    if (!f) continue;
    const fp = plano(f); let i = p.indexOf(fp);
    while (i >= 0) { pos.push([i, i + fp.length]); i = p.indexOf(fp, i + 1); }
  }
  pos.sort((a, b) => a[0] - b[0]);
  const lim = []; for (const x of pos) { if (lim.length && x[0] <= lim[lim.length - 1][1]) lim[lim.length - 1][1] = Math.max(lim[lim.length - 1][1], x[1]); else lim.push([...x]); }
  return lim;
}
function pintar(texto, lim, ini, fin) {
  let h = '', c = ini;
  for (const [a, b] of lim) { if (a < ini || b > fin) continue; h += esc(texto.slice(c, a)) + '<mark>' + esc(texto.slice(a, b)) + '</mark>'; c = b; }
  return h + esc(texto.slice(c, fin));
}
// Resumen: ventana alrededor de la primera coincidencia (la frase completa, si está); si el párrafo es corto, va entero
const CORTO = 420;
function fragmento(texto, terms, frases, largo = 320) {
  const lim = marcas(texto, terms, frases);
  if (texto.length <= CORTO) return pintar(texto, lim, 0, texto.length);
  const fr = frases.filter(Boolean).map(plano), p = plano(texto);
  const enFrase = fr.map(f => p.indexOf(f)).filter(i => i >= 0).sort((a, b) => a - b)[0];
  const primera = enFrase ?? (lim.length ? lim[0][0] : 0);
  let ini = Math.max(0, primera - 90), fin = Math.min(texto.length, ini + largo);
  if (fin === texto.length) ini = Math.max(0, fin - largo);
  if (ini > 0) { const s = texto.indexOf(' ', ini); if (s > 0 && s < ini + 30) ini = s + 1; }
  if (fin < texto.length) { const s = texto.lastIndexOf(' ', fin); if (s > ini + 100) fin = s; }
  return (ini > 0 ? '… ' : '') + pintar(texto, lim, ini, fin) + (fin < texto.length ? ' …' : '');
}
// Párrafo completo, de la primera a la última palabra; si sigue en la página siguiente, se une
function parrafoCompleto(d, i) {
  let u = unidad(d, i), texto = u.txt, hasta = u.p;
  for (let k = 0; u.cont >= 0 && k < 3; k++) { u = unidad(d, u.cont); texto += ' ' + u.txt; hasta = u.p; }
  return { texto, hasta };
}

/* ---------- Preguntas frecuentes ---------- */
function rankFAQ(texto) {
  const qn = norm(texto);
  const base = [...new Set(tokens(texto))].filter(t => !QSTOP.has(t));
  if (!base.length) return [];
  const GEN = new Map([['control', 0.3], ['preventi', 0.3], ['provisi', 0.3], ['scjn', 0.2], ['corte', 0.3]]);
  const peso = t => GEN.get(t) ?? 1;
  const total = base.reduce((a, t) => a + peso(t), 0);
  const out = [];
  for (const f of E.faq) {
    if (!f._k) { f._k = new Set(tokens(f.q + ' ' + f.kw + ' ' + f.v.join(' '))); f._q = new Set(tokens(f.q + ' ' + f.v.join(' '))); f._f = [f.q, ...f.v].map(norm); }
    let m = 0, enQ = 0, n = 0;
    for (const t of base) if (f._k.has(t)) { m += peso(t); n++; if (f._q.has(t)) enQ++; }
    const exacta = f._f.includes(qn) ? 0.4 : 0;
    if (m > 0) out.push({ f, n, nb: base.length, s: m / total + enQ * 0.08 + exacta });
  }
  return out.sort((a, b) => b.s - a.s);
}
function buscarFAQ(texto) {
  if (/"/.test(texto)) return null;               // con comillas, el profesor busca una frase literal
  const r = rankFAQ(texto);
  return r.length && r[0].s >= 0.7 && (r[0].n >= 2 || r[0].nb === 1) ? r[0].f : null;
}
function sugerenciasHTML(texto, excluir, n = 3) {
  const r = rankFAQ(texto).filter(x => x.f !== excluir && x.s >= 0.45 && (x.n >= 2 || x.nb === 1)).slice(0, n);
  if (!r.length) return '';
  return `<p><b>Preguntas frecuentes relacionadas</b></p><div class="te-refieres">${r.map(x => `<button type="button" class="sug" data-faq="${x.f.id}">${esc(x.f.q)}</button>`).join('')}</div>`;
}
function botonIr(d, p, pal, txt, frase) {
  return `<button type="button" class="btn-ir" data-ir="${d.id}" data-p="${p}" data-q="${esc(pal || '')}"${frase ? ' data-f="1"' : ''}>${esc(txt || 'Ir a la ' + pagTxt(d, p).replace(/^Pág\./, 'pág.'))}</button>`;
}
function botonSentencia(d, sen) {
  const url = sen && d.sentencias && d.sentencias[sen];
  return url ? `<a class="btn-lnk" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Sentencia ${esc(sen)} en la SCJN<small>(requiere internet)</small></a>` : '';
}
function responderFAQ(f) {
  const blq = f.bloques.map(b => {
    const d = E.docMap[b.d];
    const lugar = [b.sec, b.sen, b.parte].filter(Boolean).map(esc).join(' › ');
    return `<div class="faq-blq"><blockquote>«${esc(b.texto)}»</blockquote>
      <div class="ruta">${esc(d.corto)} › ${lugar} · ${esc(pagTxt(d, b.p, b.p2))}</div>
      <div class="res-acc">${botonIr(d, b.p, b.texto.split(/\s+/).slice(0, 7).join(' '))}${botonSentencia(d, b.sen)}</div></div>`;
  }).join('');
  burbuja(`<span class="etq">Pregunta frecuente · texto literal del documento</span><h2>${esc(f.q)}</h2>
    <div class="facil"><b>Lectura fácil</b><ul>${f.facil.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="facil-nota">Resumen en palabras sencillas; el fundamento es el texto literal de abajo.</p></div>
    ${blq}${acciones()}${aclaracion()}`);
}

/* ---------- Resultados de búsqueda ---------- */
function acciones() {
  const voz = 'speechSynthesis' in window ? '<button type="button" data-acc="voz">Escuchar</button>' : '';
  return `<div class="acciones">${voz}<button type="button" data-acc="pdf">Descargar PDF</button></div>`;
}
const MAXPAR = 3;
function bloqueParrafo(d, u, q, terms, anterior, oculto) {
  const frases = [...q.frases, q.fraseLibre];
  const completo = u.txt.length > CORTO || u.cont >= 0;
  const parte = u.parte && u.parte !== anterior ? `<div class="par-parte">${esc(u.parte)}</div>` : '';
  return `<div class="par${oculto ? ' par-oculto' : ''}"${oculto ? ' hidden' : ''}>${parte}<div class="frag">${fragmento(u.txt, terms, frases)}</div>
    ${completo ? `<button type="button" class="btn-ver" data-d="${d.id}" data-i="${u.i}">Ver párrafo completo${u.cont >= 0 ? ` <small>(continúa en la ${esc(pagTxt(d, unidad(d, u.cont).p).replace(/^Pág\./, 'pág.').replace(/ \(PDF (\d+)\)$/, ' · PDF $1'))})</small>` : ''}</button><div class="txt"></div>` : ''}</div>`;
}
function tarjeta(g, q, terms) {
  const d = g.d, u = g.us[0];
  const conFrase = g.frase && q.fraseLibre;
  const pal = q.frases.length ? q.frases.join(' ') : (conFrase ? q.fraseLibre : q.palabrasVisor.join(' '));
  const literal = q.frases.length === 1 && !q.libres.length || conFrase ? '1' : '';
  const irTxt = (p, uu) => d.modo === 'art' && uu.sec ? `Ir al ${uu.sec.replace(/^Artículo/, 'artículo')} (${pagTxt(d, p).replace(/^Pág\./, 'pág.')})` : '';
  let ant = '';
  const pars = g.us.map((x, k) => { const h = bloqueParrafo(d, x, q, terms, ant, k >= MAXPAR); ant = x.parte; return h; }).join('');
  const demas = g.us.length > MAXPAR ? `<button type="button" class="btn-demas">Ver los demás (${g.us.length - MAXPAR})</button>` : '';
  const tambien = g.tambien.length ? `<div class="tambien"><b>Este mismo texto aparece también en:</b>${g.tambien.map(t =>
      `<div class="tb-fila"><span>${esc(pagTxt(d, t.p))} · ${esc(t.u.sec || t.u.cap || '')}${t.u.sen ? ' › ' + esc(t.u.sen) : ''}</span>${botonIr(d, t.p, pal, 'Ir a la ' + pagTxt(d, t.p).replace(/^Pág\./, 'pág.'), literal)}</div>`).join('')}</div>` : '';
  return `<div class="resultado">
    <div class="ruta">${ruta(d, u)}</div>
    <div class="ref">${esc(u.sen ? (u.sec || u.cap) : (u.sec || u.cap || d.corto))} <span class="pag-chip">${esc(pagTxt(d, g.p))}</span>${g.us.length > 1 ? ` <span class="n-par">${g.us.length} párrafos</span>` : ''}</div>
    ${pars}${demas}
    <div class="res-acc">${botonIr(d, g.p, pal, irTxt(g.p, u), literal)}${botonSentencia(d, u.sen)}</div>
    ${tambien}</div>`;
}
const BUSQ = new Map(); let nBusq = 0;
async function responderBusqueda(texto, { faq = null } = {}) {
  const espera = (E.idx && E.textos) ? null : escribiendo();
  let r;
  try { r = await buscar(texto); } finally { if (espera) espera.remove(); }
  if (!r.res.length) return noEncontrado(texto, r);
  const id = ++nBusq; BUSQ.set(id, { ...r, mostrados: 0 });
  const nDocs = new Set(r.res.map(x => x.d.id)).size;
  const filtro = E.sel.size < E.docs.length ? ` · buscando en ${E.sel.size} de ${E.docs.length} documentos` : '';
  const m = burbuja(`<span class="etq">Resultados de búsqueda</span>
    <div class="res-cab"><h2>«${esc(texto)}»</h2><span class="total">${r.res.length} resultado${r.res.length > 1 ? 's' : ''} en ${nDocs} documento${nDocs > 1 ? 's' : ''}${filtro}${r.agrupados ? ` · ${r.agrupados} página${r.agrupados > 1 ? 's' : ''} con texto repetido agrupada${r.agrupados > 1 ? 's' : ''}` : ''}</span></div>
    ${r.corregidos.length ? `<p class="sug-dif">También incluí palabras parecidas, por si hubo un error de escritura.</p>` : ''}
    ${faq ? '' : sugerenciasHTML(texto)}
    <div class="lista" data-busq="${id}"></div>
    ${acciones()}${aclaracion()}`);
  mostrarMas(id, m.querySelector('.lista'));
}
function mostrarMas(id, lista) {
  const b = BUSQ.get(id); if (!b) return;
  const terms = new Set(b.pesos.keys());
  const tanda = b.res.slice(b.mostrados, b.mostrados + CONFIG.porTanda);
  b.mostrados += tanda.length;
  lista.querySelector('.btn-mas')?.remove();
  lista.insertAdjacentHTML('beforeend', tanda.map(x => tarjeta(x, b.q, terms)).join(''));
  if (b.mostrados < b.res.length)
    lista.insertAdjacentHTML('beforeend', `<button type="button" class="btn-mas" data-mas="${id}">Mostrar ${Math.min(CONFIG.porTanda, b.res.length - b.mostrados)} resultados más (quedan ${b.res.length - b.mostrados})</button>`);
}
function noEncontrado(texto, r) {
  const q = r.q || analizar(texto);
  let alt = '';
  if (E.idx && q.base.length) {
    const sug = q.base.flatMap(t => E.idx.p[t] ? [] : difusos(t, E.idx));
    if (sug.length) {
      // muestra una palabra real del documento que corresponde a la raíz sugerida
      const palabra = k => { for (const [, us] of Object.entries(E.textos || {})) for (const u of us) { const m = plano(u[6]).match(new RegExp('\\b' + k + '[a-z]*')); if (m) return m[0]; } return k; };
      alt = `<p class="sug-dif">¿Quisiste decir ${[...new Set(sug.map(palabra))].slice(0, 3).map(w => `<button type="button" data-buscar="${esc(w)}">${esc(w)}</button>`).join(', ')}?</p>`;
    }
  }
  const filtro = E.sel.size < E.docs.length ? `<p>Estás buscando sólo en ${E.sel.size} de ${E.docs.length} documentos. <button type="button" class="sug" data-acc="todos">Buscar en todos</button></p>` : '';
  burbuja(`<span class="etq">Sin coincidencias</span><p>No encontré <b>«${esc(texto)}»</b> en ${E.docs.length === 1 ? 'el documento cargado' : 'los documentos seleccionados'}. Para no darte un dato equivocado, no respondo nada que no esté en ellos.</p>
    ${alt}${filtro}${sugerenciasHTML(texto)}
    <p>Prueba con otras palabras, quita las comillas o revisa <button type="button" class="sug" data-acc="ayuda">cómo buscar</button>.</p>`);
}

/* ---------- Flujo principal ---------- */
async function responder(texto) {
  texto = texto.trim(); if (!texto) return;
  burbuja(esc(texto), { usuario: true });
  if (!E.sel.size) { burbuja('<p>No hay documentos seleccionados. Elige al menos uno en <b>Buscar en</b>, abajo.</p>'); return; }
  const f = buscarFAQ(texto);
  if (f) responderFAQ(f);
  await responderBusqueda(texto, { faq: f });
}

/* ---------- Biblioteca, índice y ayuda ---------- */
function mostrarDocumentos() {
  burbuja(`<span class="etq">Documentos cargados</span><h2>${E.docs.length} documento${E.docs.length > 1 ? 's' : ''}</h2>
    ${E.docs.map(d => `<div class="doc-ficha"><h3>${esc(d.nombre)}</h3>
      <div class="meta">${esc(d.autor)}<br>${esc(d.tipo)} · ${esc(d.fecha)} · ${d.paginas} páginas${d.modo === 'art' ? ' · se cita por artículo' : ''}</div>
      <div class="res-acc">${botonIr(d, 1, '', 'Abrir documento')}${d.toc.length ? `<button type="button" class="btn-lnk" data-toc="${d.id}">Índice (${d.toc.length})</button>` : ''}
      ${d.original ? `<a class="btn-lnk" href="${esc(d.original)}" download>Descargar Word</a>` : ''}
      ${d.url ? `<a class="btn-lnk" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Fuente oficial<small>(requiere internet)</small></a>` : ''}</div></div>`).join('')}
    <p class="aclara">Para elegir en cuáles buscar, usa <b>Buscar en</b>, arriba del cuadro de búsqueda.</p>`);
}
function mostrarIndice(id) {
  const d = E.docMap[id]; if (!d) return;
  burbuja(`<span class="etq">Índice del documento</span><h2>${esc(d.corto)}</h2>
    <ul class="toc">${d.toc.map(([t, p, n]) => `<li class="n${Math.min(2, n)}"><button type="button" data-ir="${d.id}" data-p="${p}" data-q="">${esc(t)}</button><span class="pg">${esc(pagTxt(d, p))}</span></li>`).join('')}</ul>`);
}
function mostrarTodas() {
  burbuja(`<span class="etq">Preguntas frecuentes</span><h2>${E.faq.length} preguntas por tema</h2>
    <p>Cada respuesta es texto literal del documento, con su página.</p>
    ${E.cats.map(([c, t]) => { const fs = E.faq.filter(f => f.cat === c); return fs.length ? `<details class="cat"><summary>${esc(t)} (${fs.length})</summary>${fs.map(f => `<button type="button" class="sug" data-faq="${f.id}">${esc(f.q)}</button>`).join('')}</details>` : ''; }).join('')}`);
}
function mostrarAyuda() {
  burbuja(`<div class="ayuda"><span class="etq">Cómo buscar</span><h2>Funciona como un buscador</h2>
    <dl><dt>sospecha razonable</dt><dd>Páginas donde aparecen esas palabras (primero, las que tienen todas).</dd>
    <dt>"actitud evasiva"</dt><dd>Entre comillas: la frase exacta.</dd>
    <dt>inspección -domicilio</dt><dd>Con guion: excluye las páginas que contienen esa palabra.</dd>
    <dt>ADR 1596/2014</dt><dd>Número de expediente de una sentencia.</dd>
    <dt>¿qué es la flagrancia?</dt><dd>Si coincide con una pregunta frecuente, primero verás la respuesta literal del documento.</dd></dl>
    <p>No importan los acentos ni las mayúsculas. Si escribes mal una palabra, busco también las parecidas.</p>
    <p>En cada resultado, <b>Ir a la pág.</b> abre el documento en esa página, con tus palabras resaltadas. En el visor tienes <b>Pantalla completa</b> e <b>Ir al PDF</b> (abre el archivo original en otra pestaña para descargarlo o imprimirlo).</p></div>`);
}

/* ---------- Visor PDF integrado (PDF.js, funciona sin internet) ---------- */
let visorDoc = null;
function abrirVisor(id, p, palabras, frase) {
  const d = E.docMap[id]; if (!d) return;
  visorDoc = d;
  const hash = `#page=${p}&zoom=page-width` + (palabras ? `&search=${encodeURIComponent(palabras)}${frase ? '&phrase=true' : ''}` : '');
  $('#visorMarco').src = `visor/web/viewer.html?file=${encodeURIComponent('../../' + d.pdf)}${hash}`;
  $('#visorTit').textContent = d.corto;
  $('#visorPag').textContent = pagTxt(d, p) + (palabras ? ' · resaltado: ' + palabras.slice(0, 60) : '');
  $('#vIr').href = `${d.pdf}#page=${p}`;
  const v = $('#visor'); v.hidden = false; v.classList.remove('completa'); $('#vSalirCompleta').hidden = true;
  document.body.classList.add('visor-abierto');
  $('#vCerrar').focus();
}
function cerrarVisor() {
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  $('#visor').hidden = true; $('#visorMarco').src = 'about:blank';
  document.body.classList.remove('visor-abierto'); visorDoc = null;
}
function pantallaCompleta() {
  const v = $('#visor');
  const pedir = v.requestFullscreen || v.webkitRequestFullscreen;
  v.classList.add('completa'); $('#vSalirCompleta').hidden = false;
  if (pedir) { try { const pr = pedir.call(v); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
}
function salirCompleta() {
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  $('#visor').classList.remove('completa'); $('#vSalirCompleta').hidden = true;
}
// La página que el usuario está viendo en el visor actualiza «Ir al PDF»
setInterval(() => {
  if (!visorDoc) return;
  try {
    const app = $('#visorMarco').contentWindow.PDFViewerApplication;
    const p = app && app.page;
    if (p) { $('#vIr').href = `${visorDoc.pdf}#page=${p}`; $('#visorPag').textContent = pagTxt(visorDoc, p); }
  } catch (e) {}
}, 1200);

/* ---------- Filtro de documentos ---------- */
function pintarFiltro() {
  const t = E.sel.size === E.docs.length ? (E.docs.length === 1 ? E.docs[0].corto : 'todos los documentos') : `${E.sel.size} de ${E.docs.length} documentos`;
  $('#filtroTxt').textContent = t;
  $('#panelFiltro').innerHTML = `<div class="pf-acc"><button type="button" data-pf="todos">Todos</button><button type="button" data-pf="ninguno">Ninguno</button></div>` +
    E.docs.map(d => `<label><input type="checkbox" value="${d.id}"${E.sel.has(d.id) ? ' checked' : ''}> <span><b>${esc(d.corto)}</b><br><small>${esc(d.tipo)} · ${d.paginas} págs.</small></span></label>`).join('');
}
function guardarSel() { try { localStorage.setItem('madp-sel', JSON.stringify([...E.sel])); } catch (e) {} }

/* ---------- Sugerencias ---------- */
const CHIPS = { que_es: '¿Qué es el control preventivo?', grados: 'Grados de intensidad', niveles: 'Niveles de contacto', flagrancia: 'Diferencia con flagrancia',
  sospecha: 'Sospecha razonable', nerviosa: 'Actitud nerviosa', evasiva: 'Actitud evasiva', violenta: 'Actitud violenta', transito: 'Infracción de tránsito',
  denuncia: 'Denuncia informal', vehiculo: 'Inspección de vehículos', forzosa: 'Inspección forzosa', domicilio: 'Entrar a un domicilio', mochila: 'Revisión de mochilas', parametros: 'Qué debe probar la autoridad' };
function pintarSugerencias() {
  const caja = $('#sugerencias'); caja.innerHTML = '';
  const extra = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-fijo'; b.textContent = t; b.onclick = fn; caja.appendChild(b); };
  extra('Preguntas frecuentes', mostrarTodas);
  extra('Documentos', mostrarDocumentos);
  extra('Cómo buscar', mostrarAyuda);
  for (const f of E.faq) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = CHIPS[f.id] || f.q;
    b.onclick = () => { burbuja(esc(f.q), { usuario: true }); responderFAQ(f); }; caja.appendChild(b);
  }
}
function saludo() {
  const pags = E.docs.reduce((a, d) => a + d.paginas, 0);
  burbuja(`<div class="saludo"><h1>${esc(SALUDO)}</h1>
    <div class="limites">Escribe <b>palabras clave</b> o una pregunta. Te muestro en qué documento y en qué página aparecen, y con un clic te llevo a esa página.
    Sólo respondo con el texto de los documentos cargados: si algo no está ahí, te lo digo. No guardo tus búsquedas.</div>
    <p>Prueba con: <button type="button" class="sug" data-buscar="sospecha razonable">sospecha razonable</button> <button type="button" class="sug" data-buscar="&quot;actitud evasiva&quot;">"actitud evasiva"</button> <button type="button" class="sug" data-buscar="inspección de vehículos">inspección de vehículos</button></p>
    <p class="aclara">Base al ${esc(E.corte)}: ${E.docs.length} documento${E.docs.length > 1 ? 's' : ''}, ${pags} páginas, ${E.idx ? E.idx.N : '…'} fragmentos indexados.</p></div>`);
}

/* ---------- Acciones dentro de las respuestas ---------- */
document.addEventListener('click', async ev => {
  const ir = ev.target.closest('[data-ir]');
  if (ir) { abrirVisor(ir.dataset.ir, +ir.dataset.p, ir.dataset.q, ir.dataset.f === '1'); return; }
  const dm = ev.target.closest('.btn-demas');
  if (dm) { dm.closest('.resultado').querySelectorAll('.par-oculto').forEach(x => { x.hidden = false; }); dm.remove(); return; }
  const v = ev.target.closest('.btn-ver');
  if (v) {
    const caja = v.nextElementSibling, frag = v.parentElement.querySelector('.frag');
    if (caja.innerHTML) { caja.innerHTML = ''; frag.hidden = false; v.firstChild.textContent = 'Ver párrafo completo'; return; }
    const d = E.docMap[v.dataset.d], { texto, hasta } = parrafoCompleto(d, +v.dataset.i);
    const b = BUSQ.get(+v.closest('.lista').dataset.busq);
    const terms = b ? new Set(b.pesos.keys()) : new Set(), frases = b ? [...b.q.frases, b.q.fraseLibre] : [];
    const u = unidad(d, +v.dataset.i);
    caja.innerHTML = `<div class="texto-completo">${pintar(texto, marcas(texto, terms, frases), 0, texto.length)}</div>
      <div class="meta">Párrafo completo · ${esc(pagTxt(d, u.p, hasta !== u.p ? hasta : null))}</div>`;
    frag.hidden = true; v.firstChild.textContent = 'Ocultar párrafo completo';
    return;
  }
  const mas = ev.target.closest('[data-mas]');
  if (mas) { mostrarMas(+mas.dataset.mas, mas.closest('.lista')); return; }
  const toc = ev.target.closest('[data-toc]');
  if (toc) { mostrarIndice(toc.dataset.toc); return; }
  const bq = ev.target.closest('[data-buscar]');
  if (bq) { responder(bq.dataset.buscar); return; }
  const a = ev.target.closest('[data-acc="pdf"]');
  if (a) { imprimir(a.closest('.burbuja')); return; }
  const sug = ev.target.closest('[data-faq]');
  if (sug) { const f = E.faq.find(x => x.id === sug.dataset.faq); if (f) { burbuja(esc(f.q), { usuario: true }); responderFAQ(f); } return; }
  const pf = ev.target.closest('[data-pf]');
  if (pf) { E.sel = new Set(pf.dataset.pf === 'todos' ? E.docs.map(d => d.id) : []); guardarSel(); pintarFiltro(); return; }
  if (!ev.target.closest('#filtro') && !$('#panelFiltro').hidden) { $('#panelFiltro').hidden = true; $('#btnFiltro').setAttribute('aria-expanded', 'false'); }
  const accion = ev.target.closest('[data-acc]'); if (!accion) return;
  const tipo = accion.dataset.acc;
  if (tipo === 'voz') return leer(accion);
  if (tipo === 'ayuda') return mostrarAyuda();
  if (tipo === 'todos') { E.sel = new Set(E.docs.map(d => d.id)); guardarSel(); pintarFiltro(); return; }
});
document.addEventListener('change', ev => {
  const c = ev.target.closest('#panelFiltro input[type=checkbox]'); if (!c) return;
  if (c.checked) E.sel.add(c.value); else E.sel.delete(c.value);
  guardarSel(); pintarFiltro();
});

/* ---------- Leer en voz alta (voz del propio dispositivo) ---------- */
let leyendo = null;
function leer(btn) {
  const sintesis = window.speechSynthesis;
  if (leyendo === btn) { sintesis.cancel(); btn.textContent = 'Escuchar'; leyendo = null; return; }
  sintesis.cancel(); if (leyendo) leyendo.textContent = 'Escuchar';
  const b = btn.closest('.burbuja');
  const partes = [b.querySelector('h2')?.innerText || ''];
  if (E.facil && b.querySelector('.facil')) partes.push(b.querySelector('.facil').innerText);
  else b.querySelectorAll('blockquote, .frag').forEach(x => partes.push(x.innerText));
  const u = new SpeechSynthesisUtterance(partes.join('. ').replace(/\s+/g, ' ').slice(0, 4000));
  u.lang = 'es-MX'; u.rate = 0.95;
  const voz = sintesis.getVoices().find(v => v.lang && v.lang.startsWith('es'));
  if (voz) u.voice = voz;
  u.onend = u.onerror = () => { btn.textContent = 'Escuchar'; leyendo = null; };
  leyendo = btn; btn.textContent = 'Detener'; sintesis.speak(u);
}

/* ---------- Exportar a PDF (impresión de la respuesta) ---------- */
function imprimir(b) {
  const z = $('#zonaImpresion');
  const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  z.innerHTML = `<div class="imp-cab"><div><b style="font-family:var(--f-display);font-size:14pt;color:#3A1560">MADP_Bot v${CONFIG.version} · Maestría en Alta Dirección Policial</b><br>
    <span style="font-size:9pt">Generado el ${hoy} · Base de documentos al ${esc(E.corte)}</span></div><img src="assets/logo-cges.png" alt=""></div>
    ${b.innerHTML}<div class="imp-pie">Texto tomado literalmente de los documentos cargados en MADP_Bot. Verifica siempre en la página indicada del documento original.</div>`;
  z.querySelectorAll('.txt').forEach(x => { if (!x.innerHTML) x.remove(); });
  z.querySelectorAll('.res-acc, .btn-mas, .btn-ver, .btn-demas, .tb-fila .btn-ir').forEach(x => x.remove());
  z.querySelectorAll('[hidden]').forEach(x => { x.hidden = false; });
  document.body.classList.add('imprimiendo');
  const fin = () => { document.body.classList.remove('imprimiendo'); z.innerHTML = ''; window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  setTimeout(() => window.print(), 50);
}

/* ---------- Instalación ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); E.instalarEvt = e; setTimeout(sugerirInstalar, 4000); });
function sugerirInstalar() {
  if (E.instaladoMostrado || matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!E.instalarEvt && !ios) return;
  E.instaladoMostrado = true;
  const p = $('#instalar'); p.hidden = false;
  if (ios) { $('#instTxt').textContent = 'En Safari toca Compartir y luego «Agregar a inicio». Funcionará sin internet.'; $('#instSi').hidden = true; $('#instNo').textContent = 'Entendido'; }
  $('#instSi').onclick = async () => { p.hidden = true; if (E.instalarEvt) { E.instalarEvt.prompt(); E.instalarEvt = null; } };
  $('#instNo').onclick = () => { p.hidden = true; };
}

/* ---------- Conexión ---------- */
function estadoRed() {
  const a = $('#avisoRed');
  a.hidden = navigator.onLine;
  a.textContent = 'Sin conexión: MADP_Bot funciona con los documentos guardados en tu dispositivo. Los enlaces a la SCJN y a fuentes oficiales requieren internet.';
}
addEventListener('online', estadoRed); addEventListener('offline', estadoRed);

/* ---------- Arranque ---------- */
async function iniciar() {
  $('#btnMenu').onclick = () => { const c = $('#cab'), ab = !c.classList.contains('abierto'); c.classList.toggle('abierto', ab); $('#btnMenu').setAttribute('aria-expanded', String(ab)); };
  $('#btnFacil').onclick = () => { E.facil = !E.facil; document.body.classList.toggle('facil-on', E.facil); $('#btnFacil').setAttribute('aria-checked', String(E.facil)); };
  $('#btnTexto').onclick = () => { E.esc = E.esc >= 1.3 ? 1 : +(E.esc + 0.15).toFixed(2); document.documentElement.style.setProperty('--esc', E.esc); };
  $('#btnDocs').onclick = mostrarDocumentos;
  $('#btnFiltro').onclick = () => { const p = $('#panelFiltro'); p.hidden = !p.hidden; $('#btnFiltro').setAttribute('aria-expanded', String(!p.hidden)); };
  $('#vCerrar').onclick = cerrarVisor; $('#vCompleta').onclick = pantallaCompleta; $('#vSalirCompleta').onclick = salirCompleta;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#visor').hidden && !$('#visor').classList.contains('completa')) cerrarVisor(); });
  const ta = $('#entrada');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#formEntrada').requestSubmit(); } });
  $('#formEntrada').onsubmit = e => { e.preventDefault(); const t = ta.value; ta.value = ''; ta.style.height = 'auto'; responder(t); };
  estadoRed();
  try {
    const [docs, faq] = await Promise.all([json('data/docs.json'), json('data/faq.json')]);
    E.docs = docs.docs; E.corte = docs.corte; E.faq = faq.faq; E.cats = faq.categorias || [];
    for (const d of E.docs) E.docMap[d.id] = d;
    let guardada = null; try { guardada = JSON.parse(localStorage.getItem('madp-sel') || 'null'); } catch (e) {}
    E.sel = new Set((guardada || []).filter(id => E.docMap[id]));
    if (!E.sel.size) E.sel = new Set(E.docs.map(d => d.id));
    E.idxPromise = json('data/indice.json'); E.txtPromise = json('data/textos.json');
    E.idx = await E.idxPromise;
    E.txtPromise.then(x => { E.textos = x; }).catch(() => {});
  } catch (e) {
    burbuja('<p>No pude cargar los documentos. Revisa tu conexión e inténtalo de nuevo.</p>');
    return;
  }
  pintarFiltro();
  saludo();
  pintarSugerencias();
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }
  setTimeout(sugerirInstalar, 6000);
}
document.addEventListener('DOMContentLoaded', iniciar);
