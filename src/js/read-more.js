const readMore = {
  expand: function (content) {
    return this.expandCollapse(content, "expand");
  },

  collapse: function (content) {
    return this.expandCollapse(content, "collapse");
  },

  expandCollapse: function (content, direction) {
    const heightTransition = this.getTransitionDuration(content, "height");
    const height = this.getHeight(content);

    // Only handle if the box has a transition and isn't currently animating
    if (heightTransition !== "0s" && height > 0) {
      if (content.style.height === "") {
        if (direction === "expand") {
          return this.expandContent(content, height);
        } else if (direction === "collapse") {
          return this.collapseContent(content, height);
        }
      } else {
        return new Promise((resolve, reject) => {
          content.addEventListener("transitionend", function cb (e) {
            if (content.style.height === "") {
              const collapseEvent = new Event("collapse");
              content.dispatchEvent(collapseEvent);
              content.removeEventListener("transitionend", cb);
              resolve(e);
            }
          });
        });
      }
    } else {
      return Promise.resolve();
    }
  },

  expandContent: function (content, height) {
    content.style.height = "0px";
    window.setTimeout(() => {
      content.style.height = height + "px";
    }, 1);

    return new Promise((resolve, reject) => {
      content.addEventListener("transitionend", function cb (e) {
        if (content.style.height === height + "px") {
          content.style.height = "";
          content.style.padding = "";
          content.style.margin = "";

          const expandEvent = new Event("expand");
          content.dispatchEvent(expandEvent);

          content.removeEventListener("transitionend", cb);
          resolve(e);
        }
      });
    });
  },

  collapseContent: function (content, height) {
    content.style.height = height + "px";

    window.setTimeout(() => {
      content.style.height = "0px";
      content.style.paddingTop = "0px";
      content.style.marginTop = "0px";
      content.style.paddingBottom = "0px";
      content.style.marginBottom = "0px";
    }, 1);

    return new Promise((resolve, reject) => {
      content.addEventListener("transitionend", function cb (e) {
        if (content.style.height === "0px") {
          content.style.height = "";
          content.style.padding = "";
          content.style.margin = "";

          const collapseEvent = new Event("collapse");
          content.dispatchEvent(collapseEvent);

          content.removeEventListener("transitionend", cb);
          resolve(e);
        }
      });
    });
  },

  getTransitionDuration: function (element, property) {
    const style = window.getComputedStyle(element);
    const properties = style.transitionProperty.split(",");
    const durations = style.transitionDuration.split(",");

    const transitions = properties.reduce((transitions, property, index) => {
      return Object.assign({}, transitions, {[property]: durations[index]});
    }, {});

    if (transitions[property]) {
      return transitions[property];
    } else {
      return transitions.all;
    }
  },

  getHeight: function (content) {
    const style = window.getComputedStyle(content);

    const paddingTop = style.paddingTop;
    const paddingBottom = style.paddingBottom;

    // Set styles to invisibly measure height
    if (paddingTop === "0px") {
      content.style.paddingTop = "1px";
    }
    if (paddingBottom === "0px") {
      content.style.paddingBottom = "1px";
    }
    content.style.visibility = "hidden";
    content.style.display = "block";

    // Measure height, subtracting added padding
    const addedPadding = (paddingTop === "0px" ? 1 : 0) +
        (paddingBottom === "0px" ? 1 : 0);
    const height = content.offsetHeight - addedPadding;

    // Reset styles
    content.style.paddingTop = "";
    content.style.paddingBottom = "";
    content.style.display = "";
    content.style.visibility = "";

    return height;
  }
}

module.exports = readMore;
