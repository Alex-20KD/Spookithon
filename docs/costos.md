# Declaración de costos — Plaga Zombie: Manabí

> **Región:** us-east-1 (N. Virginia).
> **Fecha de consulta de precios:** 28 de octubre de 2026.
> Precios de referencia de las páginas públicas de AWS / calculator.aws.
> Los precios de AWS cambian: verificar en <https://calculator.aws> antes de citar.
> **Todos los datos de la aplicación son SIMULADOS.**

Este proyecto se diseñó para ser **barato**: hosting estático (S3 + CloudFront)
y un único contenedor pequeño (ECS Express, 1 vCPU / 2 GB). No usa Lambda,
API Gateway ni bases de datos caras en el flujo principal.

---

## A. Costo mensual estimado de operación

Estimación para un uso de **demo/hackathon** (tráfico bajo, un solo contenedor
encendido de forma continua). El contenedor es el componente dominante del costo.

| Servicio | Uso estimado (mensual) | Precio unitario (aprox.) | Subtotal |
|---|---|---|---|
| **Amazon ECS Express** (cómputo) | 1 tarea · 1 vCPU · 2 GB · 24×7 ≈ 730 h | vCPU ~$0.04046/h + GB ~$0.004445/h·GB | ~$29.5 + ~$6.5 = **~$36.00** |
| **Amazon S3** (almacenamiento) | ~10 MB de builds estáticos | ~$0.023 / GB·mes | **~$0.01** |
| **Amazon S3** (peticiones) | miles de GET | ~$0.0004 / 1.000 GET | **~$0.01** |
| **Amazon CloudFront** (transferencia) | ~2 GB salida/mes | ~$0.085 / GB (primeros 10 TB) | **~$0.17** |
| **Amazon CloudFront** (peticiones) | ~50.000 HTTPS | ~$0.01 / 10.000 | **~$0.05** |
| **Amazon ECR** (almacenamiento imagen) | ~0.1 GB | ~$0.10 / GB·mes | **~$0.01** |
| **Amazon DynamoDB** (bajo demanda) | pocas lecturas/escrituras + <1 GB | pago por uso | **~$0.10** |
| **Amazon CloudWatch** (logs) | pocos MB de logs | ~$0.50 / GB ingerido | **~$0.05** |
| **AWS IAM / AWS Budgets** | — | sin costo | **$0.00** |
| | | **TOTAL estimado** | **≈ $36.5 / mes** |

> **Nota clave sobre el costo:** el 98% del gasto es el **contenedor de ECS
> encendido 24×7**. Para un hackathon que vive pocos días, el costo real es una
> fracción de ese total mensual (ver parte B). **Apagar / borrar el servicio ECS
> después del pitch** reduce el costo a prácticamente $0 (solo quedan centavos de
> S3/ECR). El resto de servicios (S3, CloudFront, DynamoDB) son despreciables a
> esta escala.

### Cómo reducirlo aún más (si se necesitara)
- Borrar el servicio ECS cuando no se use (lo más efectivo).
- CPU/memoria menores (0.25 vCPU) si el tiempo de simulación lo permite.
- CloudFront Price Class 100 (solo NA/UE).

---

## B. Gasto real durante el evento

El servicio estuvo encendido solo durante el desarrollo y la demo (pocos días),
no un mes completo, así que el gasto real es mucho menor que el estimado mensual.

> ⚠️ **PENDIENTE (equipo):** adjuntar la captura de **AWS Cost Explorer** /
> facturación con el gasto real del evento en `docs/gasto-real.png` y enlazarla
> aquí. El jurado verifica que coincida con lo declarado.

Estimación del gasto real (≈ días de uso del contenedor ECS):

| Concepto | Detalle | Gasto aprox. |
|---|---|---|
| ECS Express (1 vCPU/2 GB) | ~X días × ~$1.2/día | **~$ (ajustar)** |
| S3 + CloudFront + ECR + DynamoDB | tráfico de demo | **< $0.20** |
| | **Total real del evento** | **~$ (ajustar con Cost Explorer)** |

> Sustituir "X días" y el total por el dato real de la consola de facturación.

---

## Control de presupuesto

- **AWS Budget** `spookython-plaga`: **$17/mes**, con alertas por correo al
  **50%, 80% y 100%** más una de **pronóstico**. Correos del equipo verificados.
- Captura del Budget: `docs/budget.jpeg`.
- Cost Explorer activado (los datos tardan ~24 h en aparecer tras la activación).
