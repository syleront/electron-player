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
    var tabDiv = createTabDiv(id);
    if (id !== Player.data.currentTab) tabDiv.style.display = "none";
    main_container.appendChild(tabDiv);
    Player.controls.tabs[id] = e;
    e.addEventListener("click", changeTab);
  });

  var subtabs = Array.from(document.getElementsByClassName("subtab-element"));

  subtabs.forEach((subtab) => {
    var alias = subtab.getAttribute("alias");
    var for_tab = subtab.getAttribute("for_tab");
    var playlist = subtab.getAttribute("playlist");
    var additional_classes = subtab.getAttribute("add-class");

    if (for_tab && playlist) {
      var parent = document.getElementById(for_tab);
      var subtabDiv = createSubtabDiv(parent, for_tab + "__" + playlist);
      if (playlist !== Player.data.currentTabPlaylistName) subtabDiv.style.display = "none";
      if (additional_classes) {
        additional_classes.split(" ").forEach((className) => {
          subtabDiv.classList.add(className);
        });
      }
      var subtabContainer = createSubtabContainer(subtabDiv);
      subtabDiv.mainChildContainer = subtabContainer;
      if (alias) Player.controls.tabs.sub[alias] = subtabContainer;

      if (for_tab == Player.data.currentTab) {
        subtab.style.display = "";
      } else {
        subtab.style.display = "none";
      }
    }

    subtab.addEventListener("click", changeSubtab);
  });

  VK.audioUtils.getFullPlaylist().then((r) => {
    Player.data.mainPlaylist = r;
    Player.data.currentAudioListNode = Player.controls.tabs.sub.main;
    Player.renderAudioList(r, Player.controls.tabs.sub.main, 0, 50, () => {
      Player.controls.tabs.sub.main.loaded = true;
    });
  }).then(() => {
    return VK.audioUtils.getRecomendations().then((r) => {
      Player.data.recomsPlaylist = r;
      Player.renderAudioList(r, Player.controls.tabs.sub.recoms, 0, 50, () => {
        Player.controls.tabs.sub.recoms.loaded = true;
      });
    });
  }).then(() => {
    VK.api("friends.get", {
      fields: "photo_100",
      order: "hints"
    }).then((list) => {
      Player.renderUsers(list.items, Player.controls.tabs.sub.people);
    });
  });

  function onScrollHandler(evt) {
    var el = evt.target;
    //console.log(el.scrollTop, el.scrollHeight, el.offsetHeight, (el.scrollHeight - el.offsetHeight) - 50, Player.data.scrollStop)
    if (!Player.data.scrollStop) {
      if (el.scrollTop >= (el.scrollHeight - el.offsetHeight) - 50) {
        Player.data.scrollStop = true;
        var container = Player.getVisibleContainer();
        var length = Player.getCurrentTabAudioNodes().length;
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
        } else if (playlistName == "searchPlaylist" && !container.temp) {
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
      } else if (el.scrollTop < 400 && Player.data.currentTabPlaylistName !== "playlistsPlaylist") {
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

    subtabs.forEach((subtab) => {
      var for_tab = subtab.getAttribute("for_tab");
      var tab_container = document.getElementById(for_tab);
      if (for_tab == Player.data.currentTab) {
        subtab.style.display = "";
        tab_container.style.display = "";
        if (subtab.classList.contains("selected")) {
          subtab.click();
        }
      } else {
        subtab.style.display = "none";
        tab_container.style.display = "none";
      }
    });

    if (subtabs.filter((e) => e.getAttribute("for_tab") == Player.data.currentTab).every((e) => e.style.display == "none" || e.classList.contains("hidden"))) {
      container_header.style.display = "none";
    } else {
      container_header.style.display = "";
    }
  }

  function changeSubtab(evt) {
    var for_tab = evt.target.getAttribute("for_tab");
    var playlist = evt.target.getAttribute("playlist");
    var id = for_tab + "__" + playlist;
    var tabMainContainer = document.getElementById(id).mainChildContainer;

    Player.data.currentTabPlaylistName = playlist;

    var subtab_divs = Array.from(document.getElementById(for_tab).getElementsByClassName("map-subtab-div"));
    subtab_divs.forEach((div) => {
      if (div.id == id) {
        div.style.display = "";
        var selected_subtab = Array.from(container_header.getElementsByClassName("subtab-element")).filter((e) => {
          return e.getAttribute("for_tab") == Player.data.currentTab && e.classList.contains("selected");
        })[0];
        selected_subtab.classList.remove("selected");
        evt.target.classList.add("selected");
      } else {
        div.style.display = "none";
      }
    });

    if (!tabMainContainer.isLoaded) {
      if (playlist == "playlistsPlaylist") {
        VK.audioUtils.getUserPlaylists().then((r) => {
          if (tabMainContainer.isLoaded) return;
          Player.renderPlaylists(r, tabMainContainer, () => {
            $(tabMainContainer).animateCss("fadeIn veryfaster");
            tabMainContainer.isLoaded = true;
          });
        });
      } else if (playlist !== "searchPlaylist") {
        Player.renderAudioList(Player.data[playlist], tabMainContainer, 0, 50, () => {
          $(tabMainContainer).animateCss("fadeIn veryfaster");
          tabMainContainer.isLoaded = true;
        });
      } else {
        $(tabMainContainer).animateCss("fadeIn veryfaster");
      }
    } else {
      $(tabMainContainer).animateCss("fadeIn veryfaster");
    }
  }

  function showTempContainer(nodeToHide, _cb) {
    nodeToHide.style.display = "none";
    var div = createSubtabContainer((nodeToHide.parentNode || null));
    div.temp = true;
    div.close = function () {
      div.remove();
      nodeToHide.style.display = "";
    };
    if (_cb) _cb(div);
  }

  function createTabDiv(id) {
    var div = document.createElement("div");
    div.classList.add("map-tab-div");
    if (id) div.id = id;
    return div;
  }

  function createSubtabDiv(parentDiv, id) {
    var div = document.createElement("div");
    div.classList.add("map-subtab-div");
    if (id) div.id = id;
    if (parentDiv) parentDiv.appendChild(div);
    return div;
  }

  function createSubtabContainer(parentDiv, id) {
    var div = document.createElement("div");
    div.classList.add("map-subtab-container");
    div.onscroll = onScrollHandler;
    if (id) div.id = id;
    if (parentDiv) parentDiv.appendChild(div);
    return div;
  }
});