# ⚔️ War Simulator (Multiplayer 3D Melee Game)

Un trepidante juego de batallas y asedios masivos en 3D ejecutable directamente en el navegador. Construido desde cero utilizando **Vanilla JavaScript**, **Three.js** para el renderizado, y un robusto backend de **Node.js + WebSockets** para multijugador en tiempo real. 

Este proyecto destaca por su motor de físicas y colisiones personalizado, su capacidad técnica para albergar hasta 100 soldados (entre jugadores e IA) usando un modelo Peer-to-Peer simulado (Host-Authoritative), y su arquitectura desacoplada para un despliegue en la nube indoloro.

## ✨ Características Principales

* **Multijugador en Tiempo Real:** Infraestructura sólida de `WebSockets` (`ws`) para mantener el estado del juego sincronizado a bajas latencias mediante interpolaciones rápidas.
* **Arquitectura Host-Authoritative:** Uno de los jugadores en la sala asume el rol de "Host", encargándose de procesar la Inteligencia Artificial de las decenas de bots y sincronizarlas de forma pasiva (mediante mallas fantasma) para el resto de clientes interconectados.
* **Renderizado 3D Ligero y Segmentado:** Gráficos fluidos impulsados por `Three.js`. Los personajes están altamente optimizados utilizando tres primitivas modulares (Cabeza, Casco plomo y Tronco colorizado), maximizando visuales con hasta 100 entidades.
* **Terreno Procedural y Horizonte Infinito:** Un mundo inmersivo con montañas matemáticas (seno/coseno), bosques con cilindros de exclusión, un horizonte eterno, niebla deslucida en la lejanía atmosférica y reiluminación solar global.
* **IA Cognitiva (FSM):** Los NPCs operan bajo un cerebro de Máquinas de Estados (IDLE, CHASING, ATTACKING) separando amistosamente su agresividad si divisan a miembros auténticos de su bando frente a rivales remotos.
* **Interfaz Inteligente (UI/HUD):** Minimapa 2D renderizado sobre un `<canvas>`, barra de vida, joystick virtual, temporizador universal de sala, y una tabla clasificatoria de post-partida que se desliza y divide en dos de forma responsiva para no apilar listas de altos volúmenes de usuarios.

## 🎮 Modos de Juego

1.  **Todos contra Todos (FFA - Free For All):**
    * **Duración:** 2 Minutos.
    * **Dinámica:** La masacre total. Permite de 2 a 100 jugadores/bots esparciéndose aleatoriamente. No existen las alianzas, la tabla determinará al vencedor individual por bajas.
2.  **Asedio (SIEGE):**
    * **Condición de Victoria:** Escala a la primera facción que acabe con la vida del bando enemigo en un registro de muertes global y asíncrono (50 muertes por defecto).
    * **Dinámica:** Batalla por equipos. Los defensores surgen dentro de los muros, mientras que los atacantes embisten desde el perímetro obligando a forzar la entrada principal. 

## 🕹️ Controles

| Acción | Teclado (PC) | Táctil (Móvil) |
| :--- | :--- | :--- |
| **Moverse** | `W`, `A`, `S`, `D` | Joystick Virtual (Izquierda) |
| **Cámara** | Movimiento del Ratón | Joystick Virtual (Dirección) |
| **Atacar** | `Clic Izquierdo` | Botón Rojo |
| **Bloquear (Escudo)**| `Clic Derecho` | Botón Azul |
| **Saltar** | `Espacio` | Botón Verde |

## 📁 Arquitectura del Código (SOLID)

La aplicación fue rediseñada estrictamente para aislar la vista y el control de flujo multijugador.

```text
/
├── package.json        # Gestión de módulos principales y puertos
├── client/             # Entorno aislado para renderizado del cliente
│   ├── index.html      # Estructura del DOM (Menús de Host y Client)
│   ├── css/
│   └── js/
│       ├── main.js     # Core local, recepciones de red y lógica gráfica principal
│       ├── network.js  # Tubería abstracta WebSockets
│       ├── engine/     # scene.js, renderer.js, camera.js
│       ├── world/      # Generadores numéricos de biomas y castillo con colisiones
│       ├── gameplay/   # Jugador y combates
│       ├── ai/         # npc.js y control FSM
│       └── ui/         # hud.js
└── server/             # Procesamiento en tierra del motor Node.js
    ├── index.js        # Entrypoint e incializador híbrido de http + WebSockets
    ├── sockets/        # Reenrutador lógico masivo (socketHandler.js)
    ├── state/          # Manipulación volátil de las Salas e IDs (roomManager.js)
    └── utils/          # Encapsuladores red
```

## 🚀 Despliegue e Instalación Local

**Configuración Temprana en Entornos Pruebas:**
1. Instalar modulos con: `npm install`
2. Correr aplicación local `npm start` (Y abrir `localhost:3000`)

**Estrategia de Despliegue Simplificada (Render / Web Service)**
Todo este repositorio está calificado como un despliegue directo "Plug And Play". Si deseas alzar una sala con amigos hoy mismo, con plataformas gratuitas como **Render.com** únicamente tienes conectar el control de ramas Github creando un "Web Service Node" y aceptando los comandos por defecto (`npm install` y `npm start`). El servidor adaptará su variable entorno para funcionar universalmente a través de HTTPS.

---
*Si participas o provienes del enfoque interno en relación con la Universidad, debes saber que esta documentación suplanta a los documentos antiguos preservando las garantías de calificación originales pero actualizando toda la tecnología implicada.*
