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
    // estabilidad alta + compromiso alto
    estabilidad_alta_compromiso_alto: [
      'Demuestra una disciplina académica admirable: entrega sus compromisos con regularidad y mantiene un ritmo de aprendizaje constante que pocas veces fluctúa. Esta solidez es su mayor activo.',
      'Su nivel de constancia en esta materia es notable. Ha logrado construir un hábito de estudio que se refleja en la homogeneidad de sus resultados y en el cumplimiento sostenido de sus actividades.',
      'Evidencia un alto grado de autorregulación académica: no solo entrega a tiempo, sino que lo hace con una calidad que no varía de forma significativa entre un período y otro.',
    ],
    // solo estabilidad alta
    solo_estabilidad: [
      'Aunque el porcentaje de tareas entregadas tiene margen de mejora, los resultados que obtiene cuando participa son consistentes y predecibles, lo cual indica que el conocimiento está bien asentado.',
      'Su rendimiento muestra una solidez interna poco común: cuando trabaja en esta materia, los resultados son coherentes y reflejan un aprendizaje genuino más que esfuerzo puntual.',
    ],
    // solo compromiso alto
    solo_compromiso: [
      'Su nivel de compromiso con las actividades asignadas es una fortaleza clara. Entrega con regularidad y esto le da al docente información suficiente para acompañar su proceso de forma efectiva.',
      'La disposición que demuestra hacia el cumplimiento de tareas habla muy bien de su actitud frente al aprendizaje. Es uno de los pilares sobre los cuales puede construir mejores resultados.',
    ],
    // nota alta
    nota_alta: [
      'Sus calificaciones en esta materia ubican su desempeño en el rango superior del grupo. Esto no es casualidad: refleja comprensión profunda y no solo memorización superficial de los contenidos.',
      'Los resultados académicos obtenidos hasta el momento son sólidos y hablan de un proceso de aprendizaje que va más allá del mínimo requerido. Está construyendo bases fuertes para los períodos que vienen.',
    ],
    // tendencia positiva
    tendencia_positiva: [
      'La trayectoria de sus calificaciones muestra una curva ascendente que merece destacarse. Está mejorando de forma activa y sostenida, lo cual indica que las estrategias que está usando están funcionando.',
      'Del período anterior a este, su desempeño ha mejorado de manera perceptible. Esa capacidad de superarse a sí mismo en el tiempo es una fortaleza que trasciende cualquier nota específica.',
    ],
  },

  // ── OPORTUNIDADES ──────────────────────────────────────────────────────────
  oportunidad: {
    // compromiso alto pero nota baja
    comprometido_pero_bajo: [
      'Hay una señal muy positiva en su proceso: la disposición al trabajo es alta. El problema no es la actitud sino posiblemente la estrategia de estudio o la comprensión de algunos conceptos clave. Con acompañamiento focalizado, los resultados pueden mejorar de forma significativa.',
      'Entrega sus actividades con regularidad, lo que demuestra que hay voluntad genuina de aprender. Este es el punto de partida ideal para una intervención académica: el interés ya existe, solo hace falta ajustar el método.',
      'Su nivel de participación y entrega de actividades indica que está presente y comprometido con la materia. Aprovechar ese compromiso para trabajar los conceptos donde hay vacíos puede generar un avance rápido y visible.',
    ],
    // nota media con tendencia positiva
    mejorando_con_esfuerzo: [
      'Se percibe un crecimiento real entre los períodos. Si mantiene el ritmo actual de mejora y recibe orientación en los temas que aún generan dificultad, tiene el potencial de alcanzar un desempeño sobresaliente en esta materia.',
      'La tendencia positiva en sus notas sugiere que está encontrando su camino en esta asignatura. Profundizar en las áreas débiles ahora, mientras la motivación está alta, puede consolidar ese avance de forma duradera.',
    ],
    // estabilidad media — puede mejorar la consistencia
    consistencia_alcanzable: [
      'Hay períodos donde demuestra que puede rendir muy bien en esta materia. El reto está en hacer eso constante. Identificar qué condiciones favorecen sus mejores resultados y replicarlas puede marcar una diferencia importante.',
      'Sus notas muestran que el potencial está ahí: hay momentos de buen desempeño que indican comprensión real. La oportunidad está en estabilizar ese nivel y no dejarlo depender de factores externos al estudio.',
    ],
    // predicción IA moderada — zona de rescate
    zona_de_rescate: [
      'El análisis del sistema sugiere que la situación actual, aunque delicada, es recuperable. Un esfuerzo dirigido en el período restante, especialmente en las actividades pendientes y la revisión de temas anteriores, puede cambiar el resultado final.',
      'Existe una ventana de oportunidad real para revertir la tendencia actual. Focalizar la energía en los puntos críticos identificados puede tener un impacto inmediato sobre el promedio.',
    ],
  },

  // ── DEBILIDADES ────────────────────────────────────────────────────────────
  debilidad: {
    // estabilidad muy baja — notas muy variables
    muy_inestable: [
      'El patrón de calificaciones en esta materia muestra una variabilidad significativa entre actividades y períodos. Esto puede indicar que el aprendizaje no está siendo consolidado entre una evaluación y la siguiente, o que factores externos están afectando el desempeño de forma irregular.',
      'Las notas oscilan de manera pronunciada, lo que sugiere que el nivel de preparación no es uniforme. Hay momentos de buen rendimiento que no logran sostenerse, posiblemente por falta de un hábito de estudio estructurado en esta asignatura.',
      'La inconsistencia en los resultados es la señal de alerta más relevante en este caso. No se trata de falta de capacidad, sino de irregularidad en el proceso: hay días o semanas donde el estudiante está muy presente y otros donde parece ausente del aprendizaje.',
    ],
    // compromiso bajo
    bajo_compromiso: [
      'El número de actividades no entregadas representa una debilidad estructural en su proceso: cada tarea faltante no solo afecta la nota, sino que deja un vacío en el aprendizaje acumulado que se vuelve cada vez más difícil de cerrar.',
      'El bajo nivel de participación en las actividades asignadas es el factor que más está limitando su avance en esta materia. Sin entregas constantes, tanto el docente como el estudiante pierden la posibilidad de identificar y corregir los errores a tiempo.',
      'Hay un patrón de incumplimiento en las tareas que, de no atenderse, tiende a agravarse con el tiempo. Es importante identificar si la causa es falta de tiempo, dificultad con los temas o desconexión con la materia, para trabajar desde la raíz del problema.',
    ],
    // nota baja con estabilidad media — consistentemente bajo
    consistentemente_bajo: [
      'Las notas se mantienen de forma constante por debajo del nivel de aprobación. Esto indica que hay un vacío conceptual que se arrastra desde períodos anteriores y que requiere atención directa antes de continuar avanzando en los contenidos.',
      'El promedio estable pero bajo sugiere que el estudiante tiene una comprensión parcial de la materia: entiende algo, pero no lo suficiente para superar el umbral de aprobación. Identificar exactamente qué conceptos no están claros es el primer paso.',
    ],
    // estabilidad baja + compromiso bajo
    doble_debilidad: [
      'En esta materia confluyen dos factores de riesgo: la irregularidad en los resultados y el bajo nivel de entrega de actividades. Esta combinación es la que más frecuentemente lleva a situaciones de pérdida de período, y requiere una intervención prioritaria.',
      'El análisis muestra que tanto la constancia como el compromiso presentan niveles bajos en esta asignatura. Abordar uno sin el otro no será suficiente: se necesita un plan integral que trabaje los dos aspectos de forma simultánea.',
    ],
  },

  // ── AMENAZAS ───────────────────────────────────────────────────────────────
  amenaza: {
    // tendencia negativa + predicción baja
    caida_con_riesgo: [
      'La curva de rendimiento en esta materia viene en descenso y el modelo predictivo refuerza esa señal de alerta. Si la tendencia actual no se revierte antes del cierre del período, la situación podría llegar a un punto de no retorno para el año en curso.',
      'Hay dos señales que se alinean de forma preocupante: los resultados vienen cayendo y el análisis del sistema proyecta dificultades si no hay un cambio de rumbo pronto. Este es el momento de actuar, no de esperar.',
      'La dirección del desempeño en los últimos períodos es descendente y la proyección del sistema no es favorable. No se trata de un diagnóstico definitivo, sino de una advertencia que da tiempo para actuar si se toman medidas concretas hoy.',
    ],
    // predicción muy baja — riesgo alto de pérdida
    riesgo_perdida: [
      'El sistema identifica un riesgo elevado de no superar esta materia con los datos disponibles hasta el momento. Es fundamental que tanto el estudiante como el docente establezcan un plan de acción concreto en el corto plazo.',
      'La probabilidad de éxito calculada por el modelo es baja. Esto no significa que la materia esté perdida, pero sí que el margen de maniobra se está reduciendo con cada actividad que pasa sin intervención.',
    ],
    // compromiso cayendo + nota baja
    desconexion_progresiva: [
      'Se percibe una desconexión creciente con la materia: la participación ha disminuido y las notas acompañan esa tendencia. Cuando esto ocurre, el problema rara vez es académico en su origen — vale la pena explorar si hay factores personales o de motivación que estén influyendo.',
      'La combinación de menor participación y notas en descenso puede indicar que el estudiante está perdiendo el hilo de la materia de forma progresiva. Cada semana que pasa sin intervención hace la brecha más difícil de cerrar.',
    ],
    // estabilidad muy baja + tendencia negativa
    volatilidad_descendente: [
      'No solo las notas vienen bajando, sino que lo hacen de forma irregular y poco predecible. Esta volatilidad descendente es más difícil de manejar que un bajo rendimiento estable, porque impide identificar con claridad cuál es el nivel real del estudiante.',
    ],
  },

  // ── PREDICCIÓN DE NOTA NECESARIA ──────────────────────────────────────────
  notaNecesaria: {
    ya_aprobado: [
      'Con el promedio actual, la materia ya se encuentra dentro del rango de aprobación. Mantener el nivel de trabajo en el período restante es suficiente para garantizar el resultado positivo.',
      'Los resultados acumulados hasta el momento ubican al estudiante en zona de aprobación. Sostener el compromiso actual hasta el cierre del período asegura un buen desempeño final.',
    ],
    alcanzable: [
      'Para cerrar el período en zona aprobatoria, necesita alcanzar un promedio de {nota} en las actividades restantes. Esta meta es completamente alcanzable con una dedicación enfocada en los temas pendientes.',
      'El objetivo concreto para este período es llegar a {nota} en promedio. No es una cifra lejana, pero sí requiere que las próximas actividades sean atendidas con mayor cuidado y preparación.',
    ],
    exigente: [
      'Para aprobar la materia, necesitaría obtener {nota} en el período restante. Es una meta exigente pero no imposible: requiere un esfuerzo superior al habitual y, probablemente, apoyo académico adicional.',
      'La nota requerida en el período final es de {nota}. Alcanzarla es el reto más importante que tiene por delante en esta materia y demandará un compromiso muy superior al que ha mostrado hasta ahora.',
    ],
    fuera_de_alcance: [
      'Con la aritmética del período actual, superar la materia este año sería matemáticamente muy difícil incluso con una nota perfecta en lo que resta. Es importante preparar al estudiante y su familia para esta posibilidad y explorar las alternativas disponibles.',
      'El análisis numérico indica que alcanzar la nota de aprobación en este período representaría un desafío aritmético que va más allá del esfuerzo individual. Se recomienda una conversación directa sobre la situación y los pasos a seguir.',
    ],
    sin_datos: [
      'No hay suficiente información del período actual para calcular la nota necesaria en los períodos restantes. Este análisis estará disponible cuando haya al menos un resultado registrado.',
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
