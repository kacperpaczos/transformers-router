/**
 * LXRT Headless Browser Bridge Protocol
 *
 * Defines the strict contract for IPC between Node.js (Host) and Playwright (Guest).
 *
 * Architecture:
 * - Control Channel: JSON-RPC over `window.bridge.postMessage` (Page -> Node) and `page.evaluate` (Node -> Page)
 * - Data Channel: WebSocket (Binary) for efficient transport of Audio/Embeddings.
 */

// Command Types (Node -> Browser)
export enum BridgeCommandType {
  LOAD = 'CMD_LOAD',
  CHAT = 'CMD_CHAT',
  EMBED = 'CMD_EMBED',
  TTS = 'CMD_TTS',
  UNLOAD = 'CMD_UNLOAD',
}

// Event Types (Browser -> Node)
export enum BridgeEventType {
  READY = 'EVENT_READY',
  TOKEN = 'EVENT_TOKEN',
  ERROR = 'EVENT_ERROR',
  DONE = 'EVENT_DONE',
  LOG = 'EVENT_LOG',
}

// --------------------------------------------------------------------------
// Payload Definitions
// --------------------------------------------------------------------------

export interface BridgeMessage<T = unknown> {
  id: string;
  type: BridgeCommandType | BridgeEventType;
  payload: T;
  timestamp: number;
}

export interface LoadPayload {
  modality: 'llm' | 'stt' | 'tts' | 'embedding';
  modelKey: string; // e.g., 'Xenova/whisper-tiny'
  config: Record<string, unknown>;
  device?: 'webgpu' | 'wasm';
}

export interface ChatPayload {
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface TokenPayload {
  text: string;
  isFinal?: boolean;
}

export interface ErrorPayload {
  code: string;
  message: string;
  stack?: string;
  fatal: boolean;
}

export interface LogPayload {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

// --------------------------------------------------------------------------
// Binary Transport Schema (WebSocket)
// --------------------------------------------------------------------------

/**
 * Binary Frame Format:
 * [Header: 8 bytes]
 *   - Bytes 0-3: Request ID (UInt32 Little Endian) - matches JSON-RPC ID
 *   - Bytes 4-7: DataType (UInt32 Little Endian) - 0=Float32 (Embedding), 1=Int16 (Audio), 2=Blob
 * [Payload: N bytes]
 *   - Raw Buffer
 */

export const BINARY_HEADER_SIZE = 8;

export enum BinaryDataType {
  FLOAT32 = 0, // for Embeddings
  INT16 = 1, // for Audio
  BLOB = 2, // Generic
}

export interface BinaryFrame {
  requestId: number; // Cast string UUID to hash or simple counter? For Spike we use numeric ID.
  dataType: BinaryDataType;
  buffer: Buffer;
}
