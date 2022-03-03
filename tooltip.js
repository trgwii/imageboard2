// @license magnet:?xt=urn:btih:5305d91886084f776adcf57509a648432709a7c7&dn=x11.txt X11
const tooltip = document.createElement("div");
Object.assign(tooltip.style, {
  position: "absolute",
  display: "none",
  fontFamily: "'Inconsolata', monospace",
  fontSize: "14px",
  backgroundColor: "#1E1E1E",
  border: "1px solid #727272",
  padding: "4px",
});
const offset = 20;
document.body.addEventListener("mousemove", (e) => {
  tooltip.style.top = offset + e.clientY + scrollY + "px";
  tooltip.style.left = offset + e.clientX + scrollX + "px";
});
document.body.appendChild(tooltip);
const lsps = document.getElementsByTagName("data-lsp");
let timeout = 0;
for (let i = 0; i < lsps.length; i++) {
  const lsp = lsps[i];
  lsp.addEventListener("mouseenter", (e) => {
    clearTimeout(timeout);
    tooltip.textContent = e.target.getAttribute("lsp");
    tooltip.style.display = "";
  });
  lsp.addEventListener("mouseleave", () => {
    timeout = setTimeout(() => {
      tooltip.style.display = "none";
      tooltip.textContent = "";
    }, 200);
  });
}
// @license-end
