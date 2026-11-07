import { lib, game, ui, get, _status } from "../../noname.js";

export const type = "extension";

const EXT = "武将管理-高呼吾名玖罗";
const LEGACY_EXT = "武将管理";
const KEY_PRESETS = "ban_presets";
const KEY_OPTIMIZE = "optimize";
const KEY_SWAP = "swap_click";
const KEY_CODEC = "codec";
const CODECS = ["plain", "deflate", "index"];
const CODEC_NAME = { plain: "明文", deflate: "压缩", index: "极短" };
const DBL_DELAY = 230;
const MODE_SKIP = ["connect"];

/* ============ 配置读写 ============ */

function cfgGet(key, def) {
	const value = lib.config[`extension_${EXT}_${key}`];
	return value === undefined || value === null ? def : value;
}

function cfgSet(key, value) {
	game.saveExtensionConfig(EXT, key, value);
}

function migrateConfig() {
	if (LEGACY_EXT === EXT) return;
	for (const key of [KEY_PRESETS, KEY_OPTIMIZE, KEY_SWAP, KEY_CODEC]) {
		const oldKey = `extension_${LEGACY_EXT}_${key}`;
		const newKey = `extension_${EXT}_${key}`;
		if (lib.config[newKey] === undefined && lib.config[oldKey] !== undefined) {
			game.saveConfig(newKey, lib.config[oldKey]);
		}
	}
}

/* ============ 禁将列表 ============ */

function banModes() {
	const all = lib.config.all.mode;
	return Array.isArray(all) ? all.filter(mode => !MODE_SKIP.includes(mode)) : [];
}

function currentMode() {
	let mode;
	try {
		mode = get.mode();
	} catch (error) {
		mode = null;
	}
	return mode || lib.config.mode || "identity";
}

function onlineBanList() {
	if (!_status.connectMode) return null;
	if (!lib.configOL) return null;
	return Array.isArray(lib.configOL.banned) ? lib.configOL.banned : null;
}

function isCharEnabled(id) {
	const online = onlineBanList();
	if (online) return !online.includes(id);
	const list = lib.config[`${currentMode()}_banned`];
	if (!Array.isArray(list)) return true;
	return !list.includes(id);
}

function syncBanAlias() {
	const mode = currentMode();
	if (MODE_SKIP.includes(mode)) return;
	const list = lib.config[`${mode}_banned`];
	if (Array.isArray(list)) lib.config.banned = list;
}

/**
 * 同时改「本机各模式禁将」与「联机房间禁将」：
 * 联机判定看的是 lib.configOL.banned，它引用 lib.config["connect_<模式>_banned"]，
 * 因此必须就地改数组（重建新数组会断开引用，联机里就不生效）。
 */
function eachBanList(callback) {
	for (const mode of banModes()) {
		let list = lib.config[`${mode}_banned`];
		if (!Array.isArray(list)) list = [];
		callback(list);
		game.saveConfig(`${mode}_banned`, list);
		let online = lib.config[`connect_${mode}_banned`];
		if (!Array.isArray(online)) online = [];
		callback(online);
		game.saveConfig(`connect_${mode}_banned`, online);
	}
	// 房主侧：lib.configOL.banned 与 lib.config["connect_<模式>_banned"] 是同一个数组，
	// 上面的就地修改已经同步；客户端侧它是房间副本，不能乱改，故不再覆写。
}

function setCharsEnabled(ids, enabled) {
	if (!Array.isArray(ids) || !ids.length) return;
	eachBanList(list => {
		for (const id of ids) {
			const index = list.indexOf(id);
			if (enabled) {
				if (index >= 0) list.splice(index, 1);
			} else if (index < 0) {
				list.push(id);
			}
		}
	});
	syncBanAlias();
}

function banUniverse() {
	const list = [];
	for (const id in lib.character) {
		const info = lib.character[id];
		if (!info || info.isUnseen || info.isBoss || info.isHiddenBoss || info.isMinskin) continue;
		list.push(id);
	}
	return list;
}

function currentEnabledIds() {
	return banUniverse().filter(isCharEnabled);
}

function applyWhitelist(ids) {
	const keep = new Set(ids);
	const banned = banUniverse().filter(id => !keep.has(id));
	eachBanList(list => {
		list.length = 0;
		for (const id of banned) list.push(id);
	});
	syncBanAlias();
}

function applyBanAll() {
	const all = banUniverse();
	eachBanList(list => {
		list.length = 0;
		for (const id of all) list.push(id);
	});
	syncBanAlias();
	return all.length;
}

/* ============ 武将包 ============ */

function isExtensionPack(packId) {
	return Array.isArray(lib.config.extensions) && lib.config.extensions.includes(packId);
}

function packAvailable(packId) {
	if (!lib.characterPack[packId]) return false;
	if (!isExtensionPack(packId)) return true;
	if (lib.config[`extension_${packId}_enable`] === false) return false;
	if (lib.config[`extension_${packId}_characters_enable`] === false) return false;
	return true;
}

function packDisplayName(packId) {
	return lib.translate[`${packId}_character_config`] || packId;
}

function groupLabel(key) {
	const text = lib.translate[key];
	if (!text) return key;
	const index = text.lastIndexOf("·");
	return index >= 0 ? text.slice(index + 1) : text;
}

function packCharacters(packId) {
	const pack = lib.characterPack[packId];
	if (!pack) return [];
	const list = [];
	for (const id in pack) {
		const info = lib.character[id];
		if (!info || info.isUnseen) continue;
		list.push(id);
	}
	return list;
}

