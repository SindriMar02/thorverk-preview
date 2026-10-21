/* focus-guard: a focus ring only for people using a keyboard.

   The bug it ends: a menu, drawer or dialog opens and its FIRST link (or the dialog's close button)
   is outlined, as if it were selected. Cause: opening code calls first.focus(), or <dialog>.showModal()
   focuses the first control by itself. When nothing was focused before, the browser decides the ring is
   wanted. Safari never focuses a button on click and a touch tap never does either, so on iPhone,
   iPad and Safari the very first tap paints the ring. Chrome with a mouse hides it, which is why it
   passes the desktop check and then reappears on Sindri's phone.

   How: remember the last input kind on <html data-input="pointer|key"> and let focus-guard.css drop the
   ring while the last input was a pointer. Keyboard users keep every ring. Load before everything else
   (inline in <head>, ~400 bytes), no dependencies. Doc: _tools/focus-guard/README.md */
(function () {
  var root = document.documentElement;
  function set(v) { if (root.getAttribute('data-input') !== v) root.setAttribute('data-input', v); }
  addEventListener('pointerdown', function () { set('pointer'); }, true);
  addEventListener('keydown', function (e) {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    set('key');
  }, true);
})();
