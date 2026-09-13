# Plan de implementación: Juego del Juicio Final

## Objetivo

Crear una experiencia web multijugador para hasta cinco participantes. Una pantalla de anfitrión en laptop se proyecta en la TV y los jugadores usan sus celulares para unirse a una sala temporal, responder pruebas y competir por la mayor puntuación.

La partida sigue este recorrido:

`Fe -> Máscara -> Vigilancia -> Talentos -> Obras -> Juicio Final`

Cada una de las cinco pruebas puntuables vale hasta 500 puntos. La puntuación máxima total es de 2.500 puntos.

## Alcance funcional

- Crear una sala desde la pantalla de anfitrión.
- Mostrar código de sala, QR y conteo de jugadores conectados (máximo 5).
- Permitir que cada jugador se una con un nombre temporal, sin cuentas ni contraseñas.
- Cerrar el acceso a la sala al iniciar la partida.
- Ejecutar las cinco pruebas en orden para cada jugador, sin esperar a los demás participantes.
- Finalizar la partida para todos cuando el primer jugador complete las cinco pruebas.
- Mantener un temporizador global visible durante toda la partida.
- Finalizar inmediatamente la partida y pasar al Juicio Final cuando el temporizador global llegue a cero, aunque queden pruebas o preguntas sin completar.
- Mantener preguntas y respuestas privadas en cada celular.
- Mostrar en TV solamente el estado de la fase, progreso y resultados permitidos.
- Calcular el puntaje de forma autoritativa en el servidor.
- Revelar el ranking final de quinto a primer puesto y un solo ganador.
- Eliminar sala, jugadores, respuestas y resultados de memoria al finalizar o cancelar la partida.

## Tecnología

### Frontend

- React
- TypeScript
- Vite
- React Router, con rutas separadas para anfitrión y jugador
- Socket.IO Client

### Backend

- Node.js
- Express
- Socket.IO
- TypeScript
- Estado de salas exclusivamente en memoria

### Datos

- Un archivo JSON versionado con 120 preguntas:
- 40 de Fe
- 40 de Vigilancia
- 40 de Obras
- Cada pregunta tendrá `id`, `question`, `options` y `correctIndex`.

## Estructura inicial propuesta

```text
.
├── PLAN.md
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── socket/
│   │   └── styles/
│   └── package.json
├── server/
│   ├── src/
│   │   ├── game/
│   │   ├── socket/
│   │   └── index.ts
│   ├── data/questions.json
│   └── package.json
└── package.json
```

El proyecto raíz coordinará los comandos de cliente y servidor para desarrollo y compilación.

## Modelo de partida temporal

Una sala conservará únicamente durante la sesión:

- `code`: código breve de unión.
- `hostSocketId`: conexión del anfitrión.
- `status`: lobby, en_juego, juicio o finalizada.
- `gameEndsAt`: instante límite de la partida, definido por el servidor al iniciarla.
- `players`: hasta cinco jugadores con nombre, conexión, puntuación, prueba actual y progreso individual.
- `completedAt`: instante del servidor en que un jugador completa las cinco pruebas; se usa como desempate.
- `questionsByPlayer`: selección aleatoria de una pregunta de cada categoría por jugador.
- `answers`: estado temporal de respuesta para impedir dobles envíos.
- `talents`: conteo de pulsaciones durante la prueba de talentos.

No se persistirá ningún dato en base de datos, archivos de resultados o almacenamiento del navegador.

## Reglas de puntuación

### Preguntas: Fe, Vigilancia y Obras

- Respuesta incorrecta: 0 puntos.
- Respuesta correcta: 500 puntos exactos.
- La velocidad de respuesta no modifica el puntaje.
- El servidor acepta solo el primer envío válido por pregunta.
- Una pregunta que no se responda antes de que finalice la partida vale 0 puntos.

La validación y asignación de puntos se centralizarán en el backend para impedir cambios desde el cliente.

### Máscara

