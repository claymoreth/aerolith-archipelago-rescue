// Keyboard + mouse input. One clean state object; the game loop reads
// it, never raw DOM events. Keys are tracked by physical code so layout
// differences do not break the controls.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered, consumed once per frame
  let lookX = 0;
  let lookY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    // Keep arrows / space from scrolling the page while flying.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onBlur() {
    keys.clear();
  }
  function onMouseDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMouseMove(e) {
    if (!dragging) return;
    lookX += (e.clientX - lastX) * 0.0035;
    lookY += (e.clientY - lastY) * 0.0035;
    lookX = Math.max(-0.6, Math.min(0.6, lookX));
    lookY = Math.max(-0.35, Math.min(0.35, lookY));
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMouseUp() {
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  if (canvas) {
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  const input = {
    keys,
    // Continuous axes, -1..1.
    get throttleUp() { return keys.has('KeyW'); },
    get throttleDown() { return keys.has('KeyS'); },
    get pitchUp() { return keys.has('ArrowUp'); },
    get pitchDown() { return keys.has('ArrowDown'); },
    get rollLeft() { return keys.has('ArrowLeft'); },
    get rollRight() { return keys.has('ArrowRight'); },
    get yawLeft() { return keys.has('KeyQ'); },
    get yawRight() { return keys.has('KeyE'); },
    get lookX() { return lookX; },
    get lookY() { return lookY; },
    // Edge-triggered actions; each returns true once per physical press.
    wasPressed(code) {
      return pressed.has(code);
    },
    consume(code) {
      pressed.delete(code);
    },
    endFrame() {
      pressed.clear();
      // Look-around eases back to centre when the mouse is released.
      if (!dragging) {
        lookX *= 0.92;
        lookY *= 0.92;
        if (Math.abs(lookX) < 0.002) lookX = 0;
        if (Math.abs(lookY) < 0.002) lookY = 0;
      }
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      if (canvas) canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
  return input;
}
