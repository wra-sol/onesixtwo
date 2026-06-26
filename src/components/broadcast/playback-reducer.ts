export type PlaybackPhase = 'playing' | 'game-final' | 'series-final'

export type PlaybackSpeed = 1 | 2 | 4

export type PlaybackState = {
  phase: PlaybackPhase
  gameIndex: number
  frameIndex: number
  playing: boolean
  speed: PlaybackSpeed
}

export type PlaybackAction =
  | { type: 'tick' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'skip_play' }
  | { type: 'skip_game' }
  | { type: 'skip_series' }
  | { type: 'set_speed'; speed: PlaybackSpeed }
  | { type: 'replay' }
  | { type: 'enter_game_final' }
  | { type: 'advance_game' }

export type PlaybackReducer = (
  state: PlaybackState,
  action: PlaybackAction,
) => PlaybackState

export function createInitialPlaybackState(
  reducedMotion = false,
): PlaybackState {
  if (reducedMotion) {
    return {
      phase: 'series-final',
      gameIndex: 0,
      frameIndex: 0,
      playing: false,
      speed: 1,
    }
  }
  return {
    phase: 'playing',
    gameIndex: 0,
    frameIndex: 0,
    playing: true,
    speed: 1,
  }
}

export function createPlaybackReducer(
  frameCounts: number[],
  autoPlay = true,
): PlaybackReducer {
  const gameCount = frameCounts.length

  function lastFrameIndex(gameIndex: number): number {
    const count = frameCounts[gameIndex] ?? 0
    return count > 0 ? count - 1 : 0
  }

  function enterGameFinal(state: PlaybackState): PlaybackState {
    return {
      ...state,
      phase: 'game-final',
      playing: false,
      frameIndex: lastFrameIndex(state.gameIndex),
    }
  }

  function advanceFromGameFinal(state: PlaybackState): PlaybackState {
    if (state.gameIndex < gameCount - 1) {
      return {
        phase: 'playing',
        gameIndex: state.gameIndex + 1,
        frameIndex: 0,
        playing: autoPlay,
        speed: state.speed,
      }
    }
    return { ...state, phase: 'series-final', playing: false }
  }

  return (state: PlaybackState, action: PlaybackAction): PlaybackState => {
    switch (action.type) {
      case 'tick': {
        if (state.phase !== 'playing') return state
        if (state.frameIndex < lastFrameIndex(state.gameIndex)) {
          return { ...state, frameIndex: state.frameIndex + 1 }
        }
        return enterGameFinal(state)
      }
      case 'skip_play': {
        if (state.phase === 'playing') {
          if (state.frameIndex < lastFrameIndex(state.gameIndex)) {
            return { ...state, frameIndex: state.frameIndex + 1 }
          }
          return enterGameFinal(state)
        }
        if (state.phase === 'game-final') {
          return advanceFromGameFinal(state)
        }
        return state
      }
      case 'skip_game': {
        if (state.phase === 'playing') {
          return enterGameFinal(state)
        }
        if (state.phase === 'game-final') {
          return advanceFromGameFinal(state)
        }
        return state
      }
      case 'skip_series': {
        return { ...state, phase: 'series-final', playing: false }
      }
      case 'play': {
        if (state.phase === 'series-final') return state
        return { ...state, playing: true }
      }
      case 'pause': {
        return { ...state, playing: false }
      }
      case 'set_speed': {
        return { ...state, speed: action.speed }
      }
      case 'replay': {
        return {
          phase: 'playing',
          gameIndex: 0,
          frameIndex: 0,
          playing: autoPlay,
          speed: state.speed,
        }
      }
      case 'enter_game_final': {
        if (state.phase !== 'playing') return state
        return enterGameFinal(state)
      }
      case 'advance_game': {
        if (state.phase !== 'game-final') return state
        return advanceFromGameFinal(state)
      }
      default: {
        return state
      }
    }
  }
}
