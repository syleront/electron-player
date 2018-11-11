/* jshint esversion: 6 */
// тут страшно :\

process.on("uncaughtException", (e) => {
  console.log("uncaughtException " + e.stack);
});

emitter.on("auth", (VK, Settings) => {
  const Player = require(path.join(__dirname, "res/js/player_controls.js"))(VK, Settings);
  Player.showTempContainer = showTempContainer;

  if (Settings.cover_spin) {
    Player.controls.cover.classList.add("disk");
    Player.controls.cover.classList.add("animation-spin");
    cover_disk_center.classList.add("disk-center");
  }

  if (Settings.transitions == false) {
    var html = document.getElementsByTagName("html")[0];
    html.style.setProperty("--fast-transition", "0s linear");
    html.style.setProperty("--long-transition", "0s linear");
  }

  if (Settings.broadcast) {
    Player.controls.broadcast.classList.add("active");
  }

  var sidebar_links = Array.from(document.getElementsByClassName("tab-element"));
  sidebar_links.filter((e) => e.getAttribute("tab")).forEach((e) => {
    var id = e.getAttribute("tab");
    Player.controls.tabs[id] = e;
    e.addEventListener("click", changeTab);
  });

  var subtabs = Array.from(document.getElementsByClassName("subtab-element"));
  subtabs.forEach((e) => {
    var forTab = e.getAttribute("for_tab");
    var playlist = e.getAttribute("playlist");
    var div = createContainerDiv(forTab + "__" + playlist);
    e.container_id = div.id;
    main_container.appendChild(div);
    //Player.controls.tabs.sub[div.id] = div;

    if (e.getAttribute("alias")) {
      Player.controls.tabs.sub[e.getAttribute("alias")] = div;
    }
    if (Player.data.currentTab !== forTab) {
      e.style.display = "none";
      div.style.display = "none";
    }
    if (playlist !== Player.data.currentTabPlaylistName) {
      div.style.display = "none";
    }
    if (!e.classList.contains("selected")) {
      e.classList.add("map-background-transition");
    }

    e.addEventListener("click", (evt) => {
      //if (Player.data.rendering) return; //evt.target.classList.contains("selected")
      subtabs.filter((e) => e.classList.contains("selected") && e.getAttribute("for_tab") == Player.data.currentTab)[0].classList.remove("selected");
      evt.target.classList.add("selected");

      var forTab = evt.target.getAttribute("for_tab");
      var playlist = evt.target.getAttribute("playlist");
      var tabNode = document.getElementById(forTab + "__" + playlist);
      Player.data.currentSubtabId = forTab + "__" + playlist;
      Player.data.currentTabPlaylistName = playlist;
      Array.from(document.getElementsByClassName("map-container")).forEach((e) => {
        if (e.temp) {
          e.remove();
        } else {
          if (e.id !== tabNode.id) {
            e.style.display = "none";
          } else if (e.style.display == "none") {
            e.style.display = "";
          }
        }
      });

      if (!tabNode.loaded) {
        if (playlist == "playlistsPlaylist") {
          VK.audioUtils.getUserPlaylists().then((r) => {
            Player.renderPlaylists(r, tabNode, () => {
              $(tabNode).animateCss("fadeIn veryfaster");
              tabNode.loaded = true;
            });
          });
        } else if (playlist !== "searchPlaylist") {
          Player.renderAudioList(Player.data[playlist], tabNode, 0, 50, () => {
            $(tabNode).animateCss("fadeIn veryfaster");
            tabNode.loaded = true;
          });
        } else {
          $(tabNode).animateCss("fadeIn veryfaster");
        }
      } else {
        $(tabNode).animateCss("fadeIn veryfaster");
      }
    });
  });

  VK.audioUtils.getFullPlaylist().then((r) => {
    Player.data.mainPlaylist = r;
    Player.data.currentAudioListNode = Player.controls.tabs.sub.main;
    Player.renderAudioList(r, Player.controls.tabs.sub.main, 0, 50, () => {
      Player.controls.tabs.sub.main.loaded = true;
    });
  }).then(() => {
    VK.audioUtils.getRecomendations().then((r) => {
      Player.data.recomsPlaylist = r;
      Player.renderAudioList(r, Player.controls.tabs.sub.recoms, 0, 50, () => {
        Player.controls.tabs.sub.main.loaded = true;
      });
    });
  });

  function showTempContainer(nodeToHide, nodeToAppend, _cb) {
    nodeToHide.style.display = "none";
    var div = createContainerDiv();
    div.temp = true;
    div.close = function () {
      div.remove();
      nodeToHide.style.display = "";
    };
    if (!nodeToAppend) nodeToAppend = main_container;
    nodeToAppend.appendChild(div);
    if (_cb) _cb(div);
  }

  function onScrollHandler(evt) {
    var el = evt.target;
    //console.log(el.scrollTop, el.scrollHeight, el.offsetHeight, (el.scrollHeight - el.offsetHeight) - 50, Player.data.scrollStop)
    if (!Player.data.scrollStop) {
      if (el.scrollTop >= (el.scrollHeight - el.offsetHeight) - 50) {
        Player.data.scrollStop = true;
        var length = el.getElementsByClassName("map-audio-element").length;
        var playlistName = Player.data.currentTabPlaylistName;
       if (playlistName == "recomsPlaylist") {
          VK.audioUtils.getRecomendations({
            offset: length
          }).then((list) => {
            if (!list.length) {
              Player.data.scrollStop = false;
            } else {
              Player.data.recomsPlaylist = Player.data.recomsPlaylist.concat(list);
              Player.renderAudioList(list, el, () => {
                Player.data.scrollStop = false;
              });
            }
          });
       } else if (playlistName == "searchPlaylist") {
         var query = Player.data.currentSearchQuery;
         VK.audioUtils.search({
           q: query
         }).then((r) => {
           Player.renderAudioList(r, el, length, length + 50, () => {
             Player.data.scrollStop = false;
           });
         });
       } else {
         if (length >= Player.data.mainPlaylist.length) {
           Player.data.scrollStop = false;
         } else {
           Player.renderAudioList(Player.data[playlistName], el, length, length + 50, () => {
             Player.data.scrollStop = false;
           });
         }
       }
      } else if (el.scrollTop < 400 && Player.data.currentTab !== "playlists_audio_list") {
        Array.from(el.getElementsByClassName("map-audio-element")).slice(50).forEach((e) => {
          e.remove();
        });
      }
    }
  }

  function changeTab(evt) {
    Player.controls.tabs[Player.data.currentTab].classList.remove("tab-element-selected");
    Player.controls.tabs[Player.data.currentTab].classList.add("map-transition");

    Player.data.currentTab = evt.target.getAttribute("tab");
    Player.controls.tabs[Player.data.currentTab].classList.add("tab-element-selected");
    Player.controls.tabs[Player.data.currentTab].classList.remove("map-transition");

    subtabs.forEach((e) => {
      var forTab = e.getAttribute("for_tab");
      var container = document.getElementById(e.container_id);
      if (Player.data.currentTab !== forTab) {
        e.style.display = "none";
        container.style.display = "none";
      } else {
        e.style.display = "";
        if (e.classList.contains("selected")) {
          container.style.display = "";
          e.click();
        } else {
          e.classList.add("map-background-transition");
        }
      }
    });

    if (subtabs.filter((e) => e.getAttribute("for_tab") == Player.data.currentTab).every((e) => e.style.display == "none" || e.classList.contains("hidden"))) {
      container_header.style.display = "none";
    } else {
      container_header.style.display = "";
    }
  }

  function createContainerDiv(id) {
    var div = document.createElement("div");
    div.classList.add("map-container");
    div.onscroll = onScrollHandler;
    if (id) div.id = id;
    return div;
  }

  /* function loadElement(p) {
    return new Promise((resolve, reject) => {
      fs.readFile(path.join(__dirname, p), (e, d) => {
        if (e) return reject(e);
        else resolve(createElementFromHTML(d));
      });
    });
  } */
});