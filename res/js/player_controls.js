process.on("uncaughtException", (e) => {
  console.log("uncaughtException " + e.stack);
});

module.exports = function (VK, Settings) {
  const fs = require("fs");
  const { remote, ipcRenderer } = require("electron");
  const currentWindow = remote.getCurrentWindow();
  const Audio = document.createElement("audio");
  const playerEmitter = new EventEmitter();

  var Player = {
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
      tabs: {
        sub: {}
      }
    },
    loadAdditionalTracksToCurrentTracklist: function () {
      return new Promise((resolve, reject) => {
        var playlistName = this.data.currentTabPlaylistName;
        if (playlistName == "recomsPlaylist") {
          VK.audioUtils.getRecomendations({
            offset: this.data.currentTracklist.length
          }).then((r) => {
            if (!r.length) return reject(false);
            this.data.currentTracklist = this.data.currentTracklist.concat(r);
            resolve(this.data.currentTracklist);
          });
        } else if (playlistName == "searchPlaylist") {
          var query = this.data.currentSearchQuery;
          VK.audioUtils.search({
            q: query,
            offset: this.data.currentTracklist.length
          }).then((r) => {
            this.data.currentTracklist = r;
            resolve(this.data.currentTracklist);
          });
        } else {
          reject(false);
        }
      });
    },
    getVisibleContainer: function () {
      var divId = this.data.currentTab + "__" + this.data.currentTabPlaylistName;
      return Array.from(document.getElementById(divId).getElementsByClassName("map-subtab-container")).filter((e) => e.style.display !== "none")[0];
    },
    getTabAudioNodesById: function (id) {
      return document.getElementById(id).getElementsByClassName("map-audio-element");
    },
    getCurrentTabAudioNodes: function () {
      return Array.from(this.getVisibleContainer().getElementsByClassName("map-audio-element"));
    },
    getCurrentTabAudioNode: function (id) {
      return this.getCurrentTabAudioNodes().filter((e) => e.trackInfo.attachment_id == id)[0];
    },
    getListFromAudioNodes: function (list) {
      return Array.from(list).map((e) => e.trackInfo);
    },
    getCurrentTabTracklist: function () {
      var n = this.data.currentTabPlaylistName;
      return this.data[n] || this.getListFromAudioNodes(this.getCurrentTabAudioNodes());
    },
    setCurrentTabTracklist: function () {
      this.data.currentTracklist = this.getCurrentTabTracklist();
      if (Player.data.shuffle == true) {
        this.data.nonShuffledCurrentTracklist = this.data.currentTracklist.slice(0);
        this.data.currentTracklist.sort(() => Math.random() - 0.5);
      }
      return this.data.currentTracklist;
    },
    getTrackinfoFromTracklist: function (id) {
      return this.data.currentTracklist.filter((e) => e.attachment_id == id)[0] || this.setCurrentTabTracklist().filter((e) => e.attachment_id == id)[0];
    },
    getTrackIndex: function (id) {
      return this.data.currentTracklist.findIndex((e) => e.attachment_id == id);
    },
    getCurrentTrackIndex: function () {
      return this.getTrackIndex(this.data.currentTrackId);
    },
    getTrackNodesById: function (id) {
      return Array.from(document.getElementsByClassName("map-audio-element")).filter((e) => e.trackInfo.attachment_id == id);
    },
    setTrackNodesStatus: function (id, play) {
      this.getTrackNodesById(id).forEach((e) => {
        e.selectByClass("play-btn").innerHTML = (play ? "pause_circle_filled" : "play_circle_filled");
      });
    },
    searchInMainPlaylist: function (q) {
      var reg = new RegExp(q, "i");
      return Player.data.mainPlaylist.filter((e) => reg.test(e.title) || reg.test(e.artist));
    },
    isTrackInMainPlaylist: function (id, needIndex) {
      if (this.data.mainPlaylist) {
        var i = this.data.mainPlaylist.findIndex((e) => e.attachment_id == id);
        return needIndex ? i : (i > -1 ? true : false);
      } else {
        return false;
      }
    },
    setTrack: function (id) {
      var trackInfo = this.getTrackinfoFromTracklist(id);
      if (!trackInfo) return;
      playerEmitter.emit("set_track", id, (this.data.currentTrackId || false));
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
          Audio.src = trackInfo.url;
          Audio.play().then(() => {
            crossfade(true).then(() => { });
          });
        } else {
          VK.audioUtils.getAudioById({
            owner_id: trackInfo.owner_id,
            id: trackInfo.id,
            hashes: trackInfo.hashes
          }).then((r) => {
            if (!r.length) return this.playNext();
            this.data.rangeInputBreak = false;
            this.controls.range.max = r[0].duration;
            Audio.src = r[0].url;
            Audio.play().then(() => {
              crossfade(true).then(() => { });
            });
          });
        }
      });
    },
    playPause: function (id) {
      if (id && id !== this.data.currentTrackId) {
        this.setTrack(id);
      } else if (!this.data.currentTrackId) {
        var list = this.getCurrentTabTracklist();
        if (!list.length) return;
        var newId = list[0].attachment_id;
        this.setTrack(newId);
        playerEmitter.emit("play", newId);
      } else if (Audio.paused) {
        playerEmitter.emit("play", this.data.currentTrackId);
        Audio.play().then(() => {
          crossfade(true).then(() => { });
        });
      } else {
        playerEmitter.emit("pause", this.data.currentTrackId);
        crossfade(false).then(() => {
          Audio.pause();
        });
      }
    },
    playNext: function () {
      if (!this.data.currentTrackId) return;
      var currentTrackIndex = this.getCurrentTrackIndex();
      if (currentTrackIndex !== this.data.currentTracklist.length - 1) {
        var newId = this.data.currentTracklist[currentTrackIndex + 1].attachment_id;
        this.setTrack(newId);
      } else {
        this.loadAdditionalTracksToCurrentTracklist().then(() => {
          this.setTrack(this.data.currentTracklist[currentTrackIndex + 1].attachment_id);
        }).catch(() => {
          this.setTrack(this.data.currentTracklist[0].attachment_id);
        });
      }
    },
    playPrev: function () {
      if (!this.data.currentTrackId) return;
      var currentTrackIndex = this.getCurrentTrackIndex();
      var newId;
      if (currentTrackIndex !== 0) {
        newId = this.data.currentTracklist[currentTrackIndex - 1].attachment_id;
        this.setTrack(newId);
      } else {
        newId = this.data.currentTracklist[this.data.currentTracklist.length - 1].attachment_id;
        this.setTrack(newId);
      }
    },
    renderAudioList: function (list, node, from, to) {
      if (!list) list = [];
      return loadElement("html_plains/audio_element.html").then((audioNode) => {
        (typeof from == "number" ? list.slice(from, to) : list).forEach((e) => {
          var el = createAudioElement(e, audioNode);
          node.appendChild(el);
        });
        var lastArg = arguments[arguments.length - 1];
        if (typeof lastArg == "function") {
          return lastArg();
        } else {
          return true;
        }
      });
    },
    renderPlaylists: function (list, node) {
      return loadElement("html_plains/playlist_element.html").then((pl) => {
        list.forEach((playlist) => {
          var playlistNode = pl.cloneNode(true);
          if (playlist.photo && playlist.photo.url) playlist.picture = playlist.photo.url;
          playlistNode.playlistInfo = playlist;
          playlistNode.selectByClass("photo").src = playlist.picture || playlistNode.selectByClass("photo").src;
          playlistNode.selectByClass("title").innerHTML = playlist.title;
          playlistNode.addEventListener("click", () => {
            $(node).animateCss("fadeOut", () => {
              node.style.display = "none";
              Player.showTempContainer(node, (container) => {
                VK.audioUtils.getFullPlaylist({
                  access_hash: playlist.access_hash || "",
                  owner_id: playlist.owner_id,
                  playlist_id: playlist.id || playlist.playlist_id
                }).then((r) => {
                  loadElement("html_plains/back_button.html").then((btn) => {
                    btn.addEventListener("click", () => {
                      $(container).animateCss("fadeOut", () => {
                        container.close();
                        $(node).animateCss("fadeIn veryfaster");
                      });
                    });
                    this.renderAudioList(r, container, () => {
                      container.insertAdjacentElement("afterbegin", btn);
                      $(container).animateCss("fadeIn");
                    });
                  });
                });
              });
            });
          });
          node.appendChild(playlistNode);
        });
        var lastArg = arguments[arguments.length - 1];
        if (typeof lastArg == "function") {
          return lastArg();
        } else {
          return true;
        }
      });
    },
    renderUsers: function (list, node) {
      return loadElement("html_plains/people_element.html").then((nodePlain) => {
        list.forEach((user) => {
          var userNode = nodePlain.cloneNode(true);
          userNode.selectByClass("title").innerHTML = user.first_name + "<br>" + user.last_name;
          userNode.selectByClass("photo").src = user.photo_100;
          userNode.addEventListener("click", () => {
            this.showTempContainer(Player.controls.tabs.sub.people, (container) => {
              VK.audioUtils.getFullPlaylist({
                owner_id: user.id
              }).then((list) => {
                this.renderAudioList(list, container);
              });
            });
          });
          node.appendChild(userNode);
        });
      });
    },
    reloadTabs: function () {
      return VK.audioUtils.getFullPlaylist().then((r) => {
        Player.data.mainPlaylist = r;
        Player.controls.tabs.sub.main.innerHTML = "";
        Player.renderAudioList(r, Player.controls.tabs.sub.main, 0, 50, () => {
          $(Player.controls.tabs.sub.main).animateCss("fadeIn veryfaster");
        });
      }).then(() => {
        return VK.audioUtils.getRecomendations().then((r) => {
          Player.data.recomsPlaylist = r;
          Player.controls.tabs.sub.recoms.innerHTML = "";
          Player.renderAudioList(r, Player.controls.tabs.sub.recoms, 0, 50, () => {
            $(Player.controls.tabs.sub.recoms).animateCss("fadeIn veryfaster");
          });
        });
      }).then(() => {
        return VK.audioUtils.getUserPlaylists().then((r) => {
          Player.controls.tabs.sub.playlists.innerHTML = "";
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
      });
    }
  };

  Audio.volume = Settings.volume || 1;
  Player.controls.volume.value = Audio.volume * 100;
  changeInputColor(Player.controls.volume);
  changeInputColor(Player.controls.range);
  setThumbarButtons(true);

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
    var newValue = Audio.volume + (evt.deltaY < 0 ? 0.05 : -0.05);
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
    var query = Player.controls.artist.innerHTML;
    searchHandler(query, true);
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
        $(Player.controls.cover).animateCss("fadeOut veryfaster", () => {
          Player.controls.cover.src = "res/html/img/lenny.png";
          $(Player.controls.cover).animateCss("fadeIn veryfaster", () => {
            setTimeout(() => {
              $(Player.controls.cover).animateCss("fadeOut veryfaster", () => {
                Player.controls.cover.src = Player.data.currentCoverUrl || "res/html/img/nonsrc.svg";
                $(Player.controls.cover).animateCss("fadeIn veryfaster", () => {
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
    var value = Math.floor(Audio.currentTime);
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

  playerEmitter.on("play", (id) => {
    Player.setTrackNodesStatus(id, true);
    Player.controls.play.innerHTML = "pause";
    if (Settings.cover_spin) {
      Player.controls.cover.style.animationPlayState = "running";
    }
    setThumbarButtons(false);
  });

  playerEmitter.on("pause", (id) => {
    Player.setTrackNodesStatus(id, false);
    Player.controls.play.innerHTML = "play_arrow";
    if (Settings.cover_spin) {
      Player.controls.cover.style.animationPlayState = "paused";
    }
    setThumbarButtons(true);
  });

  playerEmitter.on("set_track", (newId, oldId) => {
    var trackInfo = Player.getTrackinfoFromTracklist(newId);
    if (oldId) Player.setTrackNodesStatus(oldId, false);
    Player.setTrackNodesStatus(newId, true);
    Player.controls.range.value = 0;
    Player.controls.play.innerHTML = "pause";
    Player.controls.title.innerHTML = trackInfo.title;
    Player.controls.artist.innerHTML = trackInfo.artist;
    Player.controls.full_time.innerText = secondsToString(trackInfo.duration);
    Player.controls.time.innerText = "0:00";
    Player.controls.cover.style.animationPlayState = "running";
    changeInputColor(Player.controls.range);
    setThumbarButtons(false);
    VK.audioUtils.getAudioCover(trackInfo).then((r) => {
      var url = r || "res/html/img/nonsrc.svg";
      Player.data.currentCoverUrl = url;
      if (!Player.controls.cover.src_orig && !r) return;
      if (Player.controls.cover.src_orig !== url) {
        if (Player.controls.cover.classList.contains("animation-spin")) {
          Player.controls.cover.classList.remove("animation-spin");
        }
        $(Player.controls.cover).animateCss("fadeOut superfaster", () => {
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
            $(Player.controls.cover).animateCss("fadeIn superfaster", () => {
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
    if (Settings.broadcast) {
      VK.audioUtils.setStatus({
        audio: trackInfo.owner_id + "_" + trackInfo.id
      });
    }
  });

  ipcRenderer.on("mediaKeyPressed", (event, data) => {
    Player[data.funcName]();
  });

  function crossfade(up) {
    return new Promise((resolve) => {
      if (up) Audio.volume = 0;
      var time = 400;
      var step = Math.sqrt(time).toFixed(2);
      var vol = Player.controls.volume.value / 100;
      var i = setInterval(() => {
        var n;
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
      }, time + 5);
    });
  }

  function secondsToString(sec) {
    var minutes = Math.floor(sec / 60);
    var secs = sec % 60;
    if (secs < 10) secs = "0" + secs;
    return minutes + ":" + secs;
  }

  function loadElement(p) {
    return new Promise((resolve, reject) => {
      fs.readFile(path.join(__dirname, p), (e, d) => {
        if (e) return reject(e);
        else resolve(createElementFromHTML(d));
      });
    });
  }

  function createAudioElement(track, audioNode, isAdded) {
    var node = audioNode.cloneNode(true);
    node.trackInfo = track;
    node.selectByClass("time").innerHTML = secondsToString(track.duration);
    node.selectByClass("add-btn").addEventListener("click", addTrackHandler);
    node.selectByClass("artist").innerHTML = track.artist;
    node.selectByClass("artist").addEventListener("click", () => {
      searchHandler(track.artist, true);
    });
    node.selectByClass("title").innerHTML = track.title;
    node.addEventListener("click", (evt) => {
      var ignore = ["add-btn", "artist"];
      var filtered = ignore.every((e) => !evt.toElement.classList.contains(e));
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
    var bodyStyles = window.getComputedStyle(document.body);
    var fromColor = bodyStyles.getPropertyValue("--slider-line-after-color");
    var toColor = bodyStyles.getPropertyValue("--slider-line-before-color");
    var val = (node.value - node.getAttribute("min")) / (node.getAttribute("max") - node.getAttribute("min"));

    node.setAttribute("style", "background-image: -webkit-gradient(linear, left top, right top, " +
      "color-stop(" + val + ", " + fromColor + ")," +
      "color-stop(" + val + ", " + toColor + ")" +
      ")");
  }

  function searchHandler(query, needToChangeTab) {
    if (Player.data.searchProcessing) return;
    if (Player.data.search) Player.controls.tabs.sub.search.innerHTML = "";
    Player.data.search = true;
    Player.data.searchProcessing = true;
    if (needToChangeTab) Player.controls.tabs.search_audio_list.click();
    Player.controls.search_box.value = query;
    Player.data.currentSearchQuery = query;
    Player.data.currentTabPlaylistName = "searchPlaylist";
    return loadElement("html_plains/search_box_albums_header.html").then((header) => {
      /* var list = Player.searchInMainPlaylist(query);
      if (list.length) {
        header.selectByClass("all-btn").remove();
        header.selectByClass("title").innerHTML = "Мои аудиозаписи";
        Player.controls.tabs.sub.search.appendChild(header);
        Player.renderAudioList(list, Player.controls.tabs.sub.search, 0, 50);
      } */
    }).then(() => {
      return VK.audioUtils.getAllSearchBlocks({
        q: query
      }).then((lists) => {
        var albums = lists.search_global_albums;
        if (!albums) return false;
        return loadElement("html_plains/search_box_albums_header.html").then((header) => {
          //header.classList.add("border");
          header.selectByClass("all-btn").addEventListener("click", () => {
            Player.data.scrollStop = true;
            return loadElement("html_plains/back_button.html").then((btn) => {
              $(Player.controls.tabs.sub.search).animateCss("fadeOut", () => {
                Player.showTempContainer(Player.controls.tabs.sub.search, (albumsContainer) => {
                  btn.addEventListener("click", () => {
                    $(albumsContainer).animateCss("fadeOut", () => {
                      Player.data.scrollStop = false;
                      albumsContainer.close();
                    });
                  });
                  albumsContainer.appendChild(btn);
                  Player.renderPlaylists(albums.items, albumsContainer);
                  $(albumsContainer).animateCss("fadeIn");
                });
              });
            });
          });
          Player.controls.tabs.sub.search.appendChild(header);
          //$(Player.controls.tabs.sub.search).animateCss("fadeIn");
          Player.renderPlaylists(albums.items.slice(0, 5), Player.controls.tabs.sub.search);
          return true;
        });
      }).catch(() => { });
    }).then((bool) => {
      return VK.audioUtils.search({
        q: query
      }).then((list) => {
        return loadElement("html_plains/search_box_albums_header.html").then((header) => {
          if (bool) header.classList.add("border");
          header.selectByClass("title").innerHTML = "Все аудиозаписи";
          header.selectByClass("all-btn").remove();
          Player.controls.tabs.sub.search.appendChild(header);
          return Player.renderAudioList(list, Player.controls.tabs.sub.search, 0, 50, () => {
            Player.data.searchProcessing = false;
            return true;
          });
        });
      });
    });
  }

  function addTrackHandler(evt) {
    var node = evt.target.parentNode;
    var track = node.trackInfo;
    if (Player.isTrackInMainPlaylist(track.attachment_id) || node.added) { // if track in main playlist or track node has been added from other tab
      if (node.inMaintracklist) {
        track = node.added;
        delete node.added;
      }
      VK.audioUtils.deleteAudio({
        owner_id: track.owner_id,
        id: track.id,
        hashes_string: track.hashes_string
      }).then(() => {
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
        VK.audioUtils.restoreAudio({
          owner_id: track.owner_id,
          id: track.id,
          hashes_string: track.hashes_string
        }).then(() => {
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
          var n = createAudioElement(r[0], node, true);
          node.inMaintracklist = n;
          Player.data.mainPlaylist.unshift(r[0]);
          Player.controls.tabs.sub.main.insertAdjacentElement("afterbegin", n);
        });
      }
    }
  }

  function setThumbarButtons(paused) {
    var buttonsList = [
      {
        tooltip: "Prev",
        icon: path.join(__dirname, "img/prev.png"),
        click() {
          Player.playPrev();
        }
      }, {
        tooltip: paused ? "Play" : "Pause",
        icon: paused ? path.join(__dirname, "img/play.png") : path.join(__dirname, "img/pause.png"),
        click() {
          Player.playPause();
        }
      }, {
        tooltip: "Next",
        icon: path.join(__dirname, "img/next.png"),
        click() {
          Player.playNext();
        }
      }
    ];
    currentWindow.setThumbarButtons(buttonsList);
  }

  global.player = Player;
  return Player;
};