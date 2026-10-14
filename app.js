import { MODELS } from "./config.js";

const $ = (id) => document.getElementById(id);
const BASE = "https://gen.pollinations.ai";
const STORAGE = "echo-island-pollen";
const STATE = "echo-island-auth-state";
const PENDING = "echo-island-pending-auth";
// An embedded Space can have third-party storage blocked; top-level mode still works.
const store = {
	get: (key) => {
		try {
			return sessionStorage.getItem(key);
		} catch {
			return null;
		}
	},
	set: (key, value) => {
		try {
			sessionStorage.setItem(key, value);
			return true;
		} catch {
			return false;
		}
	},
	remove: (key) => {
		try {
			sessionStorage.removeItem(key);
		} catch {
			/* blocked storage */
		}
	},
};
let token = store.get(STORAGE) || "";
let audioUrl = "";
let captionsUrl = "";
let imageUrl = "";
let busy = false;
let words = [];

function status(message, error = false) {
	$("status").textContent = message;
	$("status").classList.toggle("error", error);
}
function connected() {
	$("connect").innerHTML = token
		? "POLLEN CONNECTED <span>✳</span>"
		: "CONNECT POLLEN <span>↗</span>";
	$("connect").setAttribute(
		"aria-label",
		token ? "Disconnect Pollen" : "Connect your own Pollen",
	);
}
function cleanUrl() {
	history.replaceState(null, "", location.pathname + location.search);
}
function rememberState(state) {
	const inTab = store.set(STATE, state);
	try {
		// Only the nonce is shared across tabs; the returned grant stays in sessionStorage.
		localStorage.setItem(
			PENDING,
			JSON.stringify({ state, until: Date.now() + 30 * 60_000 }),
		);
		return true;
	} catch {
		return inTab;
	}
}
function consumeState(returned) {
	const inTab = store.get(STATE);
	store.remove(STATE);
	let acrossTabs = null;
	try {
		const pending = JSON.parse(localStorage.getItem(PENDING) || "null");
		localStorage.removeItem(PENDING);
		if (pending?.until > Date.now()) acrossTabs = pending.state;
	} catch {
		/* Storage can be disabled in embedded/private browsers. */
	}
	return !!returned && (returned === inTab || returned === acrossTabs);
}
function receiveAuth() {
	const params = new URLSearchParams(location.hash.slice(1));
	if (!params.has("api_key") && !params.has("error")) return;
	cleanUrl();
	const validState = consumeState(params.get("state"));
	if (validState && params.get("api_key")) {
		token = params.get("api_key");
		store.set(STORAGE, token);
		status("Connected. Your story can begin.");
	} else {
		status(
			params.has("error")
				? "Sign-in was cancelled."
				: "Sign-in check failed; please reconnect.",
			true,
		);
	}
	$("character").value = store.get("echo-island-draft") || "";
	store.remove("echo-island-draft");
	updateCount();
	connected();
}
function login() {
	if (window.self !== window.top) {
		$("iframeNotice").hidden = false;
		$("openTab").href = location.href;
		status("Open this Space in its own tab to finish sign-in.");
		return;
	}
	const state = crypto.randomUUID();
	if (!rememberState(state)) {
		status(
			"This browser blocks sign-in storage. Open the studio in a regular tab.",
			true,
		);
		return;
	}
	store.set("echo-island-draft", $("character").value);
	const url = new URL("https://enter.pollinations.ai/authorize");
	url.search = new URLSearchParams({
		redirect_uri: location.origin + location.pathname,
		scope: "usage",
		models: "text,image,audio",
		budget: "5",
		expiry: "7",
		state,
	}).toString();
	location.assign(url);
}
function updateCount() {
	$("counter").textContent = `${$("character").value.length} / 350`;
}

