-- On-screen heading arrow. Points at the next road bend, not at the final NPC.
local _, ns = ...

local frame
local atan2 = math.atan2 or math.atan

local function normAngle(angle)
	while angle > math.pi do
		angle = angle - math.pi * 2
	end
	while angle < -math.pi do
		angle = angle + math.pi * 2
	end
	return angle
end

local function ensure()
	if frame then
		return frame
	end
	frame = CreateFrame("Frame", "RoadwiseArrow", UIParent, "BackdropTemplate")
	frame:SetSize(248, 86)
	frame:SetFrameStrata("HIGH")
	frame:SetClampedToScreen(true)
	frame:SetMovable(true)
	frame:EnableMouse(true)
	frame:RegisterForDrag("LeftButton")
	frame:SetScript("OnDragStart", function(self)
		self:StartMoving()
	end)
	frame:SetScript("OnDragStop", function(self)
		self:StopMovingOrSizing()
		local cx, cy = self:GetCenter()
		local ux, uy = UIParent:GetCenter()
		if cx and ux and ns.DB then
			ns.DB.ax = cx - ux
			ns.DB.ay = cy - uy
		end
	end)
	local ok = pcall(frame.SetBackdrop, frame, {
		bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
		edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
		tile = true,
		tileSize = 24,
		edgeSize = 20,
		insets = { left = 4, right = 4, top = 4, bottom = 4 },
	})
	if not ok then
		local bg = frame:CreateTexture(nil, "BACKGROUND")
		bg:SetAllPoints()
		bg:SetColorTexture(0.05, 0.04, 0.02, 0.9)
	end

	local arrow = frame:CreateTexture(nil, "ARTWORK")
	arrow:SetSize(40, 40)
	arrow:SetPoint("LEFT", 12, 6)
	arrow:SetTexture("Interface\\Minimap\\MinimapArrow")
	arrow:SetVertexColor(1, 0.82, 0.25)
	frame.arrow = arrow

	local title = frame:CreateFontString(nil, "OVERLAY", "GameFontNormal")
	title:SetPoint("TOPLEFT", 60, -12)
	title:SetPoint("TOPRIGHT", -28, -12)
	title:SetJustifyH("LEFT")
	title:SetText("Roadwise")
	frame.title = title

	local body = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
	body:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -2)
	body:SetPoint("RIGHT", -12, 0)
	body:SetJustifyH("LEFT")
	body:SetText("")
	frame.body = body

	local dist = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
	dist:SetPoint("BOTTOMLEFT", 60, 12)
	dist:SetText("")
	frame.dist = dist

	local close = CreateFrame("Button", nil, frame, "UIPanelCloseButton")
	close:SetPoint("TOPRIGHT", 2, 2)
	close:SetScript("OnClick", function()
		ns.ClearGuide()
	end)

	local ax = ns.DB and ns.DB.ax or 260
	local ay = ns.DB and ns.DB.ay or 40
	frame:SetPoint("CENTER", UIParent, "CENTER", ax, ay)
	frame:Hide()
	return frame
end

function ns.SetArrow(player, target, text, dest, index, count)
	local ui = ensure()
	ui:Show()
	ui.title:SetText(dest and dest.name or "Roadwise")
	ui.body:SetText(text or "")
	local yards = ns.Yards(player.wx, player.wy, target.wx, target.wy)
	ui.dist:SetText(string.format("%d yd  ·  %d/%d", yards + 0.5, index, count))
	local facing = GetPlayerFacing and GetPlayerFacing() or nil
	if type(facing) ~= "number" or (issecretvalue and issecretvalue(facing)) then
		ui.arrow:SetRotation(0)
		return
	end
	local dx = target.wx - player.wx
	local dy = target.wy - player.wy
	local heading = atan2(dy, dx)
	ui.arrow:SetRotation(normAngle(heading - facing))
end

function ns.SetArrowStatus(_, _, text)
	local ui = ensure()
	ui:Show()
	ui.body:SetText(text or "")
	ui.arrow:SetRotation(0)
end

function ns.HideArrow()
	if frame then
		frame:Hide()
	end
end

function ns.SetWaypoint(map, x, y)
	if not C_Map or not C_Map.SetUserWaypoint or not map then
		return
	end
	local key = string.format("%d:%.1f:%.1f", map, x, y)
	if ns.waypointKey == key then
		return
	end
	if ns.waypointKey == nil and C_Map.GetUserWaypoint then
		local had = C_Map.HasUserWaypoint and C_Map.HasUserWaypoint()
		ns.hadWaypoint = had and true or false
		if had then
			ns.savedWaypoint = C_Map.GetUserWaypoint()
		end
	end
	local point
	if UiMapPoint and UiMapPoint.CreateFromVector2D then
		point = UiMapPoint.CreateFromVector2D(map, { x = x / 100, y = y / 100 })
	else
		point = { uiMapID = map, position = { x = x / 100, y = y / 100 } }
	end
	if C_Map.CanSetUserWaypointOnMap and not C_Map.CanSetUserWaypointOnMap(map) then
		return
	end
	local ok = pcall(C_Map.SetUserWaypoint, point)
	if ok then
		ns.waypointKey = key
		if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then
			pcall(C_SuperTrack.SetSuperTrackedUserWaypoint, true)
		end
	end
end

function ns.RestoreWaypoint()
	ns.waypointKey = nil
	if not C_Map then
		return
	end
	if ns.hadWaypoint and ns.savedWaypoint and C_Map.SetUserWaypoint then
		pcall(C_Map.SetUserWaypoint, ns.savedWaypoint)
	elseif C_Map.ClearUserWaypoint then
		pcall(C_Map.ClearUserWaypoint)
	end
	if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then
		pcall(C_SuperTrack.SetSuperTrackedUserWaypoint, false)
	end
	ns.savedWaypoint = nil
	ns.hadWaypoint = nil
end
