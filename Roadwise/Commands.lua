-- /roadwise and /rw. Search is English flight masters and towns, plus anything you pin.
local _, ns = ...

local lastResults = {}

function ns.Print(msg)
	local text = "|cffd4b44aRoadwise|r " .. tostring(msg)
	if DEFAULT_CHAT_FRAME then
		DEFAULT_CHAT_FRAME:AddMessage(text)
	else
		print(text)
	end
end

local function norm(s)
	s = tostring(s or ""):lower()
	s = s:gsub("[^%w%s']", " ")
	s = s:gsub("%s+", " ")
	return (s:match("^%s*(.-)%s*$"))
end

local function zoneLabel(map)
	if C_Map and C_Map.GetMapInfo then
		local info = C_Map.GetMapInfo(map)
		if info and info.name and info.name ~= "" then
			return info.name
		end
	end
	return (ns.zoneNames and ns.zoneNames[map]) or ("map " .. tostring(map))
end

function ns.Search(query)
	local want = norm(query)
	if want == "" then
		return {}
	end
	local words = {}
	for word in want:gmatch("%S+") do
		words[#words + 1] = word
	end
	local places = {}
	local pins = ns.DB and ns.DB.pins or {}
	for i = 1, #pins do
		places[#places + 1] = pins[i]
	end
	local graph = ns.GetGraph()
	for i = 1, #graph.places do
		places[#places + 1] = graph.places[i]
	end
	local hits = {}
	for i = 1, #places do
		local place = places[i]
		local name = norm(place.name)
		local score
		if name == want then
			score = 100
		else
			local all = true
			for w = 1, #words do
				if not name:find(words[w], 1, true) then
					all = false
					break
				end
			end
			if all then
				score = name:find(want, 1, true) and 70 or 50
			end
		end
		if score then
			hits[#hits + 1] = { place = place, score = score, pin = place.pin or false }
		end
	end
	table.sort(hits, function(a, b)
		if a.score ~= b.score then
			return a.score > b.score
		end
		return (a.place.name or "") < (b.place.name or "")
	end)
	local out, seen = {}, {}
	for i = 1, #hits do
		local place = hits[i].place
		local key = norm(place.name) .. "@" .. tostring(place.map)
		if not seen[key] then
			seen[key] = true
			out[#out + 1] = place
			if #out >= 8 then
				break
			end
		end
	end
	lastResults = out
	return out
end

local function factionWarning(place)
	if not place.flight or place.flight == "N" or not UnitFactionGroup then
		return
	end
	local faction = UnitFactionGroup("player")
	if (place.flight == "H" and faction == "Alliance") or (place.flight == "A" and faction == "Horde") then
		ns.Print("That flight master is the other faction. The road still goes there.")
	end
end

local function start(place)
	factionWarning(place)
	local steps, err = ns.Plan({
		name = place.name,
		map = place.map,
		x = place.x,
		y = place.y,
		flight = place.flight,
	})
	if not steps then
		ns.Print(err or "No route.")
		return
	end
	local minutes = math.floor(((steps.seconds or 0) / 60) + 0.5)
	if minutes < 1 then
		ns.Print("Road to " .. place.name .. ". You are close.")
	else
		ns.Print(string.format("Road to %s. About %d min if you stay on the road.", place.name, minutes))
	end
	if ns.RefreshMap then
		ns.RefreshMap()
	end
	ns.UpdateGuide()
end

function ns.ZoneId(text)
	if not text or text == "" then
		return nil
	end
	local asNumber = tonumber(text)
	if asNumber then
		return asNumber
	end
	local want = norm(text)
	local names = ns.zoneNames or {}
	for map, name in pairs(names) do
		if norm(name) == want then
			return map
		end
	end
	local hit
	for map, name in pairs(names) do
		if norm(name):find(want, 1, true) then
			if hit and hit ~= map then
				return nil
			end
			hit = map
		end
	end
	if hit then
		return hit
	end
	if C_Map and C_Map.GetMapInfo and not ns.localizedZones then
		ns.localizedZones = {}
		for id = 1, 3000 do
			local info = C_Map.GetMapInfo(id)
			if info and info.name and info.name ~= "" then
				local key = norm(info.name)
				if not ns.localizedZones[key] then
					ns.localizedZones[key] = id
				end
			end
		end
	end
	if not ns.localizedZones then
		return nil
	end
	if ns.localizedZones[want] then
		return ns.localizedZones[want]
	end
	local loc
	for key, map in pairs(ns.localizedZones) do
		if key:find(want, 1, true) then
			if loc and loc ~= map then
				return nil
			end
			loc = map
		end
	end
	return loc
end

local function help()
	ns.Print("/rw <name> — road to a flight master, town, or a pin")
	ns.Print("/rw <number> — pick from the last list")
	ns.Print("/rw go [zone] x y — road to coordinates on a zone map")
	ns.Print("/rw pin Name — remember the NPC you are standing on")
	ns.Print("/rw pins — list pins    /rw forget Name — drop one")
	ns.Print("/rw flight on|off — discovered flight paths, or roads only")
	ns.Print("/rw where — your zone and coordinates    /rw clear — stop")
end

local function handle(msg)
	msg = (msg or ""):match("^%s*(.-)%s*$") or ""
	local cmd, rest = msg:match("^(%S+)%s*(.*)$")
	cmd = cmd and cmd:lower() or ""
	rest = rest or ""
	if cmd == "" or cmd == "help" then
		help()
		return
	end
	if cmd == "clear" or cmd == "stop" then
		ns.ClearGuide()
		ns.Print("Cleared.")
		return
	end
	if cmd == "where" then
		local player = ns.PlayerPos()
		if not player then
			ns.Print("No position yet. Step outside and try again.")
			return
		end
		ns.Print(string.format("%s  %.1f, %.1f", zoneLabel(player.map), player.x, player.y))
		return
	end
	if cmd == "flight" then
		local value = rest:lower()
		if value == "off" or value == "0" or value == "no" then
			ns.DB.useFlight = false
		elseif value == "on" or value == "1" or value == "yes" then
			ns.DB.useFlight = true
		elseif value == "" then
			ns.DB.useFlight = not ns.DB.useFlight
		else
			ns.Print("Usage: /rw flight on|off")
			return
		end
		ns.Print(ns.DB.useFlight and "Flight paths are on." or "Flight paths are off. The arrow stays on the ground.")
		return
	end
	if cmd == "pins" then
		local pins = ns.DB.pins or {}
		if #pins == 0 then
			ns.Print("No pins. Stand on an NPC and run /rw pin Their Name.")
			return
		end
		for i = 1, #pins do
			ns.Print(string.format("%d. %s   %.1f, %.1f", i, pins[i].name, pins[i].x, pins[i].y))
		end
		return
	end
	if cmd == "forget" then
		if rest == "" then
			ns.Print("Usage: /rw forget Name")
			return
		end
		local want = norm(rest)
		local kept, removed = {}, 0
		local pins = ns.DB.pins or {}
		for i = 1, #pins do
			local name = norm(pins[i].name)
			if name == want or name:find(want, 1, true) then
				removed = removed + 1
			else
				kept[#kept + 1] = pins[i]
			end
		end
		ns.DB.pins = kept
		ns.Print(removed > 0 and ("Forgot " .. removed .. ".") or "No pin by that name.")
		return
	end
	if cmd == "pin" then
		if rest == "" then
			ns.Print("Usage: /rw pin Name")
			return
		end
		local player = ns.PlayerPos()
		if not player then
			ns.Print("No position. Stand on the NPC outdoors, then pin them.")
			return
		end
		ns.DB.pins = ns.DB.pins or {}
		local want = norm(rest)
		for i = 1, #ns.DB.pins do
			if norm(ns.DB.pins[i].name) == want then
				ns.DB.pins[i] = { name = rest, map = player.map, x = player.x, y = player.y }
				ns.Print(string.format("Updated %s at %.1f, %.1f.", rest, player.x, player.y))
				return
			end
		end
		ns.DB.pins[#ns.DB.pins + 1] = { name = rest, map = player.map, x = player.x, y = player.y }
		ns.Print(string.format("Pinned %s at %.1f, %.1f. /rw %s will use it.", rest, player.x, player.y, rest))
		return
	end
	if cmd == "go" then
		local head, xs, ys = rest:match("^(.-)%s+([%d%.]+)%s+([%d%.]+)%s*$")
		local x, y = tonumber(xs), tonumber(ys)
		if not x then
			xs, ys = rest:match("^([%d%.]+)%s+([%d%.]+)%s*$")
			x, y = tonumber(xs), tonumber(ys)
			head = ""
		end
		if not x or not y or x < 0 or x > 100 or y < 0 or y > 100 then
			ns.Print("Usage: /rw go [zone] x y    for example /rw go Elwynn Forest 42.4 65.8")
			return
		end
		local map
		if head and head ~= "" then
			map = ns.ZoneId(head)
			if not map then
				ns.Print("Unknown zone \"" .. head .. "\". You can also pass the map id.")
				return
			end
		else
			local player = ns.PlayerPos()
			if not player then
				ns.Print("Add the zone: /rw go Elwynn Forest 42.4 65.8")
				return
			end
			map = player.map
		end
		start({ name = string.format("%s %.1f, %.1f", zoneLabel(map), x, y), map = map, x = x, y = y })
		return
	end
	local pick = tonumber(cmd)
	if pick and rest == "" and lastResults[pick] then
		start(lastResults[pick])
		return
	end
	local hits = ns.Search(msg)
	if #hits == 0 then
		ns.Print("Nothing surveyed matches \"" .. msg .. "\". Stand on them and run /rw pin " .. msg .. ".")
		return
	end
	local exact
	local exactCount = 0
	local want = norm(msg)
	for i = 1, #hits do
		if norm(hits[i].name) == want then
			exactCount = exactCount + 1
			exact = hits[i]
		end
	end
	if exactCount == 1 then
		start(exact)
		return
	end
	if #hits == 1 then
		start(hits[1])
		return
	end
	ns.Print("Which one? Run /rw and the number.")
	for i = 1, #hits do
		ns.Print(string.format("%d. %s   %s", i, hits[i].name, zoneLabel(hits[i].map)))
	end
end

function ns.InitCommands()
	SLASH_ROADWISE1 = "/roadwise"
	SLASH_ROADWISE2 = "/rw"
	SlashCmdList["ROADWISE"] = handle
end
