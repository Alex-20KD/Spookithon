# Diagrama de arquitectura — Plaga Zombie: Manabí

Fuente del diagrama en **Mermaid**. Para exportar a imagen (PNG/SVG):
pega el bloque de abajo en <https://mermaid.live> y usa "Export".

- 🟩 **Verde** = público (CloudFront, API)
- 🟦 **Azul** = cómputo y estáticos
- 🟥 **Rojo/gris** = privado (roles, tablas, logs)

```mermaid
flowchart TB
    user["👤 Usuario<br/>(navegador / móvil)"]

    subgraph PUBLICO["Capa pública (HTTPS)"]
        cf["Amazon CloudFront<br/>d2n10k2c1hlb54.cloudfront.net"]
    end

    subgraph ESTATICOS["Contenido estático — Amazon S3"]
        s3dash["Dashboard React/Vite<br/>(ruta /)"]
        s3game["Videojuego React/Phaser<br/>(ruta /juego/)"]
    end

    subgraph COMPUTO["Cómputo — Amazon ECS Express Mode (us-east-1)"]
        ecs["Contenedor FastAPI :8080<br/>Simulador SEIR sobre grafo<br/>(pool de procesos)"]
    end

    subgraph PRIVADO["Capa privada (mínimo privilegio)"]
        ecr["Amazon ECR<br/>imagen plaga-backend"]
        ddb["Amazon DynamoDB<br/>tablas plaga-*"]
        iam["AWS IAM<br/>roles acotados"]
        cw["Amazon CloudWatch<br/>logs"]
    end

    budget["AWS Budgets<br/>alerta de costos"]

    user -->|HTTPS| cf
    cf -->|"/"| s3dash
    cf -->|"/juego/"| s3game
    s3dash -->|"fetch /comparar (CORS)"| ecs
    ecr -.->|imagen| ecs
    ecs -.->|lectura/escritura| ddb
    ecs -.->|logs| cw
    iam -.->|permisos| ecs
    budget -.->|vigila| ecs

    classDef publico fill:#1f7a3d,stroke:#0f3d1f,color:#fff;
    classDef estatico fill:#1d4e89,stroke:#0d2b4d,color:#fff;
    classDef computo fill:#2563eb,stroke:#13306b,color:#fff;
    classDef privado fill:#7a1f2b,stroke:#3d0f16,color:#fff;

    class cf publico;
    class s3dash,s3game estatico;
    class ecs computo;
    class ecr,ddb,iam,cw privado;
```

## Flujo

1. El **usuario** entra por HTTPS a **CloudFront**, que da una sola URL pública.
2. CloudFront sirve los estáticos desde **S3**: el **dashboard** en `/` y el
   **videojuego** en `/juego/`.
3. El dashboard llama directamente a la **API FastAPI en ECS** (`POST /comparar`),
   permitido por CORS. La API corre el simulador (300+ corridas no, tope 150 por
   el límite de 60 s del balanceador) y devuelve métricas, curvas p10–p90 y R0.
4. La **imagen** del contenedor vive en **ECR**; ECS la despliega.
5. **DynamoDB** (`plaga-*`) guarda datos; **CloudWatch** recoge logs; **IAM**
   da permisos mínimos; **AWS Budgets** vigila el costo.

## Qué es público y qué es privado

- **Público:** CloudFront (y, de hecho, la URL de la API de ECS).
- **Privado:** las tablas DynamoDB, los roles IAM y los logs no son accesibles
  desde internet; solo el contenedor los usa con permisos acotados.
