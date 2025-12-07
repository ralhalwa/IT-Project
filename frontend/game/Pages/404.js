import { h } from "../../framework/dom";

export default function NotFound() {
    return h(
    "div",
    { class: "p-8 w-[100vw] h-[100vh] bg-gray-800 text-center" },
    h("h1", { class: "text-4xl font-bold text-red-600" }, "404 Not Found"),
    h(
      "p",
      { class: "mt-4 text-white text-lg" },
      "The page you are looking for does not exist."
    )
  )
}