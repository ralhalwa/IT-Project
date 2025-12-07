import { createElement, patch } from './dom.js';
import { resetHooks } from './hooks.js';

let rootComponent = null;
let rootContainer = null;
let oldVNode = null;


export function mount(component, container) {
  rootComponent = component;
  rootContainer = container;
  oldVNode = component();
  rootContainer.appendChild(createElement(oldVNode));
}

// Re-render with diffing
export function update() {
  if (!rootComponent) return;
  resetHooks(); // reset hook index before rendering
  const newVNode = rootComponent();
  patch(rootContainer, newVNode, oldVNode);
  oldVNode = newVNode;
}
