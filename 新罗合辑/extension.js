import { lib, game, ui, get, ai, _status } from "../../noname.js";

export const type = "extension";

const CONTAINER = "新罗合辑";
const PACKS_DIR = "packs";

/* ---------------- 运行环境 ---------------- */

const nodeRequire = (() => {
	try {
		if (typeof window !== "undefined" && typeof window.require === "function") {
			return window.require;
		}
	} catch (e) {}
	try {
		if (typeof require === "function") {
			return require;
		}
	} catch (e) {}
	return null;
})();

const nodeFs = (() => {
	try {
		return (lib.node && lib.node.fs) || (nodeRequire ? nodeRequire("fs") : null);
	} catch (e) {
		return null;
	}
})();

const nodePath = (() => {
	try {
		return (lib.node && lib.node.path) || (nodeRequire ? nodeRequire("path") : null);
	} catch (e) {
		return null;
	}
})();

function appDir() {
	try {
		if (typeof __dirname === "string" && __dirname) {
			return __dirname;
		}
	} catch (e) {}
	try {
		if (typeof window !== "undefined" && typeof window.__dirname === "string" && window.__dirname) {
			return window.__dirname;
		}
	} catch (e) {}
	return "";
}

const STORAGE = (() => {
	if (nodeFs && nodePath && appDir()) {
		return "node";
	}
	try {
		const p = game && game.promises;
		if (p && typeof p.getFileList === "function" && typeof p.checkFile === "function") {
			return "game";
		}
	} catch (e) {}
	return null;
})();

function log(text) {
	try {
		console.log("[新罗合辑] " + text);
	} catch (e) {}
}

/* ---------------- 扫描子包 ---------------- */

function packsRel() {
	return "extension/" + CONTAINER + "/" + PACKS_DIR;
}

function absOf(rel) {
	return nodePath ? nodePath.join(appDir(), rel) : appDir() + "/" + rel;
}

async function listPacks() {
	const base = packsRel();
	if (STORAGE === "node") {
		const abs = absOf(base);
		if (!nodeFs.existsSync(abs)) {
			return [];
		}
		return nodeFs
			.readdirSync(abs, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name.charAt(0) !== ".")
			.map((entry) => entry.name)
			.filter((name) => nodeFs.existsSync(nodePath.join(abs, name, "extension.js")))
			.sort();
	}
	if (STORAGE === "game") {
		let result;
		try {
			result = await game.promises.getFileList(base);
		} catch (e) {
			return [];
		}
		const folders = (result && result[0]) || [];
		const out = [];
		for (const folder of folders) {
			if (folder.charAt(0) === ".") {
				continue;
			}
			try {
				const flag = await game.promises.checkFile(base + "/" + folder + "/extension.js");
				if (flag === 1) {
					out.push(folder);
				}
			} catch (e) {}
		}
		return out.sort();
	}
	return [];
}

/* ---------------- 捕获子包定义 ---------------- */

async function capturePack(folder) {
	const url = new URL("./" + PACKS_DIR + "/" + folder + "/extension.js", import.meta.url).href;
	const realImport = game["import"];
	let captured = null;
	game["import"] = function (type, obj) {
		if (type === "extension") {
			captured = obj;
			return Promise.resolve();
		}
		return realImport.apply(this, arguments);
	};
	try {
		await import(url);
	} finally {
		game["import"] = realImport;
	}
	if (!captured) {
		try {
			const mod = await import(url);
			if (mod && mod.default) {
				captured = mod.default;
			}
		} catch (e) {}
	}
	if (!captured) {
		return null;
	}
	let obj = captured;
	if (typeof obj === "function") {
		obj = await obj(lib, game, ui, get, ai, _status);
	}
	if (!obj || typeof obj !== "object" || !obj.name) {
		return null;
	}
	return obj;
}

/* ---------------- 路径改写（保险） ---------------- */

function rewriteValue(value, oldPrefix, newPrefix, oldExt, newExt, depth) {
	if (depth > 4) {
		return value;
	}
	if (typeof value === "string") {
		if (value.indexOf(oldPrefix) === 0) {
			return newPrefix + value.slice(oldPrefix.length);
		}
		if (value.indexOf(oldExt) === 0) {
			return newExt + value.slice(oldExt.length);
		}
		return value;
	}
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			value[i] = rewriteValue(value[i], oldPrefix, newPrefix, oldExt, newExt, depth + 1);
		}
		return value;
	}
	if (value && typeof value === "object") {
		for (const key of Object.keys(value)) {
			value[key] = rewriteValue(value[key], oldPrefix, newPrefix, oldExt, newExt, depth + 1);
		}
		return value;
	}
	return value;
}

