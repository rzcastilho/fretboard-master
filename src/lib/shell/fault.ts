import type { ToolId } from './tools';

export type FaultPhase = 'calculation' | 'drawing';

/**
 * Test/dev-only fault injection (contracts/test-hooks.md). The whole body is guarded by the
 * build-time flag so it is dead-code-eliminated from production builds.
 *
 * `maybeFault(tool)` and `maybeFault(tool, 'drawing')` read `__fmFault[tool]`; `'calculation'`
 * reads `__fmFault['<tool>:calculation']`, so a drawing fault never fires inside a calculation.
 */
export function maybeFault(tool: ToolId, phase?: FaultPhase): void {
  if (__FM_FAULT_INJECTION__) {
    const key = phase === 'calculation' ? (`${tool}:calculation` as const) : tool;
    const remaining = globalThis.__fmFault?.[key];
    if (typeof remaining === 'number' && remaining > 0) {
      if (remaining !== Infinity && globalThis.__fmFault) globalThis.__fmFault[key] = remaining - 1;
      throw new Error(`Injected fault: ${key}`);
    }
  }
}
