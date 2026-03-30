# ⚔️ Juego de Espadas 3D (Web-Based Melee Game)

Un trepidante juego de combate cuerpo a cuerpo en 3D ejecutable directamente en el navegador. Construido desde cero utilizando **Vanilla JavaScript** y **Three.js** para el renderizado, sin depender de motores de videojuegos pesados como Unity o Unreal.

Este proyecto destaca por su motor de físicas y colisiones personalizado, su inteligencia artificial basada en máquinas de estados finitos (FSM) y su terreno generado proceduralmente.

## ✨ Características Principales

* **Renderizado 3D Ligero:** Gráficos fluidos impulsados por `Three.js` con iluminación, sombras (flat shading) y geometrías primitivas optimizadas.
* **Terreno Procedural y Arquitectura:** Un mundo de 300x300 unidades generado mediante funciones matemáticas (seno/coseno), un bosque denso con colisiones cilíndricas, y un castillo macizo con rampas suavizadas (AABB slicing) para una navegación fluida.
* **Inteligencia Artificial (FSM):** Los NPCs (Bots) operan bajo un sistema de estados (IDLE, CHASING, ATTACKING). Incluyen sistema de patrullaje (Roaming), rango de visión dinámico y un algoritmo de esquive básico (Feeler Logic) para rodear obstáculos.
* **Motor de Físicas Custom:** Sistema unificado de detección de suelo (`getGroundY`) para gravedad y rampas, colisiones AABB para estructuras, y resolución de fuerzas secundarias (Clipping prevention) para que los personajes se empujen entre sí sin atravesar paredes.
* **Interfaz Híbrida (UI/HUD):** Minimapa 2D en tiempo real renderizado sobre un elemento `<canvas>`, barra de vida, temporizadores, y una tabla de clasificación estilo "CS 1.6" al finalizar la partida.
* **Controles Responsivos:** Soporte total para teclado y ratón en PC (con Pointer Lock API), y Joystick virtual + botones en pantalla para dispositivos móviles.

## 🎮 Modos de Juego

1.  **Todos contra Todos (FFA - Free For All):**
    * **Duración:** 2 Minutos.
    * **Dinámica:** 20 entidades (1 Jugador + 19 Bots) esparcidas por todo el mapa. No hay alianzas; gana quien sobreviva o consiga más bajas antes de que el reloj llegue a cero.
2.  **Asedio (SIEGE):**
    * **Condición de Victoria:** El primer equipo en alcanzar 50 bajas.
    * **Dinámica:** Batalla por equipos (10 Atacantes vs 10 Defensores). Los defensores aparecen dentro del castillo, mientras que los atacantes inician en un campamento al sur. Los NPCs atacantes tienen visión global para marchar directamente a la fortaleza.

## 🕹️ Controles

| Acción | Teclado (PC) | Táctil (Móvil) |
| :--- | :--- | :--- |
| **Moverse** | `W`, `A`, `S`, `D` | Joystick Virtual (Izquierda) |
| **Cámara** | Movimiento del Ratón | Joystick Virtual (Dirección) |
| **Atacar** | `Clic Izquierdo` | Botón Rojo |
| **Bloquear (Escudo)**| `Clic Derecho` | Botón Azul |
| **Saltar** | `Espacio` | Botón Verde |

## 📁 Estructura del Proyecto

La arquitectura del código sigue un modelo modular estricto (ES6 Modules) para mantener la escalabilidad:

```text
/
├── index.html          # Interfaz de usuario, Menú, HUD y Pantalla Final
├── css/
│   └── styles.css      # Estilos responsivos, UI superpuesta y Menús
└── js/
    ├── main.js         # Bucle principal (Game Loop), gestor de modos y spawns
    ├── engine/         # Motor Gráfico (scene.js, camera.js, renderer.js)
    ├── world/          # Entorno (terrain.js, castle.js, trees.js, colliders.js)
    ├── gameplay/       # Lógica del Jugador y sistema de combate
    ├── ai/             # npc.js (Cerebro de los bots y FSM)
    ├── input/          # Gestores de teclado, ratón y joystick táctil
    └── ui/             # hud.js (Actualización de barras, Minimapa y Scoreboard)
