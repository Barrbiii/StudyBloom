import React from 'react';
/** Inline editors keep ordinary Tab navigation; only Escape is handled locally. */
export function useEditorFocus(key: string | number | null, close: () => void, busy = false) {
  const ref = React.useRef<HTMLDivElement | HTMLFormElement | HTMLElement>(null);
  const action = React.useRef(close); action.current = close;
  const locked = React.useRef(busy); locked.current = busy;
  React.useLayoutEffect(() => {
    if (key === null || !ref.current) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')?.focus();
    return () => { window.requestAnimationFrame(() => {
      if (opener?.isConnected && document.activeElement === document.body) opener.focus();
    }); };
  }, [key]);
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented && !locked.current) {
      event.preventDefault(); event.stopPropagation(); action.current();
    }
  }
  return { ref, onKeyDown };
}
