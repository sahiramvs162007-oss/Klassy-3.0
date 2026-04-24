/**
 * ia/iaInterpretador.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPA 3 — Motor de Interpretación Semántica (Sistema Experto FODA)
 *
 * Transforma los 4 valores numéricos del preprocesador + la predicción de
 * brain.js en un análisis FODA detallado en texto natural.
 *
 * El sistema usa bibliotecas de frases organizadas por RANGO de métrica.
 * Cada combinación de rangos produce un diagnóstico diferente — nunca
 * se repite la misma frase para perfiles distintos.
 *
 * FUNCIÓN PURA — no depende de MongoDB ni de Express.
 *
 * Uso:
 *   const { interpretarFODA } = require('./iaInterpretador');
 *   const foda = interpretarFODA(metricas, prediccion, configColegio, nombreMateria);
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Selecciona un elemento pseudoaleatorio de un array (determinista por índice). */
function elegir(arr, semilla = 0) {
  return arr[semilla % arr.length];
}

/** Mapea un valor 0-1 a un nivel cualitativo de 5 pasos. */
function nivel(valor) {
  if (valor >= 0.80) return 'muy_alto';
  if (valor >= 0.60) return 'alto';
  if (valor >= 0.40) return 'medio';
  if (valor >= 0.20) return 'bajo';
  return 'muy_bajo';
}

/** Semilla basada en las métricas para que el mismo perfil siempre produzca
 *  la misma frase (reproducibilidad), pero perfiles distintos varíen. */
function semillaDeMetricas(metricas) {
  const { nota, tendencia, compromiso, estabilidad } = metricas;
  return Math.round((nota + tendencia + compromiso + estabilidad) * 100) % 7;
}

// ── Biblioteca de frases ──────────────────────────────────────────────────────

