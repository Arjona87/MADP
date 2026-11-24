"""Genera el Excel índice de MADP_Bot (Base_MADP_v1.xlsx). Se usa una sola vez; después el Excel se edita a mano."""
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

COLS = [
    ('#', 6, 'Número de 3 dígitos. Debe coincidir con el inicio del nombre del archivo (001_…).'),
    ('Título oficial', 52, 'Título completo, tal como aparece en el documento.'),
    ('Autor o institución', 30, 'Quién lo emite o lo escribe.'),
    ('Tipo de documento', 24, 'Elegir de la lista. Ley, Código, Reglamento y Constitución se citan por artículo.'),
    ('Fecha de publicación o última reforma', 18, 'dd/mm/aaaa, o el texto que aparezca en el documento.'),
    ('Estatus', 14, 'Vigente, Abrogado (histórico), Por confirmar…'),
    ('URL oficial', 40, 'Página oficial donde se publica el documento (botón «Fuente oficial»).'),
    ('Citación', 18, 'Por página · Por artículo · Excluido (motivo). Vacío = según el tipo.'),
    ('Nombre corto', 30, 'Cómo se muestra en los resultados.'),
    ('Alias de búsqueda', 36, 'Otras formas de nombrarlo, separadas por |'),
    ('Archivo', 46, 'Nombre exacto del archivo en la carpeta documentos/ (PDF, Word .docx o .doc).'),
    ('Notas', 30, 'Uso interno; la app no lo lee.'),
]
TIPOS = ['Cuaderno de jurisprudencia', 'Libro', 'Artículo académico', 'Sentencia', 'Tesis o jurisprudencia', 'Ley', 'Código',
         'Reglamento', 'Constitución', 'Tratado', 'Protocolo', 'Manual', 'Lineamientos', 'Acuerdo', 'Documento Word',
         'Presentación', 'Apuntes de clase', 'Otro']
CITAS = ['Por página', 'Por artículo', 'Excluido (motivo)']

FILA = [1, 'Control preventivo provisional. Cuadernos de Jurisprudencia, Justicia Penal. Sistematización de criterios hasta marzo de 2023',
        'Suprema Corte de Justicia de la Nación, Centro de Estudios Constitucionales (Isabel Montoya Ramos, Eduardo Brelandi Frontana Camacho, Carlos Ernesto Alonso Beltrán, Erwin Máximo Arellano Torres)',
        'Cuaderno de jurisprudencia', 'Octubre de 2023 (1a. ed.)', 'Vigente',
        'https://www.scjn.gob.mx/sites/default/files/publicaciones_scjn/publicacion/2024-01/CJ_JP_CONTROL%20PREVENTIVO%20DE%20PROVISIONAL_FINAL%20DIGITAL.pdf',
        'Por página', 'Cuaderno SCJN · Control preventivo provisional',
        'control preventivo provisional|cuaderno control preventivo|cuaderno de jurisprudencia|cdj control preventivo|scjn control preventivo',
        '001_CDJ_Control_preventivo_provisional.pdf', 'ISBN 978-607-552-410-8. Pág. impresa 1 = pág. 17 del PDF (la app lo toma del propio PDF).']

