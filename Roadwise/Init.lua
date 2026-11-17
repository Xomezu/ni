-- Saved settings, slash commands, and the guidance tick.
local _, ns = ...

local DEFAULTS = {
	useFlight = true,
	pins = {},
	ax = 260,
	ay = 40,
}

local ticker = CreateFrame("Frame")
local elapsed = 0
local stopped = false

ticker:RegisterEvent("ADDON_LOADED")
ticker:SetScript("OnEvent", function(_, event, name)
	if event ~= "ADDON_LOADED" or name ~= "Roadwise" then
		return
	end
	local db = RoadwiseDB or {}
	RoadwiseDB = db
	for key, value in pairs(DEFAULTS) do
		if db[key] == nil then
			if type(value) == "table" then
				db[key] = {}
			else
				db[key] = value
			end
		end
	end
	ns.DB = db
	ns.InitCommands()
	ns.InitMap()
end)

ticker:SetScript("OnUpdate", function(_, dt)
	if stopped or not ns.guide or not ns.guide.steps then
		elapsed = 0
		return
	end
	elapsed = elapsed + dt
	if elapsed < 0.2 then
		return
	end
	elapsed = 0
	local ok, err = pcall(ns.UpdateGuide)
	if not ok then
		stopped = true
		if ns.guide then
			ns.guide.steps = nil
		end
		ns.Print("Stopped after an error: " .. tostring(err))
	end
end)
