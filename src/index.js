import indexHTML from "../public/index.html";
import url from "node:url";

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
			error: "Domain parameter is required",
		};
	}

	domain = url.domainToASCII(String(domain).trim());

	if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
		return {
			error: "Invalid domain format",
		};
	}

	return "fuck";
}
