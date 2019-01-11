
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

    Array.prototype.removeDuplicates = function (prop) {
      return this.filter((obj, pos, arr) => {
        return arr.map((mapObj) => mapObj[prop]).indexOf(obj[prop]) === pos;
      });
    };

    Array.prototype.last = function () {
      return this[this.length - 1];
    };
  }
};