// Minimal type shim so TypeScript doesn't error on `import("onnxruntime-node")`.
// The actual runtime loading is done via require() in the API route to keep
// webpack from trying to bundle the native .node binaries.
declare module "onnxruntime-node" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ort: any;
  export = ort;
}
