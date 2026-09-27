import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import QRCode from 'qrcode'
import { socket } from './lib/socket'
import './App.css'

type Room = {
  code: string
  status: 'lobby' | 'playing' | 'final'
  gameStartedAt?: number
  gameEndsAt?: number
  players: Array<{ name: string; score: number; stage: string }>
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string }
type Category = 'fe' | 'vigilancia' | 'obras'
type Question = { id: string; question: string; options: string[]; category: Category }
type QuestionResult = { category: Category; correct: boolean; score: number }
type MaskState = { mode: 'preview' | 'choose' | 'result'; heartIndex: number; correct?: boolean }

const decoys = ['☁', '☂', '⚡', '☾', '✦', '♜', '♞', '☠', '⚑', '✕', '♠', '♣']

const doorTitle: Record<Category, string> = {
  fe: 'La semilla junto al camino',
  vigilancia: 'La semilla entre pedregales',
  obras: 'La semilla en buena tierra',
}
const doorMessage: Record<Category, { success: string; failure: string }> = {
  fe: { success: 'La palabra encontró un corazón dispuesto.', failure: 'Las distracciones apartaron la palabra del camino.' },
  vigilancia: { success: 'Tu raíz se mantuvo firme ante la prueba.', failure: 'La semilla necesita echar raíces profundas.' },
  obras: { success: 'La buena tierra dio fruto.', failure: 'La palabra está llamada a dar fruto.' },
}

const roomFromUrl = new URLSearchParams(window.location.search).get('join')?.toUpperCase() ?? ''

function App() {
  const [connected, setConnected] = useState(socket.connected)
  const [room, setRoom] = useState<Room | null>(null)
  const [qrCode, setQrCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [question, setQuestion] = useState<Question | null>(null)
  const [result, setResult] = useState<QuestionResult | null>(null)
  const [mask, setMask] = useState<MaskState | null>(null)
  const [talents, setTalents] = useState<{ endsAt: number; taps: number } | null>(null)
  const [talentResult, setTalentResult] = useState<{ talents: number } | null>(null)
  const [ranking, setRanking] = useState<Array<{ name: string; score: number }> | null>(null)

  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onRoomUpdated = (updatedRoom: Room) => setRoom(updatedRoom)
    const onRoomClosed = () => {
      setRoom(null)
      setError('La sala fue cerrada por el anfitrión.')
    }
    const onQuestion = (nextQuestion: Question) => {
      setResult(null)
      setMask(null)
      setTalents(null)
      setTalentResult(null)
      setQuestion(nextQuestion)
    }
    const onResult = (nextResult: QuestionResult) => setResult(nextResult)
    const onMaskPreview = (payload: { heartIndex: number }) => { setQuestion(null); setResult(null); setMask({ mode: 'preview', heartIndex: payload.heartIndex }) }
    const onMaskChoose = () => setMask((current) => current ? { ...current, mode: 'choose' } : current)
    const onMaskResult = (nextResult: { correct: boolean }) => setMask((current) => current ? { ...current, mode: 'result', correct: nextResult.correct } : current)
    const onTalentsStart = (nextTalents: { endsAt: number }) => { setQuestion(null); setResult(null); setTalents({ ...nextTalents, taps: 0 }) }
    const onTalentsResult = (nextResult: { talents: number }) => { setTalents(null); setTalentResult(nextResult) }
    const onFinal = (final: { ranking: Array<{ name: string; score: number }> }) => {
      setQuestion(null)
      setMask(null)
      setTalents(null)
      setRanking(final.ranking)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('room:updated', onRoomUpdated)
    socket.on('room:closed', onRoomClosed)
    socket.on('question:show', onQuestion)
    socket.on('question:result', onResult)
    socket.on('mask:preview', onMaskPreview)
    socket.on('mask:choose', onMaskChoose)
    socket.on('mask:result', onMaskResult)
    socket.on('talents:start', onTalentsStart)
    socket.on('talents:result', onTalentsResult)
    socket.on('game:final', onFinal)
    socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('room:updated', onRoomUpdated)
      socket.off('room:closed', onRoomClosed)
      socket.off('question:show', onQuestion)
      socket.off('question:result', onResult)
      socket.off('mask:preview', onMaskPreview)
      socket.off('mask:choose', onMaskChoose)
      socket.off('mask:result', onMaskResult)
      socket.off('talents:start', onTalentsStart)
      socket.off('talents:result', onTalentsResult)
      socket.off('game:final', onFinal)
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!room || roomFromUrl) return

    const joinUrl = new URL(window.location.href)
    joinUrl.search = `?join=${room.code}`
    void QRCode.toDataURL(joinUrl.toString(), { margin: 1, width: 280 }).then(setQrCode)
  }, [room])

  function createRoom() {
    setError('')
    socket.emit('room:create', (result: Result<Room>) => {
      if (result.ok) setRoom(result.data)
      else setError(result.error)
    })
  }

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setJoining(true)
    socket.emit('room:join', { code: roomFromUrl, name }, (result: Result<Room>) => {
      setJoining(false)
      if (result.ok) setRoom(result.data)
      else setError(result.error)
    })
  }

  function startGame() {
    if (!room) return

    socket.emit('game:start', { code: room.code }, (result: Result<Room>) => {
      if (!result.ok) setError(result.error)
    })
  }

  function answerQuestion(answerIndex: number) {
    if (!room || !question || result) return
    socket.emit('question:answer', { code: room.code, answerIndex }, (response: Result<{ correct: boolean; score: number }>) => {
      if (!response.ok) setError(response.error)
    })
  }

  function chooseMask(index: number) {
    if (!room || mask?.mode !== 'choose') return
    socket.emit('mask:choose', { code: room.code, index })
  }

  function tapTalent() {
    if (!room || !talents) return
    socket.emit('talents:tap', { code: room.code })
    setTalents({ ...talents, taps: Math.min(talents.taps + 1, 500) })
  }

  if (roomFromUrl) {
    return room ? <PlayerLobby room={room} ranking={ranking} question={question} result={result} mask={mask} talents={talents} talentResult={talentResult} onAnswer={answerQuestion} onMask={chooseMask} onTalent={tapTalent} /> : (
      <main className="player-page">
        <p className="eyebrow">Sala {roomFromUrl}</p>
        <h1>El sembrador</h1>
        <form onSubmit={joinRoom}>
          <label htmlFor="name">Tu nombre</label>
          <input id="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} autoComplete="name" required />
          <button disabled={!connected || joining}>{joining ? 'Entrando...' : 'Entrar a la sala'}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </main>
    )
  }

  return room ? (
    <HostLobby room={room} ranking={ranking} qrCode={qrCode} error={error} onStart={startGame} />
  ) : (
    <main className="landing">
      <p className="eyebrow">Mateo 13 · La parábola del sembrador</p>
      <h1>El sembrador</h1>
      <p className="message">Una semilla, cuatro terrenos y una cosecha abundante.</p>
      <button onClick={createRoom} disabled={!connected}>Crear nueva sala</button>
      <p className={connected ? 'connection online' : 'connection'}>{connected ? 'Servidor conectado' : 'Conectando al servidor'}</p>
      {error && <p className="error">{error}</p>}
    </main>
  )
}