const FRASES = {

  // ── FORTALEZAS ─────────────────────────────────────────────────────────────
  fortaleza: {

    estabilidad_alta_compromiso_alto: [
      'Demuestra una disciplina académica admirable: entrega sus compromisos con regularidad y mantiene un ritmo de aprendizaje constante que pocas veces fluctúa. Esta solidez es su mayor activo.',
      'Su nivel de constancia en esta materia es notable. Ha logrado construir un hábito de estudio que se refleja en la homogeneidad de sus resultados y en el cumplimiento sostenido de sus actividades.',
      'Evidencia un alto grado de autorregulación académica: no solo entrega a tiempo, sino que lo hace con una calidad que no varía de forma significativa entre un período y otro.',
      'La combinación de regularidad en la entrega de tareas y estabilidad en sus calificaciones es un indicador de que este estudiante tiene claridad sobre sus metas y los hábitos necesarios para alcanzarlas. Pocas fortalezas son tan valiosas como esta.',
      'Su perfil académico en esta materia refleja madurez y responsabilidad: mantiene el compromiso incluso cuando los temas se vuelven más exigentes, y sus resultados no caen de forma brusca entre evaluaciones.',
      'Lo más destacable en esta asignatura es la consistencia. Hay estudiantes que brillan en un período y desaparecen en el siguiente; este no es ese caso. El trabajo continuo y predecible es un pilar sobre el cual se construyen logros académicos duraderos.',
      'La entrega sistemática de actividades combinada con resultados homogéneos demuestra que el proceso de aprendizaje en esta materia está bien estructurado. No se trata de suerte ni de preparación de último momento, sino de trabajo sostenido.',
      'Tiene instalado algo que muchos estudiantes no logran: un ritmo propio. La regularidad en su compromiso y la estabilidad de sus notas son señales de que ha encontrado la forma de gestionar esta materia de manera efectiva.',
    ],

    solo_estabilidad: [
      'Aunque el porcentaje de tareas entregadas tiene margen de mejora, los resultados que obtiene cuando participa son consistentes y predecibles, lo cual indica que el conocimiento está bien asentado.',
      'Su rendimiento muestra una solidez interna poco común: cuando trabaja en esta materia, los resultados son coherentes y reflejan un aprendizaje genuino más que esfuerzo puntual.',
      'La consistencia de sus calificaciones sugiere que domina los conceptos centrales de la asignatura. Cada vez que entrega, el resultado es predecible y estable, lo cual habla de comprensión real y no de memorización momentánea.',
      'Hay algo que este estudiante tiene muy bien logrado en esta materia: cuando se compromete con una actividad, el resultado es sólido. Esa calidad constante es una fortaleza que puede aprovecharse para mejorar también la frecuencia de participación.',
      'Sus notas no suben ni bajan de forma dramática, lo que indica que el nivel de comprensión de la materia es real y estable. Esta base conceptual firme es el mejor punto de partida para cualquier mejora que se quiera lograr.',
      'El índice de estabilidad en esta asignatura está entre los más altos de su perfil. Eso significa que cuando estudia, estudia bien. El foco ahora debe estar en hacer eso con mayor frecuencia.',
      'Cuando este estudiante participa activamente en la materia, sus resultados son sólidos y confiables. La calidad está presente; el desafío es que aparezca con más regularidad.',
      'La homogeneidad de sus calificaciones en distintos períodos confirma que el aprendizaje en esta materia tiene raíces profundas. No depende de condiciones externas ni de días especialmente buenos: el nivel es constante.',
    ],

    solo_compromiso: [
      'Su nivel de compromiso con las actividades asignadas es una fortaleza clara. Entrega con regularidad y esto le da al docente información suficiente para acompañar su proceso de forma efectiva.',
      'La disposición que demuestra hacia el cumplimiento de tareas habla muy bien de su actitud frente al aprendizaje. Es uno de los pilares sobre los cuales puede construir mejores resultados.',
      'Entrega sus actividades con una frecuencia que supera la del grupo promedio. Esa actitud proactiva frente a los compromisos académicos es una fortaleza que trasciende la nota: habla de carácter y responsabilidad.',
      'El compromiso sostenido con las actividades de esta materia es en sí mismo un mérito. Demuestra que hay disposición real hacia el aprendizaje, y esa disposición es el ingrediente más difícil de enseñar.',
      'Participa activamente y entrega con constancia. Eso no es trivial: muchos estudiantes con mayor facilidad para el contenido dejan de entregar cuando los temas se vuelven difíciles. Este estudiante no.',
      'La regularidad en la entrega de actividades es un indicador de que el estudiante está presente en su proceso de aprendizaje. No delega en el azar ni en el último momento: hay intención detrás de su participación.',
      'Su porcentaje de tareas entregadas está por encima de lo esperado, lo cual demuestra que la materia es tomada en serio. Esa seriedad es la base sobre la que pueden construirse mejores resultados conceptuales.',
      'Muestra una actitud ejemplar frente a las obligaciones académicas de esta asignatura. Cada actividad entregada es una oportunidad de aprender y de recibir retroalimentación, y este estudiante aprovecha esas oportunidades.',
    ],

    nota_alta: [
      'Sus calificaciones en esta materia ubican su desempeño en el rango superior del grupo. Esto no es casualidad: refleja comprensión profunda y no solo memorización superficial de los contenidos.',
      'Los resultados académicos obtenidos hasta el momento son sólidos y hablan de un proceso de aprendizaje que va más allá del mínimo requerido. Está construyendo bases fuertes para los períodos que vienen.',
      'El nivel de sus calificaciones en esta asignatura es una señal clara de que los conceptos están siendo asimilados correctamente. Un promedio en este rango no se sostiene sin comprensión genuina de los temas.',
      'Sus notas en esta materia demuestran que hay un trabajo serio detrás de cada evaluación. El rendimiento alcanzado no es producto del azar sino de un proceso de estudio que está funcionando.',
      'Está rindiendo por encima de la media en esta materia. Eso significa no solo que aprueba, sino que entiende: hay una diferencia importante entre pasar y comprender, y este estudiante está en el segundo grupo.',
      'Las calificaciones obtenidas hasta el momento son un reflejo de dominio real sobre los contenidos de la asignatura. Ese nivel de desempeño es el que protege al estudiante incluso en los períodos más exigentes del año.',
      'Obtener notas altas de forma sostenida en esta materia requiere esfuerzo y comprensión. El hecho de que lo esté logrando indica que el proceso de aprendizaje está bien encaminado y que las bases son sólidas.',
      'El rendimiento en esta asignatura está claramente por encima del umbral de aprobación, lo cual genera un margen de seguridad importante para el resto del año. Ese colchón de notas es el resultado de un trabajo que merece reconocimiento.',
    ],

    tendencia_positiva: [
      'La trayectoria de sus calificaciones muestra una curva ascendente que merece destacarse. Está mejorando de forma activa y sostenida, lo cual indica que las estrategias que está usando están funcionando.',
      'Del período anterior a este, su desempeño ha mejorado de manera perceptible. Esa capacidad de superarse a sí mismo en el tiempo es una fortaleza que trasciende cualquier nota específica.',
      'La tendencia de mejora en esta materia es uno de los indicadores más positivos del análisis. Subir el rendimiento de un período a otro requiere identificar los errores anteriores y corregirlos, y eso es exactamente lo que está haciendo.',
      'Viene escalando posiciones en esta asignatura. El crecimiento sostenido entre períodos es mucho más valioso que un buen resultado aislado, porque demuestra que el aprendizaje es real y acumulativo.',
      'Cada período que pasa, sus resultados en esta materia son mejores que el anterior. Esa progresión constante es una de las señales más sanas que puede mostrar un proceso académico y merece ser reconocida y reforzada.',
      'Hay una dirección clara en su desempeño: hacia arriba. La mejora observada entre períodos no es producto del azar sino de un ajuste en el proceso de estudio que está dando frutos concretos.',
      'Su evolución en esta materia es positiva y perceptible. El estudiante que mejora constantemente, aunque no siempre llegue primero, tiene una ventaja estratégica sobre quienes se estancan: el tiempo está de su lado.',
      'Los datos muestran que en esta asignatura está en un proceso real de crecimiento. Mantener esa inercia positiva hasta el cierre del año puede cambiar de forma significativa el resultado final.',
    ],
  },

  // ── OPORTUNIDADES ──────────────────────────────────────────────────────────
  oportunidad: {

    comprometido_pero_bajo: [
      'Hay una señal muy positiva en su proceso: la disposición al trabajo es alta. El problema no es la actitud sino posiblemente la estrategia de estudio o la comprensión de algunos conceptos clave. Con acompañamiento focalizado, los resultados pueden mejorar de forma significativa.',
      'Entrega sus actividades con regularidad, lo que demuestra que hay voluntad genuina de aprender. Este es el punto de partida ideal para una intervención académica: el interés ya existe, solo hace falta ajustar el método.',
      'Su nivel de participación y entrega de actividades indica que está presente y comprometido con la materia. Aprovechar ese compromiso para trabajar los conceptos donde hay vacíos puede generar un avance rápido y visible.',
      'Tiene uno de los activos más valiosos en un proceso de aprendizaje: la disposición. El problema está en algún punto entre el esfuerzo y el resultado, y ese punto es identificable con la ayuda correcta. El terreno ya está preparado.',
      'El hecho de que entregue con regularidad pero no logre notas altas es una oportunidad disfrazada: indica que sabe trabajar, pero necesita trabajar de forma diferente. Un cambio de estrategia puede tener resultados rápidos y sorprendentes.',
      'Su compromiso con la materia es real y sostenido. Canalizarlo hacia los conceptos que generan más dificultad puede convertir ese esfuerzo existente en resultados académicos tangibles sin necesidad de esforzarse más, sino de esforzarse mejor.',
      'La brecha entre su nivel de entrega y sus calificaciones es una señal que guía directamente hacia donde está el problema. Con esa claridad, el docente puede orientar la intervención de forma muy precisa y efectiva.',
      'Muchos estudiantes fallan por falta de interés; este no es el caso. La disposición está, el trabajo está, lo que falta es afinar la comprensión de los temas base. Ese es un problema solucionable con el apoyo correcto.',
    ],

    mejorando_con_esfuerzo: [
      'Se percibe un crecimiento real entre los períodos. Si mantiene el ritmo actual de mejora y recibe orientación en los temas que aún generan dificultad, tiene el potencial de alcanzar un desempeño sobresaliente en esta materia.',
      'La tendencia positiva en sus notas sugiere que está encontrando su camino en esta asignatura. Profundizar en las áreas débiles ahora, mientras la motivación está alta, puede consolidar ese avance de forma duradera.',
      'Viene en ascenso y eso es lo que más importa en este momento. Si se aprovecha el impulso actual para reforzar los contenidos donde aún hay vacíos, la proyección para el cierre del año es claramente favorable.',
      'El esfuerzo que ha hecho en los últimos períodos está dando resultados. Esa es la señal que valida la dirección que está tomando. Ahora el reto es mantener esa dinámica y no bajar la guardia cuando los temas se vuelvan más complejos.',
      'Hay evidencia de mejora real y eso abre una ventana de oportunidad importante. El momento óptimo para consolidar un avance es mientras la inercia positiva está activa, y ese momento es ahora.',
      'La curva ascendente en sus notas es el mejor indicador de que algo está cambiando en su proceso de estudio. Identificar qué cambió y replicarlo de forma deliberada puede acelerar ese crecimiento de manera notable.',
      'Si sigue mejorando al ritmo actual, el resultado final de la materia puede ser muy diferente al punto de partida del año. La oportunidad está en no desacelerar y en buscar apoyo en los temas que todavía ofrecen resistencia.',
      'El progreso observado entre períodos indica que este estudiante es capaz de mejorar cuando se lo propone. Aprovechar esa capacidad ahora, cuando el año todavía tiene recorrido por delante, puede transformar el resultado final.',
    ],

    consistencia_alcanzable: [
      'Hay períodos donde demuestra que puede rendir muy bien en esta materia. El reto está en hacer eso constante. Identificar qué condiciones favorecen sus mejores resultados y replicarlas puede marcar una diferencia importante.',
      'Sus notas muestran que el potencial está ahí: hay momentos de buen desempeño que indican comprensión real. La oportunidad está en estabilizar ese nivel y no dejarlo depender de factores externos al estudio.',
      'Cuando rinde bien en esta materia, rinde muy bien. El problema es que esos momentos no son sistemáticos. Convertir esos picos de rendimiento en el nivel base estándar es la oportunidad más clara que tiene este estudiante.',
      'La irregularidad en sus resultados esconde una buena noticia: los períodos altos demuestran que la capacidad existe. El trabajo está en hacer que esa capacidad sea accesible de forma constante, no solo en condiciones óptimas.',
      'Entre sus calificaciones hay momentos que muestran lo que este estudiante puede lograr cuando se conecta con la materia. Esos momentos son la evidencia de que la meta es alcanzable; falta trasladarlos a la norma.',
      'Sus mejores resultados en esta asignatura son una referencia válida de lo que puede lograr cuando trabaja con foco. El objetivo es reducir la distancia entre esos picos y los resultados habituales.',
      'Hay variabilidad en sus notas, y esa variabilidad contiene información valiosa: los períodos buenos muestran dónde está el techo, y los períodos bajos muestran dónde están los obstáculos. Con esa información se puede trabajar de forma muy estratégica.',
      'La capacidad de rendir bien en esta materia ya está demostrada en algunos períodos. Lo que falta es la regularidad, y esa es una habilidad que se puede desarrollar con organización, hábito y seguimiento.',
    ],

    zona_de_rescate: [
      'El análisis del sistema sugiere que la situación actual, aunque delicada, es recuperable. Un esfuerzo dirigido en el período restante, especialmente en las actividades pendientes y la revisión de temas anteriores, puede cambiar el resultado final.',
      'Existe una ventana de oportunidad real para revertir la tendencia actual. Focalizar la energía en los puntos críticos identificados puede tener un impacto inmediato sobre el promedio.',
      'La situación en esta materia tiene solución si se actúa ahora. El tiempo disponible es suficiente para recuperar el terreno perdido, pero requiere que ese tiempo se use de forma inteligente y dirigida hacia los temas que más influyen en la nota.',
      'No es demasiado tarde. Con el período restante bien aprovechado y un esfuerzo concreto en las actividades de mayor peso, es posible cambiar el resultado final. La clave está en actuar sin demora y con un plan claro.',
      'El modelo predictivo indica que la situación no está sellada: hay margen para revertirla. Ese margen es una oportunidad que solo existe mientras el período sigue abierto. Aprovecharla requiere decisión y apoyo inmediato.',
      'Todavía hay recorrido por delante en este período y eso significa que el resultado no está escrito. Con los ajustes correctos y el apoyo del docente, la situación actual puede transformarse en un cierre positivo.',
      'La aritmética del período permite mejorar el promedio si se trabaja de forma estratégica en lo que resta. No se trata de un milagro sino de usar bien el tiempo disponible, y ese tiempo aún existe.',
      'El sistema identifica esta materia como recuperable con intervención oportuna. Esa palabra — oportuna — es clave: actuar esta semana tiene un impacto muy diferente a actuar en la última semana del período.',
    ],
  },

  // ── DEBILIDADES ────────────────────────────────────────────────────────────
  debilidad: {

    muy_inestable: [
      'El patrón de calificaciones en esta materia muestra una variabilidad significativa entre actividades y períodos. Esto puede indicar que el aprendizaje no está siendo consolidado entre una evaluación y la siguiente, o que factores externos están afectando el desempeño de forma irregular.',
      'Las notas oscilan de manera pronunciada, lo que sugiere que el nivel de preparación no es uniforme. Hay momentos de buen rendimiento que no logran sostenerse, posiblemente por falta de un hábito de estudio estructurado en esta asignatura.',
      'La inconsistencia en los resultados es la señal de alerta más relevante en este caso. No se trata de falta de capacidad, sino de irregularidad en el proceso: hay días o semanas donde el estudiante está muy presente y otros donde parece ausente del aprendizaje.',
      'Los altibajos en las calificaciones de esta materia son más pronunciados de lo esperado. Esta volatilidad dificulta predecir el resultado final y sugiere que el estudio se realiza de forma reactiva — justo antes de cada evaluación — en lugar de de forma continua.',
      'La amplitud de la variación entre sus mejores y peores resultados en esta asignatura es notable. Esa brecha indica que el conocimiento no está integrado de forma sólida: funciona cuando se activa específicamente pero no se sostiene en el tiempo.',
      'Sus calificaciones suben y bajan sin un patrón claro, lo que dificulta identificar en qué conceptos específicos hay dificultad. Se recomienda una revisión con el docente para identificar los temas que generan más inconsistencia.',
      'La inestabilidad en los resultados de esta materia puede estar relacionada con la forma en que se prepara para cada evaluación. Si el estudio es intensivo pero puntual, los resultados serán variables; si es constante y distribuido, tenderán a estabilizarse.',
      'Un perfil tan variable en las calificaciones generalmente indica que hay un problema de fondo en la metodología de estudio. No es el contenido lo que falla — hay períodos con buenas notas que lo demuestran — sino la consistencia del proceso.',
    ],

    bajo_compromiso: [
      'El número de actividades no entregadas representa una debilidad estructural en su proceso: cada tarea faltante no solo afecta la nota, sino que deja un vacío en el aprendizaje acumulado que se vuelve cada vez más difícil de cerrar.',
      'El bajo nivel de participación en las actividades asignadas es el factor que más está limitando su avance en esta materia. Sin entregas constantes, tanto el docente como el estudiante pierden la posibilidad de identificar y corregir los errores a tiempo.',
      'Hay un patrón de incumplimiento en las tareas que, de no atenderse, tiende a agravarse con el tiempo. Es importante identificar si la causa es falta de tiempo, dificultad con los temas o desconexión con la materia, para trabajar desde la raíz del problema.',
      'La tasa de entrega de actividades está por debajo del mínimo necesario para acompañar adecuadamente el proceso de aprendizaje. Cada actividad no entregada es una evaluación perdida y una oportunidad de retroalimentación que no se aprovecha.',
      'El porcentaje de tareas completadas en esta materia es uno de los más bajos de su perfil académico. Esto no solo impacta directamente en la nota sino que genera brechas de conocimiento que se acumulan y hacen cada tema siguiente más difícil de comprender.',
      'Sin una participación más activa en las actividades de la materia, el docente no cuenta con suficiente información para apoyar el proceso de aprendizaje. El bajo compromiso afecta tanto al estudiante como a la calidad del acompañamiento que puede recibir.',
      'El ritmo de entregas actual no es suficiente para alcanzar los objetivos de la materia. Cada actividad no entregada representa no solo un cero, sino también un contenido que no fue practicado y una dificultad más que enfrentar en las evaluaciones siguientes.',
      'La cantidad de actividades no entregadas en esta materia genera una deuda académica que se acumula período a período. Retomar el ritmo de participación es el primer paso, y el más urgente, para mejorar la situación en esta asignatura.',
    ],

    consistentemente_bajo: [
      'Las notas se mantienen de forma constante por debajo del nivel de aprobación. Esto indica que hay un vacío conceptual que se arrastra desde períodos anteriores y que requiere atención directa antes de continuar avanzando en los contenidos.',
      'El promedio estable pero bajo sugiere que el estudiante tiene una comprensión parcial de la materia: entiende algo, pero no lo suficiente para superar el umbral de aprobación. Identificar exactamente qué conceptos no están claros es el primer paso.',
      'El nivel de calificaciones en esta materia se mantiene de forma regular en zona de reprobación. La consistencia de ese bajo desempeño indica que no es un problema de esfuerzo en períodos específicos sino de una comprensión de base que no está siendo alcanzada.',
      'Hay una línea de rendimiento que se mantiene estable pero que no llega al nivel mínimo requerido. Esa constancia en el bajo desempeño sugiere que el estudiante está dando lo que puede con los conceptos que tiene disponibles, pero que esos conceptos son insuficientes para los contenidos de la materia.',
      'Sus calificaciones en esta asignatura se ubican de forma consistente por debajo del umbral de aprobación. Esto no indica falta de esfuerzo necesariamente, sino que puede haber contenidos fundamentales sin comprender que están bloqueando el avance en todos los temas posteriores.',
      'La estabilidad de sus notas bajas es una señal ambivalente: por un lado, indica que no hay pánico ni caída libre; por el otro, que tampoco hay mejora. Esa situación estática en zona baja requiere una intervención externa que rompa el ciclo.',
      'Mantenerse en el mismo nivel bajo período tras período indica que el estudiante ha llegado a un techo con las herramientas que tiene actualmente. Para subir ese techo es necesario reforzar los conceptos base de la materia con apoyo del docente.',
      'Un promedio constante pero insuficiente es a veces más preocupante que una caída, porque no activa la misma sensación de urgencia. La situación requiere atención aunque no se perciba como una crisis, porque el tiempo para revertirla está corriendo.',
    ],

    doble_debilidad: [
      'En esta materia confluyen dos factores de riesgo: la irregularidad en los resultados y el bajo nivel de entrega de actividades. Esta combinación es la que más frecuentemente lleva a situaciones de pérdida de período, y requiere una intervención prioritaria.',
      'El análisis muestra que tanto la constancia como el compromiso presentan niveles bajos en esta asignatura. Abordar uno sin el otro no será suficiente: se necesita un plan integral que trabaje los dos aspectos de forma simultánea.',
      'La confluencia de inestabilidad en los resultados y bajo cumplimiento de actividades crea una situación de doble vulnerabilidad en esta materia. Cada uno de esos factores por separado ya sería una señal de alerta; juntos, representan el escenario de mayor riesgo académico.',
      'Dos señales negativas que se refuerzan mutuamente: no entrega con regularidad y cuando entrega los resultados varían de forma significativa. Este patrón indica que no hay un proceso de estudio estructurado para esta asignatura y que es necesario construirlo desde cero.',
      'Los datos de esta materia muestran que no hay un piso estable ni un ritmo de trabajo constante. Sin esas dos bases, cualquier esfuerzo aislado tendrá un impacto limitado. El trabajo debe empezar por construir hábito y rutina antes de enfocarse en el contenido.',
      'La combinación de bajo compromiso y alta variabilidad en las notas es el patrón que más dificulta la recuperación académica: sin entregas constantes no hay práctica, y sin práctica el conocimiento no se asienta. Se recomienda un plan de seguimiento semanal con el docente.',
      'Ambas dimensiones de su proceso académico en esta materia presentan dificultades simultáneas. Mejorar solo una de ellas generará avances limitados; la recuperación real requiere trabajar el compromiso y la estabilidad de forma conjunta.',
      'Este es el perfil de mayor riesgo en cualquier materia: bajo nivel de participación combinado con resultados irregulares. La situación requiere una conversación directa con el estudiante, sus padres y el docente para construir un plan de acción concreto con seguimiento.',
    ],

    vacio_conceptual: [
      'Hay una señal importante que no debe ignorarse: el estudiante entrega sus actividades con regularidad y sus resultados son consistentes, pero el nivel de las notas se mantiene por debajo del umbral de aprobación. Esto indica un vacío conceptual de fondo — el problema no es la actitud ni el esfuerzo, sino la comprensión de los contenidos. Se recomienda intervención académica focalizada en los temas base de la materia.',
      'La combinación de alto compromiso con notas bajas es una señal de alerta específica: el estudiante está haciendo el esfuerzo pero no está obteniendo los resultados esperados. Esto generalmente indica que hay conceptos fundamentales que no están claros y que están bloqueando el avance. El docente puede identificar exactamente qué temas reforzar revisando las actividades entregadas.',
      'Entrega todo pero las notas no acompañan — ese es el diagnóstico preciso en esta materia. No es un problema de voluntad ni de hábito, sino de comprensión profunda. Con una intervención a tiempo, este tipo de perfil responde muy bien porque la disposición al trabajo ya existe.',
      'Este estudiante trabaja, entrega y participa, pero los resultados no reflejan ese esfuerzo. Esa brecha entre trabajo y resultado suele tener una causa específica: un concepto base que no está claro y que afecta todo lo que viene después. Identificar y atacar ese concepto puede destrabar el avance de forma rápida.',
      'El patrón de entrega alta con nota baja es uno de los más informativos del análisis académico: confirma que la voluntad no es el problema. El docente tiene en las actividades entregadas la información necesaria para diagnosticar exactamente dónde está el obstáculo conceptual.',
      'Hay un desacople entre el esfuerzo puesto y los resultados obtenidos en esta materia. Ese desacople no es normal y merece atención: cuando alguien trabaja con constancia pero no mejora, significa que está trabajando en la dirección equivocada o sin las herramientas conceptuales correctas.',
      'El compromiso de este estudiante es incuestionable en esta asignatura. El problema es que ese compromiso no está siendo suficientemente efectivo. Con una revisión de los conceptos fundamentales de la materia y una estrategia de estudio más dirigida, el mismo nivel de esfuerzo puede producir resultados muy diferentes.',
      'Cuando el compromiso es alto pero la nota no supera el mínimo, el problema es específico y solucionable: hay uno o varios conceptos clave que no están claros y que actúan como cuello de botella para todo el aprendizaje posterior. Identificarlos y reforzarlos con el docente es la intervención más eficiente posible en este caso.',
    ],
  },

  // ── AMENAZAS ───────────────────────────────────────────────────────────────
  amenaza: {

    caida_con_riesgo: [
      'La curva de rendimiento en esta materia viene en descenso y el modelo predictivo refuerza esa señal de alerta. Si la tendencia actual no se revierte antes del cierre del período, la situación podría llegar a un punto de no retorno para el año en curso.',
      'Hay dos señales que se alinean de forma preocupante: los resultados vienen cayendo y el análisis del sistema proyecta dificultades si no hay un cambio de rumbo pronto. Este es el momento de actuar, no de esperar.',
      'La dirección del desempeño en los últimos períodos es descendente y la proyección del sistema no es favorable. No se trata de un diagnóstico definitivo, sino de una advertencia que da tiempo para actuar si se toman medidas concretas hoy.',
      'Los datos muestran una tendencia negativa que se está consolidando período a período. Sin intervención, las matemáticas del año hacen cada vez más difícil alcanzar la aprobación. El momento de actuar es ahora, antes de que el margen se cierre completamente.',
      'La combinación de notas en descenso y proyección desfavorable del sistema es la señal más urgente que puede generar este análisis. No es alarmismo: es información que permite actuar con anticipación y evitar un resultado que todavía se puede cambiar.',
      'El rendimiento viene bajando de forma sostenida y eso tiene consecuencias acumulativas: cada período bajo hace la meta final más difícil de alcanzar. Revertir esa tendencia requiere una intervención concreta y un compromiso real de cambio.',
      'La trayectoria actual en esta materia apunta en la dirección equivocada. La amenaza no es un evento futuro incierto, sino una tendencia presente y medible. Cuanto antes se corrija el rumbo, menos cuesta la corrección.',
      'El sistema identifica una convergencia de señales negativas en esta materia: caída en las notas y proyección desfavorable. Esa convergencia no es coincidencia — indica que el proceso de aprendizaje necesita ser intervenido de forma estructural.',
    ],

    riesgo_perdida: [
      'El sistema identifica un riesgo elevado de no superar esta materia con los datos disponibles hasta el momento. Es fundamental que tanto el estudiante como el docente establezcan un plan de acción concreto en el corto plazo.',
      'La probabilidad de éxito calculada por el modelo es baja. Esto no significa que la materia esté perdida, pero sí que el margen de maniobra se está reduciendo con cada actividad que pasa sin intervención.',
      'El análisis indica que la situación en esta materia es de riesgo alto. Las cifras actuales no son suficientes para garantizar la aprobación, y el tiempo para revertirlas es limitado. Se requiere un plan de acción inmediato con metas claras y seguimiento semanal.',
      'El riesgo de perder esta materia es real y medible con los datos actuales. No es una predicción pesimista sino una lectura honesta de la situación que busca generar acción preventiva antes de que sea demasiado tarde.',
      'Los indicadores en esta asignatura apuntan hacia un escenario difícil si no hay cambios significativos. La probabilidad de éxito proyectada es preocupantemente baja y cada período que pasa sin mejora reduce el margen disponible.',
      'Esta materia requiere atención urgente: el nivel actual de desempeño, proyectado hacia el cierre del año, no alcanza para la aprobación. Necesita un plan específico, apoyo del docente y un compromiso renovado del estudiante.',
      'El modelo ha identificado esta materia como la de mayor riesgo en el perfil del estudiante. Esa información debe convertirse en acción concreta: reunión con el docente, identificación de los temas críticos y un calendario de recuperación con fechas específicas.',
      'La situación en esta asignatura ha alcanzado un nivel de riesgo que requiere que todos los actores involucrados — estudiante, familia y docente — estén informados y alineados en un plan de recuperación. El tiempo es un factor crítico.',
    ],

    riesgo_sin_caida: [
      'Aunque no se detecta una caída evidente entre períodos, el nivel actual de desempeño no es suficiente para garantizar la aprobación de la materia. La estabilidad en zona baja es tan preocupante como una caída, porque consume tiempo sin mejorar la situación.',
      'El riesgo en esta materia no viene de una caída reciente sino de un nivel base que se mantiene por debajo de lo necesario. Estabilizarse en notas bajas no es un avance — el objetivo debe ser subir ese nivel base antes de que se agoten los períodos del año.',
      'La ausencia de tendencia negativa no significa que la situación sea segura: las calificaciones se mantienen estables pero en un rango insuficiente para aprobar. Esa estabilidad en zona roja es una amenaza silenciosa que puede pasar desapercibida hasta que es demasiado tarde.',
      'Mantenerse en el mismo nivel bajo de período en período crea una falsa sensación de control: no está cayendo, pero tampoco está subiendo. Y el tiempo sigue corriendo. Esa inercia negativa es la amenaza que debe atenderse en esta materia.',
      'La constancia en niveles de desempeño insuficientes es una forma de riesgo diferente a la caída, pero igualmente seria. El problema no es que las cosas estén empeorando, sino que no están mejorando cuando necesitan hacerlo.',
      'Estabilidad no siempre es una buena noticia. Cuando el punto de equilibrio está por debajo de la nota de aprobación, la estabilidad se convierte en un obstáculo: el sistema se acostumbra al nivel bajo y se resiste al cambio. Romper esa inercia requiere un esfuerzo deliberado.',
      'El nivel de riesgo en esta materia no proviene de un deterioro reciente sino de un desempeño que nunca ha llegado a la zona segura. Esa situación requiere atención aunque no haya señales dramáticas, precisamente porque las señales sutiles son las más fáciles de ignorar.',
      'Hay una amenaza que no hace ruido: mantenerse justo por debajo del nivel de aprobación período tras período. No hay caída libre, pero tampoco hay salvación a la vista. Con el tiempo disponible que queda, es necesario salir de esa zona de forma deliberada y urgente.',
    ],

    desconexion_progresiva: [
      'Se percibe una desconexión creciente con la materia: la participación ha disminuido y las notas acompañan esa tendencia. Cuando esto ocurre, el problema rara vez es académico en su origen — vale la pena explorar si hay factores personales o de motivación que estén influyendo.',
      'La combinación de menor participación y notas en descenso puede indicar que el estudiante está perdiendo el hilo de la materia de forma progresiva. Cada semana que pasa sin intervención hace la brecha más difícil de cerrar.',
      'La reducción simultánea en la participación y en los resultados sigue un patrón que, si no se interrumpe, tiende a acelerarse. Recuperar el compromiso con la materia es el primer paso, y es urgente porque la desconexión progresiva es mucho más difícil de revertir que un bajo rendimiento puntual.',
      'Hay señales de que el estudiante está perdiendo contacto con esta asignatura de forma gradual: menos entregas, peores notas. Esa combinación puede estar indicando desmotivación, dificultades externas o simplemente que los temas se volvieron demasiado complejos sin el apoyo necesario.',
      'La desconexión con la materia no aparece de la noche a la mañana: se construye semana a semana a través de actividades no entregadas y contenidos que no se asimilan. En esta asignatura ese proceso parece estar activo, y requiere atención antes de que se consolide.',
      'Cada período con menos entregas y menores calificaciones amplía la brecha entre el estudiante y los contenidos de la materia. Esa brecha, una vez amplia, se vuelve un obstáculo en sí misma porque los temas nuevos dependen de los anteriores que no fueron asimilados.',
      'La tendencia de alejamiento progresivo de la materia — menos participación, peores resultados — es una señal que trasciende lo académico. Se recomienda una conversación directa con el estudiante para entender qué está generando esa desconexión y abordarla desde su causa real.',
      'Hay un proceso de distanciamiento gradual de esta asignatura que se puede medir tanto en el número de entregas como en la calidad de los resultados. Interrumpir ese proceso requiere un punto de reconexión con la materia: una actividad que genere interés, un éxito pequeño que motive a seguir.',
    ],

    volatilidad_descendente: [
      'No solo las notas vienen bajando, sino que lo hacen de forma irregular y poco predecible. Esta volatilidad descendente es más difícil de manejar que un bajo rendimiento estable, porque impide identificar con claridad cuál es el nivel real del estudiante.',
      'La combinación de alta variabilidad y tendencia negativa en esta materia es la más compleja de abordar: el rendimiento oscila pero la dirección general es hacia abajo. Cada pico alto es seguido por una caída aún mayor, lo que reduce el promedio de forma constante.',
      'Las notas se mueven de forma errática pero con una dirección clara: hacia abajo. Esa irregularidad hace difícil saber en qué está fallando exactamente, pero la tendencia descendente no deja lugar a dudas sobre la urgencia de intervenir.',
      'Una caída estable es más predecible que una caída volátil. En este caso, la irregularidad de los resultados mientras la tendencia es negativa indica que no hay un problema único y claro, sino múltiples variables afectando el desempeño de forma simultánea.',
      'La alta volatilidad combinada con una tendencia descendente es la señal más compleja que puede generar el análisis en esta materia. No hay un patrón claro que facilite el diagnóstico, pero sí hay una dirección clara: el desempeño está empeorando y de forma irregular.',
      'Los resultados suben y bajan, pero la media se mueve hacia abajo. Esa es la peor combinación posible: inestabilidad más deterioro. Requiere una intervención que primero estabilice el proceso y luego trabaje sobre la mejora.',
      'La volatilidad en los resultados mientras las notas descienden puede indicar que el estudiante está respondiendo de forma reactiva a cada evaluación sin un proceso de estudio continuo detrás. El resultado de ese enfoque es siempre irregular y generalmente decreciente.',
      'Hay una amenaza doble en esta materia: la variabilidad que impide predecir los resultados y la tendencia descendente que confirma que el promedio está cayendo. Abordar cualquiera de las dos sin la otra producirá avances parciales e inestables.',
    ],
  },

  // ── NOTA NECESARIA ─────────────────────────────────────────────────────────
  notaNecesaria: {

    ya_aprobado: [
      'Con el promedio actual, la materia ya se encuentra dentro del rango de aprobación. Mantener el nivel de trabajo en el período restante es suficiente para garantizar el resultado positivo.',
      'Los resultados acumulados hasta el momento ubican al estudiante en zona de aprobación. Sostener el compromiso actual hasta el cierre del período asegura un buen desempeño final.',
      'El promedio actual supera la nota de aprobación. Eso significa que, incluso con resultados moderados en lo que resta del año, el resultado final será positivo. Lo importante ahora es no bajar la guardia.',
      'La materia está encaminada hacia la aprobación con los datos actuales. No se necesita ningún esfuerzo extraordinario en lo que resta, solo mantener el nivel de trabajo que ha producido estos resultados.',
      'El estudiante ya alcanzó la zona de aprobación con su promedio acumulado. Eso no significa que deba relajarse, sino que está en una posición cómoda desde la cual puede incluso mejorar el resultado final.',
      'Con las calificaciones obtenidas hasta el momento, la aprobación de la materia está asegurada si se mantiene un nivel razonable de trabajo en los períodos restantes. Es una posición favorable que debe aprovecharse para reforzar los temas donde hay más debilidad.',
      'La aritmética del año está a favor del estudiante en esta materia: el promedio acumulado ya supera el umbral de aprobación. El objetivo ahora puede ser subir ese promedio aún más o consolidar los aprendizajes en los temas más complejos.',
      'Está en zona verde en esta materia. Con el trabajo realizado hasta ahora, la aprobación no está en riesgo si se mantiene una participación regular en lo que resta del período.',
    ],

    alcanzable: [
      'Para cerrar el período en zona aprobatoria, necesita alcanzar un promedio de {nota} en las actividades restantes. Esta meta es completamente alcanzable con una dedicación enfocada en los temas pendientes.',
      'El objetivo concreto para este período es llegar a {nota} en promedio. No es una cifra lejana, pero sí requiere que las próximas actividades sean atendidas con mayor cuidado y preparación.',
      'La meta numérica está clara: {nota} en los períodos que restan. Con una dedicación consistente y aprovechando el apoyo del docente, ese objetivo está dentro del alcance real de este estudiante.',
      'Necesita obtener {nota} en las actividades restantes para cerrar el año en zona aprobatoria. Es un número concreto y alcanzable: no requiere un rendimiento excepcional, sino un esfuerzo sostenido y bien dirigido.',
      'La proyección indica que con un promedio de {nota} en lo que resta del período, la materia puede aprobarse. Ese es el norte claro: no una nota perfecta, sino una meta específica que orienta el esfuerzo de forma precisa.',
      'Para garantizar la aprobación, el promedio en los períodos restantes debe ser de {nota}. Es una meta realista que se puede alcanzar con organización, revisión de los temas que han generado dificultad y entrega puntual de las actividades.',
      'El número que necesita alcanzar es {nota} en promedio para cerrar el año aprobando esta materia. Con el tiempo disponible y un plan de trabajo claro, esa cifra es perfectamente lograble.',
      'La nota objetivo para los períodos restantes es {nota}. No es alta, pero tampoco se consigue sin esfuerzo. Con disciplina en la entrega de actividades y estudio de los temas pendientes, esta meta está al alcance.',
    ],

    exigente: [
      'Para aprobar la materia, necesitaría obtener {nota} en el período restante. Es una meta exigente pero no imposible: requiere un esfuerzo superior al habitual y, probablemente, apoyo académico adicional.',
      'La nota requerida en el período final es de {nota}. Alcanzarla es el reto más importante que tiene por delante en esta materia y demandará un compromiso muy superior al que ha mostrado hasta ahora.',
      'La aritmética del período es exigente: se necesita {nota} en promedio para alcanzar la aprobación. Es posible, pero solo con un esfuerzo real y constante desde hoy, no desde la semana antes del cierre.',
      'Para cerrar la materia en zona aprobatoria se necesita {nota} en los períodos restantes. Esa cifra es alta y alcanzarla requerirá un nivel de dedicación superior al habitual, además de apoyo del docente en los temas que más generan dificultad.',
      'La nota necesaria para aprobar es {nota}. No es imposible, pero sí exigente: requiere que el estudiante funcione a su máximo nivel en lo que resta del año y que ninguna actividad quede sin entregar. Hay que actuar con urgencia.',
      'Con {nota} como meta para los períodos restantes, el margen de error es mínimo. Cualquier actividad no entregada o mal resuelta puede hacer que ese número se vuelva inalcanzable. Se requiere un compromiso total y sin demoras.',
      'El objetivo de {nota} en el período restante es un reto significativo. Alcanzarlo va a requerir más que esfuerzo: va a necesitar estrategia, priorización de temas y apoyo activo del docente para identificar los puntos críticos donde concentrar la energía.',
      'Necesita {nota} para pasar la materia y ese número no deja mucho espacio para errores. Sin embargo, sigue siendo alcanzable si el esfuerzo que queda por delante es superior al que se ha mostrado hasta ahora. El tiempo es limitado pero todavía suficiente.',
    ],

    fuera_de_alcance: [
      'Con la aritmética del período actual, superar la materia este año sería matemáticamente muy difícil incluso con una nota perfecta en lo que resta. Es importante preparar al estudiante y su familia para esta posibilidad y explorar las alternativas disponibles.',
      'El análisis numérico indica que alcanzar la nota de aprobación en este período representaría un desafío aritmético que va más allá del esfuerzo individual. Se recomienda una conversación directa sobre la situación y los pasos a seguir.',
      'Los números del año no permiten alcanzar la aprobación incluso en el mejor escenario posible para los períodos restantes. Es una situación difícil que merece ser comunicada con honestidad para que el estudiante y su familia puedan planificar con información real.',
      'La proyección matemática indica que la aprobación de la materia este año no es aritméticamente alcanzable. Esa información, aunque difícil, es valiosa porque permite preparar el siguiente paso con claridad y sin falsas esperanzas.',
      'Con el promedio acumulado y los períodos que quedan, el resultado aritmético no alcanza para la aprobación incluso con un rendimiento perfecto en lo que resta. Esto no es un juicio sino una lectura honesta de los números que busca orientar la planificación.',
      'La matemática del período es concluyente: la nota de aprobación no es alcanzable con los períodos restantes. Esta información debe llegar al estudiante y a su familia de forma clara y oportuna para que puedan tomar decisiones informadas sobre los próximos pasos.',
      'La situación numérica en esta materia es crítica: incluso con el máximo puntaje posible en lo que resta, el promedio final no llegaría al nivel de aprobación. Es el momento de hablar con honestidad sobre las opciones disponibles y de enfocarse en las otras materias donde la situación sí es recuperable.',
      'Los cálculos del período muestran que la aprobación está fuera del alcance matemático en esta asignatura. Esa realidad, aunque dura, es mejor conocerla con tiempo que llegar al cierre con sorpresas. El foco debe ponerse en evitar que esta situación se replique en otras materias.',
    ],

    sin_datos: [
      'No hay suficiente información del período actual para calcular la nota necesaria en los períodos restantes. Este análisis estará disponible cuando haya al menos un resultado registrado.',
      'Aún no hay calificaciones registradas en esta materia para el período actual. En cuanto se registren las primeras notas, el sistema podrá calcular la proyección y la nota necesaria para alcanzar la aprobación.',
      'El cálculo de la nota proyectada requiere datos del período activo. Una vez que haya evaluaciones registradas en esta asignatura, el análisis podrá hacer una proyección precisa sobre lo que se necesita para aprobar.',
      'Sin notas del período actual no es posible calcular la proyección de aprobación. El sistema actualizará este análisis automáticamente en cuanto haya calificaciones disponibles en la materia.',
      'Este análisis no puede realizar una proyección todavía porque no hay datos del período en curso para esta asignatura. Cuando las primeras actividades sean calificadas, la proyección estará disponible.',
      'La proyección de nota necesaria se activará cuando haya al menos una calificación registrada en el período actual. Por ahora, el sistema no cuenta con datos suficientes para hacer un cálculo significativo.',
      'No es posible proyectar la nota necesaria sin información del período activo. En cuanto el docente registre las primeras calificaciones de esta materia, el módulo de IA podrá generar una proyección precisa.',
      'El cálculo de nota necesaria requiere datos reales del año en curso. Tan pronto como haya registros de calificaciones para este período en esta asignatura, el análisis estará completo.',
    ],
  },
};