async function textScene(idea, mood) {
	const response = await fetch(`${BASE}/v1/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: MODELS.story,
			max_completion_tokens: 650,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content:
						"Create a warm, original voice-character vignette. Return ONLY JSON with name (2–5 words), tagline (5–11 words), artPrompt (one vivid visual sentence), and script (2–3 vivid sentences, 30–65 words, first-person speech from this character). Make the voice personal, surprising, and natural to speak aloud. Avoid markdown, quotes around script, IP characters, violence and trailing stage directions.",
				},
				{
					role: "user",
					content: `Character: ${idea}\nMood: ${mood}. Write in English.`,
				},
			],
		}),
	});
	if (!response.ok)
		throw new Error(
			response.status === 401 || response.status === 403
				? "Session not accepted. Please reconnect."
				: `Story unavailable (HTTP ${response.status}).`,
		);
	const result = await response.json();
	const raw = String(result.choices?.[0]?.message?.content || "");
	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start < 0 || end <= start)
		throw new Error("The story came back incomplete. Try again.");
	const scene = JSON.parse(raw.slice(start, end + 1));
	if (!scene.name || !scene.script || !scene.artPrompt)
		throw new Error("The scene was missing a piece. Try again.");
	return Object.fromEntries(
		["name", "tagline", "script", "artPrompt"].map((key) => [
			key,
			String(scene[key] ?? "").slice(0, key === "script" ? 750 : 240),
		]),
	);
}

async function speechFor(scene) {
	const response = await fetch(`${BASE}/v1/audio/speech/with-timestamps`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: MODELS.voice,
			input: scene.script,
			voice: $("voice").value,
			response_format: "mp3",
		}),
	});
	if (!response.ok)
		throw new Error(`Voice unavailable (HTTP ${response.status}).`);
	const data = await response.json();
	const bytes = Uint8Array.from(atob(data.audio_base64), (c) =>
		c.charCodeAt(0),
	);
	if (audioUrl) URL.revokeObjectURL(audioUrl);
	if (captionsUrl) URL.revokeObjectURL(captionsUrl);
	const alignment = data.normalized_alignment || data.alignment;
	const end = Math.max(
		1,
		Math.ceil((alignment?.character_end_times_seconds?.at(-1) || 30) + 0.5),
	);
	const stamp = new Date(end * 1000).toISOString().slice(11, 23);
	const caption = scene.script.replace(/\s+/g, " ").replace(/-->/g, "→");
	captionsUrl = URL.createObjectURL(
		new Blob([`WEBVTT\n\n00:00:00.000 --> ${stamp}\n${caption}\n`], {
			type: "text/vtt",
		}),
	);
	$("captions").src = captionsUrl;
	audioUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
	$("audio").src = audioUrl;
	$("play").disabled = false;
	showAlignedWords(alignment, scene.script);
}

function showAlignedWords(alignment, fallback) {
	const chars = alignment?.characters;
	const starts = alignment?.character_start_times_seconds;
	const ends = alignment?.character_end_times_seconds;
	if (
		!Array.isArray(chars) ||
		chars.length !== starts?.length ||
		chars.length !== ends?.length
	) {
		$("storyLine").textContent = fallback;
		words = [];
		return;
	}
	const rendered = chars.join("");
	const offsets = [];
	let offset = 0;
	for (const char of chars) {
		offsets.push(offset);
		offset += char.length;
	}
	let cursor = 0;
	words = [];
	const fragment = document.createDocumentFragment();
	for (const { segment, index, isWordLike } of new Intl.Segmenter(undefined, {
		granularity: "word",
	}).segment(rendered)) {
		if (!isWordLike) {
			fragment.append(document.createTextNode(segment));
			continue;
		}
		while (
			cursor < chars.length &&
			offsets[cursor] + chars[cursor].length <= index
		)
			cursor++;
		const first = cursor;
		while (cursor < chars.length && offsets[cursor] < index + segment.length)
			cursor++;
		const span = document.createElement("span");
		span.textContent = segment;
		if (cursor > first)
			words.push({
				element: span,
				start: starts[first],
				end: ends[cursor - 1],
			});
		fragment.append(span);
	}
	$("storyLine").replaceChildren(fragment);
}

async function portraitFor(scene, currentScene) {
	const prompt = `${scene.artPrompt}. Whimsical watercolor book illustration, thoughtful character portrait, midnight blue and warm coral palette, textured paper, no lettering, no words.`;
	const url = new URL(`${BASE}/image/${encodeURIComponent(prompt)}`);
	url.search = new URLSearchParams({
		model: MODELS.image,
		width: "512",
		height: "512",
		safe: "true",
	}).toString();
	try {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (
			!response.ok ||
			!response.headers.get("content-type")?.startsWith("image/")
		)
			return;
		const blob = await response.blob();
		if (currentScene !== $("sceneNo").textContent) return;
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		imageUrl = URL.createObjectURL(blob);
		const img = document.createElement("img");
		img.src = imageUrl;
		img.alt = `Generated portrait of ${scene.name}`;
		$("portrait").replaceChildren(img);
	} catch {
		/* The illustrated placeholder remains on image failure. */
	}
}

async function create() {
	const idea = $("character").value.trim();
	if (!idea || busy) return;
	if (!token) {
		login();
		return;
	}
	busy = true;
	$("create").disabled = true;
	$("play").disabled = true;
	$("audio").pause();
	status("Meeting your character…");
	try {
		const scene = await textScene(idea, $("mood").value);
		const take = `TAKE ${String(Date.now() % 1000).padStart(3, "0")}`;
		$("sceneNo").textContent = take;
		$("characterTag").textContent =
			scene.tagline.toUpperCase() || "AN ORIGINAL VOICE";
		$("characterName").textContent = scene.name;
		$("storyLine").textContent = scene.script;
		$("portrait").innerHTML =
			'<div class="portrait-art"><span>✧</span><div class="face">◡</div></div>';
		$("progress").style.width = "0%";
		portraitFor(scene, take);
		status("Giving the scene its voice…");
		await speechFor(scene);
		status("Your moment is ready. Press play to listen.");
	} catch (error) {
		status(error.message || "The studio is resting. Try again.", true);
	} finally {
		busy = false;
		$("create").disabled = false;
	}
}

$("connect").addEventListener("click", () => {
	if (!token) {
		login();
		return;
	}
	token = "";
	store.remove(STORAGE);
	status("Disconnected from Pollen.");
	connected();
});
$("createForm").addEventListener("submit", (event) => {
	event.preventDefault();
	create();
});
$("character").addEventListener("input", updateCount);
$("play").addEventListener("click", async () => {
	if ($("audio").paused) {
		try {
			await $("audio").play();
		} catch {
			status("Your browser could not play this recording.", true);
		}
	} else $("audio").pause();
});
$("audio").addEventListener("play", () => {
	$("play").textContent = "Ⅱ";
	$("player").classList.add("playing");
});
$("audio").addEventListener("pause", () => {
	$("play").textContent = "▶";
	$("player").classList.remove("playing");
});
$("audio").addEventListener("loadedmetadata", () => {
	const seconds = Math.round($("audio").duration || 0);
	$("duration").textContent =
		`${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
$("audio").addEventListener("timeupdate", () => {
	const seconds = $("audio").currentTime;
	$("progress").style.width =
		`${Math.min(100, (seconds / ($("audio").duration || 1)) * 100)}%`;
	for (const word of words)
		word.element.classList.toggle(
			"active-word",
			seconds >= word.start && seconds < word.end,
		);
});

if (window.self !== window.top) {
	$("iframeNotice").hidden = false;
	$("openTab").href = location.href;
}
receiveAuth();
connected();
updateCount();
