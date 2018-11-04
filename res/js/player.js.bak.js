/* jshint esversion: 6 */

emitter.on("auth", (VK, settings) => {
	var player = require(path.join(__dirname, "res/js/player_controls.js"))(VK, settings);

	if (settings.cover_spin) {
		player.buttons.cover.classList.add("disk");
		player.buttons.cover.classList.add("animation-spin");
		cover_disk_center.classList.add("disk-center");
	}

	//loadAudio();

	var sidebar_links = Array.from(document.getElementsByClassName("tab-element"));
	sidebar_links.filter((e) => e.getAttribute("tab")).forEach((e) => {
		var id = e.getAttribute("tab");
		var container = document.getElementById(id);
		if (!e.classList.contains("tab-element-selected")) {
			container.style.display = "none";
		} else {
			e.classList.remove("map-transition");
		}
		player.buttons.tabs[id] = e;
		e.addEventListener("click", changeTab);
	});

	var subtabs = Array.from(document.getElementsByClassName("subtab-element"));
	subtabs.forEach((e) => {
		var forTab = e.getAttribute("for_tab");
		e.addEventListener("click", (evt) => {
			if (evt.target.classList.contains("selected") || player.data.rendering) return;

			Array.from(document.getElementsByClassName("subtab-element selected")).filter((e) => e.getAttribute("for_tab") == player.data.currentTab)[0].classList.remove("selected");
			evt.target.classList.add("selected");

			var tabNode = document.getElementById(evt.target.getAttribute("for_tab"));
			var playlist = evt.target.getAttribute("playlist");
			player.data.currentPlaylistName = playlist;
			tabNode.innerHTML = "";
			if (playlist == "playlistsPlaylist") {
				VK.audioUtils.getUserPlaylists().then((r) => {
					player.renderPlaylists(r, tabNode, () => {
						$('#' + tabNode.id).animateCss('fadeIn veryfaster');
					});
				});
			} else {
				player.renderAudioList(player.data[playlist], tabNode, 0, 50, () => {
					$('#' + tabNode.id).animateCss('fadeIn veryfaster');
				});
			}
		});
		if (player.data.currentTab !== forTab) e.style.display = "none";
		if (!e.classList.contains("selected")) e.classList.add("map-background-transition");
	});

	var containers = Array.from(document.querySelectorAll('div[class^="map-container"]'));
	containers.forEach((el) => {
		el.onscroll = function () {
			//console.log(el.scrollTop, el.scrollHeight, el.offsetHeight, (el.scrollHeight - el.offsetHeight) - 50, player.data.scrollStop)
			if (!player.data.scrollStop) {
				if (el.scrollTop >= (el.scrollHeight - el.offsetHeight) - 50) {
					player.data.scrollStop = true;
					var length = el.getElementsByClassName("map-audio-element").length;
					var playlistName = player.data.currentPlaylistName;
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
		};
	});

	function changeTab(evt) {
		var oldTabNode = document.getElementById(player.data.currentTab);
		var id = evt.target.getAttribute("tab");
		var newTabNode = document.getElementById(id);
		if (oldTabNode == newTabNode) return;
		if (oldTabNode.getAttribute("playlist") == "mainPlaylist") {
			Array.from(oldTabNode.getElementsByClassName("audio-removed")).forEach((e) => e.remove());
		}
		oldTabNode.style.display = "none";
		player.buttons.tabs[oldTabNode.id].classList.remove("tab-element-selected");
		player.buttons.tabs[oldTabNode.id].classList.add("map-transition");
		newTabNode.style.display = "block";
		player.buttons.tabs[newTabNode.id].classList.add("tab-element-selected");
		player.buttons.tabs[newTabNode.id].classList.remove("map-transition");
		player.data.currentTab = newTabNode.id;

		var subtab_list = subtabs.filter((e) => e.getAttribute("for_tab") == player.data.currentTab);
		if (!subtab_list.length) container_header.style.display = "none";
		else container_header.style.display = "";

		subtabs.forEach((e) => {
			var forTab = e.getAttribute("for_tab");
			if (player.data.currentTab !== forTab) e.style.display = "none";
			else e.style.display = "";
			if (!e.classList.contains("selected")) e.classList.add("map-background-transition");
		});

		$('#' + newTabNode.id).animateCss('fadeIn superfaster');
	}

	VK.audioUtils.getFullPlaylist().then((r) => {
		player.data.mainPlaylist = r;
	}).then(() => {
		VK.audioUtils.getRecomendations().then((r) => {
			player.data.recomsPlaylist = r;
		});
	});

	/* function loadAudio() {
		main_audio_list.innerHTML = "";
		playlists_audio_list.innerHTML = "";
		recommendations_audio_list.innerHTML = "";

		VK.audioUtils.getFullPlaylist().then((r) => {
			player.data.mainPlaylist = r;
			player.renderAudioList(r, main_audio_list, 0, 100, () => {
				$('#main_audio_list').animateCss('fadeIn');
			});
		}).then(function p() {
			return VK.audioUtils.getUserPlaylists().then((r) => {
				loadElement("res/js/html_plains/playlist_element.html").then((pl) => {
					r.forEach((e) => {
						var el = pl.cloneNode(true);
						if (e.picture) el.childNodes[1].src = e.picture;
						el.childNodes[3].innerHTML = e.title;
						el.addEventListener("click", () => {
							$('#playlists_audio_list').animateCss('fadeOut', () => {
								playlists_audio_list.innerHTML = "";
								VK.audioUtils.getFullPlaylist({
									access_hash: e.access_hash,
									owner_id: e.owner_id,
									playlist_id: e.playlist_id
								}).then((r) => {
									loadElement("res/js/html_plains/back_button.html").then((btn) => {
										btn.addEventListener("click", () => {
											$('#playlists_audio_list').animateCss('fadeOut', () => {
												playlists_audio_list.innerHTML = "";
												p();
											});
										});
										player.data.playlistsPlaylist = r;
										player.renderAudioList(r, playlists_audio_list, () => {
											playlists_audio_list.insertAdjacentElement("afterbegin", btn);
											$('#playlists_audio_list').animateCss('fadeIn');
										});
									});
								});
							});
						});
						playlists_audio_list.appendChild(el);
						$('#playlists_audio_list').animateCss('fadeIn');
					});
				});
			});
		}).then(() => {
			return VK.audioUtils.getRecomendations().then((r) => {
				player.data.recomsPlaylist = r;
				player.renderAudioList(r, recommendations_audio_list, 0, 100, () => {
					$('#recommendations_audio_list').animateCss('fadeIn');
				});
			});
		});
	} */

	function loadElement(p) {
		return new Promise((resolve, reject) => {
			fs.readFile(path.join(__dirname, p), (e, d) => {
				if (e) return reject(e);
				else resolve(createElementFromHTML(d));
			});
		});
	}
});