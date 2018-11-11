
module.exports = {
  init: function () {
    Array.prototype.remap = function (str) {
      var obj = {};
      this.forEach((e) => obj[e[str]] = e);
      return obj;
    };

    Array.prototype.unique = function () {
      return this.filter((e, i, array) => array.indexOf(e) === i);
    };
  }
};