function HostLobby({ room, ranking, qrCode, error, onStart }: { room: Room; ranking: Array<{ name: string; score: number }> | null; qrCode: string; error: string; onStart: () => void }) {
  const canStart = room.status === 'lobby' && room.players.length > 0

  return (
    <main className="host-page">
      {ranking && <FinalScreen ranking={ranking} />}
      {!ranking && <>
      <p className="eyebrow">Sala creada</p>
      <h1>{room.code}</h1>
      <p className="instructions">Escaneen el código QR e ingresen su nombre.</p>
      {room.status === 'playing' && <GameTimer endsAt={room.gameEndsAt} startedAt={room.gameStartedAt} lineOnly />}
      {qrCode && <img className="qr" src={qrCode} alt={`Código QR para unirse a la sala ${room.code}`} />}
      <p className="count">Jugadores conectados: {room.players.length}/5</p>
      <ol className="players">{room.players.map((player) => <li key={player.name}><span>{player.name}</span>{room.status === 'playing' && <small>{player.stage}</small>}</li>)}</ol>
      <button onClick={onStart} disabled={!canStart}>{room.status === 'playing' ? 'Partida iniciada' : 'Iniciar partida'}</button>
      {error && <p className="error">{error}</p>}
      </>}
    </main>
  )
}

