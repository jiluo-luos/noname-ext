game.import("extension", function (lib, game, ui, get, ai, _status) {
	return {
		name: "神话再临-解构-菠萝包",
		content: function (config, pack) {
			const imageDir = "extension/神话再临-解构-菠萝包/image";
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
				console.warn("[神话再临-解构-菠萝包] 读取 image/ 目录失败：", e);
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
			lib.characterSort["神话再临-解构-菠萝包"] = {
				jieboluo_shenhua_feng: ["jieboluo_caoren", "jieboluo_yuji"],
				jieboluo_shenhua_huo: ["jieboluo_pangtong"],
				jieboluo_shenhua_lin: ["jieboluo_jiaxu"],
				jieboluo_shenhua_yin: ["jieboluo_wangping"],
			};
		},
		arenaReady: function () {},
		help: {},
		config: {},
		package: {
			character: {
				character: {
//#noname-kit-begin character:jieboluo_caoren
					"jieboluo_caoren": {
						sex: "male",
						group: "wei",
						hp: 4,
						skills: ["jieboluo_jushou"],
					},
//#noname-kit-end character:jieboluo_caoren
//#noname-kit-begin character:jieboluo_yuji
					"jieboluo_yuji": {
						sex: "male",
						group: "qun",
						hp: 3,
						skills: ["jieboluo_daoshi"],
					},
//#noname-kit-end character:jieboluo_yuji
//#noname-kit-begin character:jieboluo_pangtong
					"jieboluo_pangtong": {
						sex: "male",
						group: "shu",
						hp: 3,
						skills: ["jieboluo_lianhuan", "jieboluo_niepan"],
						img: "extension/神话再临-解构-菠萝包/image/jieboluo_pangtong.jpg",
						dieAudios: ["ext:神话再临-解构-菠萝包/audio/die/jieboluo_pangtong1.mp3"],
					},
//#noname-kit-end character:jieboluo_pangtong
//#noname-kit-begin character:jieboluo_jiaxu
					"jieboluo_jiaxu": {
						sex: "male",
						group: "qun",
						hp: 3,
						skills: ["jieboluo_weimu", "jieboluo_wansha", "jieboluo_luanwu"],
					},
//#noname-kit-end character:jieboluo_jiaxu
//#noname-kit-begin character:jieboluo_wangping
					"jieboluo_wangping": {
						sex: "male",
						group: "shu",
						hp: 4,
						skills: ["jieboluo_feijun", "jieboluo_chenlue"],
					},
//#noname-kit-end character:jieboluo_wangping
				},
				translate: {
					"jieboluo_caoren": "曹仁",
					"jieboluo_yuji": "于吉",
					"jieboluo_pangtong": "庞统",
					"jieboluo_jiaxu": "贾诩",
					"jieboluo_wangping": "王平",
					"jieboluo_shenhua_feng": "风",
					"jieboluo_shenhua_huo": "火",
					"jieboluo_shenhua_lin": "林",
					"jieboluo_shenhua_yin": "阴",
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
//#noname-kit-begin skill:jieboluo_jushou
					"jieboluo_jushou": {
						trigger: { player: ["phaseDiscardBegin", "damageEnd"] },
						init(player) {
							player.addSkill("jieboluo_jushou_faceup");
						},
						onremove(player) {
							player.removeSkill("jieboluo_jushou_faceup");
						},
						getPhaseName(trigger) {
							const phase = trigger.getParent("phase");
							if (!phase || !Array.isArray(phase.phaseList) || typeof phase.num !== "number") {
								return "";
							}
							return String(phase.phaseList[phase.num] || "").split("|")[0];
						},
						endCurrentPhase(trigger) {
							const skill = lib.skill["jieboluo_jushou"];
							const name = skill.getPhaseName(trigger);
							if (!name) {
								return false;
							}
							const evt = trigger.name === name ? trigger : trigger.getParent(name);
							if (!evt) {
								return false;
							}
							if (name == "phaseUse" && typeof evt.goto == "function") {
								evt.goto(5);
								return true;
							}
							if (typeof evt.cancel == "function") {
								evt.cancel();
								return true;
							}
							return false;
						},
						filter(event, player) {
							return true;
						},
						check(event, player) {
							const skill = lib.skill["jieboluo_jushou"];
							if (player.isTurnedOver()) {
								return true;
							}
							return skill.getPhaseName(event) == "phaseDiscard";
						},
						async content(event, trigger, player) {
							const skill = lib.skill["jieboluo_jushou"];
							await player.turnOver();
							if (!player.isAlive()) {
								return;
							}
							const phaseName = skill.getPhaseName(trigger);
							if (!phaseName) {
								return;
							}
							const result = await player
								.chooseBool("据守：是否结束当前阶段？")
								.set("phaseName", phaseName)
								.set("ai", () => {
									const name = get.event().phaseName;
									return name != "" && name != "phaseUse";
								})
								.forResult();
							if (result.bool) {
								skill.endCurrentPhase(trigger);
							}
						},
					},
//#noname-kit-end skill:jieboluo_jushou
//#noname-kit-begin skill:jieboluo_jushou_faceup
					"jieboluo_jushou_faceup": {
						charlotte: true,
						trigger: { player: "turnOverAfter" },
						filter(event, player) {
							return !player.isTurnedOver();
						},
						check(event, player) {
							return true;
						},
						async content(event, trigger, player) {
							await player.draw(3);
						},
					},
//#noname-kit-end skill:jieboluo_jushou_faceup
//#noname-kit-begin skill:jieboluo_daoshi
					"jieboluo_daoshi": {
						locked: true,
						forced: true,
						init(player) {
							player.addSkill("jieboluo_daoshi_effect");
							player.addSkill("jieboluo_daoshi_deck");
						},
						onremove(player) {
							player.removeSkill("jieboluo_daoshi_effect");
							player.removeSkill("jieboluo_daoshi_deck");
							delete player.storage["jieboluo_daoshi_shown"];
						},
						isOpen(player) {
							return player.countCards("h") < get.discarded().length;
						},
						getDiscardCards(event, player) {
							if (!event || !Array.isArray(event.cards)) {
								return [];
							}
							const check = (card) => get.itemtype(card) == "card" && get.position(card, true) == "d";
							if (event.name == "cardsDiscard") {
								const use = event.getParent("useCard");
								if (!use || use.player == player) {
									return [];
								}
								const useCards = Array.isArray(use.cards) ? use.cards : [];
								if (!useCards.length) {
									return [];
								}
								return event.cards.filter((card) => check(card) && useCards.includes(card));
							}
							if (event.name == "lose" && event.position == ui.discardPile && event.player != player) {
								return event.cards.filter(check);
							}
							return [];
						},
						hasNewHandcard(player) {
							const hs = player.getCards("h");
							if (!hs.length) {
								return false;
							}
							const shown = player.storage["jieboluo_daoshi_shown"];
							if (!Array.isArray(shown) || !shown.length) {
								return true;
							}
							return hs.some((card) => !shown.includes(card));
						},
						canTakeDeck(player) {
							const deckNum = ui.cardPile.childNodes.length;
							return deckNum > 0 && deckNum < player.countCards("h");
						},
						intro: {
							content(storage, player) {
								return "锁定技：手牌数少于本回合进入弃牌堆的牌数时，你的手牌公开，且其他角色使用/弃置/重铸等进入弃牌堆的牌改为进入你的手牌区；牌堆张数少于你的手牌数时，你获得牌堆剩余的牌。";
							},
						},
					},
//#noname-kit-end skill:jieboluo_daoshi
//#noname-kit-begin skill:jieboluo_daoshi_effect
					"jieboluo_daoshi_effect": {
						charlotte: true,
						popup: false,
						forced: true,
						silent: true,
						firstDo: true,
						trigger: { player: "gainAfter", global: ["cardsDiscardAfter", "loseAfter"] },
						filter(event, player) {
							const skill = lib.skill["jieboluo_daoshi"];
							if (!skill.isOpen(player)) {
								return false;
							}
							if (skill.getDiscardCards(event, player).length > 0) {
								return true;
							}
							return skill.hasNewHandcard(player);
						},
						async content(event, trigger, player) {
							const skill = lib.skill["jieboluo_daoshi"];
							const cards = skill.getDiscardCards(trigger, player);
							if (cards.length) {
								game.log(player, "盗世：获得进入弃牌堆的", cards.length, "张牌");
								await player.gain(cards, "gain2");
							}
							if (skill.isOpen(player) && skill.hasNewHandcard(player)) {
								const hs = player.getCards("h");
								player.storage["jieboluo_daoshi_shown"] = hs.slice(0);
								await player.showCards(hs, get.translation(player) + "发动了【盗世】");
							}
						},
					},
//#noname-kit-end skill:jieboluo_daoshi_effect
//#noname-kit-begin skill:jieboluo_daoshi_deck
					"jieboluo_daoshi_deck": {
						charlotte: true,
						popup: false,
						forced: true,
						silent: true,
						firstDo: true,
						trigger: { player: ["gainAfter", "loseAfter"], global: ["gainAfter", "cardsDiscardAfter"] },
						filter(event, player) {
							return lib.skill["jieboluo_daoshi"].canTakeDeck(player);
						},
						async content(event, trigger, player) {
							const deckNum = ui.cardPile.childNodes.length;
							if (deckNum <= 0) {
								return;
							}
							const cards = get.cards(deckNum);
							if (!cards.length) {
								return;
							}
							game.log(player, "盗世：获得牌堆剩余的", cards.length, "张牌");
							await player.gain(cards, "gain2");
						},
					},
//#noname-kit-end skill:jieboluo_daoshi_deck
//#noname-kit-begin skill:jieboluo_lianhuan
					"jieboluo_lianhuan": {
						audio: "ext:神话再临-解构-菠萝包/audio/skill:2",
						enable: "phaseUse",
						usable: 1,
						selectTarget: 1,
						filterTarget(card, player, target) {
							return true;
						},
						async content(event, trigger, player) {
							const target = event.targets[0];
							await target.draw(3);
							const cards = target.getCards("h");
							await target.showCards(cards);
							target.addGaintag(cards, "jieboluo_lianhuan_effect");
							target.addTempSkill("jieboluo_lianhuan_effect", "phaseUseAfter");
							player.storage["jieboluo_lianhuan_target"] = target;
						},
						init(player) {
							player.addSkill("jieboluo_lianhuan_damage");
						},
						onremove(player) {
							player.removeSkill("jieboluo_lianhuan_damage");
						},
						ai: {
							order: 6,
							result: {
								player: 1,
								target: (player, target) => -get.attitude(player, target),
							},
						},
					},
//#noname-kit-end skill:jieboluo_lianhuan
//#noname-kit-begin skill:jieboluo_lianhuan_effect
					"jieboluo_lianhuan_effect": {
						charlotte: true,
						mod: {
							cardname(card) {
								if (get.itemtype(card) !== "card" || get.position(card) !== "h") {
									return;
								}
								if (card.hasGaintag("jieboluo_lianhuan_effect")) {
									return "tiesuo";
								}
							},
						},
						onremove(player, skill) {
							player.removeGaintag(skill);
						},
					},
//#noname-kit-end skill:jieboluo_lianhuan_effect
//#noname-kit-begin skill:jieboluo_lianhuan_damage
					"jieboluo_lianhuan_damage": {
						charlotte: true,
						popup: false,
						forced: true,
						trigger: { player: "phaseAfter" },
						filter(event, player) {
							return !!player.storage["jieboluo_lianhuan_target"];
						},
						async content(event, trigger, player) {
							const target = player.storage["jieboluo_lianhuan_target"];
							player.storage["jieboluo_lianhuan_target"] = null;
							if (target && target.isAlive()) {
								await target.damage(1, player);
							}
						},
					},
//#noname-kit-end skill:jieboluo_lianhuan_damage
//#noname-kit-begin skill:jieboluo_niepan
					"jieboluo_niepan": {
						audio: "ext:神话再临-解构-菠萝包/audio/skill:2",
						juexingji: true,
						forced: true,
						trigger: { player: "dyingAfter" },
						filter(event, player) {
							return !player.awakenedSkills.includes("jieboluo_niepan") && player.isAlive() && player.hp > 0;
						},
						async content(event, trigger, player) {
							player.awakenSkill("jieboluo_niepan");
							await player.recoverTo(player.maxHp);
						},
						init(player) {
							player.addSkill("jieboluo_niepan_fire");
						},
						onremove(player) {
							player.removeSkill("jieboluo_niepan_fire");
						},
					},
//#noname-kit-end skill:jieboluo_niepan
//#noname-kit-begin skill:jieboluo_niepan_fire
					"jieboluo_niepan_fire": {
						charlotte: true,
						popup: false,
						forced: true,
						trigger: { source: "damageBegin1" },
						filter(event, player) {
							return player.awakenedSkills.includes("jieboluo_niepan");
						},
						content(event, trigger, player) {
							trigger.nature = "fire";
						},
					},
//#noname-kit-end skill:jieboluo_niepan_fire
//#noname-kit-begin skill:jieboluo_weimu
					"jieboluo_weimu": {
						locked: true,
						forced: true,
						trigger: { player: "damageBegin3", target: "useCardToPlayered" },
						filter(event, player, name) {
							if (name == "damageBegin3") {
								return !!event.source && event.source != _status.currentPhase;
							}
							if (_status.currentPhase == player) {
								return false;
							}
							const card = event.card;
							if (!card) {
								return false;
							}
							const type = get.type(card);
							if (type != "trick" && type != "delay") {
								return false;
							}
							return get.color(card) == "black";
						},
						content(event, trigger, player) {
							if (event.triggername == "damageBegin3") {
								trigger.cancel();
							} else {
								game.log(trigger.card, "对", player, "无效");
								trigger.getParent().excluded.add(player);
							}
						},
					},
//#noname-kit-end skill:jieboluo_weimu
//#noname-kit-begin skill:jieboluo_wansha
					"jieboluo_wansha": {
						locked: true,
						forced: true,
						trigger: { global: "dyingAfter" },
						filter(event, player) {
							return _status.currentPhase == player && game.hasPlayer((current) => current.isAlive());
						},
						async content(event, trigger, player) {
							const result = await player
								.chooseTarget("完杀：分配1点伤害", (card, player2, target) => target.isAlive(), true)
								.set("ai", (target) => {
									const player2 = get.event().player;
									return -get.attitude(player2, target);
								})
								.forResult();
							if (result.bool && result.targets && result.targets.length) {
								await result.targets[0].damage(1, player);
							}
						},
					},
//#noname-kit-end skill:jieboluo_wansha
//#noname-kit-begin skill:jieboluo_luanwu
					"jieboluo_luanwu": {
						enable: "phaseUse",
						limited: true,
						skillAnimation: true,
						filter(event, player) {
							return game.hasPlayer((current) => current != player && current.isAlive());
						},
						async content(event, trigger, player) {
							player.awakenSkill(event.name);
							const targets = game.filterPlayer((current) => current != player && current.isAlive()).sortBySeat();
							if (!targets.length) {
								return;
							}
							for (const target of targets) {
								if (target.isAlive()) {
									await target.loseHp();
								}
							}
							for (const target of targets) {
								if (!target.isAlive()) {
									continue;
								}
								const result = await target
									.chooseToUse({
										prompt: "乱武：你可以使用一张【杀】，然后回复1点体力",
										filterCard(card) {
											if (!card || get.name(card) != "sha") {
												return false;
											}
											return lib.filter.filterCard.apply(this, arguments);
										},
									})
									.forResult();
								if (result.bool) {
									await target.recover();
								}
							}
						},
						ai: {
							order: 7,
							result: { player: 1 },
						},
					},
//#noname-kit-end skill:jieboluo_luanwu
//#noname-kit-begin skill:jieboluo_feijun
					"jieboluo_feijun": {
						limited: true,
						skillAnimation: true,
						trigger: { global: "useCardAfter" },
						init(player) {
							player.addSkill("jieboluo_feijun_record");
						},
						onremove(player) {
							player.removeSkill("jieboluo_feijun_record");
						},
						getCards(event) {
							const cards = event && Array.isArray(event.jieboluo_feijun_cards) ? event.jieboluo_feijun_cards : [];
							return cards.filter((card) => get.itemtype(card) == "card" && get.position(card, true) == "d");
						},
						filter(event, player) {
							if (!event.card || get.name(event.card) != "nanman") {
								return false;
							}
							return lib.skill["jieboluo_feijun"].getCards(event).length > 0;
						},
						check(event, player) {
							return true;
						},
						async content(event, trigger, player) {
							player.awakenSkill(event.name);
							const cards = lib.skill["jieboluo_feijun"].getCards(trigger);
							if (!cards.length) {
								return;
							}
							game.log(player, "飞军：获得响应【南蛮入侵】的", cards.length, "张【杀】");
							await player.gain(cards, "gain2");
						},
					},
//#noname-kit-end skill:jieboluo_feijun
//#noname-kit-begin skill:jieboluo_feijun_record
					"jieboluo_feijun_record": {
						charlotte: true,
						popup: false,
						forced: true,
						silent: true,
						trigger: { global: "respond" },
						filter(event, player) {
							const use = event.getParent("useCard");
							if (!use || !use.card || get.name(use.card) != "nanman") {
								return false;
							}
							return (event.cards || []).some((card) => get.itemtype(card) == "card" && get.name(card) == "sha");
						},
						content(event, trigger, player) {
							const use = trigger.getParent("useCard");
							if (!use) {
								return;
							}
							if (!Array.isArray(use.jieboluo_feijun_cards)) {
								use.jieboluo_feijun_cards = [];
							}
							for (const card of trigger.cards || []) {
								if (get.itemtype(card) == "card" && get.name(card) == "sha" && !use.jieboluo_feijun_cards.includes(card)) {
									use.jieboluo_feijun_cards.push(card);
								}
							}
						},
					},
//#noname-kit-end skill:jieboluo_feijun_record
//#noname-kit-begin skill:jieboluo_chenlue
					"jieboluo_chenlue": {
						locked: true,
						forced: true,
						mark: true,
						marktext: "略",
						init(player) {
							player.markSkill("jieboluo_chenlue");
						},
						getHandLimit(player) {
							if (typeof player.getHandcardLimit == "function") {
								return player.getHandcardLimit();
							}
							return game.checkMod(player, player.hp, "maxHandcard", player);
						},
						getShaNum(player) {
							if (typeof player.getCardUsable == "function") {
								return player.getCardUsable("sha");
							}
							return 1;
						},
						getZ(player) {
							return Math.floor(player.countCards("h") / 2);
						},
						getY(player) {
							return Math.floor(lib.skill["jieboluo_chenlue"].getHandLimit(player) / 2);
						},
						getX(player) {
							return Math.floor(lib.skill["jieboluo_chenlue"].getShaNum(player) / 2);
						},
						mod: {
							maxHandcard(player, num) {
								return num + lib.skill["jieboluo_chenlue"].getZ(player);
							},
							cardUsable(card, player, num) {
								if (get.name(card) == "sha") {
									return num + lib.skill["jieboluo_chenlue"].getY(player);
								}
							},
						},
						trigger: { player: "phaseDrawBegin2" },
						filter(event, player) {
							return !event.numFixed && lib.skill["jieboluo_chenlue"].getX(player) > 0;
						},
						async content(event, trigger, player) {
							const x = lib.skill["jieboluo_chenlue"].getX(player);
							if (x > 0) {
								trigger.num += x;
							}
						},
						intro: {
							markcount(storage, player) {
								const skill = lib.skill["jieboluo_chenlue"];
								return skill.getX(player) + "/" + skill.getY(player) + "/" + skill.getZ(player);
							},
							content(storage, player) {
								const skill = lib.skill["jieboluo_chenlue"];
								const x = skill.getX(player);
								const y = skill.getY(player);
								const z = skill.getZ(player);
								const lines = [];
								lines.push("摸牌数 +" + x + "（你的出杀次数 " + skill.getShaNum(player) + " 的一半取整）");
								lines.push("出杀次数 +" + y + "（你的手牌上限 " + skill.getHandLimit(player) + " 的一半取整）");
								lines.push("手牌上限 +" + z + "（你的手牌数 " + player.countCards("h") + " 的一半取整）");
								return lines.join("<br>");
							},
						},
					},
//#noname-kit-end skill:jieboluo_chenlue
				},
				translate: {
//#noname-kit-begin translate:jieboluo_jushou
					"jieboluo_jushou": "据守",
					"jieboluo_jushou_info": "弃牌阶段开始时，或当你受到伤害后，你可以翻面，然后可以结束当前阶段。当你翻回正面时，你可以摸三张牌。",
//#noname-kit-end translate:jieboluo_jushou
//#noname-kit-begin translate:jieboluo_jushou_faceup
					"jieboluo_jushou_faceup": "据守",
//#noname-kit-end translate:jieboluo_jushou_faceup
//#noname-kit-begin translate:jieboluo_daoshi
					"jieboluo_daoshi": "盗世",
					"jieboluo_daoshi_info": "锁定技，你的手牌数少于本回合进入弃牌堆的牌数时，你的手牌公开，且其他角色使用、弃置、重铸等进入弃牌堆的牌改为进入你的手牌区；牌堆张数少于你的手牌数时，你获得牌堆剩余的牌。",
//#noname-kit-end translate:jieboluo_daoshi
//#noname-kit-begin translate:jieboluo_daoshi_effect
					"jieboluo_daoshi_effect": "盗世",
//#noname-kit-end translate:jieboluo_daoshi_effect
//#noname-kit-begin translate:jieboluo_daoshi_deck
					"jieboluo_daoshi_deck": "盗世",
//#noname-kit-end translate:jieboluo_daoshi_deck
//#noname-kit-begin translate:jieboluo_lianhuan
					"jieboluo_lianhuan": "连环",
					"jieboluo_lianhuan_info": "出牌阶段限一次，你可以令一名角色摸三张牌并展示所有手牌，其展示牌本阶段视为【铁索连环】。回合结束时，你对其造成一点伤害。",
//#noname-kit-end translate:jieboluo_lianhuan
//#noname-kit-begin translate:jieboluo_lianhuan_effect
					"jieboluo_lianhuan_effect": "连环",
//#noname-kit-end translate:jieboluo_lianhuan_effect
//#noname-kit-begin translate:jieboluo_niepan
					"jieboluo_niepan": "涅槃",
					"jieboluo_niepan_info": "觉醒技，当你脱离濒死状态后，你回复所有体力，此后你造成的伤害均改为火焰伤害。",
//#noname-kit-end translate:jieboluo_niepan
//#noname-kit-begin translate:jieboluo_weimu
					"jieboluo_weimu": "帷幕",
					"jieboluo_weimu_info": "锁定技，非当前回合角色对你造成的伤害无效；你的回合外，黑色锦囊牌对你无效。",
//#noname-kit-end translate:jieboluo_weimu
//#noname-kit-begin translate:jieboluo_wansha
					"jieboluo_wansha": "完杀",
					"jieboluo_wansha_info": "锁定技，你的回合内，一名角色濒死结算结束后，你分配1点伤害。",
//#noname-kit-end translate:jieboluo_wansha
//#noname-kit-begin translate:jieboluo_luanwu
					"jieboluo_luanwu": "乱武",
					"jieboluo_luanwu_info": "限定技，出牌阶段，你可令所有其他角色失去1点体力，然后依次可以使用一张【杀】并回复1点体力。",
//#noname-kit-end translate:jieboluo_luanwu
//#noname-kit-begin translate:jieboluo_feijun
					"jieboluo_feijun": "飞军",
					"jieboluo_feijun_info": "限定技，一张【南蛮入侵】结算后，你可以获得响应此牌的所有【杀】。",
//#noname-kit-end translate:jieboluo_feijun
//#noname-kit-begin translate:jieboluo_feijun_record
					"jieboluo_feijun_record": "飞军",
//#noname-kit-end translate:jieboluo_feijun_record
//#noname-kit-begin translate:jieboluo_chenlue
					"jieboluo_chenlue": "沉略",
					"jieboluo_chenlue_info": "锁定技，你的摸牌阶段摸牌数/出杀次数/手牌上限/手牌数+后者数值的半数取下。",
//#noname-kit-end translate:jieboluo_chenlue
				},
			},
			author: "芝士",
			version: "1.0",
		},
		editable: false,
		connect: true,
	};
});
