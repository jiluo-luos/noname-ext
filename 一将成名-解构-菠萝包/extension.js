game.import("extension", function (lib, game, ui, get, ai, _status) {
	return {
		name: "一将成名-解构-菠萝包",
		content: function (config, pack) {
			const imageDir = "extension/一将成名-解构-菠萝包/image";
			const fs = lib.node && lib.node.fs;
			let files = [];
			try {
				let dir = imageDir;
				if (fs && typeof window !== "undefined" && window.__dirname) {
					const absolute = window.__dirname + "/" + imageDir;
					if (fs.existsSync(absolute)) {
						dir = absolute;
					}
				}
				if (fs && fs.existsSync(dir)) {
					files = fs.readdirSync(dir).filter((file) => /\.(?:jpg|jpeg|png|webp|gif)$/i.test(file));
				}
			} catch (e) {
				console.warn("[一将成名-解构-菠萝包] 读取 image/ 目录失败：", e);
			}
			const characters = (pack && pack.character && pack.character.character) || {};
			for (const [id, character] of Object.entries(characters)) {
				if (!character || Array.isArray(character)) {
					continue;
				}
				const fileName = files.find((file) => file.replace(/\.[^.]+$/, "").toLowerCase() === id.toLowerCase());
				if (fileName) {
					character.img = imageDir + "/" + fileName;
				} else if (!character.img) {
					character.img = imageDir + "/" + id + ".jpg";
				}
			}
		},
		precontent: function () {
			lib.characterSort["一将成名-解构-菠萝包"] = {
				jieboluo_jiang1: ["jieboluo_wuyi"],
			};
		},
		arenaReady: function () {},
		help: {},
		config: {},
		package: {
			character: {
				character: {
//#noname-kit-begin character:jieboluo_wuyi
					"jieboluo_wuyi": {
						sex: "male",
						group: "shu",
						hp: 4,
						skills: ["jieboluo_benxi"],
						img: "extension/一将成名-解构-菠萝包/image/jieboluo_wuyi.jpg",
						dieAudios: ["ext:一将成名-解构-菠萝包/audio/die/jieboluo_wuyi1.mp3"],
					},
//#noname-kit-end character:jieboluo_wuyi
				},
				translate: {
					"jieboluo_wuyi": "吴懿",
					"jieboluo_jiang1": "将一",
				},
				connect: true,
			},
			card: {
				card: {},
				translate: {},
				list: [],
			},
			skill: {
				skill: {
//#noname-kit-begin skill:jieboluo_benxi
					"jieboluo_benxi": {
						audio: "ext:一将成名-解构-菠萝包/audio/skill:2",
						locked: true,
						forced: true,
						mark: true,
						marktext: "奔",
						intro: {
							markcount(storage, player) {
								const sameTurn = player.storage["jieboluo_benxi_phasenum"] === game.phaseNumber;
								const count = sameTurn ? player.storage["jieboluo_benxi_count"] || 0 : 0;
								const need = count + 1;
								const used = sameTurn ? Math.min(player.storage["jieboluo_benxi_used"] || 0, need) : 0;
								return used + "/" + need;
							},
							content(storage, player) {
								const sameTurn = player.storage["jieboluo_benxi_phasenum"] === game.phaseNumber;
								const count = sameTurn ? player.storage["jieboluo_benxi_count"] || 0 : 0;
								const need = count + 1;
								const used = sameTurn ? Math.min(player.storage["jieboluo_benxi_used"] || 0, need) : 0;
								return "锁定技，当你于你的一个出牌阶段使用" + need + "张牌后，你摸一张牌并结束本阶段，然后执行一个出牌阶段。（本回合已发动" + count + "次；当前阶段已使用" + used + "/" + need + "张牌）";
							},
						},
						trigger: { player: "useCardAfter" },
						filter(event, player) {
							const phaseUse = event.getParent("phaseUse");
							if (!phaseUse || phaseUse.player !== player) {
								return false;
							}
							const count = player.storage["jieboluo_benxi_phasenum"] === game.phaseNumber ? player.storage["jieboluo_benxi_count"] || 0 : 0;
							const need = count + 1;
							const used = player.getHistory("useCard", (evt) => evt.getParent("phaseUse") === phaseUse).length;
							return used === need;
						},
						async content(event, trigger, player) {
							const phaseUse = trigger.getParent("phaseUse");
							const phaseEvent = trigger.getParent("phase");
							if (player.storage["jieboluo_benxi_phasenum"] !== game.phaseNumber) {
								player.storage["jieboluo_benxi_phasenum"] = game.phaseNumber;
								player.storage["jieboluo_benxi_count"] = 0;
							}
							player.storage["jieboluo_benxi_count"]++;
							await player.draw(1);
							if (phaseEvent && Array.isArray(phaseEvent.phaseList) && typeof phaseEvent.num === "number") {
								phaseEvent.phaseList.splice(phaseEvent.num + 1, 0, "phaseUse|" + event.name);
							}
							player.storage["jieboluo_benxi_used"] = 0;
							if (phaseUse) {
								phaseUse.goto(5);
							}
							player.updateMark("jieboluo_benxi");
						},
						init(player) {
							player.addSkill("jieboluo_benxi_mark");
						},
						onremove(player) {
							player.removeSkill("jieboluo_benxi_mark");
						},
					},
//#noname-kit-end skill:jieboluo_benxi
//#noname-kit-begin skill:jieboluo_benxi_mark
					"jieboluo_benxi_mark": {
						charlotte: true,
						popup: false,
						forced: true,
						trigger: { player: ["phaseUseBegin", "useCardAfter"] },
						filter(event, player, name) {
							if (name == "phaseUseBegin") {
								return true;
							}
							const phaseUse = event.getParent("phaseUse");
							return !!phaseUse && phaseUse.player === player;
						},
						content(event, trigger, player) {
							if (event.triggername == "phaseUseBegin") {
								player.storage["jieboluo_benxi_used"] = 0;
							} else {
								const phaseUse = trigger.getParent("phaseUse");
								player.storage["jieboluo_benxi_used"] = player.getHistory("useCard", (evt) => evt.getParent("phaseUse") === phaseUse).length;
							}
							player.updateMark("jieboluo_benxi");
						},
					},
//#noname-kit-end skill:jieboluo_benxi_mark
				},
				translate: {
//#noname-kit-begin translate:jieboluo_benxi
					"jieboluo_benxi": "奔袭",
					"jieboluo_benxi_info": "锁定技，当你于你的一个出牌阶段使用X张牌后，你摸一张牌并结束本阶段，然后执行一个出牌阶段。（X为本技能本回合发动次数+1）",
//#noname-kit-end translate:jieboluo_benxi
//#noname-kit-begin translate:jieboluo_benxi_mark
					"jieboluo_benxi_mark": "奔袭",
//#noname-kit-end translate:jieboluo_benxi_mark
				},
			},
			author: "芝士",
			version: "1.0",
		},
		editable: false,
		connect: true,
	};
});
