// тут страшно :\

process.on("uncaughtException", (e) => {
  console.log("uncaughtException " + e.stack);
});

emitter.on("auth", (VK, INIT_INFO, Settings) => {
  const Player = require(path.join(INIT_INFO.PATH, "res/js/player_controls.js"))(VK, INIT_INFO, Settings);
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
      var mainSubtabContainer = createSubtabContainer(subtabDiv);
      if (alias) Player.controls.tabs.sub[alias] = mainSubtabContainer;

      if (for_tab == Player.data.currentTab) {
        subtab.style.display = "";
      } else {
        subtab.style.display = "none";
      }
    }
    subtab.addEventListener("click", changeSubtab);
  });

  Player.reloadTabs();
  changeTab();

  function onScrollHandler(evt) {
    var node = evt.target;
    if (isScrollOnTheBottom(node, 50)) {
      var data = node.getContainerData();
      if (data) {
        Player.data.scrollStop = true;
        if (data.type == "audios") {
          var length = Player.getCurrentTabAudioNodes().length;
          if (length < data.list.length) {
            Player.renderAudioList(data.list, node, length, length + 50, () => {
              Player.data.scrollStop = false;
            });
          } else {
            Player.data.scrollStop = false;
          }
        }
      }
    } else if (isScrollOnTheTop(node, 400)) {
      Array.from(node.childNodes).slice(75).forEach((e) => {
        e.remove();
      });
    }
  }

  function isScrollOnTheBottom(el, offset) {
    return el.scrollTop >= (el.scrollHeight - el.offsetHeight) - (offset || 0);
  }

  function isScrollOnTheTop(el, offset) {
    return el.scrollTop <= (offset || 0);
  }

  function changeTab(evt) {
    Player.controls.tabs[Player.data.currentTab].classList.remove("tab-element-selected");
    Player.controls.tabs[Player.data.currentTab].classList.add("map-transition");

    Player.data.currentTab = evt ? evt.target.getAttribute("tab") : Player.data.currentTab;
    Player.controls.tabs[Player.data.currentTab].classList.add("tab-element-selected");
    Player.controls.tabs[Player.data.currentTab].classList.remove("map-transition");

    subtabs.forEach((subtab) => {
      var for_tab = subtab.getAttribute("for_tab");
      var subtab_container = document.getElementById(for_tab);
      if (for_tab == Player.data.currentTab) {
        subtab.style.display = "";
        subtab_container.style.display = "";
        if (subtab.classList.contains("selected")) {
          subtab.click();
        }
      } else {
        subtab.style.display = "none";
        subtab_container.style.display = "none";
      }
    });

    if (subtabs.filter((e) => e.getAttribute("for_tab") == Player.data.currentTab).every((e) => e.style.display == "none" || e.classList.contains("hidden"))) {
      container_header.style.display = "none";
      Player.getCurrentTabContainerNode().style.marginTop = "";
    } else {
      container_header.style.display = "";
      Player.getCurrentTabContainerNode().style.marginTop = container_header.offsetHeight + "px";
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

    $(tabMainContainer).animateCss("fadeIn veryfaster");
  }

  function showTempContainer(nodeToHide, _cb) {
    nodeToHide.style.display = "none";
    var div = createSubtabContainer((nodeToHide.parentNode || null));
    div.temp = true;
    div.close = function (fade) {
      if (fade) {
        $(div).animateCss("fadeOut", () => {
          div.remove();
          nodeToHide.style.display = "";
          $(nodeToHide).animateCss("fadeIn veryfaster");
        });
      } else {
        div.remove();
        nodeToHide.style.display = "";
      }
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
    div.removeTempNodes = function (fade) {
      parentDiv.childNodes.forEach((node) => {
        if (node.close) node.close(fade);
      });
    };
    div.setContainerData = function (type, list) {
      div.container_data = { type, list };
    };
    div.getContainerData = function () {
      return div.container_data || null;
    };
    if (id) div.id = id;
    if (parentDiv) {
      parentDiv.appendChild(div);
      parentDiv.mainChildContainer = div;
    }
    return div;
  }
});