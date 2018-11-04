
var f = {
  init: function () {
    Array.prototype.remap = function (str) {
      var obj = {};
      this.forEach((e) => obj[e[str]] = e);
      return obj;
    };
  }
};

module.exports = f;