- Cada jugador recibe una permutación distinta de los personajes enmascarados.
- Solo una posición contiene el rostro verdadero.
- Fallo: 0 puntos.
- Acierto: hasta 500 puntos según la rapidez del primer toque válido.

### Talentos

- Cada jugador inicia Talentos al completar Vigilancia, sin esperar a los demás.
- La fase dura 15 segundos desde el inicio individual de cada jugador, medidos por el servidor.
- Cada pulsación válida incrementa el contador del jugador.
- Todos tienen la misma mecánica y no existen bonificaciones ni multiplicadores aleatorios.
- Cada pulsación suma un punto y el resultado se limita a un máximo de 500 puntos; no se compara con otros jugadores.

### Temporizador global

- Al iniciar la partida, el servidor fija una duración total configurable y calcula `gameEndsAt`.
- La TV muestra el tiempo restante durante todas las fases; los celulares pueden mostrar el mismo contador.
- El servidor es la única fuente de tiempo válida. Los contadores del cliente son únicamente visuales.
- Cuando el tiempo llega a cero, el servidor bloquea nuevas respuestas y pulsaciones, asigna 0 puntos a actividades pendientes y cambia directamente a Juicio Final.
- La partida también termina en el instante en que cualquier jugador completa Obras, su quinta prueba.
- Gana el jugador que tenga más puntos acumulados. Ante un empate entre jugadores que hayan completado el recorrido, gana quien lo terminó primero según la marca de tiempo del servidor.

## Flujo por fase

### 1. Lobby

1. El anfitrión crea una sala.
2. La TV muestra código, QR y jugadores conectados.
3. Cada celular abre la URL de jugador, escribe el código y un nombre.
4. El anfitrión inicia con uno a cinco jugadores conectados; el límite máximo es cinco.
5. La sala se bloquea para nuevas incorporaciones.

### 2. Puerta de la Fe

1. El servidor asigna una pregunta aleatoria de Fe al jugador al comenzar su recorrido.
2. El celular responde una única vez.
3. El servidor valida, suma 500 puntos si es correcta y registra el progreso.
4. El jugador pasa inmediatamente a La Máscara.

### 3. La Máscara

1. Cada jugador observa al rostro verdadero antes de las máscaras.
2. El servidor genera un orden de movimiento independiente por jugador.
3. Tras la animación, el jugador toca la posición que considera correcta.
4. El servidor valida la selección y puntúa.
5. El jugador pasa inmediatamente a Vigilancia.

### 4. Puerta de la Vigilancia

Repite el flujo de Fe usando el banco de Vigilancia.

### 5. Multiplica tus Talentos

1. El jugador inicia una cuenta regresiva individual al llegar a esta prueba.
2. El servidor abre su ventana personal de 15 segundos.
3. El celular envía pulsaciones mientras su ventana permanece abierta.
4. El servidor ignora pulsaciones fuera de tiempo y asigna los puntos según su total individual.
5. El jugador pasa inmediatamente a Obras.

### 6. Puerta de las Obras

Repite el flujo de Fe usando el banco de Obras. Al registrar esta respuesta, el servidor marca la finalización de ese jugador y pasa de inmediato a Juicio Final para toda la sala.

### 7. Juicio Final

1. Los celulares quedan en espera.
2. La TV muestra la ambientación final y calcula los totales desde el servidor.
3. Revela el ranking de quinto a primer puesto.
4. Muestra el mensaje del ganador y el mensaje general de cierre.
5. El anfitrión puede cerrar la sala y volver a crear una partida nueva.

## Eventos de Socket.IO

Los nombres definitivos se ajustarán durante la implementación, pero el protocolo cubrirá:

- Crear sala y devolver código/QR.
- Unirse a sala y notificar lista de jugadores.
- Iniciar partida y bloquear sala.
- Avanzar la prueba individual de cada jugador y publicar su progreso agregado en TV.
- Entregar pregunta privada a un jugador.
- Enviar respuesta, validar una vez y devolver resultado privado.
- Enviar escenario individual de Máscara y selección del jugador.
- Abrir, contar y cerrar Talentos individualmente desde el servidor.
- Finalizar la sala cuando un jugador complete Obras y registrar su marca de tiempo para desempates.
- Publicar progreso agregado para la TV.
- Publicar ranking y resultado final.
- Notificar desconexiones y permitir reconexión mientras la partida sigue activa.

