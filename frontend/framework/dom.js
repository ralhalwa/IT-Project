
export function h(tag, attrs = {}, ...children) {
  const events = {};
  const normalAttrs = {};

  for (const key in attrs) {
    if (key.startsWith("on") && typeof attrs[key] === "function") {
      events[key.toLowerCase()] = attrs[key]; // e.g. onClick -> onclick
    } else {
      normalAttrs[key] = attrs[key];
    }
  }

  // ✅ Flatten and clean children
  const flatChildren = children
    .flat()
    .filter(c => c !== null && c !== undefined && c !== false);

  return { tag, attrs: normalAttrs, events, children: flatChildren };
}

export function createElement(vnode) {
  if (typeof vnode === "string" || typeof vnode === "number") {
    return document.createTextNode(String(vnode));
  }

  // ✅ Handle function components
  if (typeof vnode?.tag === "function") {
    const rendered = vnode.tag({ ...(vnode.attrs || {}), children: vnode.children || [] });
    const el = createElement(rendered);
    vnode.el = rendered?.el || el;
    return el;
  }

  const el = document.createElement(vnode.tag);

  // ✅ Attributes and properties
  for (const [key, value] of Object.entries(vnode.attrs || {})) {
    if (key === "className") el.setAttribute("class", value);
    else if (key === "style" && value && typeof value === "object") {
      for (const k in value) el.style[k] = value[k];
    } else if (["checked", "value", "selected"].includes(key) || key in el) {
      el[key] = value;
    } else {
      el.setAttribute(key, value);
    }
  }

  // ✅ Add event listeners
  for (const [eventName, handler] of Object.entries(vnode.events || {})) {
    el.addEventListener(eventName.slice(2).toLowerCase(), handler);
  }

  // ✅ Children
  (vnode.children || []).forEach(child => {
    el.appendChild(createElement(child));
  });

  vnode.el = el;
  return el;
}

export function patch(parent, newVNode, oldVNode) {
  // ✅ Normalize function components
  if (typeof newVNode?.tag === "function")
    newVNode = newVNode.tag({ ...(newVNode.attrs || {}), children: newVNode.children || [] });
  if (typeof oldVNode?.tag === "function")
    oldVNode = oldVNode.tag({ ...(oldVNode.attrs || {}), children: oldVNode.children || [] });

  // --- oldVNode missing ---
  if (!oldVNode) {
    const newEl = createElement(newVNode);
    parent.appendChild(newEl);
    if (typeof newVNode === "object") newVNode.el = newEl;
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

  // --- Text node handling ---
  if (typeof newVNode === "string" || typeof oldVNode === "string") {
    if (newVNode !== oldVNode) {
      const newEl = createElement(newVNode);
      const target = oldVNode.el || parent.childNodes[0];
      parent.replaceChild(newEl, target);
      if (typeof newVNode === "object") newVNode.el = newEl;
    }
    return;
  }

  // --- Different tag or input type ---
  if (
    newVNode.tag !== oldVNode.tag ||
    (newVNode.tag === "input" && newVNode.attrs?.type !== oldVNode.attrs?.type)
  ) {
    const newEl = createElement(newVNode);
    parent.replaceChild(newEl, oldVNode.el);
    newVNode.el = newEl;
    if (newVNode.attrs?.autofocus) queueMicrotask(() => newEl.focus());
    return;
  }

  // --- Same tag (diff attrs, events, children) ---
  const el = (newVNode.el = oldVNode.el);

  // ✅ Attrs diff
  for (const [key, value] of Object.entries(newVNode.attrs || {})) {
    if (oldVNode.attrs[key] !== value) {
      if (key === "checked") el.checked = value;
      else if (key === "autofocus" && value) queueMicrotask(() => el.focus());
      else if (key === "className") el.setAttribute("class", value);
      else el.setAttribute(key, value);
    }
  }
  for (const key in oldVNode.attrs) {
    if (!(key in newVNode.attrs)) el.removeAttribute(key);
  }

  // ✅ Events diff
  for (const [eventName, newHandler] of Object.entries(newVNode.events || {})) {
    const type = eventName.slice(2).toLowerCase();
    const oldHandler = oldVNode.events?.[eventName];
    if (!oldHandler || oldHandler !== newHandler) {
      if (oldHandler) el.removeEventListener(type, oldHandler);
      el.addEventListener(type, newHandler);
    }
  }
  for (const [eventName, oldHandler] of Object.entries(oldVNode.events || {})) {
    if (!(eventName in newVNode.events)) {
      el.removeEventListener(eventName.slice(2).toLowerCase(), oldHandler);
    }
  }

  // ✅ Children diff
  const newChildren = newVNode.children || [];
  const oldChildren = oldVNode.children || [];

  const hasKeys =
    newChildren.some(c => c && typeof c === "object" && c.attrs?.key != null) ||
    oldChildren.some(c => c && typeof c === "object" && c.attrs?.key != null);

  if (hasKeys) {
    // ✅ Lightweight keyed diff
    const oldMap = new Map();
    for (let i = 0; i < oldChildren.length; i++) {
      const c = oldChildren[i];
      const k = c && typeof c === "object" ? c.attrs?.key : null;
      if (k != null) oldMap.set(k, { vnode: c, idx: i });
    }

    let lastPlacedNode = null;
    const usedOldIdx = new Set();

    for (let i = 0; i < newChildren.length; i++) {
      const n = newChildren[i];
      const key = n && typeof n === "object" ? n.attrs?.key : null;

      if (key != null && oldMap.has(key)) {
        const { vnode: o, idx } = oldMap.get(key);
        usedOldIdx.add(idx);
        patch(el, n, o);
        const node = n.el;
        if (node !== (lastPlacedNode?.nextSibling || el.firstChild)) {
          el.insertBefore(node, lastPlacedNode ? lastPlacedNode.nextSibling : el.firstChild);
        }
        lastPlacedNode = node;
      } else {
        patch(el, n, null);
        const node = n.el;
        el.insertBefore(node, lastPlacedNode ? lastPlacedNode.nextSibling : el.firstChild);
        lastPlacedNode = node;
      }
    }

    for (let i = 0; i < oldChildren.length; i++) {
      if (!usedOldIdx.has(i)) {
        const oc = oldChildren[i];
        if (oc && typeof oc === "object" && oc.el && oc.el.parentNode === el) {
          el.removeChild(oc.el);
        }
      }
    }
    return;
  } else {
    const max = Math.max(newChildren.length, oldChildren.length);
    for (let i = 0; i < max; i++) patch(el, newChildren[i], oldChildren[i]);
  }
}
