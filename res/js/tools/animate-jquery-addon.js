$.fn.extend({
  animateCss: function (animationName) {
    return new Promise((resolve) => {
      //if (false) { // to do
      //  if (typeof callback === "function") callback();
      //} else {
      var animationEnd = (function (el) {
        var animations = {
          animation: "animationend",
          OAnimation: "oAnimationEnd",
          MozAnimation: "mozAnimationEnd",
          WebkitAnimation: "webkitAnimationEnd",
        };

        for (var t in animations) {
          if (el.style[t] !== undefined) {
            return animations[t];
          }
        }
      })(document.createElement("div"));

      this.addClass("animated " + animationName).one(animationEnd, function () {
        $(this).removeClass("animated " + animationName);

        resolve(true);
      });

      return this;
      //}
    });
  },
});