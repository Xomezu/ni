-- Turns a destination into a road path and walks the player along it.
local _, ns = ...

local ARRIVE = 24
local TRANSPORT_ARRIVE = 90
local WALKED_OFF = 160
local REPATH_YARDS = 300
local APPROACH_WARN = 140

local guide = {
	steps = nil,
	index = 1,
	dest = nil,
	roughWarned = false,
	approachWarned = false,
	repathAt = 0,
	holding = false,
}

ns.guide = guide

local function num(v)
	if type(v) ~= "number" then
		return nil
	end
	if issecretvalue and issecretvalue(v) then
		return nil
	end
	return v
end

function ns.WorldOf(map, x, y)
	if not C_Map or not C_Map.GetWorldPosFromMapPos or not map then
		return nil
	end
	local cont, world = C_Map.GetWorldPosFromMapPos(map, { x = x / 100, y = y / 100 })
	if not world or (issecrettable and issecrettable(world)) then
		return nil
	end
	local wx, wy = num(world.x), num(world.y)
	if not wx or not wy then
		return nil
	end
	return wx, wy, cont
end

function ns.PlayerPos()
	if not C_Map or not C_Map.GetBestMapForUnit then
		return nil
	end
	local map = C_Map.GetBestMapForUnit("player")
	if not map then
		return nil
	end
	local pos = C_Map.GetPlayerMapPosition(map, "player")
	if not pos or (issecrettable and issecrettable(pos)) then
		return nil
	end
	local x, y = num(pos.x), num(pos.y)
	if not x or not y then
		return nil
	end
	local wx, wy, cont = ns.WorldOf(map, x * 100, y * 100)
	if not wx then
		return nil
	end
	return { map = map, x = x * 100, y = y * 100, wx = wx, wy = wy, cont = cont }
end

function ns.GetGraph()
	if ns.graph then
		return ns.graph
	end
	ns.graph = ns.BuildGraph(ns.WorldOf)
	local errors = ns.graph.errors
	for i = 1, #errors do
		ns.Print(errors[i])
	end
	return ns.graph
end

local function shortName(name)
	if not name then
		return "the stop"
	end
	local head = name:match("^(.-),")
	return head or name
end

function ns.Instruction(step, nxt)
	if nxt and nxt.kind == "gate" and nxt.via == "barrens-lift" then
		return "Ride the Great Lift"
	end
	if nxt and ns.IsTransport(nxt.kind) then
		if nxt.kind == "tram" then
			return "Take the Deeprun Tram"
		end
		local verb = "Take the "
		if nxt.kind == "boat" then
			verb = "Board the boat to "
		elseif nxt.kind == "zeppelin" then
			verb = "Take the zeppelin to "
		elseif nxt.kind == "portal" then
			verb = "Take the portal to "
		elseif nxt.kind == "flight" then
			verb = "Fly to "
		end
		return verb .. shortName(nxt.name)
	end
	if step.kind == "approach" then
		return "Last stretch is off the surveyed road"
	end
	if step.name then
		return "Follow the road toward " .. shortName(step.name)
	end
	return "Follow the road"
end