// ── Cálculo de nota proyectada ────────────────────────────────────────────────

/**
 * Calcula la nota que el estudiante necesita en los períodos restantes
 * para alcanzar la nota de aprobación, dado su promedio actual.
 *
 * @param {number} promedioActual    - Promedio real (no normalizado) acumulado
 * @param {number} periodosTranscurridos
 * @param {number} totalPeriodos    - Generalmente 4
 * @param {number} notaAprobacion   - Generalmente 3.0
 * @param {number} escalaMax        - Generalmente 5.0
 * @returns {{ notaNecesaria: number|null, situacion: string }}
 */
function calcularNotaNecesaria(promedioActual, periodosTranscurridos, totalPeriodos, notaAprobacion, escalaMax) {
  if (!periodosTranscurridos || periodosTranscurridos === 0) {
    return { notaNecesaria: null, situacion: 'sin_datos' };
  }

  const periodosRestantes = totalPeriodos - periodosTranscurridos;

  // Ya terminó el año
  if (periodosRestantes <= 0) {
    return {
      notaNecesaria: null,
      situacion: promedioActual >= notaAprobacion ? 'ya_aprobado' : 'fuera_de_alcance',
    };
  }

  // Si ya aprobó con lo que tiene
  const sumaActual   = promedioActual * periodosTranscurridos;
  const sumaObjetivo = notaAprobacion * totalPeriodos;
  const notaNecesaria= (sumaObjetivo - sumaActual) / periodosRestantes;

  if (promedioActual >= notaAprobacion && notaNecesaria <= promedioActual) {
    return { notaNecesaria: Math.max(1, Math.round(notaNecesaria * 10) / 10), situacion: 'ya_aprobado' };
  }

  if (notaNecesaria > escalaMax) {
    return { notaNecesaria: null, situacion: 'fuera_de_alcance' };
  }

  const redondeada = Math.round(notaNecesaria * 10) / 10;

  return {
    notaNecesaria: Math.max(1, redondeada),
    situacion: notaNecesaria > escalaMax * 0.80 ? 'exigente' : 'alcanzable',
  };
}

