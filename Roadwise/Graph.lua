-- Road graph and shortest path. No WoW APIs: the host passes world coordinates in.
local _, ns = ...

local WALK_YARDS_PER_SEC = 7
local MAX_WALK_EDGE = 420

local function yards(ax, ay, bx, by)
	local dx, dy = ax - bx, ay - by
	return math.sqrt(dx * dx + dy * dy)
end

local function nearly(a, b)
	return math.abs(a - b) < 0.31
end

function ns.Yards(ax, ay, bx, by)
	return yards(ax, ay, bx, by)
end

local function remember(graph, node)
	if not node.name then
		return
	end
	local places = graph.places
	for i = 1, #places do
		if places[i].node == node.id and places[i].name == node.name then
			return
		end
	end
	places[#places + 1] = {
		name = node.name,
		map = node.map,
		x = node.x,
		y = node.y,
		flight = node.flight,
		node = node.id,
	}
end

local function obtain(graph, map, x, y, name, flight)
	for i = 1, #graph.nodes do
		local node = graph.nodes[i]
		if node.map == map and nearly(node.x, x) and nearly(node.y, y) then
			if name and not node.name then
				node.name = name
			end
			if flight and not node.flight then
				node.flight = flight
			end
			remember(graph, node)
			return i
		end
	end
	local wx, wy, cont = graph.worldOf(map, x, y)
	if not wx then
		return nil
	end
	local id = #graph.nodes + 1
	graph.nodes[id] = {
		id = id,
		map = map,
		x = x,
		y = y,
		wx = wx,
		wy = wy,
		cont = cont,
		name = name,
		flight = flight,
	}
	graph.edges[id] = {}
	remember(graph, graph.nodes[id])
	return id
end

local function hasEdge(graph, a, b)
	local list = graph.edges[a]
	for i = 1, #list do
		if list[i].to == b then
			return true
		end
	end
	return false
end

