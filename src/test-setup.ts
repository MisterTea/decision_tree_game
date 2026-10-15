import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value() {} });
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value() {} });
Object.defineProperty(document, 'elementFromPoint', { configurable: true, value() { return null; } });
