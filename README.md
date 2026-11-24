# MADP_Bot · v1.0

Buscador privado de los documentos de la **Maestría en Alta Dirección Policial**. Se escriben palabras clave (o una pregunta) y MADP_Bot muestra en qué documento y en qué página aparecen. Con un clic abre el documento **en esa página**, dentro de la propia app y con las palabras resaltadas.
Funciona **sin conexión** después de la primera visita y se puede instalar en el teléfono o la computadora. Misma identidad visual que el Asistente UIG (CGES/DGAPP/AA).

**No inventa nada:** todos los resultados y las 15 preguntas frecuentes son texto literal de los documentos cargados, con su página. Si algo no está en ellos, lo dice.

## Publicar en GitHub Pages
1. Sube **todo** el contenido de esta carpeta a la raíz del repositorio `MADP` (`index.html` debe quedar en la raíz, no dentro de una subcarpeta).
   Desde el navegador: **Add file → Upload files**. GitHub acepta hasta 100 archivos por carga y son unos 120, así que hazlo en **dos cargas**:
   primero arrastra sólo la carpeta `visor` y presiona **Commit changes**; después arrastra todo lo demás (archivos sueltos y las carpetas `assets`, `data`, `documentos` y `herramientas`) y vuelve a presionar **Commit changes**.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / (root) → Save.**
3. En 1 o 2 minutos queda en `https://arjona87.github.io/MADP/`. Ábrela una vez con internet; después funciona sin conexión.

Para probar en tu computadora: dentro de la carpeta, `python -m http.server 8000` y abre `http://localhost:8000` (el visor no funciona abriendo `index.html` con doble clic).

## Cómo se usa
| Escribe | Encuentra |
|---|---|
| `sospecha razonable` | Páginas con esas palabras; primero las que tienen todas |
| `"actitud evasiva"` | La frase exacta |
| `inspección -domicilio` | Excluye las páginas que contienen «domicilio» |
| `ADR 1596/2014` | El estudio de esa sentencia primero |
| `¿qué es la flagrancia?` | Si coincide con una pregunta frecuente, primero su respuesta literal |

- No importan acentos ni mayúsculas; si una palabra está mal escrita, busca también las parecidas.
- **Buscar en** (arriba del cuadro de búsqueda): elige en cuáles documentos buscar.
- **Documentos**: ficha de cada documento, **Índice** navegable (cada entrada abre su página) y **Fuente oficial**.
- En cada resultado: **Ir a la pág.** (visor integrado), **Ver párrafo completo** y, en el cuaderno de la SCJN, **Sentencia … en la SCJN** (requiere internet).
- En el visor: **Pantalla completa** e **Ir al PDF** (abre el archivo original en otra pestaña, en la página que estás viendo, para descargarlo o imprimirlo).
- Se citan dos números de página: la **impresa** del documento (la que se cita en un trabajo) y la del **PDF** (la que muestra el visor). Ejemplo: «Pág. 27 (PDF 43)».

## Qué hay en cada archivo
| Archivo | Para qué sirve |
|---|---|
| `index.html`, `styles.css`, `app.js` | La app: búsqueda, resultados, preguntas frecuentes, visor, filtro de documentos |
| `sw.js`, `manifest.webmanifest` | Funcionamiento sin conexión e instalación |
| `documentos/` | Los documentos (PDF y, si los hay, Word con su PDF convertido) |
| `data/docs.json` | Ficha de cada documento: título, autor, tipo, fecha, URL, páginas, índice, enlaces a sentencias |
| `data/textos.json`, `data/indice.json` | Texto por fragmento (con página) e índice de búsqueda |
| `data/faq.json` | 15 preguntas frecuentes con citas literales y su página |
| `visor/` | Visor PDF.js de Mozilla (licencia Apache 2.0), en español y sin internet |
| `herramientas/Base_MADP_v1.xlsx` | **Excel índice**: la única fuente de verdad de los datos de cada documento |
| `herramientas/construir_base.py` | Reconstruye `data/` desde el Excel y la carpeta `documentos/` |
| `herramientas/preguntas.py` | Genera `data/faq.json` (se detiene si una cita no es literal) |
| `herramientas/probar_base.py` | Prueba automática antes de publicar |

## Agregar documentos
Ver `ACTUALIZAR.md`.
