// Rendered on-screen keyboard (same on every device) plus physical keyboard support.

export type KeyHandler = (key: string) => void; // "a".."z" or "backspace"

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export class Keyboard {
  private keys = new Map<string, HTMLElement>();
  enabled = true;

  constructor(
    host: HTMLElement,
    private readonly onKey: KeyHandler,
  ) {
    host.replaceChildren();
    ROWS.forEach((row, i) => {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      for (const ch of row) rowEl.appendChild(this.makeKey(ch, ch));
      if (i === 2) rowEl.appendChild(this.makeKey("backspace", "⌫", "kb-wide"));
      host.appendChild(rowEl);
    });

    window.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "backspace") {
        e.preventDefault();
        this.press("backspace");
      } else if (k.length === 1 && k >= "a" && k <= "z") {
        e.preventDefault();
        if (!e.repeat) this.press(k);
      }
    });
  }

  private makeKey(key: string, label: string, extra = "") {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `kb-key ${extra}`.trim();
    el.textContent = label;
    el.setAttribute("aria-label", key);
    // pointerdown, not click: lower latency and no double-tap zoom.
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.press(key);
    });
    this.keys.set(key, el);
    return el;
  }

  private press(key: string) {
    this.flash(key);
    if (this.enabled) this.onKey(key);
  }

  private flash(key: string) {
    const el = this.keys.get(key);
    if (!el) return;
    el.classList.remove("pressed");
    void el.offsetWidth; // restart animation
    el.classList.add("pressed");
  }
}