// ── Lógica principal del FODA ─────────────────────────────────────────────────

/**
 * Genera el análisis FODA completo para una materia.
 *
 * @param {Object} metricas
 * @param {number} metricas.nota          - 0-1
 * @param {number} metricas.tendencia     - 0-1
 * @param {number} metricas.compromiso    - 0-1
 * @param {number} metricas.estabilidad   - 0-1
 *
 * @param {number} prediccion             - Probabilidad de éxito de brain.js (0-1)
 *
 * @param {Object} configColegio
 * @param {number} configColegio.escalaMin
 * @param {number} configColegio.escalaMax
 * @param {number} configColegio.notaAprobacion
 *
 * @param {string} nombreMateria
 *
 * @param {Object} datosExtra             - Datos adicionales para nota proyectada
 * @param {number} datosExtra.promedioReal         - Promedio real (escala 1-5)
 * @param {number} datosExtra.periodosTranscurridos
 * @param {number} datosExtra.totalPeriodos        - Default 4
 *
 * @returns {{
 *   materia:          string,
 *   prediccion:       number,
 *   porcentajeExito:  number,
 *   nivel:            string,
 *   foda: {
 *     fortalezas:  string[],
 *     oportunidades: string[],
 *     debilidades: string[],
 *     amenazas:    string[],
 *   },
 *   notaProyectada: {
 *     notaNecesaria:  number|null,
 *     situacion:      string,
 *     mensaje:        string,
 *   },
 *   metricas: Object,
 * }}
 */
