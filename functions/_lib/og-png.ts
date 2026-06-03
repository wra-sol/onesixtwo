import { initWasm, Resvg } from '@resvg/resvg-wasm'
import wasm from '@resvg/resvg-wasm/index_bg.wasm'
import geistLatinBin from './geist-latin.bin'

let wasmReady: Promise<void> | null = null

function asUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

function ensureWasmReady(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(wasm)
  }
  return wasmReady
}

export async function renderOgPng(svg: string): Promise<Uint8Array> {
  await ensureWasmReady()

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontBuffers: [asUint8Array(geistLatinBin as ArrayBuffer | Uint8Array)],
      defaultFontFamily: 'Geist',
      sansSerifFamily: 'Geist',
      loadSystemFonts: false,
    },
  })

  try {
    return resvg.render().asPng()
  } finally {
    resvg.free()
  }
}