local function linkDirect(graph, a, b, kind, name, cost, rough)
	if not a or not b or a == b then
		return
	end
	if hasEdge(graph, a, b) then
		return
	end
	local edge = { to = b, kind = kind, name = name, cost = cost, rough = rough and true or false }
	local back = { to = a, kind = kind, name = name, cost = cost, rough = rough and true or false }
	local listA = graph.edges[a]
	local listB = graph.edges[b]
	listA[#listA + 1] = edge
	listB[#listB + 1] = back
end

local function linkWalk(graph, a, b, name, rough)
	local A, B = graph.nodes[a], graph.nodes[b]
	if A.cont ~= B.cont then
		graph.errors[#graph.errors + 1] = "walk crosses continents near " .. (A.name or A.map)
		return
	end
	local span = yards(A.wx, A.wy, B.wx, B.wy)
	if A.map == B.map and span > MAX_WALK_EDGE then
		local pieces = math.ceil(span / MAX_WALK_EDGE)
		local prev = a
		local i = 1
		while i < pieces do
			local t = i / pieces
			local id = obtain(graph, A.map, A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t)
			if not id then
				break
			end
			local step = yards(graph.nodes[prev].wx, graph.nodes[prev].wy, graph.nodes[id].wx, graph.nodes[id].wy)
			linkDirect(graph, prev, id, "walk", name, step / WALK_YARDS_PER_SEC, rough)
			prev = id
			i = i + 1
		end
		local last = yards(graph.nodes[prev].wx, graph.nodes[prev].wy, B.wx, B.wy)
		linkDirect(graph, prev, b, "walk", name, last / WALK_YARDS_PER_SEC, rough)
		return
	end
	linkDirect(graph, a, b, "walk", name, span / WALK_YARDS_PER_SEC, rough)
end

local function findNear(graph, map, x, y)
	local best, bestD
	for i = 1, #graph.nodes do
		local node = graph.nodes[i]
		if node.map == map then
			local d = math.abs(node.x - x) + math.abs(node.y - y)
			if d < 0.45 and (not bestD or d < bestD) then
				best, bestD = i, d
			end
		end
	end
	return best
end

function ns.BuildGraph(worldOf)
	local graph = {
		nodes = {},
		edges = {},
		places = {},
		errors = {},
		worldOf = worldOf,
	}
	local roads = ns.roads or {}
	for r = 1, #roads do
		local road = roads[r]
		local prev
		local points = road.points
		for p = 1, #points do
			local pt = points[p]
			local id = obtain(graph, pt[1], pt[2], pt[3], pt[4], pt[5])
			if id and prev then
				linkWalk(graph, prev, id, road.name, road.rough)
			end
			if id then
				prev = id
			end
		end
	end
	local gates = ns.gates or {}
	for g = 1, #gates do
		local gate = gates[g]
		local a = findNear(graph, gate[2][1], gate[2][2], gate[2][3])
		local b = findNear(graph, gate[3][1], gate[3][2], gate[3][3])
		if not a or not b then
			graph.errors[#graph.errors + 1] = "gate missing a road node: " .. gate[1]
		else
			local A, B = graph.nodes[a], graph.nodes[b]
			local span = yards(A.wx, A.wy, B.wx, B.wy)
			if span > 80 then
				graph.errors[#graph.errors + 1] = string.format("gate %s is %.0f yards apart", gate[1], span)
			end
			linkDirect(graph, a, b, "gate", gate[1], math.max(span / WALK_YARDS_PER_SEC, 1), false)
		end
	end
	local portals = ns.portals or {}
	for p = 1, #portals do
		local portal = portals[p]
		local a = findNear(graph, portal.a[1], portal.a[2], portal.a[3])
		local b = findNear(graph, portal.b[1], portal.b[2], portal.b[3])
		if not a or not b then
			graph.errors[#graph.errors + 1] = "portal missing a road node: " .. (portal.kind or "?")
		else
			linkDirect(graph, a, b, portal.kind, portal.kind, (portal.minutes or 1) * 60, false)
		end
	end
	local extras = ns.extraPlaces or {}
	for i = 1, #extras do
		local place = extras[i]
		graph.places[#graph.places + 1] = {
			name = place.name,
			map = place.map,
			x = place.x,
			y = place.y,
		}
	end
	return graph
end

function ns.NearestNode(graph, wx, wy, cont, maxYards)
	local best, bestD
	for i = 1, #graph.nodes do
		local node = graph.nodes[i]
		if node.cont == cont then
			local d = yards(wx, wy, node.wx, node.wy)
			if d <= maxYards and (not bestD or d < bestD) then
				best, bestD = i, d
			end
		end
	end
	return best, bestD
end

function ns.ShortestPath(graph, startId, goalId)
	if not startId or not goalId then
		return nil
	end
	if startId == goalId then
		local node = graph.nodes[startId]
		return {
			{
				id = startId,
				map = node.map,
				x = node.x,
				y = node.y,
				wx = node.wx,
				wy = node.wy,
				cont = node.cont,
				name = node.name,
				kind = "start",
			},
		}
	end
	local nodes, edges = graph.nodes, graph.edges
	local gScore = {}
	local prev = {}
	local prevEdge = {}
	local settled = {}
	gScore[startId] = 0
	local open = { startId }
	local inOpen = { [startId] = true }
	while #open > 0 do
		local bestI, bestId, bestG = 1, open[1], gScore[open[1]]
		for i = 2, #open do
			local id = open[i]
			if gScore[id] < bestG then
				bestI, bestId, bestG = i, id, gScore[id]
			end
		end
		table.remove(open, bestI)
		inOpen[bestId] = nil
		if bestId == goalId then
			break
		end
		if not settled[bestId] then
			settled[bestId] = true
			local list = edges[bestId]
			for i = 1, #list do
				local edge = list[i]
				local nid = edge.to
				if not settled[nid] then
					local ng = bestG + edge.cost
					if not gScore[nid] or ng < gScore[nid] then
						gScore[nid] = ng
						prev[nid] = bestId
						prevEdge[nid] = edge
						if not inOpen[nid] then
							open[#open + 1] = nid
							inOpen[nid] = true
						end
					end
				end
			end
		end
	end
	if not prev[goalId] then
		return nil
	end
	local ids = {}
	local cur = goalId
	while cur do
		table.insert(ids, 1, cur)
		if cur == startId then
			break
		end
		cur = prev[cur]
	end
	local steps = {}
	for i = 1, #ids do
		local id = ids[i]
		local node = nodes[id]
		local edge = prevEdge[id]
		steps[i] = {
			id = id,
			map = node.map,
			x = node.x,
			y = node.y,
			wx = node.wx,
			wy = node.wy,
			cont = node.cont,
			name = node.name,
			flight = node.flight,
			kind = edge and edge.kind or "start",
			via = edge and edge.name or nil,
			rough = edge and edge.rough or false,
			cost = edge and edge.cost or 0,
		}
	end
	steps.seconds = gScore[goalId]
	return steps
end

local TRANSPORT = {
	boat = true,
	zeppelin = true,
	tram = true,
	portal = true,
	flight = true,
}

function ns.IsTransport(kind)
	return TRANSPORT[kind] and true or false
end
