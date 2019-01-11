process.on("uncaughtException", (e) => {
  console.log("uncaughtException " + e.stack);
});

module.exports = function (VK, INIT_INFO, Settings, addons) {
  const fs = require("fs"),
    path = require("path"),
    EventEmitter = require("events"),
    { remote, ipcRenderer } = require("electron"),
    currentWindow = remote.getCurrentWindow(),
    Audio = document.createElement("audio"),
    Prototypes = require("./tools/prototypes.js");

  Prototypes.init();

  let Player = {
    emitter: new EventEmitter(),
    data: {
      currentTab: "main_audio_list",
      currentTabPlaylistName: "mainPlaylist",
      currentTracklist: []
    },
    controls: {
      play: document.getElementById("play_button"),
      prev: document.getElementById("prev_button"),
      next: document.getElementById("next_button"),
      range: document.getElementById("player_track_range"),
      volume: document.getElementById("player_volume_range"),
      volume_parent: document.getElementById("player_volume_parent"),
      artist: document.getElementById("player_artist"),
      title: document.getElementById("player_title"),
      time: document.getElementById("player_time"),
      full_time: document.getElementById("player_full_time"),
      cover: document.getElementById("track_cover"),
      search_box: document.getElementById("search_box"),
      shuffle: document.getElementById("shuffle_button"),
      repeat: document.getElementById("repeat_button"),
      broadcast: document.getElementById("broadcast_button"),
      refresh: document.getElementById("refresh_button"),
      back_button: document.getElementById("back_button"),
      tabs: {
        sub: {}
      }
    },
    getCurrentTabContainerNode: function () {
      return document.getElementById(this.data.currentTab);
    },
    getCurrentSubtabContainerNode: function () {
      return document.getElementById(this.data.currentTab + "__" + this.data.currentTabPlaylistName);
    },
    getVisibleContainer: function () {
      let nodes = this.getCurrentSubtabContainerNode().childNodes;
      return nodes[nodes.length - 1];
      //let divId = this.data.currentTab + "__" + this.data.currentTabPlaylistName;
      //return Array.from(document.getElementById(divId).getElementsByClassName("map-subtab-container")).filter((e) => e.style.display !== "none")[0];
    },
    getCurrentTabAudioNodes: function () {
      return Array.from(this.getVisibleContainer().getElementsByClassName("map-audio-element"));
    },
    getListFromAudioNodes: function (list) {
      return Array.from(list).map((e) => e.trackInfo);
    },
    getCurrentTabTracklist: function () {
      return this.getVisibleContainer().getContainerData().list || this.getListFromAudioNodes(this.getCurrentTabAudioNodes());
    },
    setCurrentTabTracklist: function () {
      this.data.currentTracklist = this.getCurrentTabTracklist().slice(0);
      if (Player.data.shuffle == true) {
        this.data.nonShuffledCurrentTracklist = this.data.currentTracklist.slice(0);
        this.data.currentTracklist.sort(() => Math.random() - 0.5);
      }
      return this.data.currentTracklist;
    },
    getTrackinfoFromTracklist: function (id) {
      return this.data.currentTracklist.filter((e) => e.attachment_id == id)[0] || this.setCurrentTabTracklist().filter((e) => e.attachment_id == id)[0];
    },
    getTrackIndexById: function (id) {
      return this.data.currentTracklist.findIndex((e) => e.attachment_id == id);
    },
    getCurrentTrackIndex: function () {
      return this.getTrackIndexById(this.data.currentTrackId);
    },
    getTrackNodesById: function (id) {
      return Array.from(document.getElementsByClassName("map-audio-element")).filter((e) => e.trackInfo.attachment_id == id);
    },
    setTrackNodesStatus: function (id, state) {
      this.getTrackNodesById(id).forEach((e) => {
        e.selectByClass("play-btn").innerHTML = `${state}_circle_filled`;
      });
    },
    searchInMainPlaylist: function (q) {
      let reg = new RegExp(q, "i");
      return Player.data.mainPlaylist.filter((e) => reg.test(e.title) || reg.test(e.artist));
    },
    isTrackInMainPlaylist: function (id, needIndex) {
      if (this.data.mainPlaylist) {
        let i = this.data.mainPlaylist.findIndex((e) => e.attachment_id == id);
        return needIndex ? i : (i > -1 ? true : false);
      } else {
        return false;
      }
    },
    setTrack: function (id) {
      let trackInfo = this.getTrackinfoFromTracklist(id);
      if (!trackInfo) return;
      Player.emitter.emit("set_track", id, (this.data.currentTrackId || false));
      this.data.currentTrackId = id;
      new Promise((resolve) => {
        this.data.rangeInputBreak = true;
        if (this.data.currentTrackId) {
          if (Audio.paused) {
            Audio.volume = 0;
            resolve(true);
          } else {
            crossfade(false).then(resolve);
          }
        } else {
          resolve(true);
        }
      }).then(() => {
        if (trackInfo.url) {
          this.data.rangeInputBreak = false;
          this.controls.range.max = trackInfo.duration;
          Player.emitter.emit("set_cover", trackInfo);
          Audio.src = trackInfo.url;
          Audio.play().then(() => {
            crossfade(true).then(() => { });
          });
        } else {
          VK.audioUtils.getAudioById(trackInfo).then((r) => {
            if (!r.length) return this.playNext();
            this.data.rangeInputBreak = false;
            this.controls.range.max = r[0].duration;
            Player.emitter.emit("set_cover", trackInfo);
            Audio.src = r[0].url;
            Audio.play().then(() => {
              crossfade(true).then(() => { });
            });
          }).catch(() => {
            this.playNext();
          });
        }
      });
    },
    playPause: function (id) {
      if (id && id !== this.data.currentTrackId) {
        this.setTrack(id);
      } else if (!this.data.currentTrackId) {
        let list = this.getCurrentTabTracklist();
        if (!list.length) return;
        let newId = list[0].attachment_id;
        this.setTrack(newId);
        Player.emitter.emit("play", newId);
      } else if (Audio.paused) {
        Player.emitter.emit("play", this.data.currentTrackId);
        Audio.play().then(() => {
          crossfade(true).then(() => { });
        });
      } else {
        Player.emitter.emit("pause", this.data.currentTrackId);
        crossfade(false).then(() => {
          Audio.pause();
        });
      }
    },
    playNext: function () {
      if (!this.data.currentTrackId) return;
      let currentTrackIndex = this.getCurrentTrackIndex();
      if (currentTrackIndex !== this.data.currentTracklist.length - 1) {
        let newId = this.data.currentTracklist[currentTrackIndex + 1].attachment_id;
        this.setTrack(newId);
      } else {
        this.setTrack(this.data.currentTracklist[0].attachment_id);
      }
    },
    playPrev: function () {
      if (!this.data.currentTrackId) return;
      let currentTrackIndex = this.getCurrentTrackIndex();
      let newId;
      if (currentTrackIndex !== 0) {
        newId = this.data.currentTracklist[currentTrackIndex - 1].attachment_id;
        this.setTrack(newId);
      } else {
        newId = this.data.currentTracklist[this.data.currentTracklist.length - 1].attachment_id;
        this.setTrack(newId);
      }
    },
    renderAudioList: function (list, node, from, to) {
      if (!document.body.contains(node)) return;
      if (!list) list = [];
      return loadElement("audio_element").then((audioNode) => {
        (typeof from == "number" ? list.slice(from, to) : list).forEach((e) => {
          let el = createAudioElement(e, audioNode);
          node.appendChild(el);
        });
        let lastArg = arguments[arguments.length - 1];
        if (typeof lastArg == "function") {
          return lastArg();
        } else {
          return true;
        }
      });
    },
    renderPlaylists: function (list, node) {
      if (!document.body.contains(node)) return;
      return loadElement("playlist_element").then((pl) => {
        list.forEach((playlist) => {
          let playlistNode = pl.cloneNode(true);
          if (playlist.photo && playlist.photo.url) playlist.picture = playlist.photo.url;
          playlistNode.playlistInfo = playlist;
          playlistNode.selectByClass("photo").src = playlist.picture || playlistNode.selectByClass("photo").src;
          playlistNode.selectByClass("title").innerHTML = playlist.title;
          playlistNode.addEventListener("click", () => {
            $(node).animateCss("fadeOut").then(() => {
              this.showTempContainer(node).then((container) => {
                VK.audioUtils.getFullPlaylist({
                  access_hash: playlist.access_hash || "",
                  owner_id: playlist.owner_id,
                  playlist_id: playlist.id || playlist.playlist_id
                }).then((r) => {
                  container.setContainerData("audios", r);
                  this.renderAudioList(r, container, 0, 50, () => {
                    $(container).animateCss("fadeIn");
                  });
                });
              });
            });
          });
          node.appendChild(playlistNode);
        });
        let lastArg = arguments[arguments.length - 1];
        if (typeof lastArg == "function") {
          return lastArg();
        } else {
          return true;
        }
      });
    },
    renderListHeader: function (node, head_text, border, btn_cb) {
      return loadElement("list_header").then((header) => {
        if (border) header.classList.add("border");
        if (head_text) header.selectByClass("title").innerHTML = head_text;
        if (!btn_cb) header.selectByClass("all-btn").remove();
        else header.selectByClass("all-btn").addEventListener("click", btn_cb);
        node.appendChild(header);
        return header;
      });
    },
    renderUsers: function (list, node) {
      if (!document.body.contains(node)) return;
      return loadElement("people_element").then((nodePlain) => {
        list.forEach((user) => {
          let userNode = nodePlain.cloneNode(true);
          userNode.selectByClass("title").innerHTML = user.first_name + "<br>" + user.last_name;
          userNode.selectByClass("photo").src = user.photo_100;
          if (user.can_see_audio) {
            userNode.addEventListener("click", () => {
              $(node).animateCss("fadeOut").then(() => {
                this.showTempContainer(node).then(async (container) => {
                  container.style.display = "none";
                  let playlists = await VK.audioUtils.getUserPlaylists({ owner_id: user.id });
                  let audios = await VK.audioUtils.getFullPlaylist({ owner_id: user.id });
                  container.setContainerData("audios", audios);
                  if (playlists) {
                    let cb = () => {
                      $(container).animateCss("fadeOut").then(() => {
                        this.showTempContainer(container).then(async (albumsConainer) => {
                          await this.renderPlaylists(playlists, albumsConainer);
                          $(albumsConainer).animateCss("fadeIn");
                        });
                      });
                    };
                    await this.renderListHeader(container, "Плейлисты", false, playlists.length > 5 ? cb : false);
                    await this.renderPlaylists(playlists.slice(0, 5), container);
                  }
                  await this.renderListHeader(container, "Все аудиозаписи", true);
                  await this.renderAudioList(audios, container, 0, 75);
                  container.style.display = "";
                  $(container).animateCss("fadeIn veryfaster");
                });
                //this.controls.tabs.sub.peoplewall;
              });
            });
          } else {
            userNode.classList.add("closed");
          }
          node.appendChild(userNode);
          $(node).animateCss("fadeIn");
        });
      });
    },
    renderGroups: function (list, node) {
      if (!document.body.contains(node)) return;
      return loadElement("group_element").then((nodePlain) => {
        list.forEach((group) => {
          let groupNode = nodePlain.cloneNode(true);
          groupNode.selectByClass("title").innerHTML = group.name;
          groupNode.selectByClass("photo").src = group.photo_100;
          groupNode.addEventListener("click", () => {
            $(node).animateCss("fadeOut").then(() => {
              Player.showTempContainer(node).then((container) => {
                container.data_offset = 0;
                container.setContainerData("audios", []);
                let load = function (_cb) {
                  VK.audioUtils.getWallAudioFromWall({
                    owner_id: group.id * -1,
                    offset: container.data_offset
                  }).then((list) => {
                    container.data_offset += 9;
                    let containerList = container.getContainerData();
                    container.setContainerData("audios", containerList.list.concat(list).removeDuplicates("attachment_id"));
                    Player.renderAudioList(list, container).then(_cb);
                    let length = Player.getCurrentTabAudioNodes().length;
                    if (length < 75) load(_cb);
                  });
                };
                container.setOnScrollFunction(load);
                load();
              });
            });
          });
          node.appendChild(groupNode);
          $(node).animateCss("fadeIn");
        });
      });
    },
    reloadTabs: function () {
      return VK.audioUtils.getFullPlaylist().then((r) => {
        Player.data.mainPlaylist = r;
        Player.controls.tabs.sub.main.innerHTML = "";
        Player.controls.tabs.sub.main.container_data = Player.data.mainPlaylist;
        Player.controls.tabs.sub.main.setContainerData("audios", Player.data.mainPlaylist);
        Player.renderAudioList(r, Player.controls.tabs.sub.main, 0, 75, () => {
          $(Player.controls.tabs.sub.main).animateCss("fadeIn veryfaster");
        });
      }).then(() => {
        return VK.audioUtils.getAllRecomendations().then((r) => {
          Player.controls.tabs.sub.recoms.innerHTML = "";
          Player.controls.tabs.sub.recoms.setContainerData("audios", r);
          Player.renderAudioList(r, Player.controls.tabs.sub.recoms, 0, 75, () => {
            $(Player.controls.tabs.sub.recoms).animateCss("fadeIn veryfaster");
          });
        });
      }).then(() => {
        return VK.audioUtils.getUserPlaylists().then((r) => {
          Player.controls.tabs.sub.playlists.innerHTML = "";
          Player.controls.tabs.sub.playlists.setContainerData("albums", r);
          Player.renderPlaylists(r, Player.controls.tabs.sub.playlists, () => {
            Player.controls.tabs.sub.playlists.isLoaded = true;
            $(Player.controls.tabs.sub.playlists).animateCss("fadeIn veryfaster");
          });
        });
      }).then(() => {
        if (Player.controls.search_box.value && Player.controls.tabs.sub.search.childNodes.length) {
          return searchHandler(Player.controls.search_box.value, false);
        } else {
          return true;
        }
      }).then(() => {
        Player.controls.tabs.sub.people.innerHTML = "";
        return VK.api.friends.get({
          fields: "photo_100,can_see_audio",
          order: "hints"
        }).then((list) => {
          Player.controls.tabs.sub.people.setContainerData("people", list);
          Player.renderUsers(list.items, Player.controls.tabs.sub.people);
        });
      }).then(() => {
        return VK.api.groups.get({
          extended: 1
        }).then((list) => {
          Player.controls.tabs.sub.groups.setContainerData("groups", list.items);
          Player.renderGroups(list.items, Player.controls.tabs.sub.groups);
        }).catch(console.log);
      });
    }
  };

  if (typeof addons == "object") Player = Object.assign(Player, addons);

  Audio.volume = Settings.volume || 1;
  Player.controls.volume.value = Audio.volume * 100;
  changeInputColor(Player.controls.volume);
  changeInputColor(Player.controls.range);
  setThumbarButtons("play");

  Player.controls.play.addEventListener("click", () => {
    Player.playPause();
  });

  Player.controls.next.addEventListener("click", () => {
    Player.playNext();
  });

  Player.controls.prev.addEventListener("click", () => {
    Player.playPrev();
  });

  Player.controls.volume.addEventListener("input", () => {
    Audio.volume = Player.controls.volume.value / 100;
    changeInputColor(Player.controls.volume);
  });

  Player.controls.volume.addEventListener("change", () => {
    Audio.volume = Player.controls.volume.value / 100;
    changeInputColor(Player.controls.volume);
    Settings.volume = Audio.volume;
    Settings.save();
  });

  Player.controls.volume_parent.addEventListener("wheel", (evt) => {
    let newValue = Settings.volume + (evt.deltaY < 0 ? 0.05 : -0.05);
    Audio.volume = (newValue < 0 ? 0 : (newValue > 1 ? 1 : newValue)).toFixed(2);
    Player.controls.volume.value = Audio.volume * 100;
    changeInputColor(Player.controls.volume);
    Settings.volume = Audio.volume;
    Settings.save();
  });

  Player.controls.range.addEventListener("input", (event) => {
    Player.data.rangeInputBreak = true;
    Player.controls.time.innerText = secondsToString(event.target.value);
    changeInputColor(Player.controls.range);
  });

  Player.controls.range.addEventListener("change", () => {
    Player.data.rangeInputBreak = false;
    Audio.currentTime = Player.controls.range.value;
    changeInputColor(Player.controls.range);
  });

  Player.controls.search_box.addEventListener("keyup", (evt) => {
    if (evt.keyCode == 13) {
      searchHandler(Player.controls.search_box.value, true);
    }
  });

  Player.controls.shuffle.addEventListener("click", () => {
    if (Player.data.shuffle == true) {
      Player.data.shuffle = false;
      Player.controls.shuffle.classList.remove("active");
      Player.data.currentTracklist = Player.data.nonShuffledCurrentTracklist;
      delete Player.data.nonShuffledCurrentTracklist;
    } else {
      Player.data.shuffle = true;
      Player.controls.shuffle.classList.add("active");
      Player.data.nonShuffledCurrentTracklist = Player.data.currentTracklist.slice(0);
      Player.data.currentTracklist.sort(() => Math.random() - 0.5);
    }
  });

  Player.controls.repeat.addEventListener("click", () => {
    if (Player.data.repeat == true) {
      Player.data.repeat = false;
      Player.controls.repeat.classList.remove("active");
    } else {
      Player.data.repeat = true;
      Player.controls.repeat.classList.add("active");
    }
  });

  Player.controls.broadcast.addEventListener("click", () => {
    if (Settings.broadcast == true) {
      Settings.broadcast = false;
      Player.controls.broadcast.classList.remove("active");
      VK.audioUtils.setStatus({
        audio: Player.data.currentTrackId
      }, true);
    } else {
      Settings.broadcast = true;
      Player.controls.broadcast.classList.add("active");
      VK.audioUtils.setStatus({
        audio: Player.data.currentTrackId
      });
    }
    Settings.save();
  });

  Player.controls.artist.addEventListener("click", () => {
    searchHandler(Player.controls.artist.innerHTML, true);
  });

  Player.controls.cover.addEventListener("click", () => {
    if (!Player.data.clickEasterEggCount) {
      Player.data.clickEasterEggCount = 1;
      Player.data.easterEggTimeout = setTimeout(() => {
        delete Player.data.clickEasterEggCount;
      }, 3000);
    } else {
      Player.data.clickEasterEggCount += 1;
      if (Player.data.clickEasterEggCount == 5) {
        clearTimeout(Player.data.easterEggTimeout);
        $(Player.controls.cover).animateCss("fadeOut veryfaster").then(() => {
          Player.controls.cover.src = "res/html/img/lenny.png";
          $(Player.controls.cover).animateCss("fadeIn veryfaster").then(() => {
            setTimeout(() => {
              $(Player.controls.cover).animateCss("fadeOut veryfaster").then(() => {
                Player.controls.cover.src = Player.data.currentCoverUrl || "res/html/img/nonsrc.svg";
                $(Player.controls.cover).animateCss("fadeIn veryfaster").then(() => {
                  delete Player.data.clickEasterEggCount;
                });
              });
            }, 1000);
          });
        });
      }
    }
  });

  Player.controls.refresh.addEventListener("click", () => {
    if (Player.data.reloadTabsProcessing) return;
    Player.data.reloadTabsProcessing = true;
    Player.controls.refresh.classList.add("animation-spin");
    Player.reloadTabs().then(() => {
      Player.controls.refresh.addEventListener("animationiteration", function r() {
        Player.controls.refresh.removeEventListener("animationiteration", r);
        Player.controls.refresh.classList.remove("animation-spin");
        Player.data.reloadTabsProcessing = false;
      });
    });
  });

  Audio.addEventListener("timeupdate", () => {
    if (Player.data.rangeInputBreak) return;
    let value = Math.floor(Audio.currentTime);
    Player.controls.range.value = value;
    Player.controls.time.innerText = secondsToString(value);
    changeInputColor(Player.controls.range);
  });

  Audio.addEventListener("ended", () => {
    if (Player.data.repeat) {
      Audio.play();
    } else {
      Player.playNext();
    }
  });

  Player.emitter.on("play", (id) => {
    Player.setTrackNodesStatus(id, "pause");
    Player.controls.play.innerHTML = "pause";
    if (Settings.cover_spin) {
      Player.controls.cover.style.animationPlayState = "running";
    }
    setThumbarButtons("pause");
  });

  Player.emitter.on("pause", (id) => {
    Player.setTrackNodesStatus(id, "play");
    Player.controls.play.innerHTML = "play_arrow";
    if (Settings.cover_spin) {
      Player.controls.cover.style.animationPlayState = "paused";
    }
    //document.title = "Electron Player for VK";
    setThumbarButtons("play");
  });

  Player.emitter.on("set_track", (newId, oldId) => {
    let trackInfo = Player.getTrackinfoFromTracklist(newId);
    if (oldId) Player.setTrackNodesStatus(oldId, "play");
    Player.setTrackNodesStatus(newId, "pause");
    Player.controls.range.value = 0;
    Player.controls.play.innerHTML = "pause";
    Player.controls.title.innerHTML = trackInfo.title;
    Player.controls.artist.innerHTML = trackInfo.artist;
    Player.controls.full_time.innerText = secondsToString(trackInfo.duration);
    Player.controls.time.innerText = "0:00";
    Player.controls.cover.style.animationPlayState = "running";
    changeInputColor(Player.controls.range);
    setThumbarButtons("pause");
    document.title = decodeHtmlEntity(trackInfo.artist + " - " + trackInfo.title);
    if (Settings.broadcast) {
      VK.audioUtils.setStatus({
        audio: trackInfo.owner_id + "_" + trackInfo.id
      });
    }
  });

  Player.emitter.on("set_cover", (trackInfo) => {
    VK.audioUtils.getAudioCover(trackInfo).then((r) => {
      let url = r || "res/html/img/nonsrc.svg";
      Player.data.currentCoverUrl = url;
      if (!Player.controls.cover.src_orig && !r) return;
      if (Player.controls.cover.src_orig !== url) {
        if (Player.controls.cover.classList.contains("animation-spin")) {
          Player.controls.cover.classList.remove("animation-spin");
        }
        $(Player.controls.cover).animateCss("fadeOut superfaster").then(() => {
          Player.controls.cover.style.opacity = "0";
          Player.controls.cover.src = url;
          Player.controls.cover.src_orig = url;
          if (!Settings.cover_spin) {
            if (!r && Player.controls.cover.classList.contains("shadowbox")) {
              Player.controls.cover.classList.remove("shadowbox");
            } else if (r && !Player.controls.cover.classList.contains("shadowbox")) {
              Player.controls.cover.classList.add("shadowbox");
            }
          }
          Player.controls.cover.onload = function () {
            Player.controls.cover.style.opacity = "1";
            $(Player.controls.cover).animateCss("fadeIn superfaster").then(() => {
              Player.controls.cover.classList.remove("animated");
              Player.controls.cover.classList.remove("fadeOut");
              Player.controls.cover.classList.remove("superfaster");
              if (Settings.cover_spin) {
                Player.controls.cover.classList.add("animation-spin");
                Player.controls.cover.style.animationPlayState = "running";
              }
            });
          };
        });
      }
    });
  });

  ipcRenderer.on("mediaKeyPressed", (event, data) => {
    Player[data.funcName]();
  });

  function crossfade(up) {
    return new Promise((resolve) => {
      if (up) Audio.volume = 0;
      let time = 400;
      let step = Math.sqrt(time).toFixed(2);
      let vol = Player.controls.volume.value / 100;
      let i = setInterval(() => {
        let n;
        if (up) {
          n = Audio.volume + (vol / step);
          Audio.volume = n <= 1 ? n.toFixed(4) : 1;
        } else {
          n = Audio.volume - (vol / step);
          Audio.volume = n > 0 ? n.toFixed(4) : 0;
        }
      }, step);
      setTimeout(() => {
        clearInterval(i);
        if (!up && Audio.volume !== 0) {
          Audio.volume = 0;
        } else if (up && Audio.volume !== vol) {
          Audio.volume = vol;
        }
        resolve(true);
      }, time);
    });
  }

  function secondsToString(sec) {
    let minutes = Math.floor(sec / 60);
    let secs = sec % 60;
    if (secs < 10) secs = "0" + secs;
    return minutes + ":" + secs;
  }

  function loadElement(p) {
    return new Promise((resolve, reject) => {
      fs.readFile(path.join(INIT_INFO.PATH, "res/js/html_plains", p + ".html"), (e, d) => {
        if (e) reject(e);
        else resolve(createElementFromHTML(d));
      });
    });
  }

  function createAudioElement(track, audioNode, isAdded) {
    let node = audioNode.cloneNode(true);
    node.trackInfo = track;
    node.selectByClass("time").innerHTML = secondsToString(track.duration);
    node.selectByClass("add-btn").addEventListener("click", addTrackHandler);
    node.selectByClass("artist").innerHTML = track.artist;
    node.selectByClass("artist").addEventListener("click", () => {
      searchHandler(track.artist, true);
    });
    node.selectByClass("title").innerHTML = track.title;
    node.addEventListener("click", (evt) => {
      let ignore = ["add-btn", "artist"];
      let filtered = ignore.every((e) => !evt.toElement.classList.contains(e));
      if (window.getSelection().isCollapsed && filtered) {
        Player.playPause(track.attachment_id);
      }
    });
    if (node.trackInfo.attachment_id == Player.data.currentTrackId && !Audio.paused) {
      node.selectByClass("play-btn").innerHTML = "pause_circle_filled";
    }
    if (Player.isTrackInMainPlaylist(track.attachment_id) || isAdded) {
      node.selectByClass("add-btn").innerHTML = "clear";
    }
    return node;
  }

  function changeInputColor(node) {
    let bodyStyles = window.getComputedStyle(document.body);
    let fromColor = bodyStyles.getPropertyValue("--slider-line-after-color");
    let toColor = bodyStyles.getPropertyValue("--slider-line-before-color");
    let val = (node.value - node.getAttribute("min")) / (node.getAttribute("max") - node.getAttribute("min"));

    node.setAttribute("style", "background-image: -webkit-gradient(linear, left top, right top, " +
      "color-stop(" + val + ", " + fromColor + ")," +
      "color-stop(" + val + ", " + toColor + ")" +
      ")");
  }

  async function searchHandler(query, needToChangeTab) {
    if (Player.data.searchProcessing) return;

    Player.controls.tabs.sub.search.innerHTML = "";
    Player.data.search = true;
    Player.data.searchProcessing = true;
    if (needToChangeTab) Player.controls.tabs.search_audio_list.click();
    Player.controls.search_box.value = query;
    Player.data.currentSearchQuery = query;
    Player.data.currentTabPlaylistName = "searchPlaylist";
    Player.controls.tabs.sub.search.removeTempNodes(true);

    try {
      let searchBlocks = await VK.audioUtils.getAllSearchBlocks({ q: query });
      let albums = searchBlocks.search_global_albums;
      let bool;
      if (albums) {
        await Player.renderListHeader(Player.controls.tabs.sub.search, "Альбомы", false, async () => {
          await $(Player.controls.tabs.sub.search).animateCss("fadeOut");
          let container = await Player.showTempContainer(Player.controls.tabs.sub.search);
          await Player.renderPlaylists(albums.items, container);
          $(Player.controls.tabs.sub.search).animateCss("fadeIn");
        });
        await Player.renderPlaylists(albums.items.slice(0, 5), Player.controls.tabs.sub.search);
        bool = true;
      } else {
        bool = false;
      }
      let searchList = await VK.audioUtils.search({ query });
      Player.controls.tabs.sub.search.setContainerData("audios", searchList);
      await Player.renderListHeader(Player.controls.tabs.sub.search, "Все аудиозаписи", bool);
      await Player.renderAudioList(searchList, Player.controls.tabs.sub.search, 0, 50);
      Player.data.searchProcessing = false;
      return true;
    } catch (e) {
      Player.data.searchProcessing = false;
      console.error(e);
    }
  }

  function addTrackHandler(evt) {
    let node = evt.target.parentNode;
    let track = node.trackInfo;
    if (Player.isTrackInMainPlaylist(track.attachment_id) || node.added) { // if track in main playlist or track node has been added from other tab
      if (node.inMaintracklist) {
        track = node.added;
        delete node.added;
      }
      VK.audioUtils.deleteAudio(track).then(() => {
        node.selectByClass("add-btn").innerHTML = "add";
        if (Player.data.currentTab == "main_audio_list") {
          node.classList.add("audio-removed");
          node.canBeRestored = true;
        }
        Player.data.mainPlaylist = Player.data.mainPlaylist.filter((e) => e.attachment_id !== track.attachment_id);
        if (node.inMaintracklist) {
          node.inMaintracklist.remove();
          delete node.inMaintracklist;
        }
      });
    } else {
      if (node.canBeRestored) { // if track has been removed from main tracklist and user restore it
        VK.audioUtils.restoreAudio(track).then(() => {
          VK.audioUtils.getAudioById(track).then((r) => {
            node.selectByClass("add-btn").innerHTML = "clear";
            node.classList.remove("audio-removed");
            Player.data.mainPlaylist.unshift(r[0]);
            delete node.canBeRestored;
          });
        });
      } else { // if added from any tab but not from main
        VK.audioUtils.addAudio(track).then((r) => {
          node.added = r[0];
          node.selectByClass("add-btn").innerHTML = "clear";
          let n = createAudioElement(r[0], node, true);
          node.inMaintracklist = n;
          Player.data.mainPlaylist.unshift(r[0]);
          Player.controls.tabs.sub.main.insertAdjacentElement("afterbegin", n);
        });
      }
    }
  }

  function setThumbarButtons(state) {
    let buttonsList = [
      {
        tooltip: "Prev",
        icon: path.join(INIT_INFO.PATH, "res/js/img/prev.png"),
        click() {
          Player.playPrev();
        }
      }, {
        tooltip: state,
        icon: path.join(INIT_INFO.PATH, `res/js/img/${state}.png`),
        click() {
          Player.playPause();
        }
      }, {
        tooltip: "Next",
        icon: path.join(INIT_INFO.PATH, "res/js/img/next.png"),
        click() {
          Player.playNext();
        }
      }
    ];
    currentWindow.setThumbarButtons(buttonsList);
  }

  function createElementFromHTML(htmlString) {
    var div = document.createElement("div");
    div.innerHTML = htmlString;
    return div.firstChild;
  }

  function decodeHtmlEntity(str) {
    return str.replace(/&#(\d+);/g, function (match, dec) {
      return String.fromCharCode(dec);
    });
  }

  global.player = Player; //for debug
  global.vk = VK;
  return Player;
};