function PlayerLobby({ room, ranking, question, result, mask, talents, talentResult, onAnswer, onMask, onTalent }: { room: Room; ranking: Array<{ name: string; score: number }> | null; question: Question | null; result: QuestionResult | null; mask: MaskState | null; talents: { endsAt: number; taps: number } | null; talentResult: { talents: number } | null; onAnswer: (answerIndex: number) => void; onMask: (index: number) => void; onTalent: () => void }) {
  if (ranking) return <main className="player-page"><FinalScreen ranking={ranking} /></main>
  const timer = room.status === 'playing' ? <GameTimer endsAt={room.gameEndsAt} startedAt={room.gameStartedAt} lineOnly /> : null
  if (mask) return <main className="player-page">{timer}<p className="eyebrow">Recuerda dónde cayó la semilla</p><h1>{mask.mode === 'preview' ? 'OBSERVA LA SEMILLA' : mask.mode === 'choose' ? '¿DÓNDE CAYÓ LA SEMILLA?' : mask.correct ? '¡ENCONTRASTE LA SEMILLA! 🌱' : 'LA SEMILLA SE PERDIÓ'}</h1><p className="message">{mask.mode === 'preview' ? 'Mira con atención dónde cayó la semilla antes de que termine el tiempo.' : mask.mode === 'choose' ? 'Elige el terreno donde viste la semilla.' : mask.correct ? 'Recordaste dónde cayó la semilla. ¡Que eche raíces y dé fruto!' : 'No recordaste dónde cayó la semilla. Sigue atento a la enseñanza.'}</p>{mask.mode !== 'result' && <div className="faces memory-grid">{Array.from({ length: 25 }, (_, index) => <button key={index} className={`face ${mask.mode === 'preview' && index === mask.heartIndex ? 'true-face' : ''}`} disabled={mask.mode !== 'choose'} onClick={() => onMask(index)}>{mask.mode === 'preview' ? (index === mask.heartIndex ? '🌱' : decoys[index % decoys.length]) : '?'}</button>)}</div>}</main>
  if (talents) return <main className="player-page">{timer}<p className="eyebrow">Haz crecer la cosecha</p><h1 className="talents-title">¡Que la semilla dé fruto!</h1><p className="message">Tienes 10 segundos. Pulsa tan rápido como puedas para hacer crecer tu cosecha.</p><GameTimer endsAt={talents.endsAt} startedAt={talents.endsAt - 10_000} label="Cosecha" /><div className="coin-count"><span>{talents.taps}</span> frutos</div><button className="talent-button" onClick={onTalent} aria-label="Hacer crecer la cosecha"><span>$</span></button></main>
  if (talentResult) return <main className="player-page">{timer}<p className="eyebrow">Fin de la cosecha</p><h1>TERMINÓ EL TIEMPO</h1><p className="message">La semilla que cae en buena tierra produce fruto en abundancia.</p><p className="coin-count">Cosechaste <span>{talentResult.talents}</span> frutos</p></main>
  if (question && !result) {
    return (
      <main className="player-page question-page">
        {timer}
        <p className="eyebrow">{doorTitle[question.category]}</p>
        <h1>{question.question}</h1>
        <div className="options">
          {question.options.map((option, index) => <button key={option} onClick={() => onAnswer(index)}>{option}</button>)}
        </div>
      </main>
    )
  }

  if (result) {
    return (
      <main className="player-page">
        {timer}
        <p className="eyebrow">{doorTitle[result.category]}</p>
        <h1>{result.correct ? 'Respuesta correcta' : 'Respuesta incorrecta'}</h1>
        <p className="message">{result.correct ? doorMessage[result.category].success : doorMessage[result.category].failure}</p>
        <p className="connection online">Puntaje actual: {result.score}</p>
        <p className="message">La siguiente enseñanza comenzará en un momento.</p>
      </main>
    )
  }

  return (
    <main className="player-page">
      {timer}
      <p className="eyebrow">Sala {room.code}</p>
      <h1>{room.status === 'playing' ? 'Preparando tu pregunta' : 'Estás dentro'}</h1>
      <p className="message">{room.status === 'playing' ? 'Prepárate para recibir la enseñanza.' : 'Espera a que el anfitrión comience la parábola.'}</p>
    </main>
  )
}

export default App

function FinalScreen({ ranking }: { ranking: Array<{ name: string; score: number }> }) {
  return <section className="final"><p className="eyebrow">El sembrador</p><h1>{ranking[0]?.name}</h1><p className="message">Completaste el recorrido del sembrador</p><ol>{ranking.map((player) => <li key={player.name}>{player.name} <strong>{player.score} pts</strong></li>)}</ol></section>
}

function GameTimer({ endsAt, startedAt, lineOnly = false, label = 'Tiempo restante' }: { endsAt?: number; startedAt?: number; lineOnly?: boolean; label?: string }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.ceil(((endsAt ?? Date.now()) - Date.now()) / 1_000)))
    update()
    const timer = window.setInterval(update, 1_000)
    return () => window.clearInterval(timer)
  }, [endsAt])
  const total = Math.max(1, (endsAt ?? 0) - (startedAt ?? 0))
  const remaining = Math.max(0, Math.min(100, seconds * 1000 / total * 100))
  if (lineOnly) return <div className="time-line" aria-label="Tiempo restante"><span style={{ width: `${remaining}%` }} /></div>
  return <p className="timer">{label}: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>
}
