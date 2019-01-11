const vk = require("./res/js/tools/vk-site-api.js"),
  fs = require("fs"),
  path = require("path"),
  user_settings = tryRequireSettings(),
  PlayerJS = require("./res/js/player-ui.js"),
  INIT_INFO = {
    PATH: __dirname
  };

Node.prototype.selectByClass = function (className) {
  return this.getElementsByClassName(className)[0];
};

process.on("uncaughtException", (e) => {
  console.log("uncaughtException " + e.stack);
});

/* window.onerror = function (msg, url, num) {
  alert("Error: " + msg + "\nWhere: " + url + "\nLine: " + num);
  return true;
}; */

document.addEventListener("DOMContentLoaded", () => {
  fs.readFile(path.join(__dirname, "data/cookies"), (e, d) => {
    if (e) {
      renderLogin();
    } else {
      let cookies = JSON.parse(d);
      vk.load(cookies).then((API) => {
        loadPage("player").then(() => {
          PlayerJS(API, INIT_INFO, user_settings);
        });
      }).catch((e) => {
        if (e.code == 3) {
          renderLogin();
        }
      });
    }
  });
});

function renderLogin() {
  let tmp = {};
  loadPage("login").then(() => {
    let btn = document.getElementById("login_btn");
    let preloader = document.getElementById("preloader");
    btn.addEventListener("click", () => {
      btn.parentNode.style.display = "none";
      preloader.style.display = "block";
      if (tmp.auth_check) {
        let code = document.getElementById("auth_code").value;
        tmp.auth_check(code).then((API) => {
          fs.writeFile(path.join(__dirname, "data/cookies"), JSON.stringify(API.cookies), (e) => {
            if (e) throw e;
            loadPage("player").then(() => {
              PlayerJS(API, INIT_INFO, user_settings);
            });
          });
        }).catch((e) => {
          if (e.code == 2) {
            if (tmp.incorrect) {
              btn.parentNode.style.display = "block";
              preloader.style.display = "none";
              tmp.incorrect.innerHTML = "Неверный код";
              tmp.incorrect.style.display = "block";
            } else {
              fs.readFile(path.join(__dirname, "res/js/html_plains/error_header.html"), (e, d) => {
                btn.parentNode.style.display = "block";
                preloader.style.display = "none";
                if (e) throw e;
                let el = createElementFromHTML(d);
                el.innerHTML = "Неверный код";
                document.body.insertAdjacentElement("afterbegin", el);
                tmp.incorrect = el;
              });
            }
          }
        });
      } else {
        let login = document.getElementById("login").value;
        let pass = document.getElementById("password").value;
        vk.auth(login, pass).then((API) => {
          fs.writeFile(path.join(__dirname, "data/cookies"), JSON.stringify(API.cookies), (e) => {
            if (e) throw e;
            loadPage("player").then(() => {
              PlayerJS(API, INIT_INFO, user_settings);
            });
          });
        }).catch((e) => {
          if (e.code && e.code == 1) {
            if (tmp.incorrect) tmp.incorrect.style.display = "none";
            document.getElementById("auth_forms").style.display = "none";
            document.getElementById("login_with_site").style.display = "none";
            document.getElementById("auth_check_form").style.display = "block";
            btn.parentNode.style.display = "block";
            preloader.style.display = "none";
            btn.innerText = "Отправить";
            tmp.auth_check = e.check;

            let sms_div = document.getElementById("send_sms");
            let textNode = document.getElementById("text_sms_sended");
            sms_div.style.display = "block";
            sms_div.addEventListener("click", () => {
              if (tmp.waitSms) return;
              e.sendSms().then((b) => {
                let t = b.match(/<!int>([0-9]+)/);
                setTimeout(() => {
                  if (tmp && tmp.waitSms) {
                    tmp.waitSms = false;
                    sms_div.childNodes[1].setAttribute("class", "center-align map-link-a");
                  }
                }, t ? Number(t[1]) * 1000 : 120 * 1000);
                tmp.waitSms = true;
                sms_div.childNodes[1].setAttribute("class", "center-align map-link-a-disabled");

                let s = b.match(/<!>(<b>.+?)<!/);
                textNode.innerHTML = s ? s[1] : "SMS с кодом отправлено";
                textNode.style.display = "block";
                sms_div.style.display = "block";
                preloader.style.display = "none";
              }).catch((e) => {
                throw e;
              });
            });
            document.getElementById("auth_check_form").addEventListener("keydown", (evt) => {
              if (evt.keyCode == 13) {
                btn.click();
              }
            });
          } else {
            if (tmp.incorrect) {
              btn.parentNode.style.display = "block";
              preloader.style.display = "none";
              return;
            } else {
              fs.readFile(path.join(__dirname, "res/js/html_plains/error_header.html"), (e, d) => {
                btn.parentNode.style.display = "block";
                preloader.style.display = "none";
                if (e) throw e;
                let el = createElementFromHTML(d);
                el.innerHTML = "Неверный логин или пароль!";
                document.body.insertAdjacentElement("afterbegin", el);
                tmp.incorrect = el;
              });
            }
          }
        });
      }
    });
    document.getElementById("auth_forms").addEventListener("keydown", (evt) => {
      if (evt.keyCode == 13) {
        btn.click();
      }
    });
  });
}

function loadPage(name) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(__dirname, "res/html/" + name + ".html"), (e, d) => {
      if (e) {
        reject(e);
      } else {
        document.body.innerHTML = d;
        resolve(true);
      }
    });
  });
}

function createElementFromHTML(htmlString) {
  let div = document.createElement("div");
  div.innerHTML = htmlString;
  return div.firstChild;
}

function tryRequireSettings() {
  let defaults = {
    cover_spin: false,
    volume: 1,
    animations: true,
    transitions: true,
    broadcast: false,
    save: () => {
      return new Promise((resolve, reject) => {
        fs.writeFile(path.join(__dirname, "data/settings.json"), JSON.stringify(defaults), (e, d) => {
          if (e) reject(e);
          else resolve(d);
        });
      });
    }
  };
  try {
    let s = require("./data/settings.json");
    return Object.assign(defaults, s);
  } catch (e) {
    return defaults;
  }
}