-- Offline checks for the road graph. Run from the Roadwise folder:
--   lua5.1 tests/run.lua
local ns = {}

local function load(path)
	local chunk, err = loadfile(path)
	if not chunk then
		error(err)
	end
	chunk("Roadwise", ns)
end

load("Graph.lua")
load("Data/Roads.lua")
load("Data/NPCs.lua")
load("Commands.lua")

local bounds = dofile("tests/bounds.lua")

local function worldOf(map, x, y)
	local box = bounds[map]
	if not box then
		return nil
	end
	local wx = box.x0 + (y / 100) * (box.x1 - box.x0)
	local wy = box.y0 + (x / 100) * (box.y1 - box.y0)
	return wx, wy, box.cont
end

local graph = ns.BuildGraph(worldOf)
local failed = 0

local function check(ok, message)
	if ok then
		print("ok  " .. message)
	else
		failed = failed + 1
		print("FAIL  " .. message)
	end
end

if #graph.errors == 0 then
	check(true, "graph has no build errors")
else
	for i = 1, #graph.errors do
		check(false, graph.errors[i])
	end
end

local longest = 0
local longestWhere = ""
for id, list in pairs(graph.edges) do
	local from = graph.nodes[id]
	for i = 1, #list do
		local edge = list[i]
		if edge.kind == "walk" then
			local to = graph.nodes[edge.to]
			local span = ns.Yards(from.wx, from.wy, to.wx, to.wy)
			if span > longest then
				longest = span
				longestWhere = string.format("%s %.1f,%.1f -> %.1f,%.1f", from.map, from.x, from.y, to.x, to.y)
			end
			if from.cont ~= to.cont then
				check(false, "walk edge crosses continents at " .. (from.name or from.map))
			end
		end
	end
end
check(longest < 520, string.format("longest walk edge is %.0f yd (%s)", longest, longestWhere))

local function find(name)
	for i = 1, #graph.nodes do
		if graph.nodes[i].name == name then
			return graph.nodes[i]
		end
	end
	return nil
end