def main(salida):
    wb = Workbook()
    ws = wb.active; ws.title = 'Base_MADP'
    azul = PatternFill('solid', fgColor='3A1560'); lila = PatternFill('solid', fgColor='F4EEFB'); amar = PatternFill('solid', fgColor='FFF4C2')
    fino = Side(style='thin', color='D9D2E6'); borde = Border(left=fino, right=fino, top=fino, bottom=fino)
    ws['A1'] = 'MADP_Bot · Base de documentos (Excel índice)'
    ws['A1'].font = Font(name='Arial', size=14, bold=True, color='3A1560')
    ws['A2'] = ('Única fuente de verdad de la app: título, autor, tipo, fecha, URL y alias salen de aquí. '
                'Celdas amarillas = las que se capturan. La fila 5 es el documento #001 (ejemplo real). Ver hoja «Instrucciones».')
    ws['A2'].font = Font(name='Arial', size=9, italic=True, color='62587A')
    ws.merge_cells('A2:L2')
    for j, (h, w, nota) in enumerate(COLS, 1):
        c = ws.cell(row=4, column=j, value=h)
        c.font = Font(name='Arial', size=10, bold=True, color='FFFFFF'); c.fill = azul
        c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center'); c.border = borde
        ws.column_dimensions[c.column_letter].width = w
        from openpyxl.comments import Comment
        c.comment = Comment(nota, 'MADP_Bot')
    ws.row_dimensions[4].height = 34
    for r in range(5, 105):
        for j in range(1, len(COLS) + 1):
            c = ws.cell(row=r, column=j)
            c.font = Font(name='Arial', size=10); c.border = borde
            c.alignment = Alignment(wrap_text=True, vertical='top')
            c.fill = lila if r == 5 else amar
    for j, v in enumerate(FILA, 1):
        ws.cell(row=5, column=j, value=v)
    ws.cell(row=5, column=1).number_format = '000'
    for r in range(6, 105):
        ws.cell(row=r, column=1).number_format = '000'
    dv = DataValidation(type='list', formula1='=Listas!$A$2:$A$%d' % (len(TIPOS) + 1), allow_blank=True)
    dv2 = DataValidation(type='list', formula1='=Listas!$B$2:$B$%d' % (len(CITAS) + 1), allow_blank=True, showErrorMessage=False)
    ws.add_data_validation(dv); ws.add_data_validation(dv2)
    dv.add('D5:D104'); dv2.add('H5:H104')
    ws.freeze_panes = 'C5'
    ws.auto_filter.ref = 'A4:L104'

    li = wb.create_sheet('Listas')
    li['A1'], li['B1'] = 'Tipo de documento', 'Citación'
    for c in (li['A1'], li['B1']): c.font = Font(name='Arial', bold=True)
    for i, t in enumerate(TIPOS, 2): li.cell(row=i, column=1, value=t).font = Font(name='Arial')
    for i, t in enumerate(CITAS, 2): li.cell(row=i, column=2, value=t).font = Font(name='Arial')
    li.column_dimensions['A'].width = 30; li.column_dimensions['B'].width = 20

    ins = wb.create_sheet('Instrucciones', 0)
    pasos = [
        ('Cómo agregar un documento a MADP_Bot', True),
        ('1. Pon el archivo (PDF, .docx o .doc) en la carpeta documentos/ con un número nuevo al inicio: 002_Nombre_del_documento.pdf', False),
        ('2. Agrega su fila en la hoja Base_MADP: número, título, autor, tipo, fecha, URL oficial, nombre corto, alias y nombre exacto del archivo.', False),
        ('3. Tipo Ley, Código, Reglamento, Constitución o Tratado: la app cita por artículo (y salta a la página donde empieza). Cualquier otro tipo: por página.', False),
        ('4. Los Word se convierten solos a PDF para poder abrirlos en la página exacta; el botón de descarga entrega el Word original.', False),
        ('5. Corre: python herramientas/construir_base.py --excel herramientas/Base_MADP_v1.xlsx --docs documentos --salida data', False),
        ('6. Corre la prueba: python herramientas/probar_base.py --datos data   (si dice REVISAR, no publiques).', False),
        ('7. Sube a GitHub: la carpeta data/, el archivo nuevo de documentos/ (y su PDF convertido, si era Word) y sw.js.', False),
        ('', False),
        ('Quitar un documento: en «Citación» escribe Excluido (motivo). No hace falta borrar el archivo.', False),
        ('Cambiar un documento (nueva edición o reforma): reemplaza el archivo conservando el nombre, corrige su fila y repite los pasos 5 a 7.', False),
        ('Paginación: la app toma del propio PDF la numeración impresa (romanos y arábigos) y la página física para el salto.', False),
    ]
    for i, (t, neg) in enumerate(pasos, 1):
        c = ins.cell(row=i, column=1, value=t)
        c.font = Font(name='Arial', size=13 if neg else 10, bold=neg, color='3A1560' if neg else '1C1330')
        c.alignment = Alignment(wrap_text=True, vertical='top')
    ins.column_dimensions['A'].width = 120
    wb.active = 1
    wb.save(salida)

if __name__ == '__main__':
    main(sys.argv[1])
