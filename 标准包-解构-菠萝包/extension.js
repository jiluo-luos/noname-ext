game.import("extension", function (lib, game, ui, get, ai, _status) {
	return {
		name: "标准包-解构-菠萝包",
		content: function (config, pack) {
			const imageDir = "extension/标准包-解构-菠萝包/image";
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
				console.warn("[标准包-解构-菠萝包] 读取 image/ 目录失败：", e);
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
			lib.dynamicTranslate = lib.dynamicTranslate || {};
			lib.dynamicTranslate["jieboluo_keji"] = function (player) {
				const need = player && player.hasSkill("jieboluo_dujiang_double") ? 2 : 1;
				return "弃牌阶段开始时，若你本回合未使用过【杀】，你可以弃置" + (need === 2 ? "两" : "一") + "张牌，将此阶段改为摸牌阶段。";
			};
			lib.dynamicTranslate["jieboluo_botu"] = function (player) {
				const max = player && player.hasSkill("jieboluo_dujiang_double") ? 2 : 1;
				return "每轮限" + (max === 2 ? "两" : "一") + "次，你的回合结束时，若本回合至少三个花色进入过弃牌堆，你可以执行一个额外回合。";
			};
		},
		arenaReady: function () {},
		help: {},
		config: {},
		package: {
			character: {
				character: {
//#noname-kit-begin character:jieboluo_yuejin
					"jieboluo_yuejin": {
						sex: "male",
						group: "wei",
						hp: 4,
						skills: ["jieboluo_xiaoguo", "jieboluo_xiandeng"],
						img: "extension/标准包-解构-菠萝包/image/jieboluo_yuejin.jpg",
						dieAudios: ["ext:标准包-解构-菠萝包/audio/die/jieboluo_yuejin1.mp3"],
					},
//#noname-kit-end character:jieboluo_yuejin
//#noname-kit-begin character:jieboluo_guanyu
					"jieboluo_guanyu": {
						sex: "male",
						group: "shu",
						hp: 4,
						skills: ["jieboluo_wusheng", "jieboluo_qiexing"],
						img: "extension/标准包-解构-菠萝包/image/jieboluo_guanyu.jpg",
						dieAudios: ["ext:标准包-解构-菠萝包/audio/die/jieboluo_guanyu1.mp3"],
					},
//#noname-kit-end character:jieboluo_guanyu
//#noname-kit-begin character:jieboluo_huangyueying
					"jieboluo_huangyueying": {
						sex: "female",
						group: "shu",
						hp: 3,
						skills: ["jieboluo_qicai", "jieboluo_jizhi"],
					},
//#noname-kit-end character:jieboluo_huangyueying
//#noname-kit-begin character:jieboluo_lvmeng
					"jieboluo_lvmeng": {
						sex: "male",
						group: "wu",
						hp: 4,
						skills: ["jieboluo_keji", "jieboluo_botu", "jieboluo_dujiang"],
					},
//#noname-kit-end character:jieboluo_lvmeng
//#noname-kit-begin character:jieboluo_diaochan
					"jieboluo_diaochan": {
						sex: "female",
						group: "qun",
						hp: 3,
						skills: ["jieboluo_lijian", "jieboluo_biyue"],
					},
//#noname-kit-end character:jieboluo_diaochan
				},
				translate: {
					"jieboluo_yuejin": "乐进",
					"jieboluo_guanyu": "关羽",
					"jieboluo_huangyueying": "黄月英",
					"jieboluo_lvmeng": "吕蒙",
					"jieboluo_diaochan": "貂蝉",
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
//#noname-kit-begin skill:jieboluo_xiaoguo
					"jieboluo_xiaoguo": {
						audio: "ext:标准包-解构-菠萝包/audio/skill:2",
						trigger: { global: "phaseZhunbeiBegin" },
						filter(event, player) {
							if (event.player == player) {
								return false;
							}
							const card = new lib.element.VCard({ name: "juedou" });
							return player.canUse(card, event.player);
						},
						async cost(event, trigger, player) {
							const list = ["失去体力上限"];
							if (player.countCards("h", "sha")) {
								list.push("弃置【杀】");
							}
							list.push("cancel2");
							const result = await player
								.chooseControl(list)
								.set("prompt", "骁果：选择一项")
								.set("ai", () => {
									const card = new lib.element.VCard({ name: "juedou" });
									if (get.effect(trigger.player, card, player, player) <= 0) {
										return "cancel2";
									}
									if (list.includes("弃置【杀】")) {
										return "弃置【杀】";
									}
									return player.maxHp > 1 ? "失去体力上限" : "cancel2";
								})
								.forResult();
							event.result = {
								bool: result.control != "cancel2",
								targets: [trigger.player],
								cost_data: result.control,
							};
						},
						async content(event, trigger, player) {
							if (event.cost_data == "失去体力上限") {
								await player.loseMaxHp();
							} else {
								const discard = await player.chooseToDiscard("骁果：弃置一张【杀】", "h", { name: "sha" }, true).forResult();
								if (!discard.bool) {
									return;
								}
							}
							if (!player.isAlive()) {
								return;
							}
							const card = new lib.element.VCard({ name: "juedou" });
							if (player.canUse(card, trigger.player)) {
								await player.useCard(card, trigger.player);
							}
						},
					},
//#noname-kit-end skill:jieboluo_xiaoguo
//#noname-kit-begin skill:jieboluo_xiandeng
					"jieboluo_xiandeng": {
						audio: "ext:标准包-解构-菠萝包/audio/skill:2",
						trigger: { global: "damageBegin3" },
						filter(event, player) {
							if (!event.num || event.player.hp !== event.player.maxHp) {
								return false;
							}
							const parent = event.parent;
							if (!parent || !parent.card || parent.card != event.card) {
								return false;
							}
							const useCard = parent.getParent("useCard");
							return !!useCard && useCard.player == player;
						},
						check(event, trigger, player) {
							return true;
						},
						async content(event, trigger, player) {
							await player.draw(2);
						},
					},
//#noname-kit-end skill:jieboluo_xiandeng
//#noname-kit-begin skill:jieboluo_wusheng
					"jieboluo_wusheng": {
						audio: "ext:标准包-解构-菠萝包/audio/skill:2",
						enable: ["chooseToRespond", "chooseToUse"],
						filterCard(card) {
							return get.color(card) === "red";
						},
						position: "hes",
						viewAs: { name: "sha" },
						viewAsFilter(player) {
							return player.hasCards("hes", { color: "red" });
						},
						prompt: "将一张红色牌当杀使用或打出",
						check(card) {
							const val = get.value(card);
							if (get.event().name === "chooseToRespond") {
								return 1 / Math.max(0.1, val);
							}
							return 5 - val;
						},
						ai: {
							skillTagFilter(player) {
								return player.hasCards("hes", { color: "red" });
							},
							respondSha: true,
						},
						init(player) {
							player.addSkill("jieboluo_wusheng_damage");
						},
						onremove(player) {
							player.removeSkill("jieboluo_wusheng_damage");
						},
					},
//#noname-kit-end skill:jieboluo_wusheng
//#noname-kit-begin skill:jieboluo_wusheng_damage
					"jieboluo_wusheng_damage": {
						audio: "ext:标准包-解构-菠萝包/audio/skill:2",
						charlotte: true,
						popup: false,
						forced: true,
						trigger: { global: "damageBegin3" },
						filter(event, player) {
							return event.source == player && event.num > 0 && player.storage["jieboluo_wusheng_round"] != game.roundNumber;
						},
						async content(event, trigger, player) {
							game.trySkillAudio("jieboluo_wusheng_damage", player);
							player.storage["jieboluo_wusheng_round"] = game.roundNumber;
							const target = trigger.player;
							if (target == player || !target.hasCards("h", (card) => get.color(card) == "red")) {
								return;
							}
							const result = await target
								.chooseCard("武圣：是否交给" + get.translation(player) + "一张红色牌，令此伤害-1？", "h", (card) => get.color(card) == "red")
								.set("damageNum", trigger.num)
								.set("ai", (card) => {
									const evt = get.event();
									if (evt.player.hp > evt.damageNum) {
										return 0;
									}
									return 1 / Math.max(0.1, get.value(card));
								})
								.forResult();
							if (result.bool) {
								await target.give(result.cards, player, true);
								trigger.num--;
							}
						},
					},
//#noname-kit-end skill:jieboluo_wusheng_damage
//#noname-kit-begin skill:jieboluo_qiexing
					"jieboluo_qiexing": {
						audio: "ext:标准包-解构-菠萝包/audio/skill:1",
						enable: "phaseUse",
						filter(event, player) {
							return !player.getStat().skill["jieboluo_qiexing"];
						},
						async content(event, trigger, player) {
							const juedou = get.autoViewAs({ name: "juedou", isCard: true });
							const canJuedou = game.hasPlayer((current) => current != player && player.canUse(juedou, current));
							const result = await player
								.chooseControl(canJuedou ? ["决斗", "酒"] : ["酒"])
								.set("prompt", "且行：选择视为使用的一张牌")
								.set("ai", () => (canJuedou && player.hasValueTarget(juedou) ? "决斗" : "酒"))
								.forResult();
							const first = result.control == "决斗" ? "juedou" : "jiu";
							player.storage["jieboluo_qiexing_pending"] = first == "juedou" ? "jiu" : "juedou";
							if (first == "juedou") {
								await player.chooseUseTarget(juedou, true);
							} else {
								await player.useCard(get.autoViewAs({ name: "jiu", isCard: true }), player, false);
							}
						},
						init(player) {
							player.addSkill("jieboluo_qiexing_damage");
						},
						onremove(player) {
							player.removeSkill("jieboluo_qiexing_damage");
						},
						ai: {
							order: 6,
							result: { player: 1 },
						},
					},
//#noname-kit-end skill:jieboluo_qiexing
//#noname-kit-begin skill:jieboluo_qiexing_damage
					"jieboluo_qiexing_damage": {
						charlotte: true,
						popup: false,
						forced: true,
						trigger: { global: "damage", player: "phaseAfter" },
						filter(event, player, name) {
							const pending = player.storage["jieboluo_qiexing_pending"];
							if (name == "damage") {
								return event.source == player && (pending == "juedou" || pending == "jiu");
							}
							return name == "phaseAfter" && (pending == "juedou" || pending == "jiu");
						},
						async content(event, trigger, player) {
							const name = event.triggername;
							const pending = player.storage["jieboluo_qiexing_pending"];
							if (name == "phaseAfter") {
								player.storage["jieboluo_qiexing_pending"] = false;
								return;
							}
							player.storage["jieboluo_qiexing_pending"] = false;
							if (pending == "juedou") {
								const useJuedou = async () => {
									const card = get.autoViewAs({ name: "juedou", isCard: true });
									if (game.hasPlayer((current) => current != player && player.canUse(card, current))) {
										await player.chooseUseTarget(card, true);
									}
								};
								const useCardEvent = trigger.getParent("useCard");
								if (useCardEvent && useCardEvent.name == "useCard" && !useCardEvent.finished) {
									useCardEvent.insertAfter(useJuedou);
								} else {
									await useJuedou();
								}
							} else {
								const useJiu = async () => {
									await player.useCard(get.autoViewAs({ name: "jiu", isCard: true }), player, false);
								};
								const useCardEvent = trigger.getParent("useCard");
								if (useCardEvent && useCardEvent.name == "useCard" && !useCardEvent.finished) {
									useCardEvent.insertAfter(useJiu);
								} else {
									await useJiu();
								}
							}
						},
					},
//#noname-kit-end skill:jieboluo_qiexing_damage
//#noname-kit-begin skill:jieboluo_qicai
					"jieboluo_qicai": {
						trigger: { player: "useCardAfter" },
						mark: true,
						marktext: "才",
						intro: {
							markcount: "expansion",
							mark(dialog, storage, player) {
								const cards = player.getExpansions("jieboluo_qicai");
								if (cards.length) {
									dialog.addSmall(cards);
								} else {
									dialog.addText("当前没有“才”");
								}
							},
							content(storage, player) {
								return "“才”置于你的武将牌上；移去“才”后可摸等量张牌";
							},
						},
						getCards(event, player) {
							const card = event.card;
							if (!card || get.type(card) == "basic") {
								return [];
							}
							return (event.cards || []).filter((current) => get.itemtype(current) === "card");
						},
						filter(event, player) {
							return lib.skill["jieboluo_qicai"].getCards(event, player).length > 0;
						},
						check(event, player) {
							return true;
						},
						async content(event, trigger, player) {
							const skill = lib.skill["jieboluo_qicai"];
							const cards = skill.getCards(trigger, player);
							if (!cards.length) {
								return;
							}
							const outside = cards.filter((card) => get.position(card, true) != "h");
							if (outside.length) {
								await player.gain(outside, "gain2");
							}
							const list = cards.filter((card) => get.position(card, true) == "h");
							if (!list.length) {
								return;
							}
							const next = player.addToExpansion(list, "gain2", player);
							next.gaintag.add("jieboluo_qicai");
							await next;
							const cai = player.getExpansions("jieboluo_qicai");
							if (!cai.length) {
								return;
							}
							const result = await player
								.chooseButton(["奇才：你可以移去任意张“才”，然后摸等量张牌", cai], [1, cai.length])
								.set("ai", (button) => {
									const player2 = get.player();
									return player2.countCards("h") < player2.hp ? 1 : 0;
								})
								.forResult();
							if (!result.bool || !result.links || !result.links.length) {
								return;
							}
							const removed = result.links.slice(0);
							await player.loseToDiscardpile(removed);
							await player.draw(removed.length);
						},
					},
//#noname-kit-end skill:jieboluo_qicai
//#noname-kit-begin skill:jieboluo_jizhi
					"jieboluo_jizhi": {
						locked: true,
						forced: true,
						getCai(player) {
							return player.getExpansions("jieboluo_qicai").length;
						},
						mod: {
							maxHandcard(player, num) {
								return num + lib.skill["jieboluo_jizhi"].getCai(player);
							},
							globalFrom(from, to, distance) {
								return distance - lib.skill["jieboluo_jizhi"].getCai(from);
							},
							cardUsable(card, player, num) {
								if (get.name(card) == "sha") {
									return num + lib.skill["jieboluo_jizhi"].getCai(player);
								}
							},
						},
					},
//#noname-kit-end skill:jieboluo_jizhi
//#noname-kit-begin skill:jieboluo_keji
					"jieboluo_keji": {
						trigger: { player: "phaseDiscardBegin" },
						getNum(player) {
							return player.hasSkill("jieboluo_dujiang_double") ? 2 : 1;
						},
						filter(event, player) {
							if (player.getHistory("useCard", (evt) => evt.card && get.name(evt.card) == "sha").length) {
								return false;
							}
							return player.countDiscardableCards(player, "he") >= lib.skill["jieboluo_keji"].getNum(player);
						},
						check(event, player) {
							return player.needsToDiscard() || player.countCards("he") > player.hp + 1;
						},
						async cost(event, trigger, player) {
							const need = lib.skill["jieboluo_keji"].getNum(player);
							event.result = await player
								.chooseToDiscard({
									prompt: "克己：弃置" + (need === 2 ? "两" : "一") + "张牌，将弃牌阶段改为摸牌阶段",
									position: "he",
									selectCard: need,
									ai(card) {
										return 6 - get.value(card);
									},
								})
								.forResult();
						},
						async content(event, trigger, player) {
							trigger.cancel();
							const phaseEvent = trigger.getParent("phase");
							if (phaseEvent && Array.isArray(phaseEvent.phaseList) && typeof phaseEvent.num === "number") {
								phaseEvent.phaseList.splice(phaseEvent.num + 1, 0, "phaseDraw|" + event.name);
							} else {
								await player.draw(2);
							}
						},
					},
//#noname-kit-end skill:jieboluo_keji
//#noname-kit-begin skill:jieboluo_botu
					"jieboluo_botu": {
						trigger: { player: "phaseEnd" },
						getMax(player) {
							return player.hasSkill("jieboluo_dujiang_double") ? 2 : 1;
						},
						countSuits() {
							const suits = [];
							const addSuit = (card) => {
								const suit = get.suit(card, false);
								if (suit && !suits.includes(suit)) {
									suits.push(suit);
								}
							};
							game.getGlobalHistory("cardMove", (evt) => {
								if (suits.length >= 4) {
									return;
								}
								if (evt.name == "lose") {
									if (evt.position == ui.discardPile) {
										for (const card of evt.cards || []) {
											addSuit(card);
										}
									}
								} else if (evt.name == "cardsDiscard") {
									for (const card of evt.cards || []) {
										addSuit(card);
									}
								}
							});
							return suits.length;
						},
						filter(event, player) {
							if (player.countMark("jieboluo_botu_used") >= lib.skill["jieboluo_botu"].getMax(player)) {
								return false;
							}
							return lib.skill["jieboluo_botu"].countSuits() >= 3;
						},
						check(event, player) {
							return true;
						},
						async content(event, trigger, player) {
							player.addTempSkill("jieboluo_botu_used", "roundStart");
							player.addMark("jieboluo_botu_used", 1, false);
							player.insertPhase();
						},
					},
//#noname-kit-end skill:jieboluo_botu
//#noname-kit-begin skill:jieboluo_botu_used
					"jieboluo_botu_used": {
						charlotte: true,
						onremove: true,
						mark: true,
						marktext: "图",
						intro: {
							content: "本轮已发动〖博图〗#次",
						},
					},
//#noname-kit-end skill:jieboluo_botu_used
//#noname-kit-begin skill:jieboluo_dujiang
					"jieboluo_dujiang": {
						limited: true,
						trigger: { player: "phaseZhunbeiBegin" },
						filter(event, player) {
							return !player.hasSkill("jieboluo_dujiang_double");
						},
						check(event, player) {
							return player.maxHp > 2;
						},
						async content(event, trigger, player) {
							player.awakenSkill(event.name);
							await player.loseMaxHp();
							player.addSkill("jieboluo_dujiang_double");
						},
					},
//#noname-kit-end skill:jieboluo_dujiang
//#noname-kit-begin skill:jieboluo_dujiang_double
					"jieboluo_dujiang_double": {
						charlotte: true,
						mark: true,
						marktext: "渡",
						intro: {
							content: "〖克己〗需弃置两张牌；〖博图〗每轮限两次",
						},
					},
//#noname-kit-end skill:jieboluo_dujiang_double
//#noname-kit-begin skill:jieboluo_lijian
					"jieboluo_lijian": {
						enable: "phaseUse",
						usable: 1,
						init(player) {
							player.addSkill("jieboluo_lijian_record");
						},
						onremove(player) {
							player.removeSkill("jieboluo_lijian_record");
							delete player.storage["jieboluo_lijian_winner"];
							delete player.storage["jieboluo_lijian_pending"];
						},
						filter(event, player) {
							if (!player.countDiscardableCards(player, "he")) {
								return false;
							}
							return game.countPlayer((current) => current != player && current.sex == "male" && current.isAlive()) >= 2;
						},
						async content(event, trigger, player) {
							const discard = await player
								.chooseToDiscard({
									prompt: "离间：弃置任意张牌，令一名男性角色视为对另一名男性角色使用【决斗】",
									position: "he",
									selectCard: [1, Infinity],
									forced: true,
									ai(card) {
										return 6 - get.value(card);
									},
								})
								.forResult();
							if (!discard.bool || !discard.cards || !discard.cards.length) {
								return;
							}
							const cards = discard.cards.slice(0);
							const juedou = get.autoViewAs({ name: "juedou", isCard: true });
							const first = await player
								.chooseTarget(
									"离间：选择视为使用【决斗】的男性角色",
									(card, player2, target) => {
										if (target == player2 || target.sex != "male" || !target.isAlive()) {
											return false;
										}
										return game.hasPlayer((current) => {
											return (
												current != player2 &&
												current != target &&
												current.sex == "male" &&
												current.isAlive() &&
												target.canUse(get.event().juedouCard, current)
											);
										});
									},
									true
								)
								.set("juedouCard", juedou)
								.set("ai", (target) => {
									const player2 = get.event().player;
									const att = get.attitude(player2, target);
									return att < 0 ? target.hp : -target.hp;
								})
								.forResult();
							if (!first.bool || !first.targets || !first.targets.length) {
								return;
							}
							const source = first.targets[0];
							const second = await player
								.chooseTarget(
									"离间：选择【决斗】的目标",
									(card, player2, target) => {
										const src = get.event().source;
										if (!src || target == player2 || target == src || target.sex != "male" || !target.isAlive()) {
											return false;
										}
										return src.canUse(get.event().juedouCard, target);
									},
									true
								)
								.set("source", source)
								.set("juedouCard", juedou)
								.set("ai", (target) => {
									const player2 = get.event().player;
									const att = get.attitude(player2, target);
									return att < 0 ? 2 - target.hp : target.hp - 2;
								})
								.forResult();
							if (!second.bool || !second.targets || !second.targets.length) {
								return;
							}
							const target = second.targets[0];
							player.line(source, "green");
							player.line(target, "green");
							delete player.storage["jieboluo_lijian_winner"];
							player.storage["jieboluo_lijian_pending"] = true;
							await source.useCard(juedou, target, false);
							delete player.storage["jieboluo_lijian_pending"];
							const winner = player.storage["jieboluo_lijian_winner"];
							delete player.storage["jieboluo_lijian_winner"];
							if (!winner || (winner != source && winner != target) || !winner.isAlive()) {
								return;
							}
							const pool = cards.filter((card) => {
								if (get.itemtype(card) != "card") {
									return false;
								}
								if (get.position(card, true) == "d") {
									return true;
								}
								return card.parentNode == ui.discardPile;
							});
							if (!pool.length) {
								return;
							}
							game.log(winner, "获得了", pool, "（离间）");
							await winner.gain(pool, "gain2");
						},
						ai: {
							order: 6,
							result: { player: 1 },
						},
					},
//#noname-kit-end skill:jieboluo_lijian
//#noname-kit-begin skill:jieboluo_lijian_record
					"jieboluo_lijian_record": {
						charlotte: true,
						popup: false,
						forced: true,
						silent: true,
						trigger: { global: "damage" },
						filter(event, player) {
							return !!player.storage["jieboluo_lijian_pending"];
						},
						content(event, trigger, player) {
							if (trigger.source) {
								player.storage["jieboluo_lijian_winner"] = trigger.source;
							}
						},
					},
//#noname-kit-end skill:jieboluo_lijian_record
//#noname-kit-begin skill:jieboluo_biyue
					"jieboluo_biyue": {
						trigger: { player: "phaseEnd" },
						getAreas(player) {
							return ["h", "e", "j"].filter((area) => {
								const num = player.countCards(area);
								return !game.hasPlayer((current) => current != player && current.countCards(area) < num);
							});
						},
						getAreaText(areas) {
							const names = { h: "手牌区", e: "装备区", j: "判定区" };
							return areas.map((area) => names[area] || area).join("、");
						},
						filter(event, player) {
							return lib.skill["jieboluo_biyue"].getAreas(player).length > 0;
						},
						prompt2(event, player) {
							const skill = lib.skill["jieboluo_biyue"];
							const areas = skill.getAreas(player);
							return "摸" + get.cnNumber(areas.length) + "张牌（" + skill.getAreaText(areas) + "为全场最少）";
						},
						async content(event, trigger, player) {
							const skill = lib.skill["jieboluo_biyue"];
							const areas = skill.getAreas(player);
							if (!areas.length) {
								return;
							}
							game.log(player, "闭月：", skill.getAreaText(areas), "的牌数为全场最少");
							await player.draw(areas.length);
						},
					},
//#noname-kit-end skill:jieboluo_biyue
				},
				translate: {
//#noname-kit-begin translate:jieboluo_xiaoguo
					"jieboluo_xiaoguo": "骁果",
					"jieboluo_xiaoguo_info": "其他角色的准备阶段开始时，你可以失去一点体力上限或弃置一张【杀】，视为对其使用【决斗】。",
//#noname-kit-end translate:jieboluo_xiaoguo
//#noname-kit-begin translate:jieboluo_xiandeng
					"jieboluo_xiandeng": "先登",
					"jieboluo_xiandeng_info": "当使用者为你的牌对未受伤的角色造成伤害时，你可以摸两张牌。",
//#noname-kit-end translate:jieboluo_xiandeng
//#noname-kit-begin translate:jieboluo_wusheng
					"jieboluo_wusheng": "武圣",
					"jieboluo_wusheng_info": "当你需要使用或打出【杀】时，你可以将一张红色牌当作【杀】使用或打出。每轮你首次造成伤害时，受伤角色可以交给你一张红色牌，令此伤害-1。",
//#noname-kit-end translate:jieboluo_wusheng
//#noname-kit-begin translate:jieboluo_qiexing
					"jieboluo_qiexing": "且行",
					"jieboluo_qiexing_info": "出牌阶段限一次，你可以视为使用【决斗】或【酒】中的一张牌（【酒】不计入次数限制）。本回合你下一次造成伤害后，视为使用另一张牌。",
//#noname-kit-end translate:jieboluo_qiexing
//#noname-kit-begin translate:jieboluo_qicai
					"jieboluo_qicai": "奇才",
					"jieboluo_qicai_info": "你使用非基本牌后，你可以将此牌的实体牌置于武将牌上，称为“才”。然后你可以移去任意张“才”，将这些牌置入弃牌堆并摸等量张牌。",
//#noname-kit-end translate:jieboluo_qicai
//#noname-kit-begin translate:jieboluo_jizhi
					"jieboluo_jizhi": "集智",
					"jieboluo_jizhi_info": "锁定技，你使用【杀】的次数上限、手牌上限均+X，你计算与其他角色的距离-X（X为你的“才”数量）。",
//#noname-kit-end translate:jieboluo_jizhi
//#noname-kit-begin translate:jieboluo_keji
					"jieboluo_keji": "克己",
					"jieboluo_keji_info": "弃牌阶段开始时，若你本回合未使用过【杀】，你可以弃置一张牌，将此阶段改为摸牌阶段。",
//#noname-kit-end translate:jieboluo_keji
//#noname-kit-begin translate:jieboluo_botu
					"jieboluo_botu": "博图",
					"jieboluo_botu_info": "每轮限一次，你的回合结束时，若本回合至少三个花色进入过弃牌堆，你可以执行一个额外回合。",
//#noname-kit-end translate:jieboluo_botu
//#noname-kit-begin translate:jieboluo_botu_used
					"jieboluo_botu_used": "博图",
//#noname-kit-end translate:jieboluo_botu_used
//#noname-kit-begin translate:jieboluo_dujiang
					"jieboluo_dujiang": "渡江",
					"jieboluo_dujiang_info": "限定技，准备阶段，你可以减一点体力上限，然后将〖克己〗〖博图〗中的首个数字翻倍。",
//#noname-kit-end translate:jieboluo_dujiang
//#noname-kit-begin translate:jieboluo_dujiang_double
					"jieboluo_dujiang_double": "渡江",
//#noname-kit-end translate:jieboluo_dujiang_double
//#noname-kit-begin translate:jieboluo_lijian
					"jieboluo_lijian": "离间",
					"jieboluo_lijian_info": "出牌阶段限一次，你可以弃置任意张牌，令一名男性角色视为对另一名你选择的男性角色使用【决斗】，赢的角色获得你弃置的牌。",
//#noname-kit-end translate:jieboluo_lijian
//#noname-kit-begin translate:jieboluo_lijian_record
					"jieboluo_lijian_record": "离间",
//#noname-kit-end translate:jieboluo_lijian_record
//#noname-kit-begin translate:jieboluo_biyue
					"jieboluo_biyue": "闭月",
					"jieboluo_biyue_info": "你的回合结束时，你每有一个区域的牌为全场最少，你便可以摸一张牌。",
//#noname-kit-end translate:jieboluo_biyue
				},
			},
			author: "芝士",
			version: "1.0",
		},
		editable: false,
		connect: true,
	};
});
