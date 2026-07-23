/**
 * Sidecar Build Script
 *
 * Compiles the Codebuff SDK sidecar (src-sidecar/index.ts) into a standalone
 * executable using Bun's --compile flag. The output binary is placed in
 * src-tauri/binaries/ with the platform-specific suffix Tauri expects.
 *
 * Usage:
 *   bun run scripts/build-sidecar.ts           # current platform
 *   bun run scripts/build-sidecar.ts --all     # all platforms
 */
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const SIDECAR_ENTRY = join(import.meta.dir, '..', 'src-sidecar', 'index.ts')
const OUTPUT_DIR = join(import.meta.dir, '..', 'src-tauri', 'binaries')

interface Target {
  bunTarget: string
  suffix: string
}

const TARGETS: Record<string, Target> = {
  'windows-x64': {
    bunTarget: 'bun-windows-x64',
    suffix: '-x86_64-pc-windows-msvc.exe',
  },
  'darwin-arm64': {
    bunTarget: 'bun-darwin-arm64',
    suffix: '-aarch64-apple-darwin',
  },
  'darwin-x64': {
    bunTarget: 'bun-darwin-x64',
    suffix: '-x86_64-apple-darwin',
  },
  'linux-x64': {
    bunTarget: 'bun-linux-x64',
    suffix: '-x86_64-unknown-linux-gnu',
  },
}

function getCurrentTarget(): string {
  const platform = process.platform
  const arch = process.arch
  if (platform === 'win32') return 'windows-x64'
  if (platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
  if (platform === 'linux') return 'linux-x64'
  throw new Error(`Unsupported platform: ${platform}-${arch}`)
}

async function buildSidecar(targetKey: string): Promise<void> {
  const target = TARGETS[targetKey]
  if (!target) {
    throw new Error(`Unknown target: ${targetKey}`)
  }

  const outputPath = join(OUTPUT_DIR, `codebuff-bridge${target.suffix}`)

  console.log(`[sidecar] Building for ${targetKey} → ${outputPath}`)

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Use Bun's compile API
  const proc = Bun.spawn({
    cmd: [
      'bun',
      'build',
      SIDECAR_ENTRY,
      '--compile',
      `--target=${target.bunTarget}`,
      '--outfile',
      outputPath,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`Bun build failed for ${targetKey}:\n${stderr}`)
  }

  console.log(`[sidecar] ✓ Built ${targetKey}`)
}

async function main() {
  const args = process.argv.slice(2)
  const buildAll = args.includes('--all')

  if (buildAll) {
    console.log('[sidecar] Building for all platforms...')
    for (const targetKey of Object.keys(TARGETS)) {
      try {
        await buildSidecar(targetKey)
      } catch (err) {
        console.error(`[sidecar] ✗ Failed for ${targetKey}:`, err)
      }
    }
  } else {
    const targetKey = getCurrentTarget()
    await buildSidecar(targetKey)
  }

  console.log('[sidecar] Done!')
}

main().catch((err) => {
  console.error('[sidecar] Fatal error:', err)
  process.exit(1)
})
