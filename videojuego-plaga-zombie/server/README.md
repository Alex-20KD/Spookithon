# Asesor con IA (Amazon Bedrock)

El botón **🧠 Pedir consejo** del juego envía el estado de la partida a este pequeño servidor. El servidor le pide a un modelo Claude en Amazon Bedrock un consejo de 2 o 3 frases con la personalidad del personaje elegido.

Si el servidor no está encendido o Bedrock falla, el juego usa un **asesor local por reglas**. La demo funciona siempre, con o sin AWS.

## Cómo activarlo

1. **Pide acceso al modelo.** En la consola de AWS, abre Amazon Bedrock, entra a *Model access* y habilita Claude de Anthropic en tu región.

2. **Configura las credenciales de AWS.** El servidor usa la cadena de credenciales estándar del AWS SDK v3. Nunca pongas claves en el código del juego. Usa una de estas opciones:

   ```powershell
   # Opción A: perfil de AWS (aws configure o aws sso login)
   $env:AWS_PROFILE = "mi-perfil"

   # Opción B: variables de entorno en la terminal donde corre el servidor
   $env:AWS_ACCESS_KEY_ID = "..."
   $env:AWS_SECRET_ACCESS_KEY = "..."
   $env:AWS_SESSION_TOKEN = "..."   # solo con credenciales temporales
   ```

3. **Elige región y modelo** (opcional):

   ```powershell
   $env:AWS_REGION = "us-east-1"
   $env:BEDROCK_MODEL_ID = "anthropic.claude-opus-5-5"
   ```

   Algunas regiones exigen un perfil de inferencia entre regiones. En ese caso usa el ID con prefijo que muestra la consola de Bedrock, por ejemplo `us.anthropic.claude-opus-5-5`.

4. **Instala y enciende el servidor**, y en otra terminal el juego:

   ```powershell
   npm.cmd run server:install
   npm.cmd run server
   # en otra terminal
   npm.cmd run dev
   ```

5. **Comprueba que funciona.** Abre <http://localhost:8787/api/health>. En el juego, pide un consejo. Debajo de la respuesta aparece "🤖 Consejo generado con IA (Amazon Bedrock)". Si dice "📋 Asesor local por reglas", el motivo aparece al lado y el error detallado sale en la terminal del servidor.

## Variables de entorno

| Variable | Por defecto | Para qué sirve |
| --- | --- | --- |
| `AWS_REGION` | `us-east-1` | Región de Bedrock |
| `BEDROCK_MODEL_ID` | `anthropic.claude-opus-5-5` | Modelo o perfil de inferencia |
| `BEDROCK_MAX_TOKENS` | `16000` | Límite de tokens de la respuesta |
| `BEDROCK_TIMEOUT_MS` | `25000` | Tiempo máximo de espera |
| `PORT` | `8787` | Puerto del servidor; Vite redirige `/api` aquí |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | Origen permitido por CORS |
| `RATE_LIMIT_PER_MINUTE` | `20` | Consejos por minuto por IP, para no disparar costos |

## Qué se envía

Solo datos de la partida: día, dificultad, cifras globales, los cinco cantones más infectados, presupuesto, cura, acciones activas, mutaciones y misiones. El servidor descarta cualquier otro campo y acota longitudes antes de armar el prompt.

Cada consejo es una llamada facturada por AWS según los precios de Bedrock.
