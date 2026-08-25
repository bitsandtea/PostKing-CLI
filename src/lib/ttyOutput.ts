/**
 * TTY-aware output helpers (L1 + L2).
 *
 * tickLine — rewrite the current line when stdout is a TTY; plain log otherwise
 * color    — emit ANSI color only when stdout is a TTY; strip otherwise
 */

const isTTY = (): boolean => !!process.stdout.isTTY;

export function tickLine(text: string): void {
  if (isTTY()) {
    process.stdout.write("\r" + text);
  } else {
    console.log(text);
  }
}

export function color(code: number, text: string): string {
  if (isTTY()) {
    return `\x1b[${code}m${text}\x1b[0m`;
  }
  return text;
}
