/**
 * JSON-RPC 2.0 Protocol Layer
 *
 * Handles serialization/deserialization of JSON-RPC messages over stdio.
 * This is a pure protocol module — no business logic, no state.
 *
 * Usage:
 *   const io = createJsonRpcIO()
 *   io.sendEvent(aguiEvent)
 *   io.sendResponse(id, result)
 *   io.sendError(id, code, message)
 *   io.onMessage(handler)  // register request handler
 *   io.start()             // begin reading stdin
 */
import { createInterface } from 'readline'
import type {
  AguiEvent,
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from '../src/types/agui-events'

export interface JsonRpcIO {
  /** Send a streaming event notification to the frontend. */
  sendEvent(event: AguiEvent): void
  /** Send a successful response to a request. */
  sendResponse(id: string | number, result: unknown): void
  /** Send an error response. */
  sendError(id: string | number | undefined, code: number, message: string): void
  /** Send a raw notification (e.g. 'ready' signal). */
  sendNotification(method: string, params: unknown): void
  /** Register a handler for incoming JSON-RPC requests. */
  onMessage(handler: (request: JsonRpcRequest) => void | Promise<void>): void
  /** Begin reading from stdin. */
  start(): void
}

/**
 * Create a JSON-RPC IO layer backed by process stdin/stdout.
 * Each message is a single line of JSON terminated by '\n'.
 */
export function createJsonRpcIO(): JsonRpcIO {
  const rl = createInterface({ input: process.stdin, terminal: false })

  function sendMessage(msg: JsonRpcMessage): void {
    process.stdout.write(JSON.stringify(msg) + '\n')
  }

  function sendErrorResponse(id: string | number | undefined, code: number, message: string): void {
    sendMessage({ jsonrpc: '2.0', error: { code, message }, id: id ?? undefined })
  }

  return {
    sendEvent(event: AguiEvent): void {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'event',
        params: event,
      }
      sendMessage(notification)
    },

    sendResponse(id: string | number, result: unknown): void {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        result,
        id,
      }
      sendMessage(response)
    },

    sendError(id: string | number | undefined, code: number, message: string): void {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        error: { code, message },
        id: id ?? undefined,
      }
      sendMessage(response)
    },

    sendNotification(method: string, params: unknown): void {
      sendMessage({ jsonrpc: '2.0', method, params })
    },

    onMessage(handler: (request: JsonRpcRequest) => void | Promise<void>): void {
      rl.on('line', async (line: string) => {
        if (!line.trim()) return

        let message: JsonRpcRequest
        try {
          message = JSON.parse(line)
        } catch {
          sendErrorResponse(undefined, -32700, 'Parse error')
          return
        }

        try {
          await handler(message)
        } catch (err: any) {
          sendErrorResponse(message.id, -32603, err?.message || 'Internal error')
        }
      })

      rl.on('close', () => {
        process.exit(0)
      })
    },

    start(): void {
      // readline starts automatically on creation; this is a no-op
      // kept for API symmetry and future initialization hooks
    },
  }
}