function packGroups(packId) {
	const chars = packCharacters(packId);
	const owned = new Set(chars);
	const sort = lib.characterSort[packId];
	const groups = [];
	const used = new Set();
	if (sort && typeof sort == "object") {
		for (const key in sort) {
			const ids = (sort[key] || []).filter(id => owned.has(id) && !used.has(id));
			if (!ids.length) continue;
			for (const id of ids) used.add(id);
			groups.push({ key, label: groupLabel(key), ids });
		}
	}
	const rest = chars.filter(id => !used.has(id));
	if (rest.length) groups.push({ key: `${packId}_rest`, label: groups.length ? "未分组" : packDisplayName(packId), ids: rest });
	return groups;
}

function packList() {
	const list = [];
	const seen = new Set();
	const push = packId => {
		if (!packId || seen.has(packId) || !lib.characterPack[packId]) return;
		seen.add(packId);
		list.push(packId);
	};
	for (const packId of lib.config.all.characters || []) push(packId);
	for (const packId of Object.keys(lib.characterPack).filter(item => !seen.has(item)).sort()) push(packId);
	return list;
}

/* ============ 主题表 ============ */

const THEME_DEFS = [
	{
		title: "标准包",
		subs: [
			{ title: "官标", whole: ["standard"] },
			{ title: "官界", parts: { refresh: ["refresh_standard"] } },
			{ title: "手界", parts: { mobile: ["mobile_standard"] } },
			{ title: "海外", parts: { tw: ["tw_standard"] } },
		],
	},
	{
		title: "神话再临",
		subs: [
			{ title: "官标", whole: ["shenhua"] },
			{ title: "官界", parts: { refresh: ["refresh_feng", "refresh_huo", "refresh_lin", "refresh_shan"] } },
			{
				title: "手界",
				parts: {
					mobile: ["mobile_shenhua_feng", "mobile_shenhua_huo", "mobile_shenhua_lin", "mobile_shenhua_shan", "mobile_shenhua_yin", "mobile_shenhua_lei"],
				},
			},
			{ title: "海外", parts: { tw: ["tw_shenhua_yin", "tw_shenhua_lei"] } },
		],
	},
	{
		title: "一将成名",
		subs: [
			{ title: "官标", whole: ["yijiang"] },
			{ title: "官界", parts: { refresh: ["refresh_yijiang1", "refresh_yijiang2", "refresh_yijiang3", "refresh_yijiang4", "refresh_yijiang5", "refresh_yijiang6"] } },
			{
				title: "ol界",
				parts: {
					onlyOL: ["onlyOL_yijiang1", "onlyOL_yijiang2", "onlyOL_yijiang3", "onlyOL_yijiang4", "onlyOL_yijiang5", "onlyOL_yijiang6", "onlyOL_yijiang7"],
				},
			},
			{ title: "手界", parts: { mobile: ["mobile_yijiang1", "mobile_yijiang2", "mobile_yijiang3", "mobile_yijiang4", "mobile_yijiang5", "mobile_yijiang7"] } },
			{ title: "海外", parts: { tw: ["tw_yijiang1", "tw_yijiang2", "tw_yijiang3", "tw_yijiang4", "tw_yijiang5", "tw_yijiang7"] } },
		],
	},
];

function subSections(packs, sub) {
	const sections = [];
	const addPack = (packId, keys) => {
		const pack = packs.get(packId);
		if (!pack) return;
		for (const group of pack.groups) {
			if (keys && !keys.includes(group.key)) continue;
			sections.push({ label: group.label, ids: group.ids });
		}
	};
	if (sub.whole) for (const packId of sub.whole) addPack(packId, null);
	if (sub.parts) for (const packId in sub.parts) addPack(packId, sub.parts[packId]);
	return sections;
}

function buildModel() {
	const packs = new Map();
	for (const packId of packList()) {
		if (!packAvailable(packId)) continue;
		packs.set(packId, { key: packId, groups: packGroups(packId) });
	}

	const claimed = new Map();
	const claimWhole = packId => claimed.set(packId, "*");
	const claimParts = (packId, keys) => {
		const current = claimed.get(packId);
		if (current === "*") return;
		const set = current || new Set();
		for (const key of keys) set.add(key);
		claimed.set(packId, set);
	};

	const themes = [];
	for (const def of THEME_DEFS) {
		const theme = { title: def.title, subs: [], groups: null };
		for (const sub of def.subs) {
			if (sub.whole) for (const packId of sub.whole) claimWhole(packId);
			if (sub.parts) for (const packId in sub.parts) claimParts(packId, sub.parts[packId]);
			theme.subs.push({ title: sub.title, whole: sub.whole || null, parts: sub.parts || null });
		}
		themes.push(theme);
	}

	for (const packId of packs.keys()) {
		const match = packId.match(/^(.+?)[-－—]解构[-－—](.+)$/) || packId.match(/^(.+?)-[；;]-(.+)$/);
		if (!match) continue;
		let theme = themes.find(item => item.title === match[1]);
		if (!theme) {
			theme = { title: match[1], subs: [], groups: null };
			themes.push(theme);
		}
		if (!theme.subs) theme.subs = [];
		theme.subs.push({ title: match[2], whole: [packId], parts: null });
		claimWhole(packId);
	}

	for (const packId of packs.keys()) {
		const claim = claimed.get(packId);
		if (claim === "*") continue;
		const groups = packs.get(packId).groups.filter(group => !(claim && claim.has(group.key)));
		if (!groups.length) continue;
		const display = packDisplayName(packId);
		if (themes.some(theme => theme.title === display)) continue;
		themes.push({ title: display, subs: null, groups });
	}

	for (const theme of themes) {
		if (!theme.subs) continue;
		for (const sub of theme.subs) sub.sections = subSections(packs, sub);
		theme.subs = theme.subs.filter(sub => sub.sections.length);
	}

	const result = themes.filter(theme => (theme.subs && theme.subs.length) || (theme.groups && theme.groups.length));
	result.unshift({ title: "总览", overview: true, subs: null, groups: null });
	return { packs, themes: result };
}

