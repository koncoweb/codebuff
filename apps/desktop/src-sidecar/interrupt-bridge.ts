/**
 * Interrupt Bridge
 *
 * Handles AG-UI human-in-the-loop interrupt pattern:
 * 1. Codebuff SDK triggers ask_user → emit RUN_FINISHED with interrupt outcome
 * 2. Frontend shows InterruptDialog → user approves/denies/edits
 * 3. Frontend sends `resume` JSON-RPC request → resolve pending interrupt
 *
 * REFACTOR: Sebelumnya inline di index.ts. Sekarang terisolasi —
 * mudah untuk test interrupt flow tanpa menjalankan sidecar penuh.
 */
import type {
  AguiEvent,
  AguiInterrupt,
  AguiResume,
} from '../src/types/agui-events'

/** Pending interrupt resolvers (interruptId → resolve function). */
const pendingInterrupts = new Map<string, (resume: AguiResume) => void>()

/**
 * Wait for an interrupt to be resolved by the frontend.
 * Returns a Promise that resolves when the frontend sends a `resume` request.
 */
export function waitForInterrupt(interruptId: string): Promise<AguiResume> {
  return new Promise((resolve) => {
    pendingInterrupts.set(interruptId, resolve)
  })
}

/**
 * Resolve a pending interrupt with the user's response.
 * Called when the frontend sends a `resume` request.
 */
export function resolveInterrupt(resume: AguiResume): boolean {
  const resolver = pendingInterrupts.get(resume.interruptId)
  if (resolver) {
    resolver(resume)
    pendingInterrupts.delete(resume.interruptId)
    return true
  }
  return false
}

/**
 * Try to intercept ask_user / terminal commands for human-in-the-loop approval.
 * If the Codebuff SDK uses AskUserBridge, we subscribe to it here.
 *
 * @param getCurrentRunId Returns the current active run ID (or null)
 * @param getCurrentThreadId Returns the current thread ID (or null)
 * @param emit Callback to send AG-UI events to the frontend
 */
export async function setupInterruptBridge(
  getCurrentRunId: () => string | null,
  getCurrentThreadId: () => string | null,
  emit: (event: AguiEvent) => void,
): Promise<void> {
  try {
    // Try to import the AskUserBridge (may not be exported from SDK)
    const askUserModule: any = await import(
      '@codebuff/common/utils/ask-user-bridge'
    ).catch(() => null)
    if (!askUserModule?.AskUserBridge) return

    const bridge = askUserModule.AskUserBridge

    if (typeof bridge.onRequest === 'function') {
      bridge.onRequest((request: any) => {
        const interruptId = request.id || `int-${Date.now()}`
        const runId = getCurrentRunId() || 'unknown'
        const threadId = getCurrentThreadId() || 'unknown'

        const interrupt: AguiInterrupt = {
          id: interruptId,
          reason: 'input_required',
          message: request.message || 'Agent membutuhkan input dari user',
          responseSchema: request.schema,
        }

        emit({
          type: 'RUN_FINISHED',
          threadId,
          runId,
          timestamp: Date.now(),
          outcome: { type: 'interrupt', interrupts: [interrupt] },
        })

        // Wait for resume from frontend
        waitForInterrupt(interruptId).then((resume) => {
          if (resume.status === 'resolved') {
            bridge.submit(interruptId, resume.payload)
          } else {
            bridge.skip(interruptId)
          }
        })
      })
    }
  } catch {
    // AskUserBridge not available — interrupts will work via tool_call events only
  }
}
