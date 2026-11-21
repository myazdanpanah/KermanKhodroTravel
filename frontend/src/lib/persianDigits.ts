/**
 * Persian digits everywhere.
 *
 * The UI is Persian throughout, so Latin digits in rendered copy (dates,
 * amounts, counters, letter numbers) are converted to ۰-۹ as they reach the
 * DOM. Typed values stay untouched: inputs, textareas, selects and elements
 * marked with `data-digits="latin"` are never rewritten, so numbers a user
 * types with an English keyboard are preserved.
 */

const PERSIAN = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

const SKIP_TAGS = new Set([
  'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SCRIPT', 'STYLE', 'CODE', 'PRE', 'SVG', 'MATH',
]);

function toPersian(text: string) {
  return text.replace(/[0-9]/g, (digit) => PERSIAN[Number(digit)]);
}

function shouldSkip(node: Node): boolean {
  let element = node.parentElement;
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.getAttribute('data-digits') === 'latin') return true;
    if (element.isContentEditable) return true;
    element = element.parentElement;
  }
  return false;
}

function convertNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    if (!text || !/[0-9]/.test(text) || shouldSkip(node)) return;
    node.nodeValue = toPersian(text);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  if (SKIP_TAGS.has(element.tagName) || element.getAttribute('data-digits') === 'latin') return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current.nodeValue && /[0-9]/.test(current.nodeValue) && !shouldSkip(current)) {
      current.nodeValue = toPersian(current.nodeValue);
    }
    current = walker.nextNode();
  }
}

let installed = false;

export function installPersianDigits() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  convertNode(document.body);

  // Batch mutations per frame so a busy render cannot turn this into a storm.
  let queued: Node[] = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const nodes = queued;
    queued = [];
    nodes.forEach(convertNode);
  };

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        queued.push(mutation.target);
      } else {
        mutation.addedNodes.forEach((node) => queued.push(node));
        // A React re-render replaces the text of an existing node.
        mutation.target.childNodes.forEach((child) => queued.push(child));
      }
    }
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(flush);
    }
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
