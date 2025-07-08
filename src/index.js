import indexHTML from "../public/index.html";
import url from "node:url";
import net from "node:net";
import fallback from "./fallback.js";

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const pathname = url.pathname;

		if (pathname === "/") {
			return new Response(indexHTML, {
				headers: {
					"Content-Type": "text/html",
				},
			});
		}

		if (pathname === "/query") {
			const result = await queryWhois(request, env);
			return new Response(JSON.stringify(result), {
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		// 404 处理
		return new Response("Not Found", { status: 404 });
	},
};

// 自定义函数 - 你可以在这里添加自己的逻辑
async function queryWhois(request) {
	let domain = new URL(request.url).searchParams.get("domain");
	if (!domain) {
		return {
			code: -1,
			msg: "域名不能为空！",
		};
	}

	if (domain.startsWith("http://") || domain.startsWith("https://")) {
		try {
			domain = new URL(domain).hostname;
		} catch (e) {
			return {
				code: -1,
				msg: "域名格式不正确！",
			};
		}
	}

	domain = url.domainToASCII(String(domain).trim());

	if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
		return {
			code: -1,
			msg: "域名格式不正确！",
		};
	}

	let result = null;
	let result2 = null;
	let whoisServer = null;
	const domainSuffix = domain.split(".").slice(-1)[0] || null;
	try {
		result = await whois(domainSuffix, "whois.iana.org");
		if (!result) {
			return {
				code: -1,
				msg: "无法获取 WHOIS 服务器数据",
			};
		}
		whoisServer = result.match(/whois:\s*(\S+)\n/i);
		if (!whoisServer || !whoisServer[1]) {
			console.log(findFallback(domainSuffix), domainSuffix);
			if (!(whoisServer = findFallback(domainSuffix))) {
				return {
					code: 2,
					msg: "未找到此域名的 WHOIS 服务器",
					data: {
						whoisData: result,
						domainData: "此域名没有 WHOIS 服务器",
						domainSuffix,
					},
				};
			}
		} else whoisServer = whoisServer[1];

		let queryDomain = domain;
		if (domainSuffix === "jp") {
			// queryDomain = domain + "/e";
		}
		try {
			result2 = await whois(queryDomain, whoisServer);
		} catch (error) {
			if (error.code === "ECONNREFUSED") {
				return {
					code: -2,
					msg: "无法连接到 WHOIS 服务器: " + whoisServer,
					result1: result,
					result2: result2,
					whoisServer,
				};
			} else {
				return {
					code: -3,
					msg: `访问此域名的 WHOIS 服务器 ${whoisServer} 时出现了错误: \n${error.message}`,
					result1: result,
					result2: result2,
					whoisServer,
				};
			}
		}
	} catch (error) {
		return {
			code: -22,
			msg: "无法获取 WHOIS 数据: " + error.message,
			result1: result,
			result2: result2,
			whoisServer,
		};
	}

	return {
		code: 1,
		data: {
			whoisData: result,
			domainData: result2,
			domainSuffix,
		},
	};
}

function whois(domain, server = "whois.iana.org") {
	return new Promise((resolve, reject) => {
		const client = new net.Socket();
		let result = "";

		client.connect(43, server, () => {
			client.write(domain + "\r\n");
		});

		client.on("data", (data) => {
			result += data.toString();
		});

		client.on("end", () => {
			result = result
				.trim()
				.split("\n")
				.map((line) => line.trim())
				.join("\n");
			resolve(result);
		});

		client.on("error", (err) => {
			reject(err);
		});
	});
}

function rwhois(host, query) {
	return new Promise((resolve, reject) => {
		console.log("Connecting to RWHOIS server:", host);
		const sock = net.createConnection(4321, host, () => {
			sock.write("-rwhois 1.5\r\n");
			sock.write(query + "\r\n");
			sock.write("-quit\r\n");
		});
		console.log("Connected to RWHOIS server:", host);
		let buf = "";
		sock.on("data", (d) => (buf += d));
		sock.on("end", () => resolve(buf));
		sock.on("error", reject);
	});
}

function findFallback(suffix) {
	for (const entry of fallback) {
		if (entry[0].includes("." + suffix)) {
			return entry[1];
		}
	}
	return null;
}
