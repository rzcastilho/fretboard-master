import type { ToolId } from './tools';

/**
 * Test/dev-only fault injection (contracts/test-hooks.md). The whole body is guarded by the
 * build-time flag so it is dead-code-eliminated from production builds.
 */
export function maybeFault(tool: ToolId): void {
  if (__FM_FAULT_INJECTION__) {
    const remaining = globalThis.__fmFault?.[tool];
    if (typeof remaining === 'number' && remaining > 0) {
      if (remaining !== Infinity && globalThis.__fmFault)
        globalThis.__fmFault[tool] = remaining - 1;
      throw new Error(`Injected fault: ${tool}`);
    }
  }
}