function themeAllIds(theme) {
	if (theme._allIds) return theme._allIds;
	const list = [];
	const seen = new Set();
	const push = ids => {
		for (const id of ids) {
			if (seen.has(id)) continue;
			seen.add(id);
			list.push(id);
		}
	};
	if (theme.subs) for (const sub of theme.subs) for (const section of sub.sections) push(section.ids);
	if (theme.groups) for (const group of theme.groups) push(group.ids);
	theme._allIds = list;
	return list;
}

function overviewIds() {
	const list = [];
	const seen = new Set();
	for (const theme of state.model ? state.model.themes : []) {
		if (theme.overview) continue;
		for (const id of themeAllIds(theme)) {
			if (seen.has(id)) continue;
			seen.add(id);
			list.push(id);
		}
	}
	return list;
}

function overviewEnabledIds() {
	return overviewIds().filter(isCharEnabled);
}

/* ============ 同名判定 ============ */

const NAME_PREFIX = ["界限突破", "手杀异构", "海外服异构", "OL专属", "十周年", "手杀", "新杀", "SP", "sp", "界", "标", "新", "旧", "老", "神", "魔", "谋", "鼎", "故", "TW", "OL"];

function stripName(name) {
	let text = String(name || "");
	for (let loop = 0; loop < 4; loop++) {
		let changed = false;
		for (const prefix of NAME_PREFIX) {
			if (text.length > prefix.length && text.startsWith(prefix)) {
				text = text.slice(prefix.length);
				changed = true;
				break;
			}
		}
		if (!changed) break;
	}
	return text;
}

function stripId(id) {
	let text = String(id || "");
	for (let loop = 0; loop < 4; loop++) {
		const match = text.match(/^[a-z]{1,8}[0-9]{0,2}_(.+)$/);
		if (!match) break;
		text = match[1];
	}
	return text;
}

function isSameName(a, b) {
	if (a === b) return false;
	if (stripId(a) === stripId(b)) return true;
	return stripName(lib.translate[a] || a) === stripName(lib.translate[b] || b);
}

function sameNameChars(id) {
	const theme = state.theme;
	const pool = theme && !theme.overview ? themeAllIds(theme) : overviewIds();
	return pool.filter(other => other !== id && isSameName(id, other));
}

/* ============ 禁将码 ============ */

let cachedUniverse = null;

function universe() {
	if (cachedUniverse) return cachedUniverse;
	const list = [];
	const seen = new Set();
	for (const packId of packList()) {
		const pack = lib.characterPack[packId];
		if (!pack) continue;
		for (const id of Object.keys(pack).sort()) {
			if (seen.has(id)) continue;
			seen.add(id);
			list.push(id);
		}
	}
	cachedUniverse = list;
	return list;
}

function universeSignature() {
	const list = universe();
	const text = list.join(",");
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = (hash * 0x01000193) >>> 0;
	}
	return `${list.length.toString(36)}.${hash.toString(36)}`;
}

