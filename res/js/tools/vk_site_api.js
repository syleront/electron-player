var needle = require("needle");
var audioUnmaskSource = require("./audioUnmaskSource.js");
var prototypes = require("./prototypes");
prototypes.init();

var options = {
  multipart: true,
  user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:62.0) Gecko/20100101 Firefox/62.0"
};

process.on("uncaughtException", (e) => {
  console.log("uncaughtException " + e.stack);
});

var VK = {
  auth: function (email, password) {
    return new Promise((resolve, reject) => {
      needle.get("https://vk.com/login", (e, r, b) => {
        if (e) throw e;
        var ip_h = b.match(/name="ip_h" value="([A-z0-9]+)"/i);
        var lg_h = b.match(/name="lg_h" value="([A-z0-9]+)"/i);
        if (!ip_h || !lg_h) throw "ip_h or lg_h is not finded at this page";
        options.cookies = r.cookies;
        var data = {
          _origin: "https://vk.com",
          act: "login",
          email: email,
          pass: password,
          role: "al_frame",
          ip_h: ip_h[1],
          lg_h: lg_h[1],
        };
        needle.post("https://login.vk.com/?act=login", data, options, (e, r) => {
          if (e) throw e;
          options.cookies = Object.assign(options.cookies, r.cookies);
          needle.get(r.headers.location, options, (e, r, b) => {
            if (e) throw e;
            options.cookies = Object.assign(options.cookies, r.cookies);
            if (/act=authcheck/i.test(b)) {
              needle.get("https://vk.com/login?act=authcheck", options, (e, r, b) => {
                if (e) throw e;
                options.cookies = Object.assign(options.cookies, r.cookies);
                var hash = b.match(/hash: '([0-9A-z]+_[0-9A-z]+)'/)[1];
                reject({
                  code: 1,
                  check: function (code) {
                    return VK.auth_check(code, hash);
                  },
                  sendSms: function () {
                    return new Promise((resolve, reject) => {
                      var data = {
                        act: "a_authcheck_sms",
                        al: 1,
                        hash
                      };
                      needle.post("https://vk.com/al_login.php", data, options, (e, r, b) => {
                        if (e) reject(e);
                        else resolve(b);
                      });
                    });
                  }
                });
              });
            } else {
              resolve(this.load(options.cookies));
            }
          });
        });
      });
    });
  },
  auth_check: function (code, hash) {
    return new Promise((resolve, reject) => {
      delete options.cookies.remixtst;
      var data = {
        act: "a_authcheck_code",
        al: 1,
        code,
        hash,
        remember: 1
      };
      needle.post("https://vk.com/al_login.php", data, options, (e, r, b) => {
        if (e) throw e;
        options.cookies = Object.assign(options.cookies, r.cookies);
        var url = b.match(/<!>\/(.+?)</);
        if (!url) {
          reject({
            code: 2,
            text: b
          });
        } else {
          needle.get("https://vk.com/" + url[1], options, (e, r) => {
            if (e) throw e;
            options.cookies = Object.assign(options.cookies, r.cookies);
            resolve(this.load(options.cookies));
          });
        }
      });
    });
  },
  load: function (cookies) {
    return new Promise((resolve, reject) => {
      options.cookies = cookies;
      needle.get("https://vk.com/dev/execute", options, (e, r, b) => {
        if (e) throw e;
        var hash = b.match(/Dev\.methodRun\('([A-z0-9:]+)/i);
        if (!hash) return reject({ code: 3, error: "incorect login or password" });
        VK.api = function (method, params) {
          return new Promise((resolve) => {
            var data = {
              param_code: "return API." + method + "(" + JSON.stringify(params) + ");",
              act: "a_run_method",
              al: 1,
              method: "execute",
              param_v: "5.80",
              hash: hash[1],
            };
            needle.post("https://vk.com/dev", data, options, (e, r, b) => {
              var res = JSON.parse(b.match(/{.*/)[0]);
              resolve(res.response || res);
            });
          });
        };
        VK.api("users.get", {}).then((r) => {
          if (!r) return VK.load(cookies);
          VK.user_id = r[0].id;
          VK.cookies = options.cookies;
          VK.audioUtils.getExportsHash().then((hash) => {
            VK.exports_hash = hash;
            resolve(VK);
          });
        });
      });
    });
  },
  audioUtils: {
    search: function (obj) {
      return new Promise((resolve) => {
        needle.post("https://vk.com/al_audio.php", {
          act: "load_section",
          al: 1,
          claim: 0,
          count: 100,
          offset: obj.offset || 0,
          type: "search",
          owner_id: VK.user_id,
          search_q: obj.q,
          search_history: 0,
          track_type: "default"
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var json = JSON.parse(b.match(/<!json>(.+?)<!>/i)[1]);
            var list = audioListToObj(json.list);
            resolve(list);
          });
      });
    },
    getRecomsBlocks: function (obj) {
      return new Promise((resolve, reject) => {
        needle.post("https://vk.com/al_audio.php", {
          act: "recoms_blocks",
          al: 1,
          offset: obj.offset || 0,
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var json = JSON.parse(b.match(/<!json>(.+?)<!>/i)[1]);
            var sections = json.join("").match(/<a(.+?)href="\/audios[0-9]+\?section=recoms_block(.+?)>/g);
            if (sections) {
              var blocks = sections.map((e) => e.match(/section=recoms_block&type=[A-z0-9]+/ig).map((e) => e.replace("section=recoms_block&type=", ""))[0]);
              var load = blocks.map((e) => {
                return VK.audioUtils.loadBlockById({
                  id: e
                });
              });
              Promise.all(load).then((lists) => {
                var blocks = lists.remap("name");
                resolve(blocks);
              }).catch(reject);
            } else {
              reject({
                error: "result is null"
              });
            }
          });
      });
    },
    getAllSearchBlocks: function (obj) {
      return new Promise((resolve, reject) => {
        needle.post("https://vk.com/al_audio.php", {
          act: "section",
          al: 1,
          is_layer: 0,
          owner_id: VK.user_id,
          q: obj.q,
          offset: obj.offset || 0,
          section: "search",
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var albums = b.match(/<a(.+?)href="\/audios[0-9]+\?section=search_block(.+?)>/gm);
            if (albums) {
              var blocks = albums.map((e) => e.match(/section=search_block&type=[A-z0-9]+/ig).map((e) => e.replace("section=search_block&type=", ""))[0]);
              var load = blocks.map((e) => {
                return VK.audioUtils.loadBlockById({
                  id: e
                });
              });
              Promise.all(load).then((lists) => {
                var blocks = lists.remap("name");
                resolve(blocks);
              }).catch(reject);
            } else {
              reject({
                error: "search result is null"
              });
            }
          });
      });
    },
    loadBlockById: function (obj) {
      return new Promise((resolve, reject) => {
        needle.post("https://vk.com/al_audio.php", {
          act: "load_playlists_block",
          al: 1,
          block_id: obj.id,
          render_html: 1
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var match = b.match(/audio\?z=audio_playlist(.+?)"/g);
            if (!match) {
              reject({
                error: "Page isn't loaded"
              });
            } else {
              var json = JSON.parse(b.match(/<!json>(.+?)<!>/i)[1]);
              if (json.type == "playlists") {
                var hashes = b.match(/AudioUtils\.showAudioPlaylist\((.+?)\)/g).unique().map((e) => e.match(/'(.*?)'/)[1]);
                json.items = Object.entries(json.items).map((e, i) => {
                  e[1].playlist_id = e[0];
                  e[1].access_hash = hashes[i];
                  return e[1];
                });
                json.items.forEach((e) => {
                  if (e.photo) {
                    var p = e.photo.angles[0].m;
                    e.photo.url = `https://pp.userapi.com/c${p.server}/v${p.volume_id}/${p.volume_local_id}/${p.secret}.jpg`;
                  }
                });
              }
              resolve(json);
            }
          });
      });
    },
    getWallAudio: function (obj) {
      return new Promise((resolve) => {
        needle.post("https://vk.com/al_audio.php", {
          access_hash: "",
          act: "load_section",
          al: 1,
          claim: 0,
          offset: 1,
          owner_id: obj.owner_id,
          playlist_id: 3424665,
          post_id: obj.post_id || "",
          track_type: "default",
          type: "wall",
          wall_query: "",
          wall_type: "own"
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var json = JSON.parse(b.match(/<!json>(.+?)<!>/i)[1]);
            resolve(json);
          });
      });
    },
    getPlaylist: function (obj, dontTransformList) {
      return new Promise((resolve, reject) => {
        needle.post("https://vk.com/al_audio.php", {
          access_hash: obj.access_hash || "",
          act: "load_section",
          al: 1,
          claim: 0,
          count: 100,
          offset: obj.offset || 0,
          type: "playlist",
          owner_id: obj.owner_id || VK.user_id,
          playlist_id: obj.playlist_id || -1
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var json = JSON.parse(b.match(/<!json>(.+?)<!>/i)[1]);
            if (json.list) {
              if (dontTransformList) {
                resolve(json);
              } else {
                var list = audioListToObj(json.list);
                resolve([list, json]);
              }
              
            } else {
              reject({
                error: "playlist is not available"
              });
            }
          });
      });
    },
    getFullPlaylist: function (obj) {
      return new Promise((resolve) => {
        var container = [];
        (function get(offset) {
          VK.audioUtils.getPlaylist(Object.assign(obj || {}, { offset })).then(([list, r]) => {
            container = container.concat(list);
            if (r.nextOffset < r.totalCount) {
              get(r.nextOffset);
            } else {
              resolve(container);
            }
          });
        })();
      });
    },
    getUserPlaylists: function (obj) {
      if (!obj) obj = {};
      return new Promise((resolve) => {
        needle.post("https://vk.com/al_audio.php", {
          act: "section",
          al: 1,
          is_layer: 0,
          section: "playlists",
          owner_id: obj.owner_id || VK.user_id
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var elems = b.match(/<a\shref="\/audio.+?>/g);
            var titles = b.match(/<a\sclass="audio_item__title".+?>(.+?)</g);
            var playlists = [];
            if (elems) {
              elems.forEach((e, i) => {
                var params = parseNodeParams(e);
                var ids = params.href.match(/audio_playlist([-_0-9]+)/i)[1].split("_");
                var access_hash = params.href.match(/\/([A-z0-9]+)$/i);
                var picture = params.style.match(/http(?:s):\/\/.+?.jpg/i);
                var title = titles[i].match(/>(.+?)</i)[1];
                playlists.push({
                  owner_id: ids[0],
                  playlist_id: ids[1],
                  picture: picture ? picture[0] : null,
                  title: title,
                  access_hash: access_hash ? access_hash[1] : null
                });
              });
              resolve(playlists);
            } else {
              resolve(null);
            }
          });
      });
    },
    getAudioById: function (obj) {
      return new Promise((resolve) => {
        needle.post("https://vk.com/al_audio.php", {
          act: "reload_audio",
          al: 1,
          ids: obj.owner_id + "_" + obj.id + "_" + obj.hashes.join("_")
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var json = JSON.parse(b.match(/<!json>(.+?)<!>/i)[1]);
            resolve(audioListToObj(json));
          });
      });
    },
    getRecomendations: function (obj) {
      if (!obj) obj = {};
      return new Promise((resolve) => {
        needle.post("https://vk.com/al_audio.php", {
          act: "load_section",
          owner_id: VK.user_id,
          claim: 0,
          type: "recoms",
          offset: obj.offset || 0,
          al: 1
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var json = JSON.parse(b.match(/<!json>(.+?)<!>/i)[1]);
            json.list = audioListToObj(json.list);
            resolve(json);
          });
      });
    },
    getAllRecomendations: function () {
      return new Promise((resolve) => {
        var list = [];
        (function get(offset) {
          VK.audioUtils.getRecomendations({ offset }).then((res) => {
            list = list.concat(res.list);
            if (res.list.length) {
              get(res.nextOffset);
            } else {
              resolve(list);
            }
          });
        })(0);
      });
    },
    addAudio: function (obj) {
      if (!obj) obj = {};
      return new Promise((resolve, reject) => {
        needle.post("https://vk.com/al_audio.php", {
          al: 1,
          act: "add",
          audio_id: obj.id,
          audio_owner_id: obj.owner_id,
          group_id: 0,
          hash: obj.hashes_string.split("//")[0]
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            var match = b.match(/<!json>(.+?)$/i);
            if (match) {
              var json = JSON.parse(b.match(/<!json>(.+?)$/i)[1]);
              resolve(audioListToObj([json]));
            } else {
              reject({
                error: "json is undefined"
              });
            }
          });
      });
    },
    deleteAudio: function (obj) {
      if (!obj) obj = {};
      return new Promise((resolve) => {
        needle.post("https://vk.com/al_audio.php", {
          al: 1,
          act: "delete_audio",
          aid: obj.id,
          oid: obj.owner_id,
          hash: obj.hashes_string.split("/")[3],
          restore: 1
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            resolve(b);
          });
      });
    },
    restoreAudio: function (obj) {
      if (!obj) obj = {};
      return new Promise((resolve) => {
        needle.post("https://vk.com/al_audio.php", {
          al: 1,
          act: "restore_audio",
          aid: obj.id,
          oid: obj.owner_id,
          hash: obj.hashes_string.split("/")[1]
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            resolve(b);
          });
      });
    },
    getAudioCover: function (obj) {
      return new Promise((resolve) => {
        Promise.resolve().then(() => {
          if (obj.playlist_info) {
            return obj;
          } else {
            return VK.audioUtils.getAudioById({
              owner_id: obj.owner_id,
              id: obj.id,
              hashes: obj.hashes
            });
          }
        }).then((r) => {
          VK.audioUtils.getPlaylist({
            owner_id: r.playlist_info.owner_id,
            playlist_id: r.playlist_info.id,
            access_hash: r.playlist_info.access_hash
          }, true).then((c) => {
            resolve(c.coverUrl || null);
          });
        });
      });
    },
    setStatus: function (obj, off) {
      if (!obj) obj = {};
      return new Promise((resolve) => {
        needle.post("https://vk.com/al_audio.php", {
          al: 1,
          exp: off ? 0 : 1,
          act: "toggle_status",
          hash: VK.exports_hash,
          oid: off ? 0 : VK.user_id,
          id: obj.audio || "",
          top: 0
        }, {
            multipart: true,
            cookies: VK.cookies
          }, (e, r, b) => {
            if (e) throw e;
            resolve(b);
          });
      });
    },
    getExportsHash: function () {
      return new Promise((resolve) => {
        needle.get("https://vk.com/al_audio.php", {
          multipart: true,
          cookies: VK.cookies
        }, (e, r, b) => {
          if (e) throw e;
          resolve(b.match(/statusExportHash:\s'(.+?)'/)[1]);
        });
      });
    }
  }
};

function audioListToObj(list) {
  return list.map((e) => {
    return {
      id: e[0],
      owner_id: e[1],
      title: e[3],
      artist: e[4],
      duration: e[5],
      hashes: [e[13].split("/")[2], (e[13].split("//")[2] || e[13].split("//")[1]).replace("/", "")],
      hashes_string: e[13],
      picture: e[14] !== "" ? e[14].split(",") : null,
      url: e[2] !== "" ? audioUnmaskSource(e[2], VK.user_id) : null,
      attachment_id: e[1] + "_" + e[0],
      playlist_info: {
        owner_id: e[19][0],
        id: e[19][1],
        access_hash: e[19][2]
      }
    };
  });
}

function parseNodeParams(string) {
  var params = string.match(/[A-z]+=(?:""|".+?")/g);
  var obj = {};
  params.forEach((e) => {
    var p = e.split("=\"");
    obj[p[0]] = p[1].replace(/"$/, "");
  });
  return obj;
}

module.exports = VK;