local function reachable(startId)
	local seen = { [startId] = true }
	local queue = { startId }
	local n = 0
	while #queue > 0 do
		local id = table.remove(queue, 1)
		n = n + 1
		local list = graph.edges[id]
		for i = 1, #list do
			local to = list[i].to
			if not seen[to] then
				seen[to] = true
				queue[#queue + 1] = to
			end
		end
	end
	return n, seen
end

local stormwind = find("Stormwind Gate")
check(stormwind ~= nil, "Stormwind Gate exists")
if stormwind then
	local count, seen = reachable(stormwind.id)
	check(count == #graph.nodes, string.format("one road network (%d/%d nodes)", count, #graph.nodes))
	if count ~= #graph.nodes then
		local shown = 0
		for i = 1, #graph.nodes do
			if not seen[i] and graph.nodes[i].name and shown < 12 then
				print("  unreachable: " .. graph.nodes[i].name)
				shown = shown + 1
			end
		end
	end
end

local function hasKind(steps, kind)
	for i = 1, #steps do
		if steps[i].kind == kind then
			return true
		end
	end
	return false
end

local function hasName(steps, name)
	for i = 1, #steps do
		if steps[i].name == name then
			return true
		end
	end
	return false
end

local function route(fromName, toName)
	local a, b = find(fromName), find(toName)
	if not a or not b then
		check(false, "missing endpoint for " .. fromName .. " -> " .. toName)
		return nil
	end
	local steps = ns.ShortestPath(graph, a.id, b.id)
	if not steps then
		check(false, "no path " .. fromName .. " -> " .. toName)
		return nil
	end
	return steps
end

local tram = route("Stormwind Gate", "Ironforge Gate")
if tram then
	check(hasKind(tram, "tram"), string.format("Stormwind to Ironforge takes the tram (%.0f s)", tram.seconds or 0))
end

local boat = route("Menethil Harbor, Wetlands", "Auberdine, Darkshore")
if boat then
	check(hasKind(boat, "boat"), string.format("Menethil to Auberdine takes the boat (%.0f s)", boat.seconds or 0))
end

local lakeshire = route("Lakeshire, Redridge", "Stormwind, Elwynn")
if lakeshire then
	check(hasName(lakeshire, "Goldshire"), "Lakeshire to Stormwind passes Goldshire")
	check((lakeshire.seconds or 9999) < 2000, string.format("Lakeshire to Stormwind is %.0f s", lakeshire.seconds or 0))
	check(not hasName(lakeshire, "Thorium Point, Searing Gorge"), "Lakeshire does not detour through the Burning Steppes")
end

local sun = route("Crossroads, The Barrens", "Sun Rock Retreat, Stonetalon Mountains")
if sun then
	check(hasName(sun, "Barrens pass"), "Crossroads to Sun Rock uses the southern pass")
	check(not hasName(sun, "Talondeep Pass"), "Crossroads to Sun Rock does not loop over the peak")
end

local climb = route("Barrens pass", "Stonetalon Peak, Stonetalon Mountains")
if climb then
	check(hasName(climb, "Sun Rock Retreat, Stonetalon Mountains"), "the Stonetalon climb passes Sun Rock")
end

local peak = route("Crossroads, The Barrens", "Stonetalon Peak, Stonetalon Mountains")
if peak then
	check(hasName(peak, "Talondeep Pass"), "Crossroads to the Peak uses Talondeep, the north pass")
end

local ratchet = route("Ratchet, The Barrens", "Booty Bay, Stranglethorn")
if ratchet then
	check(hasKind(ratchet, "boat"), "Ratchet to Booty Bay takes the boat")
end

local zep = route("Orgrimmar Zeppelin", "Tirisfal Zeppelin")
if zep then
	check(hasKind(zep, "zeppelin"), "Orgrimmar to Tirisfal takes the zeppelin")
end

local darn = route("Darnassus Gate", "Auberdine, Darkshore")
if darn then
	check(hasKind(darn, "portal") and hasKind(darn, "boat"), "Darnassus reaches Auberdine by portal and boat")
end

local tunnel = route("Thelsamar, Loch Modan", "Ironforge, Dun Morogh")
if tunnel then
	local viaTunnel = hasName(tunnel, "North Gate Pass") or hasName(tunnel, "South Gate Pass")
		or hasName(tunnel, "North Gate Outpost") or hasName(tunnel, "South Gate Outpost")
	check(viaTunnel, "Thelsamar to Ironforge uses a tunnel")
	check(not hasName(tunnel, "Stormwind Gate"), "Thelsamar to Ironforge does not tour Stormwind")
end

local hills = route("The Sepulcher, Silverpine Forest", "Tarren Mill, Hillsbrad")
if hills then
	check((hills.seconds or 9999) < 4000, string.format("Sepulcher to Tarren Mill is %.0f s", hills.seconds or 0))
	check(not hasName(hills, "Stormwind Gate"), "Sepulcher to Tarren Mill does not tour Stormwind")
end

local river = route("Lakeshire, Redridge", "Morgan's Vigil, Burning Steppes")
if river then
	check(hasName(river, "Rog'mar, Riverglades") or hasName(river, "Farholde Keep, Riverglades") or hasName(river, "Powderfuse Port, Riverglades"), "Redridge reaches the Burning Steppes through Riverglades")
end

local feather = route("Feathermoon Dock", "Feathermoon, Feralas")
if feather then
	check(hasKind(feather, "boat"), "Feathermoon is a boat, not a swim")
end

ns.DB = { pins = { { name = "Mankrik's Wife", map = 1413, x = 51.0, y = 30.0 } } }
ns.GetGraph = function()
	return graph
end
local found = ns.Search("lakeshire")
check(#found == 1 and found[1].name == "Lakeshire, Redridge", "search finds Lakeshire")
local pinned = ns.Search("mankrik")
check(#pinned == 1 and pinned[1].name == "Mankrik's Wife", "search finds a pinned NPC")
local missing = ns.Search("zzzz-not-an-npc")
check(#missing == 0, "unknown names do not invent a destination")
check(ns.ZoneId("Elwynn Forest") == 1429, "Elwynn Forest resolves")
check(ns.ZoneId("1429") == 1429, "a map id resolves")

print(string.format("%d nodes, %d places", #graph.nodes, #graph.places))
if failed > 0 then
	print(failed .. " failed")
	os.exit(1)
end
print("all checks passed")