local function appendApproach(steps, dest)
	local last = steps[#steps]
	local d = ns.Yards(last.wx, last.wy, dest.wx, dest.wy)
	if d < 30 then
		return d
	end
	steps[#steps + 1] = {
		map = dest.map,
		x = dest.x,
		y = dest.y,
		wx = dest.wx,
		wy = dest.wy,
		cont = dest.cont,
		name = dest.name,
		kind = "approach",
	}
	return d
end

local function flightFactionOK(flight)
	if not flight or flight == "N" then
		return true
	end
	local faction = UnitFactionGroup and UnitFactionGroup("player")
	if faction == "Horde" then
		return flight == "H"
	end
	if faction == "Alliance" then
		return flight == "A"
	end
	return true
end

local function taxiDiscovered(name, map)
	if not C_TaxiMap or not C_TaxiMap.GetTaxiNodesForMap then
		return false
	end
	local ok, nodes = pcall(C_TaxiMap.GetTaxiNodesForMap, map)
	if not ok or type(nodes) ~= "table" then
		return false
	end
	for i = 1, #nodes do
		local node = nodes[i]
		if node.name == name and not node.isUndiscovered then
			local faction = node.faction
			local player = UnitFactionGroup and UnitFactionGroup("player")
			local hordeId = Enum and Enum.FlightPathFaction and Enum.FlightPathFaction.Horde or 1
			local allianceId = Enum and Enum.FlightPathFaction and Enum.FlightPathFaction.Alliance or 2
			if faction == hordeId and player == "Alliance" then
				return false
			end
			if faction == allianceId and player == "Horde" then
				return false
			end
			return true
		end
	end
	return false
end

local function addFlights(graph, undo)
	if ns.DB and ns.DB.useFlight == false then
		return
	end
	local fps = {}
	for i = 1, #graph.nodes do
		local node = graph.nodes[i]
		if node.flight and node.name and flightFactionOK(node.flight) and taxiDiscovered(node.name, node.map) then
			fps[#fps + 1] = node
		end
	end
	for i = 1, #fps do
		for j = i + 1, #fps do
			local a, b = fps[i], fps[j]
			if a.cont == b.cont then
				local span = ns.Yards(a.wx, a.wy, b.wx, b.wy)
				if span > 400 then
					local cost = span / 30 + 20
					local listA, listB = graph.edges[a.id], graph.edges[b.id]
					listA[#listA + 1] = { to = b.id, kind = "flight", name = "flight", cost = cost }
					listB[#listB + 1] = { to = a.id, kind = "flight", name = "flight", cost = cost }
					undo[#undo + 1] = function()
						listA[#listA] = nil
						listB[#listB] = nil
					end
				end
			end
		end
	end
end

local function popFlights(undo)
	for i = #undo, 1, -1 do
		undo[i]()
	end
end

function ns.Plan(dest)
	local graph = ns.GetGraph()
	local player = ns.PlayerPos()
	if not player then
		return nil, "Your position is hidden right now. Roadwise can guide again once you are outdoors."
	end
	local dwx, dwy, dcont = ns.WorldOf(dest.map, dest.x, dest.y)
	if not dwx then
		return nil, "That spot is not on a world map Roadwise can read."
	end
	dest.wx, dest.wy, dest.cont = dwx, dwy, dcont
	if ns.Yards(player.wx, player.wy, dwx, dwy) < 80 and player.cont == dcont then
		local steps = {
			{
				map = dest.map,
				x = dest.x,
				y = dest.y,
				wx = dwx,
				wy = dwy,
				cont = dcont,
				name = dest.name,
				kind = "approach",
			},
		}
		steps.seconds = ns.Yards(player.wx, player.wy, dwx, dwy) / 7
		guide.steps = steps
		guide.index = 1
		guide.dest = dest
		guide.roughWarned = true
		guide.approachWarned = false
		guide.holding = false
		guide.repathAt = 0
		guide.startWarn = false
		return steps
	end
	local startId, startDist = ns.NearestNode(graph, player.wx, player.wy, player.cont, 4000)
	local goalId = ns.NearestNode(graph, dwx, dwy, dcont, 4000)
	if not startId then
		return nil, "No surveyed road near you. If this is a cave or a new island, walk outside and try again."
	end
	if not goalId then
		return nil, "No surveyed road near " .. dest.name .. "."
	end
	local undo = {}
	addFlights(graph, undo)
	local steps = ns.ShortestPath(graph, startId, goalId)
	popFlights(undo)
	if not steps then
		return nil, "Those roads are not connected yet. Zephras Isle has no surveyed crossing."
	end
	local approach = appendApproach(steps, dest)
	guide.steps = steps
	guide.index = 1
	guide.dest = dest
	guide.roughWarned = false
	guide.approachWarned = approach > APPROACH_WARN
	guide.holding = false
	guide.repathAt = 0
	guide.startWarn = startDist > APPROACH_WARN
	return steps
end

function ns.ClearGuide()
	guide.steps = nil
	guide.index = 1
	guide.dest = nil
	guide.holding = false
	if ns.RestoreWaypoint then
		ns.RestoreWaypoint()
	end
	if ns.HideArrow then
		ns.HideArrow()
	end
	if ns.RefreshMap then
		ns.RefreshMap()
	end
end

function ns.CurrentStep()
	local steps = guide.steps
	if not steps then
		return nil
	end
	return steps[guide.index], steps[guide.index + 1], guide
end

local function advanceOrHold(player)
	local steps = guide.steps
	local index = guide.index
	local step = steps[index]
	local nxt = steps[index + 1]
	if not step then
		return true
	end
	if nxt and ns.IsTransport(nxt.kind) then
		guide.holding = true
		local arrived = ns.Yards(player.wx, player.wy, nxt.wx, nxt.wy)
		if arrived < TRANSPORT_ARRIVE then
			guide.index = index + 1
			guide.holding = false
			return "advanced"
		end
		if player.map == step.map and ns.Yards(player.wx, player.wy, step.wx, step.wy) > WALKED_OFF then
			return "repath"
		end
		return false
	end
	guide.holding = false
	if ns.Yards(player.wx, player.wy, step.wx, step.wy) < ARRIVE then
		guide.index = index + 1
		if guide.index > #steps then
			return true
		end
		return "advanced"
	end
	return false
end

function ns.UpdateGuide()
	local steps = guide.steps
	if not steps then
		return
	end
	local player = ns.PlayerPos()
	if not player then
		if ns.SetArrowStatus then
			ns.SetArrowStatus(nil, nil, "Paused until your position is visible")
		end
		return
	end
	local arrived = false
	for _ = 1, 16 do
		arrived = advanceOrHold(player)
		if arrived ~= "advanced" then
			break
		end
	end
	if arrived == "repath" then
		local now = GetTime and GetTime() or 0
		if now >= guide.repathAt then
			guide.repathAt = now + 4
			local dest = guide.dest
			ns.Plan(dest)
			if ns.RefreshMap then
				ns.RefreshMap()
			end
		end
		return
	end
	if arrived == true then
		ns.Print("You made it to " .. (guide.dest and guide.dest.name or "the destination") .. ".")
		if PlaySound and SOUNDKIT and SOUNDKIT.MAP_PING then
			pcall(PlaySound, SOUNDKIT.MAP_PING)
		end
		ns.ClearGuide()
		return
	end
	local step, nxt = ns.CurrentStep()
	if not step then
		ns.ClearGuide()
		return
	end
	if not guide.holding then
		local off = ns.Yards(player.wx, player.wy, step.wx, step.wy)
		if off > REPATH_YARDS then
			local now = GetTime and GetTime() or 0
			if now >= guide.repathAt then
				guide.repathAt = now + 4
				ns.Plan(guide.dest)
				if ns.RefreshMap then
					ns.RefreshMap()
				end
				return
			end
		end
	end
	if guide.roughWarned == false then
		for i = 1, #steps do
			if steps[i].rough then
				guide.roughWarned = true
				ns.Print("Part of this route is in a new zone. The arrow follows the flight masters and borders there; if it climbs a ridge, stay on the road you can see.")
				break
			end
		end
		if guide.roughWarned == false then
			guide.roughWarned = true
		end
	end
	if guide.approachWarned then
		guide.approachWarned = false
		ns.Print("The last stretch leaves the surveyed road. If a cliff is in the way, walk around it.")
	end
	if guide.startWarn then
		guide.startWarn = false
		ns.Print("The first stretch is a straight line to the nearest road.")
	end
	local text = ns.Instruction(step, nxt)
	local target = step
	if ns.SetArrow then
		ns.SetArrow(player, target, text, guide.dest, guide.index, #steps)
	end
	if ns.SetWaypoint then
		ns.SetWaypoint(target.map, target.x, target.y)
	end
end
