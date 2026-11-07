import { lib, game, ui, get, ai, _status } from "../../noname.js";

export const type = "extension";

const CONF = (key) => "extension_新罗服云端更新_" + key;
const MANIFEST = "_manifest.json";
const DEFAULT_REPO = "jiluo-luos/noname-ext";

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

const nodeCrypto = (() => {
	try {
		return nodeRequire ? nodeRequire("crypto") : null;
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

/* 电脑版走 fs，手机版（PE）走引擎的 cordova 文件接口 */
const STORAGE = (() => {
	if (nodeFs && nodePath && appDir()) {
		return "node";
	}
	try {
		const p = game && game.promises;
		if (p && typeof p.getFileList === "function" && typeof p.readFile === "function" && typeof p.writeFile === "function") {
			return "game";
		}
	} catch (e) {}
	return null;
})();

function absOf(rel) {
	return nodePath ? nodePath.join(appDir(), rel) : appDir() + "/" + rel;
}

async function existsRel(rel) {
	if (STORAGE === "node") {
		return nodeFs.existsSync(absOf(rel));
	}
	try {
		const r = await game.promises.checkFile(rel);
		return r === 1;
	} catch (e) {
		return false;
	}
}

async function readRel(rel) {
	if (STORAGE === "node") {
		return nodeFs.readFileSync(absOf(rel));
	}
	return await game.promises.readFile(rel);
}

async function writeRel(rel, bytes) {
	if (STORAGE === "node") {
		const full = absOf(rel);
		const parent = nodePath.dirname(full);
		if (!nodeFs.existsSync(parent)) {
			nodeFs.mkdirSync(parent, { recursive: true });
		}
		nodeFs.writeFileSync(full, bytes);
		return;
	}
	const index = rel.lastIndexOf("/");
	await game.promises.writeFile(bytes, rel.slice(0, index), rel.slice(index + 1));
}

async function removeRel(rel) {
	if (STORAGE === "node") {
		nodeFs.unlinkSync(absOf(rel));
		return;
	}
	await game.promises.removeFile(rel);
}

async function scanExt(name) {
	const base = "extension/" + name;
	const out = new Map();
	if (STORAGE === "node") {
		const abs = absOf(base);
		if (!nodeFs.existsSync(abs)) {
			return out;
		}
		const stack = [["", abs]];
		while (stack.length) {
			const item = stack.pop();
			const rel = item[0];
			const dir = item[1];
			let entries;
			try {
				entries = nodeFs.readdirSync(dir, { withFileTypes: true });
			} catch (e) {
				continue;
			}
			for (const entry of entries) {
				const childRel = rel ? rel + "/" + entry.name : entry.name;
				const childAbs = nodePath.join(dir, entry.name);
				if (entry.isDirectory()) {
					stack.push([childRel, childAbs]);
				} else if (entry.isFile()) {
					let size = null;
					try {
						size = nodeFs.statSync(childAbs).size;
					} catch (e) {}
					out.set(childRel, { size: size });
				}
			}
		}
		return out;
	}
	if (!(await existsRel(base))) {
		return out;
	}
	const queue = [""];
	while (queue.length) {
		const rel = queue.shift();
		const dirRel = rel ? base + "/" + rel : base;
		let result;
		try {
			result = await game.promises.getFileList(dirRel);
		} catch (e) {
			continue;
		}
		const folders = (result && result[0]) || [];
		const files = (result && result[1]) || [];
		for (const file of files) {
			out.set(rel ? rel + "/" + file : file, { size: null });
		}
		for (const folder of folders) {
			queue.push(rel ? rel + "/" + folder : folder);
		}
	}
	return out;
}

function errText(e) {
	if (!e) {
		return "未知错误";
	}
	return e.message ? String(e.message) : String(e);
}

function log(text) {
	try {
		console.log("[新罗服云端更新] " + text);
	} catch (e) {}
}

/* ---------------- 配置读写 ---------------- */

function cfg(key, def) {
	const value = lib.config[CONF(key)];
	if (value === undefined || value === null || value === "") {
		return def;
	}
	return value;
}

function saveCfg(key, value) {
	game.saveConfig(CONF(key), value);
}

function saveInput(node, key) {
	const value = String(node.textContent || "").replace(/\s+/g, " ").trim();
	node.textContent = value;
	saveCfg(key, value);
}

function normalizeMirror(text) {
	let s = String(text || "").trim();
	if (!s) {
		return "";
	}
	if (!/^https?:\/\//i.test(s)) {
		s = "https://" + s;
	}
	if (!s.endsWith("/")) {
		s += "/";
	}
	return s;
}

/* ---------------- 仓库地址解析 ---------------- */

function parseRepo(input) {
	let s = String(input || "").trim();
	if (!s) {
		return null;
	}
	s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
	s = s.replace(/^github\.com\//i, "");
	const matched = s.match(/^([^/\s]+)\/([^/\s#?]+)(?:\/tree\/([^#?\s]+))?/);
	if (!matched) {
		return null;
	}
	const owner = matched[1];
	const repo = matched[2].replace(/\.git$/i, "");
	let branch = matched[3] ? matched[3].replace(/\/+$/, "") : cfg("branch", "");
	return { owner: owner, repo: repo, branch: String(branch || "").trim() };
}

/* ---------------- 指纹（git blob sha1） ---------------- */

function toBytes(value) {
	if (value instanceof Uint8Array) {
		return value;
	}
	if (typeof value === "string") {
		return new TextEncoder().encode(value);
	}
	if (value && value.buffer) {
		return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
	}
	return null;
}

async function blobSha1(raw) {
	const bytes = toBytes(raw);
	if (!bytes) {
		throw new Error("无法读取文件内容");
	}
	const header = new TextEncoder().encode("blob " + bytes.length + "\u0000");
	const all = new Uint8Array(header.length + bytes.length);
	all.set(header, 0);
	all.set(bytes, header.length);
	if (nodeCrypto && typeof nodeCrypto.createHash === "function") {
		return nodeCrypto.createHash("sha1").update(all).digest("hex");
	}
	const digest = await crypto.subtle.digest("SHA-1", all);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/* ---------------- 本地文件扫描 ---------------- */

function walkDir(dir) {
	const result = new Map();
	const stack = [[dir, ""]];
	while (stack.length) {
		const current = stack.pop();
		const abs = current[0];
		const rel = current[1];
		let entries;
		try {
			entries = nodeFs.readdirSync(abs, { withFileTypes: true });
		} catch (e) {
			continue;
		}
		for (const entry of entries) {
			const childRel = rel ? rel + "/" + entry.name : entry.name;
			const childAbs = nodePath ? nodePath.join(abs, entry.name) : abs + "/" + entry.name;
			if (entry.isDirectory()) {
				stack.push([childAbs, childRel]);
			} else if (entry.isFile()) {
				let size = 0;
				try {
					size = nodeFs.statSync(childAbs).size;
				} catch (e) {}
				result.set(childRel, { size: size, abs: childAbs });
			}
		}
	}
	return result;
}

/* ---------------- 云端来源：接口 / 清单 ---------------- */

async function ghFetch(url, options) {
	const opts = options || {};
	const headers = {
		Accept: opts.raw ? "application/vnd.github.v3.raw" : "application/vnd.github+json",
	};
	if (opts.token) {
		headers.Authorization = "token " + opts.token;
	}
	return fetch(url, { headers: headers });
}

function groupExtensions(tree) {
	const buckets = new Map();
	for (const item of tree) {
		if (!item || item.type !== "blob" || typeof item.path !== "string") {
			continue;
		}
		const index = item.path.indexOf("/");
		if (index <= 0) {
			continue;
		}
		const name = item.path.slice(0, index);
		const rel = item.path.slice(index + 1);
		if (!buckets.has(name)) {
			buckets.set(name, new Map());
		}
		buckets.get(name).set(rel, {
			sha: item.sha,
			size: typeof item.size === "number" ? item.size : 0,
		});
	}
	const list = [];
	for (const pair of buckets) {
		if (!pair[1].has("extension.js")) {
			continue;
		}
		list.push({ name: pair[0], files: pair[1] });
	}
	return list;
}

async function fetchFromApi(parsed, token) {
	const branches = parsed.branch ? [parsed.branch] : ["main", "master"];
	let lastError = null;
	for (const branch of branches) {
		const url = "https://api.github.com/repos/" + parsed.owner + "/" + parsed.repo + "/git/trees/" + encodeURIComponent(branch) + "?recursive=1";
		let response;
		try {
			response = await ghFetch(url, { token: token });
		} catch (e) {
			throw new Error("无法连接 GitHub（" + errText(e) + "），请检查网络");
		}
		if (response.status === 404) {
			lastError = new Error("仓库 " + parsed.owner + "/" + parsed.repo + " 或分支 " + branch + " 不存在");
			continue;
		}
		if (response.status === 401) {
			throw new Error("Token 无效（401），请检查设置里的 Token");
		}
		if (response.status === 403 || response.status === 429) {
			throw new Error("GitHub 接口被限流（" + response.status + "）");
		}
		if (!response.ok) {
			throw new Error("GitHub 接口返回 HTTP " + response.status);
		}
		const data = await response.json();
		if (data.truncated) {
			throw new Error("仓库文件过多，接口返回被截断");
		}
		return { branch: branch, extensions: groupExtensions(Array.isArray(data.tree) ? data.tree : []) };
	}
	throw lastError || new Error("读取仓库失败");
}

async function fetchFromManifest(parsed, mirror) {
	const branches = parsed.branch ? [parsed.branch] : ["main", "master"];
	let lastError = null;
	for (const branch of branches) {
		const rawUrl = "https://raw.githubusercontent.com/" + parsed.owner + "/" + parsed.repo + "/" + encodeURIComponent(branch) + "/" + MANIFEST;
		let response = null;
		try {
			response = await fetch(mirror + rawUrl);
		} catch (e) {
			response = null;
		}
		if (!response || !response.ok) {
			lastError = new Error("仓库里没有清单文件 " + MANIFEST);
			continue;
		}
		let data = null;
		try {
			data = await response.json();
		} catch (e) {
			lastError = new Error("清单文件 " + MANIFEST + " 格式错误");
			continue;
		}
		const table = data && data.extensions;
		if (!table || typeof table !== "object") {
			lastError = new Error("清单文件 " + MANIFEST + " 缺少 extensions 字段");
			continue;
		}
		const list = [];
		for (const name of Object.keys(table)) {
			const entry = table[name] || {};
			const files = new Map();
			for (const rel of Object.keys(entry)) {
				const info = entry[rel] || {};
				files.set(rel, {
					sha: info.sha,
					size: typeof info.size === "number" ? info.size : 0,
				});
			}
			if (files.has("extension.js")) {
				list.push({ name: name, files: files });
			}
		}
		return { branch: branch, extensions: list };
	}
	throw lastError || new Error("读取清单失败");
}

async function loadCloud(parsed, token, mirror) {
	let apiError = null;
	try {
		const result = await fetchFromApi(parsed, token);
		if (result.extensions.length) {
			return { branch: result.branch, extensions: result.extensions, source: "接口" };
		}
	} catch (e) {
		apiError = e;
	}
	try {
		const result = await fetchFromManifest(parsed, mirror);
		return { branch: result.branch, extensions: result.extensions, source: "清单" };
	} catch (e) {
		throw apiError || e;
	}
}

/* ---------------- 差异比对 ---------------- */

async function diffExtension(name, remoteFiles) {
	const baseRel = "extension/" + name;
	const isNewExt = !(await existsRel(baseRel));
	const localFiles = isNewExt ? new Map() : await scanExt(name);
	const need = [];
	for (const pair of remoteFiles) {
		const rel = pair[0];
		const info = pair[1];
		const found = localFiles.get(rel);
		if (!found) {
			need.push({ rel: rel, sha: info.sha });
			continue;
		}
		if (found.size !== null && info.size && found.size !== info.size) {
			need.push({ rel: rel, sha: info.sha });
			continue;
		}
		let localSha = "";
		try {
			localSha = await blobSha1(await readRel(baseRel + "/" + rel));
		} catch (e) {
			localSha = "";
		}
		if (localSha !== info.sha) {
			need.push({ rel: rel, sha: info.sha });
		}
	}
	const extras = [];
	for (const rel of localFiles.keys()) {
		if (!remoteFiles.has(rel)) {
			extras.push(rel);
		}
	}
	return {
		name: name,
		baseRel: baseRel,
		isNewExt: isNewExt,
		files: remoteFiles,
		need: need,
		extras: extras,
	};
}

/* ---------------- 下载与写盘 ---------------- */

function encodePath(text) {
	return text
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

async function downloadFile(parsed, branch, name, rel, token, mirror) {
	const pathInRepo = encodePath(name + "/" + rel);
	const rawUrl = "https://raw.githubusercontent.com/" + parsed.owner + "/" + parsed.repo + "/" + encodeURIComponent(branch) + "/" + pathInRepo;
	let response = null;
	try {
		response = await fetch(mirror + rawUrl);
	} catch (e) {
		response = null;
	}
	if (!response || !response.ok) {
		const apiUrl = "https://api.github.com/repos/" + parsed.owner + "/" + parsed.repo + "/contents/" + pathInRepo + "?ref=" + encodeURIComponent(branch);
		try {
			response = await ghFetch(apiUrl, { token: token, raw: true });
		} catch (e) {
			throw new Error("《" + name + "/" + rel + "》下载失败：" + errText(e));
		}
	}
	if (!response.ok) {
		throw new Error("《" + name + "/" + rel + "》下载失败（HTTP " + response.status + "）");
	}
	return new Uint8Array(await response.arrayBuffer());
}

function writeLocalFile(localDir, rel, bytes) {
	const full = nodePath ? nodePath.join(localDir, ...rel.split("/")) : localDir + "/" + rel;
	const parent = nodePath ? nodePath.dirname(full) : localDir;
	if (!nodeFs.existsSync(parent)) {
		nodeFs.mkdirSync(parent, { recursive: true });
	}
	nodeFs.writeFileSync(full, bytes);
}

function registerNewExtension(name) {
	const list = lib.config.extensions;
	if (list && typeof list.includes === "function" && !list.includes(name)) {
		if (typeof list.add === "function") {
			list.add(name);
		} else {
			list.push(name);
		}
		game.saveConfig("extensions", list);
	}
	game.saveConfig("extension_" + name + "_enable", true);
}

/* ---------------- 主流程 ---------------- */

let checking = false;
let autoChecked = false;

function formatPlan(plan) {
	const lines = [];
	for (const item of plan) {
		const tag = item.isNewExt ? "（新扩展）" : "";
		const cut = item.extras && item.extras.length ? "，清理旧文件 " + item.extras.length + " 个" : "";
		lines.push(item.name + tag + "：" + item.need.length + " 个文件" + cut);
	}
	const shown = lines.slice(0, 8);
	if (lines.length > 8) {
		shown.push("……等 " + lines.length + " 个扩展");
	}
	return shown.join("\n");
}

async function runCheck(options) {
	const opts = options || {};
	const manual = !!opts.manual;
	const force = !!opts.force;
	if (!STORAGE) {
		if (manual) {
			alert("这台设备既没有电脑版的文件权限，也没有手机端的文件接口，无法自动更新。");
		}
		return;
	}
	if (checking) {
		if (manual) {
			alert("正在检查中，请稍候。");
		}
		return;
	}
	const parsed = parseRepo(cfg("repo", DEFAULT_REPO));
	if (!parsed) {
		if (manual) {
			alert("仓库地址不正确，应形如：用户名/仓库名");
		}
		return;
	}
	checking = true;
	try {
		const token = String(cfg("token", "")).trim();
		const mirror = normalizeMirror(cfg("mirror", ""));
		const cleanup = cfg("cleanup", true) !== false;
		const cloud = await loadCloud(parsed, token, mirror);
		const branch = cloud.branch;
		const extensions = cloud.extensions;
		if (!extensions.length) {
			if (manual) {
				alert("仓库里没有找到扩展（每个扩展文件夹的第一层必须有 extension.js）。");
			}
			return;
		}
		log("数据来源：" + cloud.source + "，共 " + extensions.length + " 个扩展");
		const plan = [];
		for (const item of extensions) {
			const diff = await diffExtension(item.name, item.files);
			if (force) {
				diff.need = Array.from(item.files.keys()).map((rel) => {
					return { rel: rel, sha: item.files.get(rel).sha };
				});
			}
			if (!cleanup) {
				diff.extras = [];
			}
			if (diff.need.length || diff.extras.length) {
				plan.push(diff);
			}
		}
		if (!plan.length) {
			if (manual) {
				alert("已是最新：" + extensions.length + " 个扩展与云端完全一致。");
			}
			return;
		}
		let total = 0;
		for (const item of plan) {
			total += item.need.length;
		}
		const asked = force
			? "强制重下：" + plan.length + " 个扩展，共 " + total + " 个文件。\n\n" + formatPlan(plan) + "\n\n现在开始吗？"
			: "云端有变化，共 " + total + " 个文件需要同步：\n\n" + formatPlan(plan) + "\n\n同名扩展会以云端为准整体替换，现在开始吗？";
		if (!confirm(asked)) {
			return;
		}
		const payload = [];
		for (const item of plan) {
			for (const file of item.need) {
				const bytes = await downloadFile(parsed, branch, item.name, file.rel, token, mirror);
				const sha = await blobSha1(bytes);
				if (sha !== file.sha) {
					throw new Error(
						"《" + item.name + "/" + file.rel + "》校验失败（云端 " + String(file.sha).slice(0, 8) + "，下载得到 " + sha.slice(0, 8) + "），已中止，未修改任何文件。"
					);
				}
				payload.push({ absRel: item.baseRel + "/" + file.rel, bytes: bytes });
			}
		}
		for (const item of payload) {
			await writeRel(item.absRel, item.bytes);
		}
		let removed = 0;
		for (const item of plan) {
			for (const rel of item.extras) {
				try {
					await removeRel(item.baseRel + "/" + rel);
					removed++;
				} catch (e) {
					log("删除失败 " + item.name + "/" + rel);
				}
			}
		}
		const fresh = [];
		for (const item of plan) {
			if (item.isNewExt) {
				fresh.push(item.name);
			}
		}
		for (const name of fresh) {
			registerNewExtension(name);
		}
		saveCfg("lastsync", String(Date.now()));
		log("同步完成，" + payload.length + " 个文件，清理 " + removed + " 个");
		const extra = fresh.length ? "\n已自动启用新扩展：" + fresh.join("、") : "";
		const cutText = removed ? "，清理旧文件 " + removed + " 个" : "";
		alert("同步完成：更新 " + payload.length + " 个文件" + cutText + "。\n请重启游戏后生效。" + extra);
	} finally {
		checking = false;
	}
}

/* ---------------- 扩展定义 ---------------- */

export default function () {
	return {
		name: "新罗服云端更新",
		editable: false,
		config: {
			repo: {
				name: "仓库地址",
				intro: "已预填 jiluo-luos/noname-ext，一般不需要改。也可填完整网址 https://github.com/用户名/仓库名。程序会扫描仓库根目录下所有含 extension.js 的文件夹，各视为一个扩展。",
				init: DEFAULT_REPO,
				input: true,
				onblur: function () {
					saveInput(this, "repo");
				},
			},
			auto: {
				name: "启动时自动检查",
				intro: "开启后每次启动游戏（不在联机房间时）会与云端核对一次文件指纹；发现差异会先询问你，确认后才下载。",
				init: true,
			},
			cleanup: {
				name: "同名扩展整体替换",
				intro: "开启后同名扩展以云端为准：云端已删掉的文件会从本地一并删除。关闭则只覆盖新增，不动本地多余文件。",
				init: true,
			},
			branch: {
				name: "分支",
				intro: "留空则默认 main；main 不存在时会自动再试 master。",
				init: "",
				input: true,
				onblur: function () {
					saveInput(this, "branch");
				},
			},
			mirror: {
				name: "下载加速前缀",
				intro: "可选。直连 raw.githubusercontent.com 不通时，可填加速站前缀（如 https://mirror.ghproxy.com/）。留空为直连。",
				init: "",
				input: true,
				onblur: function () {
					saveInput(this, "mirror");
				},
			},
			token: {
				name: "GitHub Token",
				intro: "可选。填写后走官方接口（每小时 5000 次），不会受普通接口限流影响。注意：会明文保存在游戏设置中，请使用只授予 repo 权限的令牌。",
				init: "",
				input: true,
				onblur: function () {
					saveInput(this, "token");
				},
			},
			checknow: {
				name: '<span style="text-decoration: underline;">立即检查更新</span>',
				intro: "立即与云端核对，只下载有变化的文件。",
				clear: true,
				onclick: function () {
					runCheck({ manual: true }).catch((e) => alert("检查更新失败：" + errText(e)));
					return false;
				},
			},
			redownload: {
				name: '<span style="text-decoration: underline;">强制重下全部</span>',
				intro: "忽略指纹比对，把所有扩展的全部文件重新下载覆盖。谨慎使用。",
				clear: true,
				onclick: function () {
					runCheck({ manual: true, force: true }).catch((e) => alert("重下失败：" + errText(e)));
					return false;
				},
			},
		},
		prepare: function () {
			setTimeout(() => {
				if (autoChecked) {
					return;
				}
				autoChecked = true;
				if (cfg("auto", true) === false) {
					return;
				}
				if (game.online || game.onlineroom || lib.config.mode === "connect") {
					return;
				}
				runCheck({}).catch((e) => log("自动检查失败：" + errText(e)));
			}, 2500);
		},
		package: {
			intro: "按文件指纹与新罗服云端仓库自动对齐扩展：仓库地址已内嵌，打开即用；同名扩展以云端为准整体替换，只下载有变化的文件，写入后重启游戏生效。电脑版与手机版（PE）均可。",
			author: "无名杀工坊",
			version: "1.2.0",
		},
	};
}
