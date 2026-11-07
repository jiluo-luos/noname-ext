game.import("extension", function (lib, game, ui, get, ai, _status) {
	const SKILL_XUANFENG = "jiepangnu_xuanfeng";
	const SKILL_SWAP = "jiepangnu_xuanfeng_swap";
	const SKILL_YONGJIN = "jiepangnu_yongjin";

	// ── 「旋」区（置于武将牌上的另一套装备区） ──
	// 以 gaintag 为准，并兼容“牌确实在武将牌上但标签丢失”的情况（用 storage 记录兼底）
	function getXuan(player) {
		const list = player.storage.jiepangnu_xuanfeng_list || [];
		return player.getCards("x", function (card) {
			return card.hasGaintag(SKILL_XUANFENG) || list.includes(card);
		});
	}

	function countXuan(player) {
		return getXuan(player).length;
	}

	// 当前生效装备区里的牌：显示牌（nodes）与实体牌（phys）
	function getEquipAreaCards(player) {
		const nodes = player.getCards("e");
		const phys = [];
		for (const node of nodes) {
			const vcard = node.cardSymbol ? node[node.cardSymbol] : null;
			const cards = vcard && vcard.cards;
			if (cards && cards.length) {
				for (const card of cards) {
					if (!phys.includes(card)) {
						phys.push(card);
					}
				}
			} else if (!phys.includes(node)) {
				phys.push(node);
			}
		}
		return { nodes: nodes, phys: phys };
	}

	// 正背面两套装备区对调：卸下的牌置于武将牌上称「旋」，原「旋」牌依次置入装备区
	async function swapEquipArea(player) {
		if (!player.isAlive()) {
			return;
		}
		// 换套前的装备区牌数（换套结束后由〖勇进〗按净变化检索）
		const beforeCount = player.countCards("e");
		const area = getEquipAreaCards(player);
		const xuan = getXuan(player);
		// 木牛流马一类：下方牌随牌暂存，避免装备牌离场时被弃置
		const stash = [];
		for (const card of area.phys) {
			if (Array.isArray(card.storages) && card.storages.length) {
				stash.push([card, card.storages]);
				card.storages = [];
			}
		}
		// 换套不判定〖勇进〗
		player.storage.jiepangnu_yongjin_swapping = true;
		try {
			// 1. 当前生效那一套离开装备区，置于武将牌上称为「旋」
			if (area.nodes.length) {
				await player.lose(area.nodes, ui.special);
			}
			if (area.phys.length) {
				await player.addToExpansion(area.phys, player, "giveAuto").set("gaintag", [SKILL_XUANFENG]);
				const added = area.phys.filter(function (card) {
					return get.position(card, true) == "x";
				});
				if (added.length) {
					player.storage.jiepangnu_xuanfeng_list = added.slice(0);
				} else {
					// 自检：牌没落到武将牌上就放回装备区，绝不让牌丢失
					game.log(player, "【旋风】「旋」置入异常，已把牌放回装备区");
					delete player.storage.jiepangnu_xuanfeng_list;
					player.directequip(area.phys);
				}
			}
			// 2. 原「旋」依次置入装备区（未启用的装备栏不能置入，留在「旋」里）
			const move = [];
			for (const card of xuan) {
				if (!player.canEquip(card, true)) {
					continue;
				}
				card.removeGaintag(SKILL_XUANFENG);
				move.push(card);
			}
			if (move.length) {
				await game.cardsGotoSpecial(move);
				for (const card of move) {
					await player.equip(card);
				}
				const rest = (player.storage.jiepangnu_xuanfeng_list || []).filter(function (card) {
					return !move.includes(card);
				});
				if (rest.length) {
					player.storage.jiepangnu_xuanfeng_list = rest;
				} else {
					delete player.storage.jiepangnu_xuanfeng_list;
				}
			}
		} finally {
			for (const pair of stash) {
				pair[0].storages = pair[1];
			}
			delete player.storage.jiepangnu_yongjin_swapping;
		}
		player.markSkill(SKILL_XUANFENG);
		if (
			player.countVCards("e", function (card) {
				return card.name == "muniu";
			})
		) {
			player.markSkill("muniu_skill");
		}
		const afterCount = player.countCards("e");
		game.log(
			player,
			"对调了两套装备区（旋" + countXuan(player) + "张 / 装备区" + afterCount + "张）"
		);
		// 换套结算完毕后按装备区牌数的净变化检索〖勇进〗（减少才判定）
		if (afterCount < beforeCount && player.isAlive() && player.hasSkill(SKILL_YONGJIN)) {
			await yongjinEffect(player);
		}
	}

	// ── 〖勇进〗相关 ──
	// 本次结算中该角色离开装备区的牌：
	// 单独失去时 getl 返回事件自身；被获得/异步失去时 getl 汇总子事件；
	// 替换装备产生的失去带 getlx=false，getl 返回空表，因此不判定。
	function getLostEquipCards(event, player) {
		if (typeof event.getl != "function") {
			return [];
		}
		const map = event.getl(player);
		return map && map.es ? map.es.slice() : [];
	}

	// 本回合进入弃牌堆、且当前仍在弃牌堆的牌
	function getTurnDiscardPile(filter) {
		const inPile = Array.from(ui.discardPile.childNodes);
		const result = [];
		const history = game.getGlobalHistory("cardMove", function (evt) {
			if (evt.name == "lose") {
				return evt.position == ui.discardPile;
			}
			return evt.name == "cardsDiscard";
		});
		for (const evt of history) {
			const cards = evt.cards || [];
			for (const card of cards) {
				if (!inPile.includes(card)) {
					continue;
				}
				if (result.includes(card)) {
					continue;
				}
				if (filter && !filter(card)) {
					continue;
				}
				result.push(card);
			}
		}
		return result;
	}

	function getTurnBasicCards() {
		return getTurnDiscardPile(function (card) {
			return get.type(card) == "basic";
		});
	}

	function canBeDiscardedBy(target, player) {
		return target != player && target.countDiscardableCards(player, "he") > 0;
	}

	// 〖勇进〗的效果本体：弃置至多两名其他角色共计两张牌，或获得一张本回合进弃牌堆的基本牌
	async function yongjinEffect(player) {
		const textDiscard = "弃置至多两名其他角色共计两张牌";
		const textGain = "获得一张本回合进入弃牌堆的基本牌";
		const options = [];
		if (
			game.hasPlayer(function (current) {
				return canBeDiscardedBy(current, player);
			})
		) {
			options.push(textDiscard);
		}
		if (getTurnBasicCards().length) {
			options.push(textGain);
		}
		if (!options.length) {
			return;
		}
		const controls = options.slice();
		controls.push("cancel2");
		const result = await player
			.chooseControl(controls)
			.set("prompt", get.prompt(SKILL_YONGJIN))
			.set(
				"prompt2",
				lib.translate[SKILL_YONGJIN + "_info"] ||
					"你可弃置至多两名其他角色共计两张牌，或从本回合弃牌堆中获得一张基本牌。"
			)
			.set("ai", function () {
				return options[0];
			})
			.forResult();
		if (!result || result.control == "cancel2") {
			return;
		}
		if (result.control == textGain) {
			const cards = getTurnBasicCards();
			if (!cards.length) {
				return;
			}
			const choose = await player
				.chooseButton(["勇进：选择一张基本牌获得", cards], true)
				.set("ai", get.buttonValue)
				.forResult();
			if (choose && choose.bool && choose.links && choose.links.length) {
				await player.gain(choose.links, "gain2");
			}
			return;
		}
		for (let i = 0; i < 2; i++) {
			if (
				!game.hasPlayer(function (current) {
					return canBeDiscardedBy(current, player);
				})
			) {
				break;
			}
			const choose = await player
				.chooseTarget("勇进：弃置一名其他角色的一张牌（至多两张）", function (card, player2, target) {
					return canBeDiscardedBy(target, player2);
				})
				.set("ai", function (target) {
					return -get.attitude(get.player(), target);
				})
				.forResult();
			if (!choose || !choose.bool || !choose.targets || !choose.targets.length) {
				break;
			}
			player.line(choose.targets[0], "green");
			await player.discardPlayerCard(choose.targets[0], "he", true);
		}
	}

	return {
		name: "一将成名-解构-胖怒",
		content: function (config, pack) {},
		precontent: function () {
			lib.characterSort["一将成名-解构-胖怒"] = {
				jiepangnu_jiang1: ["jiepangnu_lingtong"],
			};
		},
		help: {},
		config: {},
		package: {
			character: {
				character: {
					jiepangnu_lingtong: {
						sex: "male",
						group: "wu",
						hp: 4,
						maxHp: 4,
						skills: [SKILL_XUANFENG, SKILL_YONGJIN],
						img: "extension/一将成名-解构-胖怒/image/jiepangnu_lingtong.jpg",
					},
				},
				translate: {
					jiepangnu_lingtong: "凌统",
					jiepangnu_jiang1: "将一",
				},
			},
			skill: {
				skill: {
					//#noname-kit-begin skill:jiepangnu_xuanfeng
					jiepangnu_xuanfeng: {
						group: [SKILL_SWAP],
						trigger: { player: "useCard" },
						mark: true,
						intro: {
							name: "旋",
							markcount: "expansion",
							mark: function (dialog, content, player) {
								const cards = getXuan(player);
								if (cards.length) {
									dialog.addAuto(cards);
								} else {
									return "没有“旋”";
								}
							},
							content: function (content, player) {
								const cards = getXuan(player);
								if (cards.length) {
									return get.translation(cards);
								}
							},
						},
						filter: function (event, player) {
							return get.type(event.card) == "equip";
						},
						check: function (event, player) {
							// AI：背面那一套不少于正面那一套时才翻面
							return countXuan(player) >= player.countCards("e");
						},
						prompt2: "你可以翻面：翻面后正反面的两套装备区对调",
						onremove: function (player, skill) {
							// 失去〖旋风〗时，「旋」区的牌正常掉落到弃牌堆
							const cards = getXuan(player);
							if (cards.length) {
								game.cardsDiscard(cards);
							}
							player.unmarkSkill(SKILL_XUANFENG);
							delete player.storage.jiepangnu_xuanfeng_list;
							delete player.storage.jiepangnu_xuanfeng_swap;
						},
						async content(event, trigger, player) {
							await player.turnOver();
						},
					},
					//#noname-kit-end skill:jiepangnu_xuanfeng
					//#noname-kit-begin skill:jiepangnu_xuanfeng_swap
					jiepangnu_xuanfeng_swap: {
						trigger: { player: "turnOverAfter" },
						forced: true,
						popup: false,
						init: function (player) {
							// 记录当前装备区里放的是哪一套（front = 正面那一套，back = 反面那一套）
							if (!["front", "back"].includes(player.storage.jiepangnu_xuanfeng_swap)) {
								player.storage.jiepangnu_xuanfeng_swap = "front";
							}
						},
						async content(event, trigger, player) {
							// 检查你现在是正是反：装备区里应当是当前朝上那一面的那一套，不一致才换（幂等，重复触发不会互相抵消）
							const want = player.isTurnedOver() ? "back" : "front";
							const cur = player.storage.jiepangnu_xuanfeng_swap || "front";
							if (cur === want) {
								return;
							}
							await swapEquipArea(player);
							player.storage.jiepangnu_xuanfeng_swap = want;
						},
					},
					//#noname-kit-end skill:jiepangnu_xuanfeng_swap
					//#noname-kit-begin skill:jiepangnu_yongjin
					jiepangnu_yongjin: {
						trigger: { player: ["loseAfter"], global: ["gainAfter", "loseAsyncAfter"] },
						forced: true,
						popup: false,
						filter: function (event, player) {
							// 本次是〖旋风〗换套造成的失去，不判定
							if (player.storage.jiepangnu_yongjin_swapping) {
								return false;
							}
							return getLostEquipCards(event, player).length > 0;
						},
						async content(event, trigger, player) {
							// 死亡结算清场时不判定
							if (player.isDead() || !getLostEquipCards(trigger, player).length) {
								return;
							}
							await yongjinEffect(player);
						},
					},
					//#noname-kit-end skill:jiepangnu_yongjin
				},
				translate: {
					//#noname-kit-begin translate:jiepangnu_xuanfeng
					jiepangnu_xuanfeng: "旋风",
					jiepangnu_xuanfeng_info: "你正反面独立拥有装备区。你使用装备牌时，你可翻面。",
					//#noname-kit-end translate:jiepangnu_xuanfeng
					//#noname-kit-begin translate:jiepangnu_xuanfeng_swap
					jiepangnu_xuanfeng_swap: "旋风",
					jiepangnu_xuanfeng_swap_info:
						"锁定技，你翻面后，你将当前装备区的牌置于武将牌上称为“旋”，然后将“旋”依次置入你的装备区（未启用的装备栏不能置入）。",
					//#noname-kit-end translate:jiepangnu_xuanfeng_swap
					//#noname-kit-begin translate:jiepangnu_yongjin
					jiepangnu_yongjin: "勇进",
					jiepangnu_yongjin_info:
						"你装备区的牌数减少后，你可弃置至多两名其他角色共计两张牌，或从本回合弃牌堆中获得一张基本牌。",
					//#noname-kit-end translate:jiepangnu_yongjin
				},
			},
			author: "",
			version: "1.0",
		},
	};
});
