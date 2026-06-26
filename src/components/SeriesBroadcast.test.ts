import { describe, expect, it } from 'vitest'
import {
  createInitialPlaybackState,
  createPlaybackReducer,
} from './broadcast/playback-reducer'
import type { PlaybackState } from './broadcast/playback-reducer'

const FRAME_COUNTS = [10, 8]
const reducer = createPlaybackReducer(FRAME_COUNTS)

function state(over: Partial<PlaybackState> = {}): PlaybackState {
  return {
    phase: 'playing',
    gameIndex: 0,
    frameIndex: 0,
    playing: true,
    speed: 1,
    ...over,
  }
}

describe('playbackReducer — tick', () => {
  it('advances frameIndex by one while inside a game', () => {
    const next = reducer(state({ frameIndex: 3 }), { type: 'tick' })
    expect(next.frameIndex).toBe(4)
    expect(next.phase).toBe('playing')
    expect(next.playing).toBe(true)
  })

  it('enters game-final at the last frame of a game', () => {
    const next = reducer(state({ frameIndex: 9 }), { type: 'tick' })
    expect(next.phase).toBe('game-final')
    expect(next.frameIndex).toBe(9)
    expect(next.playing).toBe(false)
  })

  it('is a no-op outside the playing phase', () => {
    const next = reducer(state({ phase: 'game-final' }), { type: 'tick' })
    expect(next).toEqual(state({ phase: 'game-final' }))
  })
})

describe('playbackReducer — skip_game', () => {
  it('jumps to game-final from the playing phase', () => {
    const next = reducer(state({ frameIndex: 3 }), { type: 'skip_game' })
    expect(next.phase).toBe('game-final')
    expect(next.frameIndex).toBe(9)
    expect(next.playing).toBe(false)
  })

  it('advances to the next game when already in game-final', () => {
    const next = reducer(
      state({ phase: 'game-final', frameIndex: 9 }),
      { type: 'skip_game' },
    )
    expect(next.phase).toBe('playing')
    expect(next.gameIndex).toBe(1)
    expect(next.frameIndex).toBe(0)
    expect(next.playing).toBe(true)
  })

  it('ends the series when skipping from the final game-final', () => {
    const next = reducer(
      state({ phase: 'game-final', gameIndex: 1, frameIndex: 7 }),
      { type: 'skip_game' },
    )
    expect(next.phase).toBe('series-final')
    expect(next.playing).toBe(false)
  })
})

describe('playbackReducer — skip_series', () => {
  it('jumps straight to series-final', () => {
    const next = reducer(state({ frameIndex: 4, gameIndex: 1 }), {
      type: 'skip_series',
    })
    expect(next.phase).toBe('series-final')
    expect(next.playing).toBe(false)
  })
})

describe('playbackReducer — set_speed', () => {
  it('changes the speed', () => {
    const next = reducer(state(), { type: 'set_speed', speed: 4 })
    expect(next.speed).toBe(4)
  })
})

describe('playbackReducer — replay', () => {
  it('resets to game 0 in the playing phase', () => {
    const next = reducer(
      state({ phase: 'series-final', gameIndex: 1, frameIndex: 7 }),
      { type: 'replay' },
    )
    expect(next.phase).toBe('playing')
    expect(next.gameIndex).toBe(0)
    expect(next.frameIndex).toBe(0)
    expect(next.playing).toBe(true)
  })
})

describe('playbackReducer — play / pause', () => {
  it('pause sets playing false', () => {
    const next = reducer(state({ playing: true }), { type: 'pause' })
    expect(next.playing).toBe(false)
  })

  it('play sets playing true', () => {
    const next = reducer(state({ playing: false }), { type: 'play' })
    expect(next.playing).toBe(true)
  })

  it('play is a no-op in series-final', () => {
    const next = reducer(state({ phase: 'series-final', playing: false }), {
      type: 'play',
    })
    expect(next.playing).toBe(false)
    expect(next.phase).toBe('series-final')
  })
})

describe('playbackReducer — advance_game', () => {
  it('advances from game-final to the next game', () => {
    const next = reducer(
      state({ phase: 'game-final', frameIndex: 9 }),
      { type: 'advance_game' },
    )
    expect(next.phase).toBe('playing')
    expect(next.gameIndex).toBe(1)
    expect(next.frameIndex).toBe(0)
    expect(next.playing).toBe(true)
  })

  it('ends the series after the last game-final', () => {
    const next = reducer(
      state({ phase: 'game-final', gameIndex: 1, frameIndex: 7 }),
      { type: 'advance_game' },
    )
    expect(next.phase).toBe('series-final')
  })
})

describe('playbackReducer — manual mode', () => {
  it('advances and replays without auto-play when autoPlay is false', () => {
    const manualReducer = createPlaybackReducer(FRAME_COUNTS, false)
    const advanced = manualReducer(
      { ...state(), phase: 'game-final', frameIndex: 9 },
      { type: 'advance_game' },
    )
    expect(advanced.phase).toBe('playing')
    expect(advanced.playing).toBe(false)

    const replayed = manualReducer(
      { ...state(), phase: 'series-final' },
      { type: 'replay' },
    )
    expect(replayed.phase).toBe('playing')
    expect(replayed.playing).toBe(false)
  })
})

describe('createInitialPlaybackState', () => {
  it('starts playing by default', () => {
    const initial = createInitialPlaybackState()
    expect(initial.phase).toBe('playing')
    expect(initial.playing).toBe(true)
  })

  it('skips to series-final under reduced motion', () => {
    const initial = createInitialPlaybackState(true)
    expect(initial.phase).toBe('series-final')
    expect(initial.playing).toBe(false)
  })
})
