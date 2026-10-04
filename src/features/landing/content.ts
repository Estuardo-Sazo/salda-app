/** Textos de la página pública. Las preguntas también alimentan el JSON-LD FAQPage (index.html). */

export interface Feature {
  titulo: string
  texto: string
}

export const FEATURES: Feature[] = [
  {
    titulo: 'Tu deuda real, no solo el saldo',
    texto:
      'Suma las compras en cuotas y los extrafinanciamientos que el banco todavía no cobra y que no aparecen en el estado de cuenta.',
  },
  {
    titulo: 'Un pago registrado en 15 segundos',
    texto:
      'Elegís la deuda, el monto viene prellenado con tu cuota y anotás el saldo que quedó. Si no tenés el interés, Saldá lo estima y lo marca.',
  },
  {
    titulo: 'Cada compra con tarjeta es deuda nueva',
    texto:
      'Al registrar un gasto con tarjeta aparece en rojo cuánto agregaste y cuánto te cuesta al mes con la tasa de esa tarjeta.',
  },
  {
    titulo: 'Un plan con fecha de fin',
    texto:
      'Avalancha, bola de nieve o cuotas fijas. Ves la meta de cada mes, si vas adelantado o atrasado y en qué mes terminás de pagar.',
  },
  {
    titulo: 'Simulá antes de decidir',
    texto:
      'Probá un abono extra o un préstamo para consolidar: total pagado, intereses y mes de liquidación, lado a lado con tu plan actual.',
  },
  {
    titulo: 'Préstamos de interés fijo y pagos únicos',
    texto:
      'Los que cobran un porcentaje sobre lo prestado y se pagan de un solo al vencer. El aguinaldo, los bonos y otros ingresos extra entran en tu flujo de ese mes.',
  },
  {
    titulo: 'Dinero que te deben',
    texto:
      'Si prestás con interés mensual, registrás los abonos y sabés cuánto te deben hoy y desde qué día se suma otro mes.',
  },
  {
    titulo: 'Reportes y tu Excel',
    texto:
      'Reporte mensual y anual con interés contra capital. Exportás a Excel, CSV o un respaldo completo, e importás tu hoja de control.',
  },
]

export const PASOS = [
  {
    titulo: 'Cargá tus deudas',
    texto: 'Con el asistente paso a paso o subiendo tu Excel. Lo que el banco no te dijo queda como pendiente.',
  },
  {
    titulo: 'Registrá pagos y gastos',
    texto: 'Desde el celular, con el botón + de abajo. El saldo de cada mes se actualiza solo.',
  },
  {
    titulo: 'Seguí el plan',
    texto: 'Cada mes ves cuánto bajó tu deuda, cuánto se fue en intereses y si vas a tiempo.',
  },
]

export const FAQ = [
  {
    pregunta: '¿Tengo que conectar mi banco?',
    respuesta:
      'No. Vos registrás tus pagos y saldos con lo que dice tu estado de cuenta o la app de tu banco. Saldá nunca pide credenciales bancarias.',
  },
  {
    pregunta: '¿Quién puede ver mis datos?',
    respuesta:
      'Solo vos. Cada registro está atado a tu cuenta y la base de datos bloquea el acceso de cualquier otro usuario.',
  },
  {
    pregunta: '¿Qué pasa si no sé la tasa o el seguro de una tarjeta?',
    respuesta:
      'Lo dejás vacío y queda marcado como “pendiente de confirmar”. Saldá no inventa tasas: cuando la sepás, la agregás y el plan se recalcula.',
  },
  {
    pregunta: '¿Puedo traer mi hoja de Excel?',
    respuesta:
      'Sí. Importás tu Control_deudas.xlsx con una vista previa que muestra filas válidas, errores y duplicados antes de guardar.',
  },
  {
    pregunta: '¿Funciona en el celular?',
    respuesta:
      'Sí. Se instala como una app desde el navegador, abre rápido y tiene modo oscuro. Está pensada primero para la pantalla del celular.',
  },
]