function toBase64Url(bytes) {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
	let str = String(text || "").replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function deflateBytes(bytes) {
	if (typeof CompressionStream == "undefined") return null;
	try {
		const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch (error) {
		console.error(error);
		return null;
	}
}

async function inflateBytes(bytes) {
	if (typeof DecompressionStream == "undefined") return null;
	try {
		const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch (error) {
		console.error(error);
		return null;
	}
}

function pushVarint(bytes, value) {
	let rest = value;
	while (rest >= 0x80) {
		bytes.push((rest & 0x7f) | 0x80);
		rest = Math.floor(rest / 128);
	}
	bytes.push(rest);
}

function readVarints(bytes) {
	const list = [];
	let value = 0;
	let scale = 1;
	for (let i = 0; i < bytes.length; i++) {
		const byte = bytes[i];
		value += (byte & 0x7f) * scale;
		if (byte & 0x80) scale *= 128;
		else {
			list.push(value);
			value = 0;
			scale = 1;
		}
	}
	return list;
}

function collectPacks(ids) {
	const index = new Map();
	for (const packId of packList()) {
		const pack = lib.characterPack[packId];
		if (!pack) continue;
		for (const id in pack) if (!index.has(id)) index.set(id, packId);
	}
	const packs = [];
	for (const id of ids) {
		const packId = index.get(id);
		if (packId && !packs.includes(packId)) packs.push(packId);
	}
	return packs;
}

async function encodeCode(ids, codec) {
	const list = ids.slice();
	if (codec === "index") {
		const table = universe();
		const index = new Map();
		for (let i = 0; i < table.length; i++) index.set(table[i], i);
		const numbers = [];
		const extra = [];
		for (const id of list) {
			const value = index.get(id);
			if (value === undefined) extra.push(id);
			else numbers.push(value);
		}
		numbers.sort((a, b) => a - b);
		const bytes = [];
		let previous = -1;
		for (const value of numbers) {
			pushVarint(bytes, value - previous - 1);
			previous = value;
		}
		let code = `MJS1:${universeSignature()}:${toBase64Url(new Uint8Array(bytes))}`;
		if (extra.length) code += `|X:${extra.join(",")}`;
		return code;
	}
	const text = `PACKS:${collectPacks(list).join(",")}|CHARS:${list.join(",")}`;
	if (codec === "deflate") {
		const bytes = await deflateBytes(new TextEncoder().encode(text));
		if (bytes) return `MJ1:${toBase64Url(bytes)}`;
	}
	return `MJ1|${text}`;
}

async function decodeCode(raw) {
	let text = String(raw || "")
		.replace(/[\r\n\t]/g, "")
		.replace(/，/g, ",")
		.replace(/｜/g, "|")
		.replace(/\s/g, "");
	if (!text) return null;
	let marker = -1;
	for (const head of ["MJS1", "MJ1"]) {
		const found = text.indexOf(head);
		if (found >= 0 && (marker < 0 || found < marker)) marker = found;
	}
	if (marker > 0) text = text.slice(marker);
	else if (marker < 0) {
		const bar = text.indexOf("|");
		if (bar >= 0) text = text.slice(bar + 1);
	}
	if (text.startsWith("MJS1:")) {
		const body = text.slice(5);
		const split = body.indexOf(":");
		if (split < 0) return null;
		const signature = body.slice(0, split);
		let payload = body.slice(split + 1);
		let extra = [];
		const cut = payload.indexOf("|X:");
		if (cut >= 0) {
			extra = payload.slice(cut + 3).split(",").filter(Boolean);
			payload = payload.slice(0, cut);
		}
		if (signature !== universeSignature()) return { ids: [], packs: [], codec: "index", mismatch: true };
		const table = universe();
		const ids = [];
		let previous = -1;
		for (const value of readVarints(fromBase64Url(payload))) {
			const at = previous + value + 1;
			previous = at;
			if (table[at] && !ids.includes(table[at])) ids.push(table[at]);
		}
		for (const id of extra) if (!ids.includes(id)) ids.push(id);
		return { ids, packs: collectPacks(ids), codec: "index" };
	}
	if (text.startsWith("MJ1:")) {
		const bytes = await inflateBytes(fromBase64Url(text.slice(4)));
		if (!bytes) return null;
		text = new TextDecoder().decode(bytes);
	}
	let body = text;
	if (body.startsWith("MJ1|")) body = body.slice(4);
	let packs = [];
	const packMatch = body.match(/PACKS:([^|]*)/);
	if (packMatch) packs = packMatch[1].split(",").filter(Boolean);
	let charPart = body;
	const charMatch = body.match(/CHARS:([\s\S]*)$/);
	if (charMatch) charPart = charMatch[1];
	const ids = charPart
		.split(",")
		.map(id => id.trim())
		.filter(Boolean);
	return { ids, packs, codec: "plain" };
}

/* ============ 页面状态 ============ */

const state = {
	page: null,
	left: null,
	right: null,
	chips: null,
	input: null,
	theme: null,
	sub: null,
	expanded: new Set(),
	selected: -1,
	model: null,
};

let renderToken = 0;

/* ============ 样式 ============ */

const STYLE_ID = "nmcm-style";

function injectStyle() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.innerHTML = `
.menu.main > .menu-tab > .nmcm-tab{width:auto!important;min-width:45px;padding-left:6px;padding-right:6px;font-size:15px;white-space:nowrap;}
.menu.main.nmcm-active{width:calc(100% - 30px)!important;height:calc(100% - 70px)!important;}
.nmcm-page{display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;box-sizing:border-box;}
.nmcm-top{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;padding:3px 6px;border-bottom:1px solid rgba(0,0,0,0.25);}
.nmcm-btn{display:inline-block;padding:2px 8px;margin:2px 3px 2px 0;border-radius:4px;background:rgba(0,0,0,0.28);color:#fff;font-size:14px;line-height:18px;white-space:nowrap;cursor:pointer;}
.nmcm-btn.on{background:rgba(0,133,255,0.8);}
.nmcm-input{flex:1 1 120px;min-width:80px;height:20px;margin:2px 4px;padding:0 4px;font-size:13px;color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:4px;background:rgba(0,0,0,0.35);user-select:text;-webkit-user-select:text;}
.nmcm-chips{flex:0 0 auto;display:flex;align-items:center;overflow-x:auto;overflow-y:hidden;padding:2px 6px;border-bottom:1px solid rgba(0,0,0,0.2);}
.nmcm-chip{flex:0 0 auto;max-width:42%;margin-right:5px;padding:1px 8px;border-radius:10px;background:rgba(0,0,0,0.25);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}
.nmcm-chip.sel{background:rgba(0,133,255,0.8);}
.nmcm-body{flex:1 1 auto;min-height:0;display:flex;}
.nmcm-left{flex:0 0 26%;min-width:110px;max-width:260px;overflow-y:auto;overflow-x:hidden;padding:3px;border-right:2px solid rgba(255,255,255,0.45);box-sizing:border-box;}
.nmcm-right{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:3px 5px;box-sizing:border-box;}
.nmcm-frame{margin:5px 3px;padding:3px 6px;border:2px solid rgba(255,255,255,0.32);border-radius:5px;background:rgba(0,0,0,0.18);font-size:15px;line-height:20px;cursor:pointer;}
.nmcm-frame.sel{border-color:rgba(0,133,255,0.95);background:rgba(0,133,255,0.25);}
.nmcm-frame.overview{border-color:rgba(255,205,80,0.75);background:rgba(255,205,80,0.16);}
.nmcm-frame.overview.sel{border-color:rgba(255,205,80,0.95);background:rgba(255,205,80,0.28);}
.nmcm-sub{margin:4px 0 4px 8px;padding:2px 6px;border:2px solid rgba(0,0,0,0.6);border-radius:5px;background:rgba(0,0,0,0.38);font-size:14px;cursor:pointer;}
.nmcm-sub.sel{border-color:rgba(0,133,255,0.95);background:rgba(0,70,160,0.55);}
.nmcm-row{display:flex;align-items:center;}
.nmcm-name{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.nmcm-num{flex:0 0 auto;margin-left:6px;font-size:12px;opacity:0.7;}
.nmcm-righthead{display:flex;flex-wrap:wrap;align-items:baseline;padding:2px 4px 4px;}
.nmcm-righttitle{font-size:16px;margin-right:8px;}
.nmcm-hint{font-size:12px;opacity:0.65;}
.nmcm-tip{padding:10px 6px;font-size:14px;opacity:0.75;}
.nmcm-section{margin-bottom:6px;}
.nmcm-sec-title{margin:4px 0;padding:2px 6px;font-size:15px;border-left:3px solid rgba(0,133,255,0.85);background:rgba(0,0,0,0.16);}
.nmcm-sec-body{display:flex;flex-wrap:wrap;}
.nmcm-sec-body > .button.character{margin:4px;}
.button.character.nmcm-off{opacity:0.42;filter:grayscale(1);}
.button.character.nmcm-off::after{content:"禁";position:absolute;right:2px;bottom:2px;font-size:12px;color:#ff8a8a;}
.nmcm-dialog{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%);width:min(680px,94vw)!important;height:auto!important;max-height:86vh;overflow-y:auto;background:rgba(25,25,25,0.94);border-radius:8px;padding:12px 0;box-shadow:0 0 12px rgba(0,0,0,0.6);z-index:20;box-sizing:border-box;}
.nmcm-dialog > div{position:relative!important;width:80%;margin:8px auto 0;box-sizing:border-box;}
.nmcm-dialog .nmcm-dialogbtn{position:relative!important;display:inline-block!important;margin:3px 6px;padding:3px 10px;border-radius:4px;background:rgba(0,133,255,0.8);font-size:16px;line-height:20px;white-space:nowrap;cursor:pointer;}
.nmcm-ta{display:block;width:100%;height:104px;box-sizing:border-box;margin:4px 0;padding:4px;font-size:13px;color:#fff;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.25);border-radius:4px;user-select:text;-webkit-user-select:text;resize:vertical;}
`;
	document.head.appendChild(style);
}

/* ============ 菜单页签挂载 ============ */

function findMenu() {
	if (!ui.menuContainer) return null;
	return ui.menuContainer.querySelector(".main.menu");
}

function findContent(menu) {
	if (!menu) return null;
	for (const child of menu.children) {
		if (child.classList.contains("menu-content")) return child;
	}
	return null;
}

function findTab(menu) {
	if (!menu) return null;
	for (const child of menu.children) {
		if (!child.classList.contains("menu-tab")) continue;
		for (const item of child.children) {
			if (item.classList.contains("nmcm-tab")) return item;
		}
	}
	return null;
}

function syncMenuSize() {
	const menu = findMenu();
	if (!menu) return;
	const tab = findTab(menu);
	menu.classList.toggle("nmcm-active", !!(tab && tab.classList.contains("active")));
}

function openPage(tab) {
	const menu = findMenu();
	const content = findContent(menu);
	const page = buildPage();
	tab._link = page;
	if (content) while (content.firstChild) content.removeChild(content.firstChild);
	if (typeof ui.click.menuTab == "function") {
		ui.click.menuTab("武将管理");
	} else {
		tab.classList.add("active");
		if (content) content.appendChild(page);
	}
	syncMenuSize();
}

function ensureTab() {
	const menu = findMenu();
	if (!menu) return false;
	let tabBar = null;
	for (const child of menu.children) {
		if (child.classList.contains("menu-tab")) tabBar = child;
	}
	if (!tabBar) return false;
	if (findTab(menu)) return true;
	const tab = ui.create.div(".nmcm-tab", "武将管理", tabBar);
	tab._link = ui.create.div("");
	if (typeof MutationObserver == "function" && !tabBar._nmcmObserver) {
		tabBar._nmcmObserver = new MutationObserver(function () {
			syncMenuSize();
		});
		tabBar._nmcmObserver.observe(tabBar, { attributes: true, attributeFilter: ["class"], subtree: true });
	}
	tab.listen(function (event) {
		if (event) event.stopPropagation();
		try {
			openPage(tab);
		} catch (error) {
			console.error(error);
			alert(`《${EXT}》页面打开失败：${error && error.message ? error.message : error}`);
		}
	});
	return true;
}

function refreshTabIfActive() {
	const menu = findMenu();
	if (!menu) return;
	ensureTab();
	const tab = findTab(menu);
	if (!tab || !tab.classList.contains("active")) return;
	openPage(tab);
}

function wrapConfigMenu() {
	if (typeof ui.click.configMenu != "function") return false;
	if (ui.click.configMenu._nmcm) return true;
	const original = ui.click.configMenu;
	const wrapped = function () {
		const result = original.apply(this, arguments);
		try {
			refreshTabIfActive();
		} catch (error) {
			console.error(error);
		}
		return result;
	};
	wrapped._nmcm = true;
	ui.click.configMenu = wrapped;
	return true;
}

function install() {
	injectStyle();
	if (!wrapConfigMenu()) return false;
	ensureTab();
	return true;
}

/* ============ 预设方案 ============ */

function getPresets() {
	const value = lib.config[`extension_${EXT}_${KEY_PRESETS}`];
	return Array.isArray(value) ? value : [];
}

function setPresets(list) {
	cfgSet(KEY_PRESETS, list);
}

/* ============ 页面构建 ============ */

function buildPage() {
	cachedUniverse = null;
	state.model = buildModel();
	state.selected = -1;
	state.sub = null;
	state.expanded = new Set();

	const page = ui.create.div(".nmcm-page");
	const top = ui.create.div(".nmcm-top", "", page);

	ui.create.div(".nmcm-btn", "返回", top).listen(function (event) {
		event.stopPropagation();
		if (typeof game.closeMenu == "function") game.closeMenu();
		else if (typeof ui.click.configMenu == "function") ui.click.configMenu();
	});

	const optimize = ui.create.div(".nmcm-btn", "禁卡优化", top);
	optimize.classList.toggle("on", !!cfgGet(KEY_OPTIMIZE, false));
	optimize.listen(function (event) {
		event.stopPropagation();
		const next = !cfgGet(KEY_OPTIMIZE, false);
		cfgSet(KEY_OPTIMIZE, next);
		this.classList.toggle("on", next);
	});

	const swap = ui.create.div(".nmcm-btn", "单击双击交换", top);
	swap.classList.toggle("on", !!cfgGet(KEY_SWAP, false));
	swap.listen(function (event) {
		event.stopPropagation();
		const next = !cfgGet(KEY_SWAP, false);
		cfgSet(KEY_SWAP, next);
		this.classList.toggle("on", next);
		renderRight();
	});

	const input = document.createElement("input");
	input.className = "nmcm-input";
	input.type = "text";
	input.placeholder = "粘贴禁将码 / 分享文本（备注|码）";
	input.addEventListener("keydown", event => event.stopPropagation());
	input.addEventListener("keyup", event => event.stopPropagation());
	input.addEventListener("mousedown", event => event.stopPropagation());
	top.appendChild(input);
	state.input = input;

	ui.create.div(".nmcm-btn", "使用", top).listen(function (event) {
		event.stopPropagation();
		doUse();
	});
	ui.create.div(".nmcm-btn", "导出", top).listen(function (event) {
		event.stopPropagation();
		doExport();
	});
	ui.create.div(".nmcm-btn", "保存", top).listen(function (event) {
		event.stopPropagation();
		doSave();
	});
	ui.create.div(".nmcm-btn", "删除", top).listen(function (event) {
		event.stopPropagation();
		doDelete();
	});

	const banAllBtn = ui.create.div(".nmcm-btn", "一键全禁", top);
	banAllBtn.style.background = "rgba(190,55,55,0.8)";
	banAllBtn.listen(function (event) {
		event.stopPropagation();
		doBanAll();
	});

	const codecBtn = ui.create.div(".nmcm-btn", "", top);
	const refreshCodec = () => {
		const codec = cfgGet(KEY_CODEC, "deflate");
		codecBtn.innerHTML = `码式：${CODEC_NAME[codec] || "压缩"}`;
	};
	refreshCodec();
	codecBtn.listen(function (event) {
		event.stopPropagation();
		const current = cfgGet(KEY_CODEC, "deflate");
		const index = CODECS.indexOf(current);
		const next = CODECS[(index + 1) % CODECS.length];
		cfgSet(KEY_CODEC, next);
		refreshCodec();
		alert(`禁将码输出方式已切换为：${CODEC_NAME[next]}`);
	});

	state.chips = ui.create.div(".nmcm-chips", "", page);
	const body = ui.create.div(".nmcm-body", "", page);
	state.left = ui.create.div(".nmcm-left", "", body);
	state.right = ui.create.div(".nmcm-right", "", body);
	state.page = page;

	const themes = state.model.themes;
	state.theme = themes.find(theme => theme.overview) || themes[0] || null;

	renderLeft();
	renderRight();
	renderChips();
	return page;
}

function renderLeft() {
	const left = state.left;
	if (!left) return;
	left.innerHTML = "";
	state.overviewNumNode = null;
	const themes = state.model ? state.model.themes : [];
	if (!themes.length) {
		ui.create.div(".nmcm-tip", "没有可显示的武将包", left);
		return;
	}
	for (const theme of themes) {
		const frame = ui.create.div(".nmcm-frame", "", left);
		if (theme.overview) frame.classList.add("overview");
		if (state.theme === theme) frame.classList.add("sel");
		const row = ui.create.div(".nmcm-row", "", frame);
		ui.create.div(".nmcm-name", theme.title, row);
		const num = ui.create.div(".nmcm-num", theme.overview ? String(overviewEnabledIds().length) : String(themeAllIds(theme).length), row);
		if (theme.overview) state.overviewNumNode = num;
		frame.listen(function (event) {
			event.stopPropagation();
			onThemeClick(theme);
		});
		if (!theme.subs) continue;
		if (state.theme !== theme) continue;
		if (!state.expanded.has(theme.title)) continue;
		for (const sub of theme.subs) {
			const node = ui.create.div(".nmcm-sub", "", frame);
			if (state.sub === sub) node.classList.add("sel");
			const subrow = ui.create.div(".nmcm-row", "", node);
			ui.create.div(".nmcm-name", sub.title, subrow);
			const count = sub.sections.reduce((total, section) => total + section.ids.length, 0);
			ui.create.div(".nmcm-num", String(count), subrow);
			node.listen(function (event) {
				event.stopPropagation();
				onSubClick(theme, sub);
			});
		}
	}
}

function onThemeClick(theme) {
	if (state.theme !== theme) {
		state.theme = theme;
		state.sub = null;
		state.expanded.delete(theme.title);
	} else if (theme.subs && theme.subs.length) {
		if (state.expanded.has(theme.title)) {
			state.expanded.delete(theme.title);
			state.sub = null;
		} else {
			state.expanded.add(theme.title);
		}
	}
	renderLeft();
	renderRight();
}

function onSubClick(theme, sub) {
	state.theme = theme;
	state.sub = sub;
	state.expanded.add(theme.title);
	renderLeft();
	renderRight();
}

function renderRight() {
	const right = state.right;
	if (!right) return;
	right.innerHTML = "";
	const theme = state.theme;
	if (!theme) {
		ui.create.div(".nmcm-tip", "请选择左侧的主题", right);
		return;
	}
	const head = ui.create.div(".nmcm-righthead", "", right);
	ui.create.div(".nmcm-righttitle", state.sub ? `${theme.title} · ${state.sub.title}` : theme.title, head);
	ui.create.div(".nmcm-hint", cfgGet(KEY_SWAP, false) ? "单击：开启/关闭　双击：查看武将" : "单击：查看武将　双击：开启/关闭", head);
	if (_status.connectMode) ui.create.div(".nmcm-hint", "联机：已同步写入联机房间禁将（最终以房主的房间设置为准）", head);

	const token = ++renderToken;
	if (theme.overview) {
		ui.create.div(".nmcm-hint", "只显示已开启的武将", head);
		renderOverview(right, token);
		return;
	}

	let total = 0;
	if (state.sub) {
		for (const section of state.sub.sections) total += renderSection(right, section.label, section.ids, false);
	} else if (theme.subs) {
		for (const sub of theme.subs) {
			const ids = [];
			const seen = new Set();
			for (const section of sub.sections) {
				for (const id of section.ids) {
					if (seen.has(id)) continue;
					seen.add(id);
					ids.push(id);
				}
			}
			total += renderSection(right, sub.title, ids, true);
		}
	} else if (theme.groups) {
		for (const group of theme.groups) total += renderSection(right, group.label, group.ids, false);
	}
	if (!total) {
		ui.create.div(".nmcm-tip", theme.subs ? "该主题下没有已开启的武将（再次点击主题可展开小版本）" : "该主题下没有可显示的武将", right);
	}
}

function renderOverview(right, token) {
	const groups = [];
	for (const theme of state.model ? state.model.themes : []) {
		if (theme.overview) continue;
		const ids = themeAllIds(theme).filter(isCharEnabled);
		if (ids.length) groups.push({ title: theme.title, ids });
	}
	if (!groups.length) {
		ui.create.div(".nmcm-tip", "当前没有已开启的武将", right);
		return;
	}
	let index = 0;
	const step = () => {
		if (token !== renderToken) return;
		if (index >= groups.length) return;
		const group = groups[index++];
		renderSection(right, group.title, group.ids, false);
		if (index < groups.length) setTimeout(step, 0);
	};
	step();
}

function renderSection(right, label, ids, onlyEnabled) {
	const list = onlyEnabled ? ids.filter(isCharEnabled) : ids;
	if (!list.length) return 0;
	const section = ui.create.div(".nmcm-section", "", right);
	ui.create.div(".nmcm-sec-title", `${label}（${list.length}）`, section);
	const box = ui.create.div(".nmcm-sec-body", "", section);
	const buttons = ui.create.buttons(list, "character", box, true);
	for (const button of buttons) bindCharacter(button);
	return list.length;
}

function bindCharacter(button) {
	const id = button.link;
	button.classList.add("nmcm-char");
	updateCharButton(button);
	let timer = null;
	button.listen(function () {
		const swapped = !!cfgGet(KEY_SWAP, false);
		if (timer) {
			clearTimeout(timer);
			timer = null;
			if (swapped) viewCharacter(id);
			else toggleCharacter(id);
			return;
		}
		timer = setTimeout(function () {
			timer = null;
			if (swapped) toggleCharacter(id);
			else viewCharacter(id);
		}, DBL_DELAY);
	});
}

function updateCharButton(button) {
	button.classList.toggle("nmcm-off", !isCharEnabled(button.link));
}

function viewCharacter(id) {
	if (_status.dragged) return;
	ui.click.charactercard(id);
}

function toggleCharacter(id) {
	if (isCharEnabled(id)) {
		setCharsEnabled([id], false);
	} else {
		setCharsEnabled([id], true);
		if (cfgGet(KEY_OPTIMIZE, false)) {
			const same = sameNameChars(id);
			if (same.length) setCharsEnabled(same, false);
		}
	}
	if (state.overviewNumNode) state.overviewNumNode.innerHTML = String(overviewEnabledIds().length);
	renderRight();
}

/* ============ 已保存方案 ============ */

function renderChips() {
	const wrap = state.chips;
	if (!wrap) return;
	wrap.innerHTML = "";
	const list = getPresets();
	ui.create.div(".nmcm-hint", "已保存：", wrap);
	if (!list.length) {
		ui.create.div(".nmcm-hint", "暂无", wrap);
		return;
	}
	list.forEach((item, index) => {
		const chip = ui.create.div(".nmcm-chip", item && item.note ? item.note : "未命名", wrap);
		if (index === state.selected) chip.classList.add("sel");
		chip.listen(function (event) {
			event.stopPropagation();
			state.selected = index;
			const preset = getPresets()[index];
			if (state.input && preset) state.input.value = preset.code || (preset.ids || []).join(",");
			renderChips();
		});
	});
}

/* ============ 操作 ============ */

async function doUse() {
	const raw = state.input ? state.input.value : "";
	let result;
	try {
		result = await decodeCode(raw);
	} catch (error) {
		console.error(error);
		result = null;
	}
	if (!result) {
		alert("没有识别到禁将码，请检查粘贴内容");
		return;
	}
	if (result.mismatch) {
		alert("这条极短码与本机的武将包版本不一致，无法解析。\n请让对方改用「压缩」或「明文」码式重新导出。");
		return;
	}
	const ids = result.ids.filter(Boolean);
	if (!ids.length) {
		alert("码里没有武将");
		return;
	}
	const known = ids.filter(id => !!lib.character[id]);
	const missing = ids.filter(id => !lib.character[id]);
	if (!known.length) {
		alert("码里的武将本机都不存在，请确认双方扩展包是否一致");
		return;
	}
	let message = `识别到 ${ids.length} 个武将，本机可用 ${known.length} 个。`;
	if (missing.length) {
		message += `\n本机缺失 ${missing.length} 个：${missing.slice(0, 10).join("、")}${missing.length > 10 ? "…" : ""}`;
	}
	message += `\n\n使用后：全部武将按禁将处理，只开启码内的 ${known.length} 个（写入全部模式）。确定吗？`;
	if (!confirm(message)) return;
	applyWhitelist(known);
	state.selected = -1;
	renderLeft();
	renderRight();
	alert(`已应用：开启 ${known.length} 个武将`);
}

function doBanAll() {
	const all = banUniverse();
	if (!all.length) {
		alert("没有可禁用的武将");
		return;
	}
	if (!confirm(`确定把全部 ${all.length} 个武将设为禁将吗？\n（写入全部模式的禁将列表，之后可用「使用」禁将码或双击武将逐个恢复）`)) return;
	applyBanAll();
	state.selected = -1;
	renderLeft();
	renderRight();
	alert(`已禁用全部 ${all.length} 个武将`);
}

async function doExport() {
	const ids = currentEnabledIds();
	if (!ids.length) {
		alert("当前没有已开启的武将，无法导出");
		return;
	}
	const codec = cfgGet(KEY_CODEC, "deflate");
	let code;
	try {
		code = await encodeCode(ids, codec);
	} catch (error) {
		console.error(error);
		alert("生成禁将码失败");
		return;
	}
	const preset = state.selected >= 0 ? getPresets()[state.selected] : null;
	const note = preset && preset.note ? String(preset.note).replace(/\|/g, "｜") : "武将管理";
	showCodeDialog(code, `${note}|${code}`, ids.length);
}

function doSave() {
	const inputCode = state.input ? String(state.input.value || "").trim() : "";
	game.prompt("给这条禁将方案写个备注（例如：适合身份八人局，节奏快）", async function (note) {
		if (note === false) return;
		let ids = [];
		let code = inputCode;
		if (code) {
			let result = null;
			try {
				result = await decodeCode(code);
			} catch (error) {
				console.error(error);
			}
			ids = result && !result.mismatch ? result.ids : [];
		} else {
			ids = currentEnabledIds();
			const codec = cfgGet(KEY_CODEC, "deflate");
			try {
				code = await encodeCode(ids, codec);
			} catch (error) {
				console.error(error);
				code = "";
			}
		}
		if (!ids.length) {
			alert("没有可保存的内容（输入框为空且当前没有已开启的武将）");
			return;
		}
		const list = getPresets();
		list.push({ note: String(note || "未命名").slice(0, 60), ids: ids.slice(), code: code || ids.join(","), time: Date.now() });
		setPresets(list);
		state.selected = list.length - 1;
		renderChips();
	});
}

function doDelete() {
	const list = getPresets();
	if (state.selected < 0 || state.selected >= list.length) {
		alert("请先点选一条已保存的方案");
		return;
	}
	const note = (list[state.selected] && list[state.selected].note) || "未命名";
	if (!confirm(`确定删除方案「${note}」吗？`)) return;
	list.splice(state.selected, 1);
	setPresets(list);
	state.selected = -1;
	renderChips();
}

function showCodeDialog(code, share, count) {
	const layer = ui.create.div(".popup-container", ui.window);
	const center = ui.create.div(".prompt-container", layer);
	const box = ui.create.div(".menubg.nmcm-dialog", ui.create.div("", center), function (event) {
		event.stopPropagation();
	});
	const hint = ui.create.div("", `共 ${count} 个武将。复制下面的码发给别人，对方粘贴到输入框点「使用」即可。`, box);
	hint.style.width = "80%";
	hint.style.fontSize = "14px";
	const wrap = ui.create.div("", box);
	wrap.style.width = "80%";
	const area = document.createElement("textarea");
	area.className = "nmcm-ta";
	area.readOnly = true;
	area.value = code;
	wrap.appendChild(area);
	const shareWrap = ui.create.div("", box);
	shareWrap.style.width = "80%";
	const shareArea = document.createElement("textarea");
	shareArea.className = "nmcm-ta";
	shareArea.style.height = "52px";
	shareArea.readOnly = true;
	shareArea.value = share;
	shareWrap.appendChild(shareArea);
	const controls = ui.create.div("", box);
	controls.style.width = "80%";
	const close = () => layer.remove();
	ui.create.div(".nmcm-dialogbtn", "全选", controls).listen(function () {
		area.focus();
		area.select();
	});
	ui.create.div(".nmcm-dialogbtn", "复制", controls).listen(function () {
		area.focus();
		area.select();
		let done = false;
		try {
			done = document.execCommand("copy");
		} catch (error) {
			done = false;
		}
		if (done) {
			alert("已复制到剪贴板");
			return;
		}
		try {
			navigator.clipboard.writeText(code).then(
				() => alert("已复制到剪贴板"),
				() => alert("已全选，请按 Ctrl+C 复制")
			);
		} catch (error) {
			alert("已全选，请按 Ctrl+C 复制");
		}
	});
	ui.create.div(".nmcm-dialogbtn", "关闭", controls).listen(function () {
		close();
	});
	layer.addEventListener("click", close);
}

/* ============ 扩展入口 ============ */

export default function () {
	return {
		name: "武将管理-高呼吾名玖罗",
		connect: true,
		editable: false,
		config: {},
		help: {},
		package: {},
		precontent() {},
		content() {
			try {
				migrateConfig();
			} catch (error) {
				console.error(error);
			}
			try {
				injectStyle();
			} catch (error) {
				console.error(error);
			}
			try {
				install();
			} catch (error) {
				console.error(error);
			}
			let tries = 0;
			const timer = setInterval(function () {
				tries++;
				try {
					if (install()) clearInterval(timer);
				} catch (error) {
					console.error(error);
				}
				if (tries > 200) clearInterval(timer);
			}, 250);
			if (Array.isArray(lib.arenaReady)) lib.arenaReady.push(install);
			if (Array.isArray(lib.onfree)) lib.onfree.push(install);
		},
	};
}
