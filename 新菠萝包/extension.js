game.import("extension", function (lib, game, ui, get, ai, _status) {
	return {
		name: "新菠萝包",
		content: function (config, pack) {
			const imageDir = "extension/新菠萝包/image";
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
				console.warn("[新菠萝包] 读取 image/ 目录失败：", e);
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
		precontent: function () {},
		arenaReady: function () {},
		help: {},
		config: {},
		package: {
			character: {
				character: {
//#noname-kit-begin character:boluo12_zhugejin
					"boluo12_zhugejin": {
						sex: "male",
						group: "wu",
						hp: 3,
						skills: ["boluo12_hongyuan", "boluo12_taozhou", "boluo12_mingzhe"],
					},
//#noname-kit-end character:boluo12_zhugejin
//#noname-kit-begin character:boluo12_litong
					"boluo12_litong": {
						sex: "male",
						group: "wei",
						hp: 4,
						skills: ["boluo12_tuifeng"],
					},
//#noname-kit-end character:boluo12_litong
				},
				translate: {
					"boluo12_zhugejin": "诸葛瑾",
					"boluo12_litong": "李通",
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
//#noname-kit-begin skill:boluo12_hongyuan
					"boluo12_hongyuan": {
						trigger: { player: "gainAfter", global: "loseAsyncAfter" },
						filter(event, player) {
							if (player.hasSkill("boluo12_hongyuan_blocker")) {
								return false;
							}
							if (!player.countCards("he")) {
								return false;
							}
							if (!game.hasPlayer((current) => current != player && current.isAlive())) {
								return false;
							}
							return event.getg(player).length >= 2;
						},
						async content(event, trigger, player) {
							player.addTempSkill("boluo12_hongyuan_blocker", [
								"phaseZhunbeiBefore",
								"phaseJudgeBefore",
								"phaseDrawBefore",
								"phaseUseBefore",
								"phaseDiscardBefore",
								"phaseJieshuBefore",
								"phaseBefore",
							]);
							const used = [];
							while (
								used.length < 3 &&
								player.countCards("he") &&
								game.hasPlayer((current) => current != player && current.isAlive() && !used.includes(current))
							) {
								const result = await player
									.chooseCardTarget({
										prompt: "弘援：将一张牌交给一名其他角色（至多三名，每名各一张）",
										filterCard: true,
										position: "he",
										filterTarget(card, player2, target) {
											return target != player2 && target.isAlive() && !get.event().usedTargets.includes(target);
										},
										complexCard: true,
										complexTarget: true,
										complexSelect: true,
										ai1(card) {
											const player2 = get.event().player;
											const usedTargets = get.event().usedTargets;
											const hasFriend = game.hasPlayer(
												(current) =>
													current != player2 &&
													!usedTargets.includes(current) &&
													get.attitude(player2, current) > 0 &&
													!current.hasSkillTag("nogain")
											);
											if (!hasFriend) {
												return -get.value(card);
											}
											return 4 - Math.max(player2.getUseValue(card), get.value(card, player2));
										},
										ai2(target) {
											const player2 = get.event().player;
											const att = get.attitude(player2, target);
											if (!ui.selected.cards.length) {
												return att;
											}
											const card = ui.selected.cards[0];
											const val = get.value(card, target);
											if (val < 0) {
												return -att * Math.sqrt(-val);
											}
											return att * Math.sqrt(val + 2);
										},
									})
									.set("usedTargets", used)
									.forResult();
								if (!result.bool) {
									break;
								}
								const target = result.targets[0];
								used.push(target);
								player.line(target);
								await player.give(result.cards, target);
							}
						},
						ai: { threaten: 0.8 },
					},
//#noname-kit-end skill:boluo12_hongyuan
//#noname-kit-begin skill:boluo12_hongyuan_blocker
					"boluo12_hongyuan_blocker": {
						charlotte: true,
						onremove: true,
					},
//#noname-kit-end skill:boluo12_hongyuan_blocker
//#noname-kit-begin skill:boluo12_taozhou
					"boluo12_taozhou": {
						trigger: { player: "phaseJieshuBegin" },
						init(player) {
							player.addSkill("boluo12_taozhou_record");
						},
						onremove(player) {
							player.removeSkill("boluo12_taozhou_record");
						},
						filter(event, player) {
							return game.hasPlayer(
								(current) => current != player && lib.skill["boluo12_taozhou_record"].getCount(player, current) > 0
							);
						},
						check(event, player) {
							return game.hasPlayer((current) => {
								return (
									current != player &&
									lib.skill["boluo12_taozhou_record"].getCount(player, current) > 0 &&
									get.attitude(player, current) < 0 &&
									current.countGainableCards(player, "he") > 0
								);
							});
						},
						async cost(event, trigger, player) {
							event.result = await player
								.chooseTarget(
									"讨州：选择一名角色，获得其X张牌（X为其获得你的牌的次数），然后重置其X的记录",
									(card, player2, target) => {
										return target != player2 && lib.skill["boluo12_taozhou_record"].getCount(player2, target) > 0;
									}
								)
								.set("ai", (target) => {
									const player2 = get.event().player;
									const num = Math.min(
										lib.skill["boluo12_taozhou_record"].getCount(player2, target),
										target.countGainableCards(player2, "he")
									);
									if (num <= 0) {
										return 0;
									}
									const att = get.attitude(player2, target);
									return att < 0 ? num * 2 : -num;
								})
								.forResult();
						},
						async content(event, trigger, player) {
							const skill = lib.skill["boluo12_taozhou_record"];
							const target = event.targets[0];
							const num = Math.min(skill.getCount(player, target), target.countGainableCards(player, "he"));
							if (num > 0) {
								await player.gainPlayerCard(target, "he", num, true);
							}
							skill.setCount(player, target, 0);
						},
					},
//#noname-kit-end skill:boluo12_taozhou
//#noname-kit-begin skill:boluo12_taozhou_record
					"boluo12_taozhou_record": {
						charlotte: true,
						popup: false,
						forced: true,
						silent: true,
						mark: true,
						marktext: "欠",
						intro: {
							mark(dialog, storage, player) {
								if (game.me !== player) {
									return;
								}
								const skill = lib.skill["boluo12_taozhou_record"];
								const targets = game
									.filterPlayer((current) => current != player && skill.getCount(player, current) > 0)
									.sortBySeat();
								if (!targets.length) {
									dialog.addText("当前没有角色欠牌");
									return;
								}
								for (const target of targets) {
									dialog.addText(get.translation(target) + "：" + skill.getCount(player, target) + " 张");
								}
							},
							content(storage, player) {
								return "记录每名角色获得你的牌的次数（即其欠你的牌数），仅你可见";
							},
						},
						getCount(player, target) {
							if (!target) {
								return 0;
							}
							const records = player.storage["boluo12_taozhou_record"];
							if (!records) {
								return 0;
							}
							return records[target.playerid] || 0;
						},
						setCount(player, target, num) {
							const skill = lib.skill["boluo12_taozhou_record"];
							if (!player.storage["boluo12_taozhou_record"]) {
								player.storage["boluo12_taozhou_record"] = {};
							}
							player.storage["boluo12_taozhou_record"][target.playerid] = num;
							skill.update(player);
						},
						update(player) {
							const id = "boluo12_taozhou_record";
							const skill = lib.skill[id];
							const hasAny = game.hasPlayer((current) => current != player && skill.getCount(player, current) > 0);
							if (hasAny) {
								player.markSkill(id);
								player.updateMark(id);
							} else {
								player.unmarkSkill(id);
							}
						},
						trigger: { global: "gainAfter" },
						filter(event, player) {
							const gainer = event.player;
							if (!gainer || gainer == player) {
								return false;
							}
							const evt = event.getl(player);
							return !!(evt && evt.cards2 && evt.cards2.length);
						},
						content(event, trigger, player) {
							const skill = lib.skill["boluo12_taozhou_record"];
							const gainer = trigger.player;
							if (!gainer) {
								return;
							}
							skill.setCount(player, gainer, skill.getCount(player, gainer) + 1);
						},
					},
//#noname-kit-end skill:boluo12_taozhou_record
//#noname-kit-begin skill:boluo12_mingzhe
					"boluo12_mingzhe": {
						trigger: {
							player: "loseAfter",
							global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
						},
						getCards(event, player) {
							const evt = event.getl(player);
							if (!evt || !evt.cards2) {
								return [];
							}
							return evt.cards2.filter((card) => get.color(card, player) == "red");
						},
						filter(event, player) {
							if (player.isPhaseUsing()) {
								return false;
							}
							return lib.skill["boluo12_mingzhe"].getCards(event, player).length > 0;
						},
						check(event, player) {
							return true;
						},
						async content(event, trigger, player) {
							const cards = lib.skill["boluo12_mingzhe"].getCards(trigger, player);
							if (cards.length && !trigger.visible) {
								await player.showCards(cards, get.translation(player) + "发动了【明哲】");
							}
							await player.draw(1);
						},
					},
//#noname-kit-end skill:boluo12_mingzhe
//#noname-kit-begin skill:boluo12_tuifeng
					"boluo12_tuifeng": {
						enable: "phaseUse",
						prompt: "重铸两张牌，若本次重铸的【杀】数量多于本回合上一次且不为0，视为使用【决斗】",
						position: "he",
						selectCard: 2,
						lose: false,
						discard: false,
						delay: false,
						init(player) {
							player.addSkill("boluo12_tuifeng_record");
						},
						onremove(player) {
							player.removeSkill("boluo12_tuifeng_record");
						},
						getLast(player) {
							const last = player.storage["boluo12_tuifeng_last"];
							return typeof last == "number" ? last : -1;
						},
						getNeed(player) {
							const last = lib.skill["boluo12_tuifeng"].getLast(player);
							return last < 0 ? 0 : last + 1;
						},
						filterCard(card, player) {
							return player.canRecast(card);
						},
						filter(event, player) {
							const skill = lib.skill["boluo12_tuifeng"];
							const need = skill.getNeed(player);
							if (need > 2) {
								return false;
							}
							const recastable = player.getCards("he").filter((card) => player.canRecast(card));
							if (recastable.length < 2) {
								return false;
							}
							if (need <= 0) {
								return true;
							}
							return recastable.filter((card) => get.name(card) == "sha").length >= need;
						},
						check(card) {
							const player = get.player();
							const need = lib.skill["boluo12_tuifeng"].getNeed(player);
							if (need > 0) {
								return get.name(card) == "sha" ? 12 - get.value(card) : 0;
							}
							return 6 - get.value(card);
						},
						async content(event, trigger, player) {
							const skill = lib.skill["boluo12_tuifeng"];
							const need = skill.getNeed(player);
							const cards = (event.cards || []).slice(0);
							const shaNum = cards.filter((card) => get.name(card) == "sha").length;
							if (cards.length != 2 || shaNum < need) {
								game.log(player, "推锋：本次重铸的【杀】数量不足，未发动");
								return;
							}
							await player.recast(cards);
							player.storage["boluo12_tuifeng_last"] = shaNum;
							if (shaNum <= 0) {
								return;
							}
							const juedou = get.autoViewAs({ name: "juedou", isCard: true });
							if (game.hasPlayer((current) => current != player && player.canUse(juedou, current))) {
								await player.chooseUseTarget(juedou, true);
							}
						},
						ai: {
							order: 5,
							result: { player: 1 },
						},
					},
//#noname-kit-end skill:boluo12_tuifeng
//#noname-kit-begin skill:boluo12_tuifeng_record
					"boluo12_tuifeng_record": {
						charlotte: true,
						popup: false,
						forced: true,
						silent: true,
						trigger: { player: "phaseAfter" },
						content(event, trigger, player) {
							delete player.storage["boluo12_tuifeng_last"];
						},
					},
//#noname-kit-end skill:boluo12_tuifeng_record
				},
				translate: {
//#noname-kit-begin translate:boluo12_hongyuan
					"boluo12_hongyuan": "弘援",
					"boluo12_hongyuan_info": "每阶段限一次，当你一次性获得至少两张牌后，你可以将至多三张牌分别交给至多三名其他角色（每名角色各一张）。",
//#noname-kit-end translate:boluo12_hongyuan
//#noname-kit-begin translate:boluo12_hongyuan_blocker
					"boluo12_hongyuan_blocker": "弘援",
//#noname-kit-end translate:boluo12_hongyuan_blocker
//#noname-kit-begin translate:boluo12_taozhou
					"boluo12_taozhou": "讨州",
					"boluo12_taozhou_info": "结束阶段，你可以获得一名角色X张牌（X为其获得你的牌的次数，不足则全获得），然后重置其X的记录。",
//#noname-kit-end translate:boluo12_taozhou
//#noname-kit-begin translate:boluo12_taozhou_record
					"boluo12_taozhou_record": "讨州",
//#noname-kit-end translate:boluo12_taozhou_record
//#noname-kit-begin translate:boluo12_mingzhe
					"boluo12_mingzhe": "明哲",
					"boluo12_mingzhe_info": "当你于出牌阶段外失去红色牌时，你可以展示之，然后摸一张牌。",
//#noname-kit-end translate:boluo12_mingzhe
//#noname-kit-begin translate:boluo12_tuifeng
					"boluo12_tuifeng": "推锋",
					"boluo12_tuifeng_info": "出牌阶段，你可以重铸两张牌；若本回合已发动过此技能，则本次重铸的牌中【杀】的数量须多于上一次。若本次重铸的【杀】数量不为0，你视为使用一张【决斗】。",
//#noname-kit-end translate:boluo12_tuifeng
//#noname-kit-begin translate:boluo12_tuifeng_record
					"boluo12_tuifeng_record": "推锋",
//#noname-kit-end translate:boluo12_tuifeng_record
				},
			},
			author: "芝士",
			version: "1.0",
		},
		editable: false,
		connect: true,
	};
});
