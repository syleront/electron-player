// тут страшно :\

process.on("uncaughtException", (e) => {
  console.log("uncaughtException " + e.stack);
});

module.exports = function (VK, INIT_INFO, Settings) {
  const Player = require("./player-controls.js")(VK, INIT_INFO, Settings, {
    showTempContainer, hideHeader, showHeader
  });

  initTabs();
  Player.reloadTabs();
  changeTab();
  applySettings(Settings);

  window.addEventListener("resize", calculateHeaderOffset);

  function initTabs() {
    let sidebar_links = Array.from(document.getElementsByClassName("tab-element"));
    sidebar_links.filter((e) => e.getAttribute("tab")).forEach((e) => {
      let id = e.getAttribute("tab");
      let tabDiv = createTabDiv(id);
      if (id !== Player.data.currentTab) tabDiv.style.display = "none";
      let main_container = document.getElementById("main_container");
      main_container.appendChild(tabDiv);
      Player.controls.tabs[id] = e;
      e.addEventListener("click", changeTab);
    });

    let subtabs = Array.from(document.getElementsByClassName("subtab-element"));
    subtabs.forEach((subtab) => {
      let alias = subtab.dataset.alias;
      let for_tab = subtab.getAttribute("for_tab");
      let playlist = subtab.getAttribute("playlist");
      let additional_classes = subtab.getAttribute("add-class");

      if (for_tab && playlist) {
        let parent = document.getElementById(for_tab);
        let subtabDiv = createSubtabDiv(parent, for_tab + "__" + playlist);
        if (playlist !== Player.data.currentTabPlaylistName) subtabDiv.style.display = "none";
        if (additional_classes) {
          additional_classes.split(" ").forEach((className) => {
            subtabDiv.classList.add(className);
          });
        }
        let mainSubtabContainer = createSubtabContainer(subtabDiv);
        if (alias) Player.controls.tabs.sub[alias] = mainSubtabContainer;

        if (for_tab == Player.data.currentTab) {
          subtab.style.display = "";
        } else {
          subtab.style.display = "none";
        }
      }
      subtab.addEventListener("click", changeSubtab);
    });

    Player.controls.back_button.addEventListener("click", () => {
      let visible = Player.getVisibleContainer();
      if (visible.temp == true) {
        visible.close(true, () => {
          let new_visible = Player.getVisibleContainer();
          if (new_visible.temp !== true) {
            hideBackButton();
          }
        });
      }
    });
  }

  function applySettings(Settings) {
    if (Settings.cover_spin == true) {
      Player.controls.cover.classList.add("disk");
      Player.controls.cover.classList.add("animation-spin");
      document.getElementById("cover_disk_center").classList.add("disk-center");
    }

    if (Settings.transitions == false) {
      let html = document.getElementsByTagName("html")[0];
      html.style.setProperty("--fast-transition", "0s linear");
      html.style.setProperty("--long-transition", "0s linear");
    }

    if (Settings.broadcast == true) {
      Player.controls.broadcast.classList.add("active");
    }
  }

  function onScrollHandler(evt) {
    let node = evt.target;
    let data = node.getContainerData();
    if (!data || data.type !== "audios") return;
    if (Player.data.scrollStop == true) return;

    if (isScrollOnTheBottom(node, 50)) {
      Player.data.scrollStop = true;

      let length = Player.getCurrentTabAudioNodes().length;
      if (length < data.list.length) {
        Player.renderAudioList(data.list, node, length, length + 50, () => {
          Player.data.scrollStop = false;
        });
      } else {
        let onScrollFunction = node.getOnScrollFunction();
        if (onScrollFunction) {
          onScrollFunction(() => {
            Player.data.scrollStop = false;
          });
        } else {
          Player.data.scrollStop = false;
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

    let subtabs = Array.from(document.getElementsByClassName("subtab-element"));
    subtabs.forEach((subtab) => {
      let for_tab = subtab.getAttribute("for_tab");
      let subtab_container = document.getElementById(for_tab);
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

    let first_visible_subtab = subtabs.filter((subtab) => subtab.style.display !== "none")[0];
    if (!first_visible_subtab.classList.contains("first")) first_visible_subtab.classList.add("first");
    /* subtabs.filter((e) => e.getAttribute("for_tab") == Player.data.currentTab).every((e) => e.style.display == "none"
            || e.classList.contains("hidden"))
            || */
    let subtab_header_is_hidden = Player.getVisibleContainer().dataset.header == "hidden";
    if (subtab_header_is_hidden) {
      hideHeader();
    } else {
      showHeader();
    }
  }

  function changeSubtab(evt) {
    let forTab = evt.target.getAttribute("for_tab");
    let playlist = evt.target.getAttribute("playlist");
    let id = forTab + "__" + playlist;
    let tabMainContainer = document.getElementById(id).mainChildContainer;

    Player.data.currentTabPlaylistName = playlist;

    let forTabNode = document.getElementById(forTab);
    let subtab_divs = Array.from(forTabNode.getElementsByClassName("map-subtab-div"));
    subtab_divs.forEach((div) => {
      if (div.id == id) {
        div.style.display = "";
        let container_header = document.getElementById("container_header");
        let selected_subtab = Array.from(container_header.getElementsByClassName("subtab-element")).filter((e) => {
          return e.getAttribute("for_tab") == Player.data.currentTab && e.classList.contains("selected");
        })[0];
        selected_subtab.classList.remove("selected");
        evt.target.classList.add("selected");
      } else {
        div.style.display = "none";
      }
    });

    $(tabMainContainer).animateCss("fadeIn veryfaster");

    let visible = Player.getVisibleContainer();
    if (visible.temp == true) {
      Player.controls.back_button.style.display = "";
    } else {
      Player.controls.back_button.style.display = "none";
    }

    /* if (visible.hideHeader) {
      hideHeader();
    } else {
      showHeader();
    } */
  }

  function calculateHeaderOffset() {
    let container_header = document.getElementById("container_header");
    Player.getCurrentTabContainerNode().style.marginTop = container_header.offsetHeight + "px";
  }

  function showBackButton() {
    Player.controls.back_button.style.display = "";
    $(Player.controls.back_button).animateCss("fadeIn superfaster");
  }

  function hideBackButton() {
    $(Player.controls.back_button).animateCss("fadeOut superfaster").then(() => {
      Player.controls.back_button.style.display = "none";
    });
  }

  function showHeader() {
    calculateHeaderOffset();
    let container_header = document.getElementById("container_header");
    container_header.style.display = "";
  }

  function hideHeader() {
    let container_header = document.getElementById("container_header");
    container_header.style.display = "none";
    calculateHeaderOffset();
  }

  function showTempContainer(nodeToHide) {
    return new Promise((resolve) => {
      nodeToHide.style.display = "none";
      let div = createSubtabContainer(nodeToHide.parentNode || null);
      div.temp = true;
      div.close = (fade, _cb) => {
        if (fade) {
          $(div).animateCss("fadeOut").then(() => {
            div.remove();
            nodeToHide.style.display = "";
            $(nodeToHide).animateCss("fadeIn veryfaster");
            if (_cb) _cb();
          });
        } else {
          div.remove();
          nodeToHide.style.display = "";
          if (_cb) _cb();
        }
      };
      showBackButton();
      resolve(div);
    });
  }

  function createTabDiv(id) {
    let div = document.createElement("div");
    div.classList.add("map-tab-div");
    if (id) div.id = id;
    return div;
  }

  function createSubtabDiv(parentDiv, id) {
    let div = document.createElement("div");
    div.classList.add("map-subtab-div");
    if (id) div.id = id;
    if (parentDiv) parentDiv.appendChild(div);
    return div;
  }

  function createSubtabContainer(parentDiv) {
    let div = document.createElement("div");
    div.classList.add("map-subtab-container");
    div.onscroll = onScrollHandler;
    div.removeTempNodes = function (fade) {
      parentDiv.childNodes.forEach((node) => {
        if (node.close) node.close(fade);
      });
    };
    div.setOnScrollFunction = function (f) {
      return div.onScrollHandler = f;
    };
    div.getOnScrollFunction = function () {
      return div.onScrollHandler;
    };
    div.setContainerData = function (type, list) {
      div.container_data = { type, list };
    };
    div.getContainerData = function () {
      return div.container_data || null;
    };
    if (parentDiv) {
      parentDiv.appendChild(div);
      parentDiv.mainChildContainer = div;
    }
    return div;
  }
};