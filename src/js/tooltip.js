const hiddenClass = "tooltip-hidden";

const tooltip = document.createElement("div");
tooltip.classList.add("tooltip", hiddenClass);
document.body.appendChild(tooltip);

function show() {
  tooltip.classList.remove(hiddenClass);
}

function hide() {
  tooltip.classList.add(hiddenClass);
}

function setHTML(html) {
  tooltip.innerHTML = html;
}

function setPosition(mouseX, mouseY) {
  const bounds = tooltip.getBoundingClientRect();

  // Offset above mouse
  const mouseOffset = 20;
  // Padding from window
  const gutter = 10;
  // If tooltip is too big for the window, set padding to zero
  const padding = window.innerWidth < bounds.width + gutter * 2
    ? 0
    : gutter;
  // Padded positions relative to container
  const leftExtent = 0 + padding;
  const rightExtent = window.innerWidth - padding - bounds.width;

  // Distance above the mouse
  const y = mouseY - bounds.height - mouseOffset;
  // distance from left - half the box
  const x = mouseX - (bounds.width / 2);

  const top = y < 0 + padding
    ? mouseY + mouseOffset
    : y;

  const left = window.innerWidth < bounds.width
    // If it's too big for the window, align to window left outside container
    ? 0
    : x < leftExtent
      // If the pointer is past the left position, align left
      ? leftExtent
      : x > rightExtent
        // If the pointer is past the right position, align right
        ? rightExtent
        // Otherwise, use pointer position
        : x;

  tooltip.setAttribute("style", `top: ${top}px; left: ${left}px`);
}

module.exports = {
  show,
  hide,
  setHTML,
  setPosition
};