function fixPackPaths(obj, folder) {
	const oldPrefix = "extension/" + folder + "/";
	const newPrefix = "extension/" + CONTAINER + "/" + PACKS_DIR + "/" + folder + "/";
	const oldExt = "ext:" + folder + "/";
	const newExt = "ext:" + CONTAINER + "/" + PACKS_DIR + "/" + folder + "/";
	const pack = obj.package;
	if (pack && pack.character && pack.character.character) {
		for (const id of Object.keys(pack.character.character)) {
			pack.character.character[id] = rewriteValue(pack.character.character[id], oldPrefix, newPrefix, oldExt, newExt, 0);
		}
	}
	if (pack && pack.card && pack.card.card) {
		for (const id of Object.keys(pack.card.card)) {
			pack.card.card[id] = rewriteValue(pack.card.card[id], oldPrefix, newPrefix, oldExt, newExt, 0);
		}
	}
	if (pack && pack.skill && pack.skill.skill) {
		for (const id of Object.keys(pack.skill.skill)) {
			pack.skill.skill[id] = rewriteValue(pack.skill.skill[id], oldPrefix, newPrefix, oldExt, newExt, 0);
		}
	}
}

/* ---------------- 注册 ---------------- */

const loaded = [];

async function registerPack(folder, obj) {
	const name = obj.name || folder;
	if (loaded.indexOf(name) !== -1) {
		return false;
	}
	game.saveConfig("extension_" + name + "_enable", true);
	await game["import"]("extension", obj);
	loaded.push(name);
	try {
		delete lib.extensionMenu["extension_" + name];
	} catch (e) {}
	return true;
}

async function loadAll() {
	if (!STORAGE) {
		log("没有文件系统权限，无法扫描子包");
		return 0;
	}
	let folders = [];
	try {
		folders = await listPacks();
	} catch (e) {
		log("扫描子包失败：" + (e && e.message));
		return 0;
	}
	if (!folders.length) {
		log("packs 目录里没有子包");
		return 0;
	}
	let count = 0;
	for (const folder of folders) {
		try {
			const obj = await capturePack(folder);
			if (!obj) {
				log("跳过 " + folder + "：没有捕获到扩展对象");
				continue;
			}
			fixPackPaths(obj, folder);
			if (await registerPack(folder, obj)) {
				count++;
				log("已注册子包 " + obj.name);
			}
		} catch (e) {
			log("加载子包失败 " + folder + "：" + (e && e.message ? e.message : String(e)));
		}
	}
	log("本次共注册 " + count + " 个子包");
	return count;
}

/* ---------------- 扩展定义 ---------------- */

export default function () {
	return {
		name: "新罗合辑",
		editable: false,
		config: {
			list: {
				name: '<span style="text-decoration: underline;">查看已加载的子包</span>',
				intro: "列出本次启动从 packs 目录里自动加载的武将包。",
				clear: true,
				onclick: function () {
					const text = loaded.length ? loaded.join("\n") : "（本次启动没有加载到任何子包）";
					alert("已加载的子包：\n\n" + text);
					return false;
				},
			},
			rescan: {
				name: '<span style="text-decoration: underline;">重新扫描 packs 目录</span>',
				intro: "往 packs 目录里新丢了子包时，可以试试点这里（更稳妥的做法是重启游戏）。",
				clear: true,
				onclick: function () {
					loadAll()
						.then((n) => alert("扫描完成，本次新注册 " + n + " 个子包。\n请重启游戏让武将列表生效。"))
						.catch((e) => alert("扫描失败：" + (e && e.message ? e.message : String(e))));
					return false;
				},
			},
		},
		precontent: async function () {
			await loadAll();
		},
		package: {
			intro: "容器扩展：自动扫描 packs 目录，把里面的每个子包单独注册成一个武将包（武将页各自独立入口），扩展页只保留「新罗合辑」一项。删掉本扩展文件夹即全部移除。",
			author: "无名杀工坊",
			version: "1.0.0",
		},
	};
}
