// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill for PointerEvent related issues in JSDOM with Radix UI
if (typeof window !== 'undefined' && !window.PointerEvent) {
	class PointerEvent extends MouseEvent {
		public pointerId?: number;
		public width?: number;
		public height?: number;
		public pressure?: number;
		public tangentialPressure?: number;
		public tiltX?: number;
		public tiltY?: number;
		public twist?: number;
		public pointerType?: string;
		public isPrimary?: boolean;

		constructor(type: string, params: PointerEventInit = {}) {
			super(type, params);
			this.pointerId = params.pointerId;
			this.width = params.width;
			this.height = params.height;
			this.pressure = params.pressure;
			this.tangentialPressure = params.tangentialPressure;
			this.tiltX = params.tiltX;
			this.tiltY = params.tiltY;
			this.twist = params.twist;
			this.pointerType = params.pointerType;
			this.isPrimary = params.isPrimary;
		}
	}
	window.PointerEvent = PointerEvent as any;
}

if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function(pointerId: number) {};
}

if (typeof Element !== 'undefined' && !Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = jest.fn();
}

// Add hasPointerCapture if it's missing
if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = jest.fn();
}

// Polyfill for missing JSDOM APIs
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = jest.fn();
}

// Mock window.matchMedia used by some UI libraries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});