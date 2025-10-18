export function h(tag, attrs = {}, ...children) {
  const events = {};
  const normalAttrs = {};

  for (const key in attrs) {
    if (key.startsWith("on") && typeof attrs[key] === "function") {
      events[key.toLowerCase()] = attrs[key]; // events like onClick
    } else {
      normalAttrs[key] = attrs[key];
    }
  }

  // Always ensure children is an array
  const flatChildren = children
    .flat()
    .filter((c) => c !== null && c !== undefined);

  return { tag, attrs: normalAttrs, events, children: flatChildren };
}

export function createElement(vnode) {
  if (typeof vnode === "string") {
    return document.createTextNode(vnode);
  }

  const el = document.createElement(vnode.tag);

  // ✅ Set attributes & DOM properties correctly
  for (const [key, value] of Object.entries(vnode.attrs || {})) {
    if (key === "checked" || key === "value" || key === "selected") {
      el[key] = value; // DOM property
    } else {
      el.setAttribute(key, value);
    }
  }

  // events
  for (const [eventName, handler] of Object.entries(vnode.events || {})) {
    el.addEventListener(eventName.slice(2).toLowerCase(), handler);
  }

  // children
  (vnode.children || []).forEach((child) => {
    el.appendChild(createElement(child));
  });

  vnode.el = el;
  return el;
}

export function patch(parent, newVNode, oldVNode) {
  // --- oldVNode missing ---
  if (!oldVNode) {
    const newEl = createElement(newVNode);
    parent.appendChild(newEl);
    if (typeof newVNode === "object") newVNode.el = newEl;

    // autofocus for new inputs
    if (newVNode.attrs?.autofocus) queueMicrotask(() => newEl.focus());
    return;
  }

  // --- newVNode missing ---
  if (!newVNode) {
    if (oldVNode && typeof oldVNode !== "string" && oldVNode.el) {
      parent.removeChild(oldVNode.el);
    }
    return;
  }

  // --- text nodes ---
  if (typeof newVNode === "string" || typeof oldVNode === "string") {
    if (newVNode !== oldVNode) {
      const newEl = createElement(newVNode);
      parent.replaceChild(
        newEl,
        typeof oldVNode === "string" ? parent.childNodes[0] : oldVNode.el
      );
      if (typeof newVNode === "object") newVNode.el = newEl;
    }
    return;
  }

  // --- different tag or input type (replace) ---
  if (
    newVNode.tag !== oldVNode.tag ||
    (newVNode.tag === "input" && newVNode.attrs?.type !== oldVNode.attrs?.type)
  ) {
    const newEl = createElement(newVNode);
    parent.replaceChild(newEl, oldVNode.el);
    newVNode.el = newEl;

    // autofocus for inputs
    if (newVNode.attrs?.autofocus) queueMicrotask(() => newEl.focus());
    return;
  }

  // --- same tag ---
  const el = (newVNode.el = oldVNode.el);

  if (newVNode.tag === "input" && newVNode.attrs?.type === "checkbox") {
    el.checked = !!newVNode.attrs.checked;
  }

  // update attrs
  for (const [key, value] of Object.entries(newVNode.attrs || {})) {
    if (oldVNode.attrs[key] !== value) {
      if (key === "checked") {
        el.checked = value;
      } // checkbox
      else if (key === "autofocus" && value) queueMicrotask(() => el.focus());
      else {
        el.setAttribute(key, value);
      }
    }
  }
  for (const key in oldVNode.attrs) {
    if (!(key in newVNode.attrs)) el.removeAttribute(key);
  }

  // update events
  for (const [eventName, newHandler] of Object.entries(newVNode.events || {})) {
    const type = eventName.slice(2);
    const oldHandler = oldVNode.events?.[eventName];
    if (!oldHandler || oldHandler !== newHandler) {
      if (oldHandler) el.removeEventListener(type, oldHandler);
      el.addEventListener(type, newHandler);
    }
  }
  for (const [eventName, oldHandler] of Object.entries(oldVNode.events || {})) {
    if (!(eventName in newVNode.events))
      el.removeEventListener(eventName.slice(2), oldHandler);
  }

  // --- children diff ---
  const newChildren = newVNode.children || [];
  const oldChildren = oldVNode.children || [];

  const hasKeys =
    newChildren.some(
      (c) => c && typeof c === "object" && c.attrs?.key != null
    ) ||
    oldChildren.some((c) => c && typeof c === "object" && c.attrs?.key != null);

  if (hasKeys) {
  // 🚨 SAFETY MODE: keyed diffing disabled
  // -> Full replace of children to avoid NotFoundError crashes

  // Remove all old children
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }

  // Add all new children fresh
  newChildren.forEach((child) => {
    patch(el, child, null);
  });

  return;
} else {
    const max = Math.max(newChildren.length, oldChildren.length);
    for (let i = 0; i < max; i++) patch(el, newChildren[i], oldChildren[i]);
  }
}
