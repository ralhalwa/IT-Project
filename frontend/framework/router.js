import { mount } from "./renderer.js";

let routes = {};
let rootContainer = null;

export function createRouter(routeConfig, container) {
  routes = routeConfig;
  rootContainer = container;

  window.addEventListener("popstate", renderRoute);
  renderRoute(); // initial render
}

function renderRoute() {
  const path = window.location.pathname;
  const component = routes[path] || routes["*"];
  if (!component) {
    console.error(`No route defined for path: ${path}`);
    return;
  }

  rootContainer.innerHTML = "";
  mount(component, rootContainer);
}

export function navigate(path) {
  history.pushState({}, "", path);
  renderRoute();
}
