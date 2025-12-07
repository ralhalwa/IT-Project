import { createElement, patch } from "./dom.js";
import { resetHooks } from "./hooks.js";

let rootComponent = null;
let rootContainer = null;
let oldVNode = null;

export function mount(component, container) {
  rootComponent = component;
  rootContainer = container;
  oldVNode = component();
  rootContainer.appendChild(createElement(oldVNode));
}

export function unmount() {
  if (!rootContainer || !oldVNode) return;
  if (oldVNode.el && oldVNode.el.parentNode === rootContainer) {
    rootContainer.removeChild(oldVNode.el);
  }
  rootComponent = null;
  oldVNode = null;
}

export function update() {
  if (!rootComponent) return;
  resetHooks();
  const newVNode = rootComponent();
  patch(rootContainer, newVNode, oldVNode);
  oldVNode = newVNode;
}
