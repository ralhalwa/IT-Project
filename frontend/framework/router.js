import { mount, unmount } from "./renderer.js";

let routes = {};
let rootContainer = null;

export function createRouter(routeConfig, container) {
  routes = routeConfig;
  rootContainer = container;
  window.addEventListener("popstate", renderRoute);
  renderRoute();
}

function renderRoute() {
  const path = window.location.pathname;
  const component = routes[path] || routes["*"];
  if (!component) return console.error(`No route defined for path: ${path}`);

  unmount(); // ✅ Clean previous route
  rootContainer.innerHTML = "";
  mount(component, rootContainer);
}

export function navigate(path) {
  history.pushState({}, "", path);
  renderRoute();
}
