-- Draws the surveyed route on the world map so the bends around a mountain are visible.
local _, ns = ...

local provider
local lines = {}
local mapFailed = false

local function clearLines()
	for i = 1, #lines do
		lines[i]:Hide()
		lines[i]:SetParent(nil)
		lines[i] = nil
	end
end

local function canvasPoint(map, mapID, x, y)
	local px, py = x / 100, y / 100
	local display = map:GetMapID()
	if mapID ~= display and C_Map and C_Map.GetWorldPosFromMapPos and C_Map.GetMapPosFromWorldPos then
		local cont, world = C_Map.GetWorldPosFromMapPos(mapID, { x = px, y = py })
		if not world then
			return nil
		end
		local found, pos = C_Map.GetMapPosFromWorldPos(cont, world, display)
		if found ~= display or not pos or not pos.x or not pos.y then
			return nil
		end
		px, py = pos.x, pos.y
	end
	if px < -0.08 or px > 1.08 or py < -0.08 or py > 1.08 then
		return nil
	end
	local canvas = map:GetCanvas()
	return px * canvas:GetWidth(), -py * canvas:GetHeight(), canvas
end

local function draw()
	clearLines()
	local steps = ns.guide and ns.guide.steps
	if not steps or not provider or not provider.GetMap then
		return
	end
	local map = provider:GetMap()
	if not map or not map.GetCanvas then
		return
	end
	local canvas
	for i = 2, #steps do
		local prev, step = steps[i - 1], steps[i]
		if not ns.IsTransport(step.kind) and prev.wx and step.wx then
			local x1, y1, c1 = canvasPoint(map, prev.map, prev.x, prev.y)
			local x2, y2 = canvasPoint(map, step.map, step.x, step.y)
			if x1 and x2 then
				canvas = c1
				local line = canvas:CreateLine(nil, "OVERLAY")
				line:SetThickness(step.kind == "approach" and 2 or 4)
				if step.kind == "approach" or step.rough then
					line:SetColorTexture(0.95, 0.55, 0.2, 0.75)
				else
					line:SetColorTexture(0.95, 0.78, 0.25, 0.9)
				end
				line:SetStartPoint("TOPLEFT", canvas, "TOPLEFT", x1, y1)
				line:SetEndPoint("TOPLEFT", canvas, "TOPLEFT", x2, y2)
				lines[#lines + 1] = line
			end
		end
	end
end

function ns.RefreshMap()
	if provider and provider.RefreshAllData then
		pcall(provider.RefreshAllData, provider)
	end
end

local function install()
	if provider or not WorldMapFrame or not WorldMapFrame.AddDataProvider or not MapCanvasDataProviderMixin then
		return
	end
	provider = CreateFromMixins(MapCanvasDataProviderMixin)
	function provider:RefreshAllData()
		if mapFailed then
			return
		end
		local ok, err = pcall(draw)
		if not ok then
			mapFailed = true
			ns.Print("Could not draw the route on the map. The arrow still works.")
			ns.Print(tostring(err))
		end
	end
	function provider:RemoveAllData()
		clearLines()
	end
	WorldMapFrame:AddDataProvider(provider)
end

function ns.InitMap()
	if C_AddOns and C_AddOns.IsAddOnLoaded and C_AddOns.IsAddOnLoaded("Blizzard_WorldMap") then
		install()
		return
	end
	local watcher = CreateFrame("Frame")
	watcher:RegisterEvent("ADDON_LOADED")
	watcher:SetScript("OnEvent", function(_, _, name)
		if name == "Blizzard_WorldMap" then
			install()
		end
	end)
end
