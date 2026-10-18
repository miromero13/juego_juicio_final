# Juicio Final | Interactive Multiplayer Party Game

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![WebSockets](https://img.shields.io/badge/WebSockets-Real--Time-010101?style=flat&logo=socketdotio&logoColor=white)](https://socket.io)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=flat&logo=render&logoColor=black)](https://render.com)

Jackbox-style real-time multiplayer party game for up to 5 players. The host screen projects the main game board on a TV or laptop while players join dynamically from their smartphones by scanning a QR code or entering a room code.

---

## 🎮 Gameplay & Mechanics

Players compete asynchronously in a thematic progression journey through five stages of judgment:

$$\text{Fe} \longrightarrow \text{Máscara} \longrightarrow \text{Vigilancia} \longrightarrow \text{Talentos} \longrightarrow \text{Obras} \longrightarrow \text{Juicio Final}$$

- **Zero-Friction Onboarding:** Players join with temporary nicknames via QR code or short room PIN without needing accounts or app installations.
- **Individual Pacing:** Each participant answers challenges on their phone at their own speed.
- **Score System:** Each of the 5 challenges grants up to 500 points for a maximum score of 2,500 points.
- **Sudden Death Finish:** The game concludes for everyone when the first player finishes all five trials, triggering the final scoreboard and award ceremony on the main display.

---

## 🏛️ System Architecture

- **`client/`**: Dual responsive interface:
  - **Host View:** Big-screen layout displaying room PIN, QR code, live connected player avatars, countdown timers, and final leaderboard.
  - **Player Controller View:** Mobile-optimized touch UI with dynamic buttons, sliders, and timed decision interfaces.
- **`server/`**: Low-latency WebSocket room broker built with Node.js to manage active sessions, room state machines, and real-time score dispatch.

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Run development servers (Client + Server)
npm run dev
```

---

## 👤 Author

Developed by **María Ilse Romero Saavedra** ([@miromero13](https://github.com/miromero13)).
