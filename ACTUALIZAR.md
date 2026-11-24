# Cómo agregar o actualizar documentos en MADP_Bot

**La única fuente de verdad es el Excel** `herramientas/Base_MADP_v1.xlsx` (hoja `Base_MADP`). La app nunca inventa títulos, fechas ni autores: los toma de ahí.

## Requisitos (una sola vez)
- Python 3.9 o superior: https://www.python.org/downloads/
- En una terminal: `pip install pandas openpyxl pypdf`
- Recomendado: Poppler (`pdftotext`) para una extracción de texto más limpia.
- Para documentos de Word: LibreOffice (https://www.libreoffice.org/). El script lo usa para convertir el Word a PDF y así poder abrirlo en la página exacta.

## Agregar un documento
1. Copia el archivo a la carpeta `documentos/` con un número nuevo al inicio: `002_Codigo_Nacional_de_Procedimientos_Penales.pdf`, `003_Apuntes_sesion_4.docx`.
2. En el Excel, agrega su fila: **#**, **Título oficial**, **Autor o institución**, **Tipo de documento** (lista), **Fecha**, **Estatus**, **URL oficial**, **Nombre corto**, **Alias de búsqueda** (separados por `|`) y el **Archivo** (nombre exacto).
   - Tipo **Ley, Código, Reglamento, Constitución o Tratado**: se divide y se cita **por artículo** («Artículo 268 · pág. 112»), y el botón lleva a la página donde empieza el artículo.
   - Cualquier otro tipo (cuaderno, libro, sentencia, apuntes, Word…): se cita **por página**.
   - Para forzar uno u otro, escribe en **Citación**: `Por página` o `Por artículo`.
3. Desde la carpeta raíz de la app, corre:
   ```
   python herramientas/construir_base.py --excel herramientas/Base_MADP_v1.xlsx --docs documentos --salida data
   python herramientas/preguntas.py --datos data
   python herramientas/probar_base.py --datos data
   ```
   Revisa los AVISOS. Si la prueba dice `RESULTADO: REVISAR`, no publiques hasta corregir lo que señala.
   Un aviso «páginas sin texto (¿PDF escaneado?)» significa que el PDF es una imagen: hay que pasarlo por OCR (por ejemplo, con Adobe Acrobat o `ocrmypdf`) antes de cargarlo.
4. Sube a GitHub, en una sola carga: la carpeta `data/` completa, el archivo nuevo de `documentos/` (y su PDF convertido, si era Word) y `sw.js`. GitHub reemplaza los archivos con el mismo nombre.
   El script cambia la versión de `sw.js` para que los dispositivos descarguen la base nueva.

## Cambiar o quitar un documento
- **Nueva edición o reforma:** reemplaza el archivo conservando el nombre, corrige su fila en el Excel y repite los pasos 3 y 4.
- **Quitar:** en **Citación** escribe `Excluido (motivo)` y repite los pasos 3 y 4. No hace falta borrar el archivo.

## Preguntas frecuentes
Están en `herramientas/preguntas.py`. Cada respuesta se define con la **página del PDF** y una **frase inicial y final exactas**; el script recorta el texto literal entre ambas y **se detiene si no lo encuentra**, de modo que ninguna respuesta puede contener palabras que no estén en el documento. La «Lectura fácil» de cada pregunta es un resumen en palabras sencillas y se muestra marcado como tal.
Si editas `data/faq.json` a mano, cambia el número de `const VERSION` en la línea 3 de `sw.js` (por ejemplo, fecha y hora: `202612011030`).

## Paginación
La app toma del propio PDF la numeración impresa (romanos en preliminares, arábigos en el cuerpo) y la página física para el salto. En el cuaderno de la SCJN: pág. impresa 1 = pág. 17 del PDF.

## Índice y sentencias
Si el PDF tiene marcadores (índice lateral), la app los usa para el **Índice** navegable y para indicar en cada resultado el capítulo, el apartado y la sentencia. En los Cuadernos de Jurisprudencia de la SCJN, además, enlaza cada sentencia con su versión pública en la página de la Suprema Corte.
