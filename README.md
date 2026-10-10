# Password Generator

Cryptographically secure password generator — length slider (8–64), toggles for uppercase / lowercase / numbers / symbols, entropy-based strength meter, click-to-copy.

## How to use

Open `index.html` in any browser. Adjust the length, pick character sets, hit **Generate password** (it also regenerates live as you change settings). Click the password to copy it.

## How it works

- Randomness comes from `crypto.getRandomValues` with **rejection sampling** (no modulo bias).
- Every selected character set is guaranteed at least one character (Fisher–Yates shuffle, crypto-driven).
- Strength = `length × log2(pool size)` bits of entropy: Weak <40, Fair <60, Good <80, Strong <100, Excellent ≥100.
- 100% local — no server, no tracking.

## Files

- `index.html` — the page markup
- `styles.css` — all the styling, with plain-English comments
- `app.js` — the password logic, with plain-English comments
