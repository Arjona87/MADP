#!/usr/bin/env python3
"""
MADP_Bot · Preguntas frecuentes
Genera data/faq.json. Cada respuesta es texto LITERAL del documento: se recorta de data/textos.json entre
una frase inicial y una final, en la página indicada. Si una frase no aparece, el script se detiene
(así ninguna respuesta puede contener palabras que no estén en el documento).

Uso:  python herramientas/preguntas.py --datos data
"""
import argparse, json, os, sys

# d = documento · p = página física del PDF · desde/hasta = frases exactas (inclusive)
FAQ = [
 dict(id='que_es', cat='concepto', q='¿Qué es el control preventivo provisional?',
      v=['qué es control preventivo provisional', 'definición de control preventivo provisional', 'concepto de control preventivo'],
      kw='que es definicion concepto control preventivo provisional naturaleza afectacion momentanea libertad personal restriccion temporal',
      bloques=[dict(d='001', p=18, desde='Ahora bien, la Constitución General no menciona', hasta='que está autorizada por la Constitución.'),
               dict(d='001', p=28, desde='En efecto, el control preventivo provisional es una restricción temporal', hasta='sino también en su investigación.'),
               dict(d='001', p=99, desde='Otro de los elementos del control preventivo provisional es que tiene su fundamento', hasta='en tanto se justifica en la sospecha razonable.')],
      facil=['Es una limitación breve y momentánea de la libertad de una persona, que no equivale a detenerla.',
             'No está escrita en la Constitución: la creó la Suprema Corte al interpretar el derecho a la libertad personal.',
             'Su fundamento es el artículo 21 constitucional y sólo es válida si hay una sospecha razonable.']),
 dict(id='parametros', cat='concepto', q='¿Qué datos debe aportar la autoridad para justificar un control preventivo provisional?',
      v=['parámetros constitucionales del control preventivo', 'requisitos del control preventivo provisional', 'qué debe acreditar la autoridad que detiene'],
      kw='parametros requisitos datos aportar autoridad justificar detencion hechos narrados lugar razones agentes militares',
      bloques=[dict(d='001', p=24, desde='La implementación de un control preventivo provisional se debe ceñir', hasta='no fue aportada de manera suficiente por los agentes militares.')],
      facil=['La autoridad debe probar que los hechos ocurrieron y explicar cómo detuvo a la persona.',
             'Debe decir qué hizo para detener el vehículo, en qué lugar y por qué hizo un control de grado superior.']),
 dict(id='grados', cat='concepto', q='¿Cuáles son los grados de intensidad del control preventivo provisional?',
      v=['grado menor y grado superior', 'grados del control preventivo', 'intensidad del control preventivo'],
      kw='grados intensidad grado menor superior registro profundo revision ocular superficial',
      bloques=[dict(d='001', p=31, desde='El control preventivo provisional tiene dos grados', hasta='la integridad y la vida de los propios agentes.'),
               dict(d='001', p=99, desde='El primero es el control preventivo de grado menor', hasta='el interior de algún vehículo.')],
      facil=['Hay dos grados: menor y superior.',
             'Grado menor: detener el paso un momento para pedir información y mirar por fuera.',
             'Grado superior: una revisión más profunda de la persona o del vehículo.']),
 dict(id='niveles', cat='concepto', q='¿Cuáles son los niveles de contacto para aplicar el control preventivo provisional?',
      v=['niveles de contacto', 'tres niveles de contacto', 'niveles de aproximación de la policía'],
      kw='niveles contacto inmediacion restriccion temporal detencion aproximacion escalada',
      bloques=[dict(d='001', p=36, desde='De acuerdo con la Constitución, el control preventivo provisional requiere de tres niveles', hasta='de aquellos que justifican la detención formal.'),
               dict(d='001', p=39, desde='De acuerdo con la Constitución, la autoridad debe aplicar los niveles de contacto de manera escalada', hasta='en momentos distintos.')],
      facil=['Primer nivel: el simple acercamiento entre el agente y la persona.',
             'Segundo nivel: una restricción temporal de un derecho.',
             'Tercer nivel: la detención. Los niveles se aplican de forma escalonada.']),
 dict(id='flagrancia', cat='concepto', q='¿En qué se distingue el control preventivo provisional de la flagrancia?',
      v=['diferencia entre control preventivo y flagrancia', 'control preventivo vs flagrancia', 'es lo mismo flagrancia y control preventivo'],
      kw='diferencia distincion flagrancia detencion orden aprehension caso urgente control preventivo',
      bloques=[dict(d='001', p=33, desde='Las actuaciones realizadas en el marco de un control preventivo provisional son restricciones temporales a la libertad personal que sí deben distinguirse', hasta='y deben justificarse en consecuencia.'),
               dict(d='001', p=99, desde='En efecto, la flagrancia se da cuando se detiene a la persona', hasta='no se traduce en la detención de la persona.')],
      facil=['La flagrancia es detener a alguien cuando comete el delito o justo después.',
             'El control preventivo provisional es una restricción momentánea que no es una detención.']),
 dict(id='sospecha', cat='sospecha', q='¿Qué es la sospecha razonable y por qué es indispensable?',
      v=['sospecha razonable', 'elementos de la sospecha razonable', 'sospecha razonada y objetiva'],
      kw='sospecha razonable razonada objetiva subjetiva requisito constitucional estereotipos apariencia carga prueba policia',
      bloques=[dict(d='001', p=44, desde='La sospecha razonable sí es un requisito constitucional', hasta='frente a ciertos hechos supuestamente constitutivos de delito.'),
               dict(d='001', p=49, desde='1. Las diligencias policiales que consisten en aproximarse a una persona para verificar la existencia de un delito flagrante deben fundarse', hasta='la posible comisión de un delito flagrante.')],
      facil=['Es el requisito esencial: sin ella, el control es arbitrario.',
             'Debe basarse en hechos y datos objetivos, no en corazonadas, apariencia o estereotipos.',
             'La policía tiene que probar que existía.']),
 dict(id='nerviosa', cat='sospecha', q='¿La actitud nerviosa de una persona justifica una inspección?',
      v=['actitud nerviosa', 'nerviosismo justifica revisión', 'persona nerviosa inspección'],
      kw='actitud nerviosa nerviosismo inspeccion medida seguridad excepcionalidad',
      bloques=[dict(d='001', p=52, desde='De acuerdo con una interpretación constitucional, la inspección como medida de seguridad', hasta='desde un punto de'),
               dict(d='001', p=53, desde='vista objetivo, cualquier persona', hasta='llegue a la misma determinación que la autoridad.')],
      facil=['No. La sola actitud nerviosa no basta.',
             'La autoridad debe explicar con qué información contaba, de modo que cualquier persona con esos datos llegaría a la misma conclusión.']),
 dict(id='evasiva', cat='sospecha', q='¿La actitud evasiva frente a la autoridad es suficiente para un control preventivo provisional?',
      v=['actitud evasiva', 'evadir a la policía', 'conducta evasiva sospecha'],
      kw='actitud evasiva evasion revision precautoria elementos objetivos contexto',
      bloques=[dict(d='001', p=58, desde='La actitud evasiva de una persona frente a la autoridad que detiene no es suficiente', hasta='sin otro requisito más que la apreciación subjetiva de la autoridad aprehensora.')],
      facil=['No, por sí sola no es suficiente.',
             'Se necesitan elementos objetivos y analizar el contexto de los hechos.']),
 dict(id='violenta', cat='sospecha', q='¿La actitud violenta contra la policía constituye sospecha razonada?',
      v=['actitud violenta', 'agresión a policías sospecha', 'comportamiento agresivo'],
      kw='actitud violenta agresiva grosera altanera policia sospecha razonada',
      bloques=[dict(d='001', p=60, desde='La actitud violenta en contra de autoridades policiales no constituye', hasta='con el comportamiento agresivo de un ciudadano.')],
      facil=['No, por sí sola no es sospecha razonada.',
             'La sospecha razonada exige certeza y objetividad sobre la comisión de un delito.']),
 dict(id='transito', cat='sospecha', q='¿Una infracción al reglamento de tránsito constituye sospecha razonable?',
      v=['infracción de tránsito', 'reglamento de tránsito sospecha razonable', 'estacionarse en zona prohibida'],
      kw='infraccion administrativa reglamento transito estacionarse zona prohibida multa',
      bloques=[dict(d='001', p=55, desde='La transgresión de una norma administrativa', hasta='de uso exclusivo del ejército.')],
      facil=['Sí. En el ADR 4822/2014 la Suprema Corte consideró que una infracción de tránsito sí es sospecha razonable.']),
 dict(id='denuncia', cat='sospecha', q='¿Basta una denuncia informal para hacer un control preventivo provisional?',
      v=['denuncia informal', 'denuncia anónima', 'llamada a la policía control preventivo'],
      kw='denuncia informal anonima llamada causa razonable minima grado superior coincidencia',
      bloques=[dict(d='001', p=64, desde='2. Para que una autoridad realice un acto de molestia al gobernado con motivo de una denuncia informal', hasta='en las denuncias que haya recibido la policía previamente.'),
               dict(d='001', p=72, desde='La sola existencia de una denuncia informal no es suficiente', hasta='frente a los agentes de la autoridad.')],
      facil=['La denuncia informal no basta por sí sola para un control de grado superior.',
             'Los datos deben coincidir con lo que describieron las víctimas o testigos: objetos, personas, lugar y horario.']),
 dict(id='vehiculo', cat='inspeccion', q='¿Qué requisitos debe cumplir la inspección de un vehículo?',
      v=['inspección de vehículos', 'revisión de automóvil', 'registro de un vehículo', 'juicio de proporcionalidad y juicio de urgencia'],
      kw='inspeccion revision registro vehiculo automovil juicio proporcionalidad urgencia articulo 16 privacidad',
      bloques=[dict(d='001', p=78, desde='Sin embargo, derivado de una interpretación constitucional, la decisión de realizar el registro de un vehículo exige', hasta='que se está realizando.'),
               dict(d='001', p=83, desde='1. Los parámetros de constitucionalidad referentes a la inspección de personas sí son aplicables', hasta='entre otros factores.')],
      facil=['Hacen falta dos juicios: uno de proporcionalidad (sospecha fundada) y otro de urgencia (por qué aquí y ahora).',
             'En el vehículo también hay privacidad, aunque menor: se necesita sospecha razonable.']),
 dict(id='forzosa', cat='inspeccion', q='¿Es constitucional la inspección forzosa de personas y sus posesiones?',
      v=['inspección forzosa', 'uso de la fuerza en la inspección', 'registro forzoso'],
      kw='inspeccion forzosa fuerza consentimiento registro posesiones personas',
      bloques=[dict(d='001', p=83, desde='2. La inspección de personas y sus posesiones realizada de manera forzosa es constitucional.', hasta='eficiencia, profesionalismo y honradez.')],
      facil=['Sí es constitucional, pero la fuerza no debe ser la primera opción.',
             'Primero se pide el consentimiento; sólo si se niega, se usa la fuerza estrictamente necesaria.']),
 dict(id='domicilio', cat='inspeccion', q='¿El control preventivo provisional permite entrar a un domicilio?',
      v=['ingresar al domicilio', 'entrar a una casa', 'inspección de domicilio'],
      kw='domicilio casa ingresar entrar inviolabilidad intimidad propiedad',
      bloques=[dict(d='001', p=88, desde='1. El hecho de que una persona evada a la autoridad ingresando a un domicilio', hasta='para investigar, identificar y prevenir el delito.')],
      facil=['No. El control preventivo provisional no autoriza a entrar a un domicilio.',
             'Meterse a su casa para evitar a la policía no es, por sí solo, sospecha razonable.']),
 dict(id='mochila', cat='similares', q='¿La revisión de mochilas en las escuelas es un control preventivo provisional?',
      v=['operativo mochila segura', 'revisión de mochilas', 'revisión a estudiantes'],
      kw='mochila segura escuela estudiantes centros educativos revision posesiones acto molestia',
      bloques=[dict(d='001', p=94, desde='1. La revisión de las propiedades de los estudiantes en los centros educativos no equivale', hasta='con o sin la participación de la policía u otras fuerzas de seguridad.'),
               dict(d='001', p=95, desde='Por su parte, la revisión a las posesiones de los estudiantes', hasta='no se requiere la configuración de la sospecha razonable.')],
      facil=['No. Es parecida porque también es un acto de molestia, pero es otra figura.',
             'Se hace dentro de las escuelas, sólo a estudiantes, y no requiere sospecha razonable.']),
]
CATS = [['concepto', 'Concepto, grados y niveles'], ['sospecha', 'Sospecha razonable'], ['inspeccion', 'Inspección de vehículos, personas y domicilio'],
        ['similares', 'Figuras similares']]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--datos', default='data'); a = ap.parse_args()
    textos = json.load(open(os.path.join(a.datos, 'textos.json'), encoding='utf-8'))
    docs = {d['id']: d for d in json.load(open(os.path.join(a.datos, 'docs.json'), encoding='utf-8'))['docs']}
    errores, out = [], []
    for f in FAQ:
        bloques = []
        for b in f['bloques']:
            us = [u for u in textos[b['d']] if u[0] == b['p']]
            pagina, offs = '', []
            for u in us:
                offs.append(len(pagina)); pagina += u[6] + ' '
            i = pagina.find(b['desde']); j = pagina.find(b['hasta'], max(i, 0))
            if i < 0 or j < 0:
                errores.append(f"{f['id']}: no encontré «{b['desde'][:40]}…» / «{b['hasta'][:40]}» en la pág. {b['p']}"); continue
            u = us[max(k for k, o in enumerate(offs) if o <= i)]     # fragmento donde empieza la cita
            bloques.append(dict(texto=pagina[i:j + len(b['hasta'])].strip(), d=b['d'], p=b['p'], et=docs[b['d']]['etiquetas'][b['p'] - 1],
                                sec=u[3] or u[2], sen=u[4], parte=u[5]))
        # bloques partidos entre dos páginas consecutivas: se unen en un solo párrafo
        unidos = []
        for x in bloques:
            if unidos and unidos[-1]['p'] == x['p'] - 1 and not unidos[-1]['texto'].rstrip().endswith(('.', ':', '"')):
                unidos[-1]['texto'] += ' ' + x['texto']; unidos[-1]['p2'] = x['p']; unidos[-1]['et2'] = x['et']
            else:
                unidos.append(x)
        g = {k: f[k] for k in ('id', 'cat', 'q', 'v', 'kw', 'facil')}
        g['bloques'] = unidos
        out.append(g)
    if errores:
        print('\n'.join('ERROR ' + e for e in errores)); sys.exit(1)
    json.dump({'nota': 'Preguntas frecuentes de MADP_Bot: cada respuesta es texto literal del documento citado, con su página.',
               'categorias': CATS, 'faq': out}, open(os.path.join(a.datos, 'faq.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(out)} preguntas frecuentes · {sum(len(x["bloques"]) for x in out)} citas literales verificadas')

if __name__ == '__main__':
    main()
