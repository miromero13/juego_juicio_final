import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

type Category = 'fe' | 'vigilancia' | 'obras'
type Stage = Category | 'mascara' | 'talentos' | 'completed'
type Question = { id: string; question: string; options: string[]; correctIndex: number }
type PublicQuestion = Omit<Question, 'correctIndex'>
type Player = { socketId: string; name: string; score: number; stage: Stage; completedAt?: number; question?: Question; maskIndex?: number; maskChoiceAt?: number; talents?: number }
type FinalPlayer = { name: string; score: number }
type Room = { code: string; hostSocketId: string; status: 'lobby' | 'playing' | 'final'; players: Player[]; gameStartedAt?: number; gameEndsAt?: number; gameTimer?: ReturnType<typeof setTimeout>; ranking?: FinalPlayer[] }
type RoomView = { code: string; status: Room['status']; gameStartedAt?: number; gameEndsAt?: number; players: Array<{ name: string; score: number; stage: Stage }> }
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
type Questions = Record<Category, Question[]>

const port = Number(process.env.PORT ?? 3000)
const maxPlayers = 5
const gameDurationMs = Number(process.env.GAME_DURATION_SECONDS ?? 300) * 1000
const clientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim())
const questions = JSON.parse(readFileSync(new URL('./data/questions.json', import.meta.url), 'utf8')) as Questions
const rooms = new Map<string, Room>()

for (const category of ['fe', 'vigilancia', 'obras'] as const) {
  if (!Array.isArray(questions[category]) || questions[category].length !== 40) {
    throw new Error(`El banco de ${category} debe contener exactamente 40 preguntas.`)
  }
}

const app = express()
app.use(cors({ origin: clientOrigins }))
app.get('/health', (_request, response) => response.json({ status: 'ok' }))

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: clientOrigins, methods: ['GET', 'POST'] } })

function roomView(room: Room): RoomView {
  return { code: room.code, status: room.status, gameStartedAt: room.gameStartedAt, gameEndsAt: room.gameEndsAt, players: room.players.map(({ name, score, stage }) => ({ name, score, stage })) }
}

function newRoomCode(): string {
  let code = ''
  do code = Math.random().toString(36).slice(2, 6).toUpperCase()
  while (rooms.has(code))
  return code
}

function emitRoomUpdate(room: Room): void {
  io.to(room.code).emit('room:updated', roomView(room))
}

