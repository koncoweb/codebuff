/**
 * Codebuff Sidecar Transport
 *
 * Manages the sidecar process lifecycle and provides a JSON-RPC client
 * interface for the frontend to communicate with the Codebuff SDK sidecar.
 *
 * Uses Tauri's shell plugin to spawn and communicate with the sidecar.
 * Falls back gracefully when the sidecar is unavailable (browser mode).
 */
import type {
  AguiEvent,
  AguiResume,
  JsonRpcMessage,
  JsonRpcRequest,
  RunParams,
  RunResult,
} from '../types/agui-events'

type EventHandler = (event: AguiEvent) => void
type ReadyHandler = () => void
type ErrorHandler = (error: string) => void

interface SidecarProcess {
  write: (data: string) => Promise<void>
  kill: () => Promise<void>
  pid: number
}

class CodebuffSidecarTransport {
  private process: SidecarProcess | null = null
  private eventHandlers = new Set<EventHandler>()
  private readyHandlers = new Set<ReadyHandler>()
  private errorHandlers = new Set<ErrorHandler>()
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (result: unknown) => void
      reject: (error: Error) => void
    }
  >()
  private nextRequestId = 1
  private isReady = false
  private isSpawning = false

  /** Check if we're running inside Tauri (desktop mode). */
  isDesktopMode(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!(window as any).__TAURI_INTERNALS__
    )
  }

  /** Register an event handler. Returns an unsubscribe function. */
  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  /** Register a ready handler. */
  onReady(handler: ReadyHandler): () => void {
    this.readyHandlers.add(handler)
    if (this.isReady) handler()
    return () => this.readyHandlers.delete(handler)
  }

  /** Register an error handler. */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  /**
   * Start the sidecar process.
   * Tries the compiled binary first, falls back to `bun run`.
   */
  async start(): Promise<boolean> {
    if (this.process || this.isSpawning) return this.isReady
    this.isSpawning = true

    if (!this.isDesktopMode()) {
      this.isSpawning = false
      return false
    }

    try {
      const { Command } = await import('@tauri-apps/plugin-shell')

      // Try compiled sidecar binary first
      let command: any = null
      try {
        command = Command.sidecar('binaries/codebuff-bridge')
      } catch {
        // Binary not found — try running via bun in dev mode
        command = Command.create('bun', [
          'run',
          'apps/desktop/src-sidecar/index.ts',
        ])
      }

      // Set up event listeners BEFORE spawning
      command.stdout.on('data', (line: string) => {
        this.handleStdoutLine(line)
      })

      command.stderr.on('data', (line: string) => {
        console.warn('[sidecar stderr]', line)
      })

      const child = await command.spawn()
      this.process = {
        write: (data: string) => child.write(data),
        kill: async () => {
          await child.kill()
        },
        pid: child.pid,
      }

      this.isSpawning = false

      // Wait for "ready" notification (with timeout)
      await this.waitForReady(10_000).catch(() => {
        console.warn('[sidecar] Ready timeout — proceeding anyway')
      })

      return true
    } catch (err: any) {
      console.error('[sidecar] Failed to start:', err)
      this.errorHandlers.forEach((h) => h(err?.message || 'Unknown error'))
      this.isSpawning = false
      return false
    }
  }

  /** Wait for the sidecar to signal readiness. */
  private waitForReady(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs)
      const unsubscribe = this.onReady(() => {
        clearTimeout(timeout)
        unsubscribe()
        resolve()
      })
    })
  }

  /** Stop the sidecar process. */
  async stop(): Promise<void> {
    if (this.process) {
      try {
        await this.process.kill()
      } catch (err) {
        console.warn('[sidecar] Kill failed:', err)
      }
      this.process = null
      this.isReady = false
    }
    this.pendingRequests.forEach(({ reject }) =>
      reject(new Error('Sidecar stopped')),
    )
    this.pendingRequests.clear()
  }

  /** Send a JSON-RPC request and await the response. */
  async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.process) {
      throw new Error('Sidecar not started')
    }

    const id = this.nextRequestId++
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, 120_000) // 2 min timeout for LLM runs

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeout)
          resolve(result)
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
      })

      this.process!
        .write(JSON.stringify(request) + '\n')
        .catch(reject)
    })
  }

  /**
   * Run a prompt through the Codebuff SDK sidecar.
   * Returns the RunResult. Events are streamed via onEvent handlers.
   */
  async runPrompt(params: RunParams): Promise<RunResult> {
    const result = await this.request('run', params)
    return result as RunResult
  }

  /** Resume an interrupted run with user responses. */
  async resumeRun(
    threadId: string,
    resume: AguiResume[],
    prompt?: string,
  ): Promise<RunResult> {
    const result = await this.request('resume', {
      threadId,
      resume,
      prompt,
    })
    return result as RunResult
  }

  /** Cancel the active run. */
  async cancelRun(runId: string): Promise<void> {
    if (!this.process) return
    await this.process.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'cancel',
        params: { runId },
      }) + '\n',
    )
  }

  /** Ping the sidecar to check health. */
  async ping(): Promise<{ pong: boolean; version: string }> {
    const result = await this.request('ping')
    return result as { pong: boolean; version: string }
  }

  /** Process a line from the sidecar's stdout. */
  private handleStdoutLine(line: string): void {
    if (!line.trim()) return

    let message: JsonRpcMessage
    try {
      message = JSON.parse(line)
    } catch {
      return // Ignore non-JSON lines
    }

    // Handle responses (to our requests)
    if ('result' in message || 'error' in message) {
      const resp = message as { result?: unknown; error?: unknown; id?: string | number }
      if (resp.id !== undefined) {
        const pending = this.pendingRequests.get(resp.id)
        if (pending) {
          this.pendingRequests.delete(resp.id)
          if (resp.error) {
            pending.reject(
              new Error((resp.error as any)?.message || 'RPC error'),
            )
          } else {
            pending.resolve(resp.result)
          }
        }
      }
      return
    }

    // Handle notifications
    const notif = message as { method?: string; params?: unknown }
    if (notif.method === 'ready') {
      this.isReady = true
      this.readyHandlers.forEach((h) => h())
    } else if (notif.method === 'event') {
      const event = notif.params as AguiEvent
      this.eventHandlers.forEach((h) => h(event))
    }
  }
}

// Singleton instance
export const sidecarTransport = new CodebuffSidecarTransport()
export default sidecarTransport
