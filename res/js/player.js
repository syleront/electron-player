/* jshint esversion: 6 */
// тут страшно :\

emitter.on("auth", (VK, settings) => {
	var player = require(path.join(__dirname, "res/js/player_controls.js"))(VK, settings);

	if (settings.cover_spin) {
		player.buttons.cover.classList.add("disk");
		player.buttons.cover.classList.add("animation-spin");
		cover_disk_center.classList.add("disk-center");
	}

	var sidebar_links = Array.from(document.getElementsByClassName("tab-element"));
	sidebar_links.filter((e) => e.getAttribute("tab")).forEach((e) => {
		var id = e.getAttribute("tab");
		player.buttons.tabs[id] = e;
		e.addEventListener("click", changeTab);
	});

	var subtabs = Array.from(document.getElementsByClassName("subtab-element"));
	subtabs.forEach((e) => {
		e.addEventListener("click", (evt) => {
			if (player.data.rendering) return; //evt.target.classList.contains("selected")

			subtabs.filter((e) => e.classList.contains("selected") && e.getAttribute("for_tab") == player.data.currentTab)[0].classList.remove("selected");
			evt.target.classList.add("selected");

			var forTab = evt.target.getAttribute("for_tab");
			var playlist = evt.target.getAttribute("playlist");
			var tabNode = document.getElementById(forTab + "__" + playlist);
			player.data.currentTabPlaylistName = playlist;
			Array.from(document.getElementsByClassName("map-container")).forEach((e) => {
				if (e.id !== tabNode.id) {
					e.style.display = "none";
				} else if (e.style.display == "none") {
					e.style.display = "";
				}
			});

			if (!tabNode.loaded) {
				if (playlist == "playlistsPlaylist") {
					VK.audioUtils.getUserPlaylists().then((r) => {
						player.renderPlaylists(r, tabNode, () => {
							$('#' + tabNode.id).animateCss('fadeIn veryfaster');
							tabNode.loaded = true;
						});
					});
				} else {
					player.renderAudioList(player.data[playlist], tabNode, 0, 50, () => {
						$('#' + tabNode.id).animateCss('fadeIn veryfaster');
						tabNode.loaded = true;
					});
				}
			} else {
				$('#' + tabNode.id).animateCss('fadeIn veryfaster');
			}
		});

		var forTab = e.getAttribute("for_tab");
		var playlist = e.getAttribute("playlist");
		var div = document.createElement("div");
		div.classList.add("map-container");
		div.id = forTab + "__" + playlist;
		div.onscroll = onScrollHandler;
		e.container_id = div.id;
		main_container.appendChild(div);

		if (player.data.currentTab !== forTab) {
			e.style.display = "none";
			div.style.display = "none";
		}
		if (playlist !== player.data.currentTabPlaylistName) {
			div.style.display = "none";
		}
		if (!e.classList.contains("selected")) {
			e.classList.add("map-background-transition");
		}
	});

	function onScrollHandler(evt) {
		var el = evt.target;
		//console.log(el.scrollTop, el.scrollHeight, el.offsetHeight, (el.scrollHeight - el.offsetHeight) - 50, player.data.scrollStop)
		if (!player.data.scrollStop) {
			if (el.scrollTop >= (el.scrollHeight - el.offsetHeight) - 50) {
				player.data.scrollStop = true;
				var length = el.getElementsByClassName("map-audio-element").length;
				var playlistName = player.data.currentTabPlaylistName;
				if (playlistName == "mainPlaylist" || playlistName == "currentTracklist") {
					if (length >= player.data.mainPlaylist.length) {
						player.data.scrollStop = false;
					} else {
						player.renderAudioList(player.data[playlistName], el, length, length + 100);
					}
				} else if (playlistName == "recomsPlaylist") {
					VK.audioUtils.getRecomendations({
						offset: length
					}).then((list) => {
						if (!list.length) {
							player.data.scrollStop = false;
						} else {
							player.data.recomsPlaylist = player.data.recomsPlaylist.concat(list);
							player.renderAudioList(list, el);
						}
					});
				} else {
					player.data.scrollStop = false;
				}
			} else if (el.scrollTop < 400 && player.data.currentTab !== "playlists_audio_list") {
				Array.from(document.getElementById(el.id).getElementsByClassName("map-audio-element")).slice(100).forEach((e) => {
					e.remove();
				});
			}
		}
	}

	function changeTab(evt) {
		player.buttons.tabs[player.data.currentTab].classList.remove("tab-element-selected");
		player.buttons.tabs[player.data.currentTab].classList.add("map-transition");

		player.data.currentTab = evt.target.getAttribute("tab");
		player.buttons.tabs[player.data.currentTab].classList.add("tab-element-selected");
		player.buttons.tabs[player.data.currentTab].classList.remove("map-transition");

		subtabs.forEach((e) => {
			var forTab = e.getAttribute("for_tab");
			var container = document.getElementById(e.container_id);
			if (player.data.currentTab !== forTab) {
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

		if (subtabs.filter((e) => e.getAttribute("for_tab") == player.data.currentTab).every((e) => e.style.display == "none" || e.classList.contains("hidden"))) {
			container_header.style.display = "none";
		} else {
			container_header.style.display = "";
		}
	}

	VK.audioUtils.getFullPlaylist().then((r) => {
		player.data.mainPlaylist = r;
		var node = document.getElementById("main_audio_list__mainPlaylist");
		player.renderAudioList(r, node, 0, 50, () => {
			node.loaded = true;
		});
	}).then(() => {
		VK.audioUtils.getRecomendations().then((r) => {
			player.data.recomsPlaylist = r;
			var node = document.getElementById("recommendations_audio_list__recomsPlaylist");
			player.renderAudioList(r, node, 0, 50, () => {
				node.loaded = true;
			});
		});
	});

	function loadElement(p) {
		return new Promise((resolve, reject) => {
			fs.readFile(path.join(__dirname, p), (e, d) => {
				if (e) return reject(e);
				else resolve(createElementFromHTML(d));
			});
		});
	}
});