function endGame(room: Room): void {
  if (room.status === 'final') return
  if (room.gameTimer) clearTimeout(room.gameTimer)
  room.status = 'final'
  room.ranking = [...room.players]
    .sort((a, b) => b.score - a.score || (a.completedAt ?? Number.MAX_SAFE_INTEGER) - (b.completedAt ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
    .map(({ name, score }) => ({ name, score }))
  emitRoomUpdate(room)
  io.to(room.code).emit('game:final', { ranking: room.ranking })
}

function questionFor(category: Category): Question {
  const bank = questions[category]
  const source = bank[Math.floor(Math.random() * bank.length)]
  const options = source.options.map((option, index) => ({ option, index }))

  for (let index = options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[options[index], options[swapIndex]] = [options[swapIndex], options[index]]
  }

  return {
    ...source,
    options: options.map(({ option }) => option),
    correctIndex: options.findIndex(({ index }) => index === source.correctIndex),
  }
}

function isQuestionStage(stage: Stage): stage is Category {
  return stage === 'fe' || stage === 'vigilancia' || stage === 'obras'
}

function sendQuestion(socketId: string, player: Player, category: Category): void {
  const question = questionFor(category)
  player.stage = category
  player.question = question
  const { correctIndex: _correctIndex, ...publicQuestion } = question
  io.to(socketId).emit('question:show', { ...publicQuestion satisfies PublicQuestion, category })
}

function startMask(socketId: string, player: Player): void {
  player.stage = 'mascara'
  player.maskIndex = Math.floor(Math.random() * 25)
  io.to(socketId).emit('mask:preview', { heartIndex: player.maskIndex })
  setTimeout(() => {
    if (player.stage !== 'mascara') return
    player.maskChoiceAt = Date.now()
    io.to(socketId).emit('mask:choose')
  }, 3000)
}

function startTalents(socketId: string, player: Player): void {
  player.stage = 'talentos'
  player.talents = 0
  io.to(socketId).emit('talents:start', { endsAt: Date.now() + 10_000 })
  setTimeout(() => {
    if (player.stage !== 'talentos') return
    player.score += Math.min(player.talents ?? 0, 500)
    player.stage = 'obras'
    io.to(socketId).emit('talents:result', { talents: player.talents, score: player.score })
    setTimeout(() => {
      if (player.stage === 'obras') sendQuestion(socketId, player, 'obras')
    }, 3000)
  }, 10_000)
}

io.on('connection', (socket) => {
  socket.on('room:create', (ack: (result: Result<RoomView>) => void) => {
    const room: Room = { code: newRoomCode(), hostSocketId: socket.id, status: 'lobby', players: [] }
    rooms.set(room.code, room)
    socket.join(room.code)
    ack({ ok: true, data: roomView(room) })
  })

  socket.on('room:join', (payload: { code?: string; name?: string }, ack: (result: Result<RoomView>) => void) => {
    const room = rooms.get(payload.code?.trim().toUpperCase() ?? '')
    const name = payload.name?.trim().replace(/\s+/g, ' ') ?? ''
    if (!room) return ack({ ok: false, error: 'La sala no existe.' })
    if (room.status !== 'lobby') return ack({ ok: false, error: 'La partida ya comenzó.' })
    if (room.players.length >= maxPlayers) return ack({ ok: false, error: 'La sala ya tiene cinco jugadores.' })
    if (name.length < 2 || name.length > 20) return ack({ ok: false, error: 'El nombre debe tener entre 2 y 20 caracteres.' })
    if (room.players.some((player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return ack({ ok: false, error: 'Ese nombre ya está en uso en esta sala.' })

    room.players.push({ socketId: socket.id, name, score: 0, stage: 'fe' })
    socket.join(room.code)
    emitRoomUpdate(room)
    ack({ ok: true, data: roomView(room) })
  })

  socket.on('game:start', (payload: { code?: string }, ack: (result: Result<RoomView>) => void) => {
    const room = rooms.get(payload.code?.trim().toUpperCase() ?? '')
    if (!room || room.hostSocketId !== socket.id) return ack({ ok: false, error: 'No puedes iniciar esta sala.' })
    if (room.players.length === 0) return ack({ ok: false, error: 'Debe haber al menos un jugador.' })

    room.status = 'playing'
    room.gameStartedAt = Date.now()
    room.gameEndsAt = room.gameStartedAt + gameDurationMs
    room.gameTimer = setTimeout(() => endGame(room), gameDurationMs)
    for (const player of room.players) sendQuestion(player.socketId, player, 'fe')
    emitRoomUpdate(room)
    io.to(room.code).emit('game:started')
    ack({ ok: true, data: roomView(room) })
  })

  socket.on('question:answer', (payload: { code?: string; answerIndex?: number }, ack: (result: Result<{ correct: boolean; score: number }>) => void) => {
    const room = rooms.get(payload.code?.trim().toUpperCase() ?? '')
    const player = room?.players.find((candidate) => candidate.socketId === socket.id)
    if (!room || room.status !== 'playing' || !player?.question || !isQuestionStage(player.stage)) return ack({ ok: false, error: 'No hay una pregunta disponible.' })
    if (!Number.isInteger(payload.answerIndex) || payload.answerIndex! < 0 || payload.answerIndex! >= player.question.options.length) return ack({ ok: false, error: 'Respuesta inválida.' })

    const category = player.stage
    const correct = payload.answerIndex === player.question.correctIndex
    if (correct) player.score += 500
    player.question = undefined
    if (category === 'fe') player.stage = 'mascara'
    else if (category === 'vigilancia') player.stage = 'talentos'
    else {
      player.stage = 'completed'
      player.completedAt = Date.now()
    }
    socket.emit('question:result', { category, correct, score: player.score })
    emitRoomUpdate(room)
    if (category === 'fe') {
      setTimeout(() => {
        if (room.status === 'playing' && player.stage === 'mascara') startMask(socket.id, player)
      }, 3000)
    } else if (category === 'vigilancia') {
      setTimeout(() => {
        if (room.status === 'playing' && player.stage === 'talentos') startTalents(socket.id, player)
      }, 3000)
    } else {
      setTimeout(() => endGame(room), 3000)
    }
    ack({ ok: true, data: { correct, score: player.score } })
  })

  socket.on('mask:choose', (payload: { code?: string; index?: number }, ack?: (result: Result<{ correct: boolean; score: number }>) => void) => {
    const room = rooms.get(payload.code?.trim().toUpperCase() ?? '')
    const player = room?.players.find((candidate) => candidate.socketId === socket.id)
    if (!room || !player || player.stage !== 'mascara' || player.maskIndex === undefined || player.maskChoiceAt === undefined) return ack?.({ ok: false, error: 'La máscara aún no está lista.' })
    if (!Number.isInteger(payload.index) || payload.index! < 0 || payload.index! > 24) return ack?.({ ok: false, error: 'Selección inválida.' })
    const correct = payload.index === player.maskIndex
    if (correct) player.score += Math.max(300, 500 - Math.floor((Date.now() - player.maskChoiceAt) / 40))
    player.maskIndex = undefined
    player.maskChoiceAt = undefined
    io.to(socket.id).emit('mask:result', { correct, score: player.score })
    setTimeout(() => {
      if (player.stage === 'mascara') sendQuestion(socket.id, player, 'vigilancia')
    }, 3000)
    emitRoomUpdate(room)
    ack?.({ ok: true, data: { correct, score: player.score } })
  })

  socket.on('talents:tap', (payload: { code?: string }) => {
    const room = rooms.get(payload.code?.trim().toUpperCase() ?? '')
    const player = room?.players.find((candidate) => candidate.socketId === socket.id)
    if (room && player?.stage === 'talentos') player.talents = Math.min((player.talents ?? 0) + 1, 500)
  })

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      if (room.hostSocketId === socket.id) {
        rooms.delete(room.code)
        io.to(room.code).emit('room:closed')
        continue
      }
      const index = room.players.findIndex((player) => player.socketId === socket.id)
      if (index >= 0) {
        room.players.splice(index, 1)
        emitRoomUpdate(room)
      }
    }
  })
})

httpServer.listen(port, () => console.info(`Servidor disponible en el puerto ${port}`))