function interpretarFODA(metricas, prediccion, configColegio, nombreMateria, datosExtra = {}) {
  const { nota, tendencia, compromiso, estabilidad } = metricas;
  const { escalaMin = 1, escalaMax = 5, notaAprobacion = 3 } = configColegio;
  const {
    promedioReal          = (nota * (escalaMax - escalaMin) + escalaMin),
    periodosTranscurridos = 1,
    totalPeriodos         = 4,
  } = datosExtra;

  const semilla = semillaDeMetricas(metricas);
  const porcentajeExito = Math.round(prediccion * 100);

  // Niveles cualitativos de cada métrica
  const nNota        = nivel(nota);
  const nTendencia   = nivel(tendencia);
  const nCompromiso  = nivel(compromiso);
  const nEstabilidad = nivel(estabilidad);

  // Umbral de tendencia: >0.55 mejora, <0.45 cae
  const mejorando = tendencia > 0.55;
  const cayendo   = tendencia < 0.45;

  const fortalezas    = [];
  const oportunidades = [];
  const debilidades   = [];
  const amenazas      = [];

  // ── FORTALEZAS ─────────────────────────────────────────────────────────────
  if (estabilidad >= 0.70 && compromiso >= 0.80) {
    fortalezas.push(
      elegir(FRASES.fortaleza.estabilidad_alta_compromiso_alto, semilla)
    );
  } else if (estabilidad >= 0.70) {
    fortalezas.push(
      elegir(FRASES.fortaleza.solo_estabilidad, semilla)
    );
  } else if (compromiso >= 0.80) {
    fortalezas.push(
      elegir(FRASES.fortaleza.solo_compromiso, semilla)
    );
  }

  if (nota >= 0.65) {
    fortalezas.push(
      elegir(FRASES.fortaleza.nota_alta, semilla + 1)
    );
  }

  if (mejorando && nota >= 0.40) {
    fortalezas.push(
      elegir(FRASES.fortaleza.tendencia_positiva, semilla + 2)
    );
  }

  // ── OPORTUNIDADES ──────────────────────────────────────────────────────────
  if (compromiso >= 0.80 && nota < 0.50) {
    oportunidades.push(
      elegir(FRASES.oportunidad.comprometido_pero_bajo, semilla)
    );
  }

  if (mejorando && nota >= 0.30 && nota < 0.65) {
    oportunidades.push(
      elegir(FRASES.oportunidad.mejorando_con_esfuerzo, semilla + 1)
    );
  }

  if (nEstabilidad === 'medio' && nota >= 0.40) {
    oportunidades.push(
      elegir(FRASES.oportunidad.consistencia_alcanzable, semilla + 2)
    );
  }

  if (prediccion >= 0.35 && prediccion < 0.55 && nota < 0.50) {
    oportunidades.push(
      elegir(FRASES.oportunidad.zona_de_rescate, semilla + 3)
    );
  }

  // ── DEBILIDADES ────────────────────────────────────────────────────────────
  if (estabilidad < 0.40 && compromiso < 0.50) {
    debilidades.push(
      elegir(FRASES.debilidad.doble_debilidad, semilla)
    );
  } else {
    if (estabilidad < 0.40) {
      debilidades.push(
        elegir(FRASES.debilidad.muy_inestable, semilla)
      );
    }
    if (compromiso < 0.50) {
      debilidades.push(
        elegir(FRASES.debilidad.bajo_compromiso, semilla + 1)
      );
    }
  }

  if (nota < 0.40 && (nEstabilidad === 'medio' || nEstabilidad === 'alto')) {
    debilidades.push(
      elegir(FRASES.debilidad.consistentemente_bajo, semilla + 2)
    );
  }

  // ✅ NUEVO: nota muy baja con compromiso y estabilidad altos → vacío conceptual
  if (nota < 0.45 && compromiso >= 0.70 && estabilidad >= 0.60) {
    debilidades.push(
      elegir(FRASES.debilidad.vacio_conceptual, semilla + 3)
    );
  }

  // ── AMENAZAS ───────────────────────────────────────────────────────────────
  if (cayendo && prediccion < 0.50) {
    if (prediccion < 0.30) {
      amenazas.push(
        elegir(FRASES.amenaza.riesgo_perdida, semilla)
      );
    }
    amenazas.push(
      elegir(FRASES.amenaza.caida_con_riesgo, semilla + 1)
    );
  }

  // ✅ NUEVO: predicción baja aunque no haya tendencia negativa (estable en zona baja)
  if (prediccion < 0.40 && !cayendo) {
    amenazas.push(
      elegir(FRASES.amenaza.riesgo_sin_caida, semilla + 4)
    );
  }

  if (compromiso < 0.50 && nota < 0.40) {
    amenazas.push(
      elegir(FRASES.amenaza.desconexion_progresiva, semilla + 2)
    );
  }

  if (estabilidad < 0.35 && cayendo) {
    amenazas.push(
      elegir(FRASES.amenaza.volatilidad_descendente, semilla + 3)
    );
  }

  // Garantizar al menos 1 elemento en FODA si todo está en zona media
  if (fortalezas.length === 0 && oportunidades.length === 0
      && debilidades.length === 0 && amenazas.length === 0) {
    if (prediccion >= 0.50) {
      fortalezas.push(elegir(FRASES.fortaleza.solo_compromiso, semilla));
      oportunidades.push(elegir(FRASES.oportunidad.consistencia_alcanzable, semilla));
    } else {
      debilidades.push(elegir(FRASES.debilidad.consistentemente_bajo, semilla));
      oportunidades.push(elegir(FRASES.oportunidad.zona_de_rescate, semilla));
    }
  }

  // ── Nivel de riesgo global ─────────────────────────────────────────────────
  let nivelGlobal;
  if      (porcentajeExito >= 75) nivelGlobal = 'Desempeño satisfactorio';
  else if (porcentajeExito >= 55) nivelGlobal = 'En proceso de consolidación';
  else if (porcentajeExito >= 35) nivelGlobal = 'Requiere atención';
  else                            nivelGlobal = 'En riesgo académico';

  // ── Nota proyectada ────────────────────────────────────────────────────────
  const { notaNecesaria, situacion } = calcularNotaNecesaria(
    promedioReal,
    periodosTranscurridos,
    totalPeriodos,
    notaAprobacion,
    escalaMax,
  );

  let mensajeNota = elegir(FRASES.notaNecesaria[situacion] || FRASES.notaNecesaria.sin_datos, semilla);
  if (notaNecesaria) {
    mensajeNota = mensajeNota.replace('{nota}', notaNecesaria.toFixed(1));
  }

  // ── Resultado final ────────────────────────────────────────────────────────
  return {
    materia:         nombreMateria,
    prediccion:      Math.round(prediccion * 10000) / 10000,
    porcentajeExito,
    nivel:           nivelGlobal,
    foda: {
      fortalezas,
      oportunidades,
      debilidades,
      amenazas,
    },
    notaProyectada: {
      notaNecesaria,
      situacion,
      mensaje: mensajeNota,
    },
    metricas: {
      nota:        Math.round(nota        * 100) / 100,
      tendencia:   Math.round(tendencia   * 100) / 100,
      compromiso:  Math.round(compromiso  * 100) / 100,
      estabilidad: Math.round(estabilidad * 100) / 100,
      nivelNota:        nNota,
      nivelTendencia:   nTendencia,
      nivelCompromiso:  nCompromiso,
      nivelEstabilidad: nEstabilidad,
    },
  };
}

module.exports = { interpretarFODA, calcularNotaNecesaria };
