declare module '*.wasm' {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}

declare module '*.bin' {
  const bytes: ArrayBuffer
  export default bytes
}
