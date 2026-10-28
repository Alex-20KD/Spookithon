# Declaración de costos — Plaga Zombie: Manabí

> **Región:** us-east-1 (N. Virginia).
> **Fecha de consulta de precios:** 28 de octubre de 2026.
> Precios de referencia de las páginas públicas de AWS / calculator.aws.
> Los precios de AWS cambian: verificar en <https://calculator.aws> antes de citar.
> **Todos los datos de la aplicación son SIMULADOS.**

Este proyecto se diseñó para ser **barato**: hosting estático (S3 + CloudFront)
y un único contenedor (ECS Express). No usa Lambda ni API Gateway; DynamoDB va
en modo bajo demanda. El cómputo se amplió desde 1 vCPU / 2 GB para poder correr
**300 corridas** por petición bajo el límite de 60 s del balanceador.

---

## A. Costo mensual estimado de operación

Estimación para un uso de **demo/hackathon** (tráfico bajo, un solo contenedor
encendido de forma continua). El contenedor es el componente dominante del costo.

### Cómputo ECS según la configuración

Precio de referencia (Fargate, us-east-1): **~$0.04046 por vCPU·hora** y
**~$0.004445 por GB·hora**. Un mes ≈ 730 h.

| Configuración | Cálculo por hora | Por día | Por mes (730 h) |
|---|---|---|---|
| 1 vCPU / 2 GB (inicial) | 1×0.04046 + 2×0.004445 = $0.0494 | ~$1.18 | ~$36.0 |
| **2 vCPU / 4 GB (actual, en ECS)** | 2×0.04046 + 4×0.004445 = $0.0987 | **~$2.37** | **~$72.1** |
| 4 vCPU / 8 GB | 4×0.04046 + 8×0.004445 = $0.1974 | ~$4.74 | ~$144.1 |

La configuración desplegada es **2 vCPU / 4 GB**.

### Resto de servicios

| Servicio | Uso estimado (mensual) | Precio unitario (aprox.) | Subtotal |
|---|---|---|---|
| **Amazon ECS Express** (cómputo) | 1 tarea 2 vCPU / 4 GB, 24×7 | $0.0987 / hora | **~$72.10** |
| **Amazon S3** (almacenamiento) | ~10 MB de builds estáticos | ~$0.023 / GB·mes | **~$0.01** |
| **Amazon S3** (peticiones) | miles de GET | ~$0.0004 / 1.000 GET | **~$0.01** |
| **Amazon CloudFront** (transferencia) | ~2 GB salida/mes | ~$0.085 / GB (primeros 10 TB) | **~$0.17** |
| **Amazon CloudFront** (peticiones) | ~50.000 HTTPS | ~$0.01 / 10.000 | **~$0.05** |
| **Amazon ECR** (almacenamiento imagen) | ~0.1 GB | ~$0.10 / GB·mes | **~$0.01** |
| **Amazon DynamoDB** (bajo demanda) | pocas lecturas/escrituras + <1 GB | pago por uso | **~$0.10** |
| **Amazon CloudWatch** (logs) | pocos MB de logs | ~$0.50 / GB ingerido | **~$0.05** |
| **AWS IAM / AWS Budgets** | — | sin costo | **$0.00** |
| | | **TOTAL estimado** | **≈ $72.5 / mes** |

> **Nota clave sobre el costo:** casi todo el gasto es el **contenedor de ECS
> encendido 24×7**. El resto (S3, CloudFront, ECR, DynamoDB, CloudWatch) suma
> menos de $0.50/mes a esta escala. Como el hackathon dura pocos días, el costo
> real es una fracción del total mensual (ver parte B), y **el servicio ECS se
> borra después del pitch**, con lo que el costo queda prácticamente en $0.

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
| ECS Express | días encendido × ~$1.18/día (1 vCPU) o ~$2.37/día (2 vCPU) | **~$ (ajustar con Cost Explorer)** |
| S3 + CloudFront + ECR + DynamoDB | tráfico de demo | **< $0.20** |
| | **Total real del evento** | **~$ (ajustar con Cost Explorer)** |

> Sustituir "X días" y el total por el dato real de la consola de facturación.

---

## Control de presupuesto

- **AWS Budget** `spookython-plaga`: **$17/mes**, con alertas por correo al
  **50%, 80% y 100%** más una de **pronóstico**. Correos del equipo verificados.
- Captura del Budget: `docs/budget.jpeg`.
- Cost Explorer activado (los datos tardan ~24 h en aparecer tras la activación).
