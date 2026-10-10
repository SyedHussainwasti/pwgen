// Run in strict mode: catches common mistakes while the code runs.
'use strict';
// The four character sets a password can be built from.
var CHAR_SETS = {
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower:   'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~'
};

// Pick `length` random characters from `pool`, fairly.
// (Rejection sampling: throw away rolls that would favor some characters,
// so every character has exactly the same chance — no modulo bias.)
function randomFromPool(pool, length) {
  var range = pool.length;
  // Largest multiple of range below 2^32: only accept rolls under this.
  var limit = Math.floor(4294967296 / range) * range; // largest multiple of range < 2^32
  var out = [];
  // Grab 64 random numbers at a time from the browser.
  var buf = new Uint32Array(64);
  // Keep rolling until we have enough characters.
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (var i = 0; i < buf.length && out.length < length; i++) {
      // Accept the roll only if it is under the limit (fair), else skip it.
      if (buf[i] < limit) out.push(pool.charAt(buf[i] % range));
    }
  }
  return out.join('');
}

// Shuffle an array using the browser's secure randomness.
// (Chunked: one getRandomValues call is capped at 65536 bytes.)
function secureShuffle(arr) {
  // Reusable buffer of random numbers; refilled when empty.
  var buf = new Uint32Array(Math.min(4096, arr.length));
  var bi = buf.length; // force fill on first use
  // Hand out one random number, refilling the buffer when needed.
  function nextRand() {
    if (bi >= buf.length) { crypto.getRandomValues(buf); bi = 0; }
    return buf[bi++];
  }
  // Fisher–Yates shuffle: walk backwards, swap each item with a random earlier one.
  for (var i = arr.length - 1; i > 0; i--) {
    var j = nextRand() % (i + 1);
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// Build a password of `length` using the selected character sets (`opts`).
function generatePassword(length, opts) {
  // Collect the chosen sets.
  var pools = [];
  if (opts.upper)   pools.push(CHAR_SETS.upper);
  if (opts.lower)   pools.push(CHAR_SETS.lower);
  if (opts.numbers) pools.push(CHAR_SETS.numbers);
  if (opts.symbols) pools.push(CHAR_SETS.symbols);
  // Nothing selected: this is an error the caller shows to the user.
  if (pools.length === 0) throw new Error('Select at least one character set.');
  // All chosen characters joined into one big pool.
  var all = pools.join('');
  // Guarantee at least one character from each selected set...
  var chars = pools.map(function (p) { return randomFromPool(p, 1); });
  // ...then fill the rest randomly from the big pool.
  var rest = randomFromPool(all, Math.max(0, length - chars.length));
  // Shuffle everything so the guaranteed characters are not stuck at the front.
  return secureShuffle((chars.join('') + rest).split('')).join('').slice(0, length);
}

// How strong is the password? length × log2(pool size), in bits.
function passwordEntropy(length, poolSize) {
  return length * (Math.log(poolSize) / Math.log(2));
}

// Turn the bit count into a word, a bar color, and a bar width.
// More bits = stronger password. Thresholds: 40 / 60 / 80 / 100.
function strengthInfo(bits) {
  if (bits < 40)  return { label: 'Weak',      color: '#f85149', pct: 20 };  // under 40 bits
  if (bits < 60)  return { label: 'Fair',      color: '#d29922', pct: 40 };  // 40–59 bits
  if (bits < 80)  return { label: 'Good',      color: '#e3b341', pct: 60 };  // 60–79 bits
  if (bits < 100) return { label: 'Strong',    color: '#7ee787', pct: 80 };  // 80–99 bits
  return                 { label: 'Excellent', color: '#3fb950', pct: 100 }; // 100+ bits
}

// Read which character-set checkboxes are ticked right now.
function currentOpts() {
  return {
    upper:   document.getElementById('upper').checked,
    lower:   document.getElementById('lower').checked,
    numbers: document.getElementById('numbers').checked,
    symbols: document.getElementById('symbols').checked
  };
}

// Count how many characters are in the selected sets combined.
function poolSizeOf(opts) {
  var n = 0;
  if (opts.upper)   n += CHAR_SETS.upper.length;
  if (opts.lower)   n += CHAR_SETS.lower.length;
  if (opts.numbers) n += CHAR_SETS.numbers.length;
  if (opts.symbols) n += CHAR_SETS.symbols.length;
  return n;
}

// Show a short message in the green message line (empty text clears it).
function setMsg(t) { document.getElementById('msg').textContent = t || ''; }

// Make a new password and update everything on screen.
function regenerate() {
  // Clear any old message.
  setMsg('');
  // Read the length from the slider and show the number next to it.
  var len = parseInt(document.getElementById('length').value, 10);
  document.getElementById('lenval').textContent = len;
  var opts = currentOpts();
  try {
    // Build the password.
    var pw = generatePassword(len, opts);
    // Show it in the password box.
    document.getElementById('password').textContent = pw;
    // Work out its strength in bits.
    var bits = passwordEntropy(len, poolSizeOf(opts));
    var s = strengthInfo(bits);
    // Paint the strength bar: width and color.
    var fill = document.getElementById('meterfill');
    fill.style.width = s.pct + '%';
    fill.style.background = s.color;
    // Show the strength word in its color.
    var st = document.getElementById('strength');
    st.textContent = s.label;
    st.style.color = s.color;
    // Show the bits, like "128 bits of entropy".
    document.getElementById('entropy').textContent = Math.round(bits) + ' bits of entropy';
  } catch (e) {
    // Something went wrong (e.g. no character set selected): clear and show why.
    document.getElementById('password').textContent = '';
    document.getElementById('meterfill').style.width = '0%';
    document.getElementById('strength').textContent = '';
    document.getElementById('entropy').textContent = '';
    setMsg(e.message);
  }
}

// Copy the current password to the clipboard.
function copyPassword() {
  var pw = document.getElementById('password').textContent;
  // Nothing to copy: do nothing.
  if (!pw) return;
  function done() { setMsg('Copied to clipboard.'); }
  // Use the modern clipboard if available, else the old fallback.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(pw).then(done, function () { fallbackCopy(pw, done); });
  } else { fallbackCopy(pw, done); }
}
// Old-style copy: put the text in a hidden box, select it, copy it.
function fallbackCopy(text, done) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { setMsg('Copy failed — select manually.'); }
  document.body.removeChild(ta);
}

// Wire everything up once the page is ready.
function init() {
  // No secure randomness in this browser: show an error and disable the button.
  if (!window.crypto || !crypto.getRandomValues) {
    document.getElementById('password').textContent = '';
    setMsg('crypto.getRandomValues is not available in this browser.');
    document.getElementById('genbtn').disabled = true;
    return;
  }
  // Regenerate live whenever the slider or any checkbox changes.
  ['length', 'upper', 'lower', 'numbers', 'symbols'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', regenerate);
    document.getElementById(id).addEventListener('change', regenerate);
  });
  // Generate button: make a new password when clicked.
  document.getElementById('genbtn').addEventListener('click', regenerate);
  // Clicking the password box copies it.
  document.getElementById('outbox').addEventListener('click', copyPassword);
  // Make the first password as soon as the page loads.
  regenerate();
}

// Start init now, or wait for the page to finish loading first.
if (typeof document !== 'undefined' && document.getElementById) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