## Diseño de pantallas

### Anfitrión / TV

- Lobby con código, QR y lista de conectados.
- Indicador del recorrido y progreso individual de cada participante: Fe, Máscara, Vigilancia, Talentos y Obras.
- Barras de progreso por jugador sin revelar preguntas ni respuestas.
- Temporizador global persistente y visible durante la partida.
- La TV muestra el avance agregado; los temporizadores de Talentos se muestran solo en el celular que está jugando esa prueba.
- Juicio Final con revelación escalonada del ranking.

### Jugador / celular

- Ingreso por código y nombre.
- Transición inmediata entre pruebas, sin esperar a otros jugadores.
- Pregunta de opción múltiple con bloqueo después de enviar.
- Minijuego de Máscara adaptado a pantalla táctil.
- Botón grande de pulsación para Talentos.
- Mensaje final individual al concluir la partida.

El diseño debe priorizar legibilidad a distancia en TV, botones grandes en celular y una ambientación solemne basada en Mateo 21-25, sin exponer información privada de otros jugadores.

## Despliegue

Se prepararán dos modos de ejecución:

- Desarrollo/feria local: laptop como servidor y todos los dispositivos en la misma red Wi-Fi. Es el modo recomendado sin Internet.
- Producción pública: frontend en Vercel o Netlify y backend WebSocket en Render o Railway. Los jugadores se unen por URL pública con código de sala.

Las URLs del cliente y del servidor se configurarán mediante variables de entorno. En despliegues gratuitos se deberá activar y probar el backend antes de iniciar la feria si el proveedor puede suspenderlo por inactividad.

## Fases de implementación

1. Inicializar monorepo, TypeScript, Vite, Express y Socket.IO.
2. Incorporar el JSON de preguntas y validarlo al iniciar el servidor.
3. Implementar creación/unión/cierre de sala y pantallas de lobby.
4. Implementar el motor de recorrido individual, estado temporal y progreso agregado de TV.
5. Implementar las tres puertas de preguntas con 500 puntos fijos por respuesta correcta.
6. Implementar La Máscara con escenarios individuales y validación en servidor.
7. Implementar Talentos con temporizador individual y un punto por pulsación, limitado a 500.
8. Implementar Juicio Final, ranking y limpieza completa de la sala.
9. Aplicar diseño responsive, QR y manejo de reconexiones.
10. Verificar localmente una partida con cinco navegadores/dispositivos y preparar el despliegue.

## Criterios de aceptación

- Una sala acepta como máximo cinco jugadores y no admite más tras iniciar.
- Cada jugador recibe una pregunta aleatoria de Fe, Vigilancia y Obras.
- Las preguntas no aparecen en la TV ni en celulares ajenos.
- Cada respuesta correcta de Fe, Vigilancia y Obras suma exactamente 500 puntos; una incorrecta o no respondida suma 0.
- La Máscara tiene orden/posición final independiente para cada jugador.
- Cada jugador avanza individualmente por las cinco pruebas y no espera a otros jugadores.
- Talentos dura exactamente 15 segundos por jugador, controlados por servidor, y se puntúa por total individual de pulsaciones.
- El temporizador global es controlado por servidor, permanece visible y fuerza el Juicio Final cuando llega a cero.
- La primera persona que complete las cinco pruebas finaliza la partida para todos.
- Al finalizar por tiempo o por recorrido completado, gana el jugador con más puntos acumulados; en empate, quien completó primero las cinco pruebas.
- La suma final no supera 2.500 puntos por jugador.
- Existe un único ganador, incluso ante empates según la regla definida.
- Al cerrar o terminar una sala, sus datos dejan de existir en memoria.
- La aplicación funciona en pantalla grande y en navegadores móviles modernos conectados a la misma red o a la URL pública.
