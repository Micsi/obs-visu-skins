// Test helpers for walking Vue VNode trees produced by the pure renderers,
// plus minimal Tokens/Ctx stubs matching the @obs/visu-contract surface.

import type { Ctx, Device, Tokens } from "@obs/visu-contract";

export interface VNodeLike {
  type: unknown;
  props: Record<string, unknown> | null;
  children: unknown;
}

function isVNode(x: unknown): x is VNodeLike {
  return !!x && typeof x === "object" && "type" in (x as object) && "props" in (x as object);
}

/** Depth-first list of every VNode in the tree (root included). */
export function flatten(node: unknown, out: VNodeLike[] = []): VNodeLike[] {
  if (Array.isArray(node)) {
    for (const c of node) flatten(c, out);
    return out;
  }
  if (!isVNode(node)) return out;
  out.push(node);
  flatten(node.children, out);
  return out;
}

/** All `data-action` strings present anywhere in the tree. */
export function actions(node: unknown): string[] {
  return flatten(node)
    .map((v) => v.props?.["data-action"])
    .filter((a): a is string => typeof a === "string");
}

/** First VNode whose tag === `tag` and (optionally) class string contains `cls`. */
export function find(node: unknown, tag: string, cls?: string): VNodeLike | undefined {
  return flatten(node).find(
    (v) => v.type === tag && (cls === undefined || classStr(v).includes(cls)),
  );
}

/** All VNodes matching tag (+ optional class fragment). */
export function findAll(node: unknown, tag: string, cls?: string): VNodeLike[] {
  return flatten(node).filter(
    (v) => v.type === tag && (cls === undefined || classStr(v).includes(cls)),
  );
}

/** Concatenated text of all string children in the subtree. */
export function text(node: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === "string") {
      parts.push(n);
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (isVNode(n)) walk(n.children);
  };
  walk(node);
  return parts.join("");
}

function classStr(v: VNodeLike): string {
  const c = v.props?.class;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((x) => typeof x === "string").join(" ");
  return "";
}

export function classOf(v: VNodeLike | undefined): string {
  return v ? classStr(v) : "";
}

/* ---- contract stubs -------------------------------------------------------- */

export const tokensStub: Tokens = {
  accent: (token) => `var(--acc-${token})`,
  accentInk: (token) => `var(--ink-${token})`,
  font: "Manrope",
  space: (step) => `${step * 4}px`,
};

export function ctxStub(overrides: Partial<Ctx> = {}): Ctx {
  return {
    stateText: () => "",
    stateParts: () => ({ word: "", rest: "" }),
    hyphenate: (s) => s,
    floorShort: () => "",
    icon: (_d: Device, slot: string) => `icon:${slot}`,
    nf: (v) => String(v),
    warn: () => false,
    ...overrides,
  };
}
