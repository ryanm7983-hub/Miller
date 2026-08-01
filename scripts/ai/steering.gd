class_name Steering
extends RefCounted
## Movement for agents on streamed procedural terrain.
##
## This is deliberately *not* a NavigationAgent3D. A baked navmesh would have to
## be rebuilt every time a chunk streams in — dozens of times a minute while the
## player walks — and on a single-threaded web build that is a stutter the game
## cannot afford. The trade is that agents cannot solve mazes; they can follow
## ground, avoid what is in front of them, and route around obstacles they
## cannot pass.
##
## The forest suits this: it is open terrain with scattered blockers, which is
## exactly the case where steering beats pathfinding. Interiors are small enough
## that a doorway waypoint on the building handles them.
##
## The composition is: seek the goal, add whisker avoidance, project onto the
## ground, refuse slopes that are too steep.

const WHISKER_ANGLES := [0.0, 0.45, -0.45, 0.95, -0.95]
const WHISKER_LENGTH := 3.4
const OBSTACLE_MASK := 1 | 2 | 64      ## terrain, static world, props
const MAX_CLIMB_SLOPE := 0.62
const STUCK_TIME := 1.4
const STUCK_DISTANCE := 0.55


## Compute a desired horizontal direction for `agent` heading to `goal`.
##
## Returns a normalised XZ vector, or ZERO if the agent should stop.
static func direction_to(agent: Node3D, goal: Vector3, avoid_water: bool = true,
		world: WorldRoot = null) -> Vector3:
	var to_goal := goal - agent.global_position
	to_goal.y = 0.0
	if to_goal.length_squared() < 0.0001:
		return Vector3.ZERO
	var desired := to_goal.normalized()

	var steer := desired
	var space := agent.get_world_3d().direct_space_state
	var origin := agent.global_position + Vector3(0, 0.9, 0)

	# Whiskers: cast a fan forward and push away from whatever is hit. Weighting
	# by 1/length means a wall right in front turns the agent hard and a tree at
	# the edge of the fan only nudges it.
	var avoidance := Vector3.ZERO
	var blocked_ahead := false
	for angle in WHISKER_ANGLES:
		var direction := desired.rotated(Vector3.UP, angle)
		var query := PhysicsRayQueryParameters3D.create(
			origin, origin + direction * WHISKER_LENGTH, OBSTACLE_MASK)
		query.exclude = [agent.get_rid()] if agent.has_method("get_rid") else []
		var hit := space.intersect_ray(query)
		if hit.is_empty():
			continue
		var hit_position: Vector3 = hit["position"]
		var distance := origin.distance_to(hit_position)
		var push := (origin - hit_position)
		push.y = 0.0
		if push.length_squared() < 0.0001:
			continue
		avoidance += push.normalized() * (1.0 - distance / WHISKER_LENGTH)
		if absf(angle) < 0.5:
			blocked_ahead = true

	if avoidance.length_squared() > 0.0001:
		steer = (desired + avoidance.normalized() * 1.35).normalized()

	# Head-on blockage: pick a side and commit, rather than oscillating in front
	# of it. The side is chosen from the obstacle's own normal.
	if blocked_ahead:
		var side := desired.cross(Vector3.UP).normalized()
		if avoidance.dot(side) < 0.0:
			side = -side
		steer = (steer + side * 0.8).normalized()

	if world != null:
		steer = _refuse_impassable(agent, steer, avoid_water, world)
	return steer


## Reject a heading that leads up a cliff or into deep water.
static func _refuse_impassable(agent: Node3D, steer: Vector3, avoid_water: bool,
		world: WorldRoot) -> Vector3:
	if world.generator == null:
		return steer
	var probe := agent.global_position + steer * 2.2
	var ground := world.generator.height_at(probe.x, probe.z)
	var slope := world.generator.slope_at(probe.x, probe.z)
	var too_steep := slope > MAX_CLIMB_SLOPE
	var too_deep := avoid_water and ground < world.generator.water_level_at(probe.x, probe.z) - 0.8

	if not too_steep and not too_deep:
		return steer

	# Try turning left and right in increasing increments until something works.
	for offset in [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6]:
		var candidate := steer.rotated(Vector3.UP, offset)
		var test := agent.global_position + candidate * 2.2
		var test_ground := world.generator.height_at(test.x, test.z)
		if world.generator.slope_at(test.x, test.z) > MAX_CLIMB_SLOPE:
			continue
		if avoid_water and test_ground < world.generator.water_level_at(test.x, test.z) - 0.8:
			continue
		return candidate
	return Vector3.ZERO


## Pick a wander target within `radius` that an agent can actually stand on.
static func wander_target(from: Vector3, radius: float, world: WorldRoot,
		rng: RandomNumberGenerator) -> Vector3:
	if world == null or world.generator == null:
		return from
	for attempt in 12:
		var angle := rng.randf() * TAU
		var distance := rng.randf_range(radius * 0.35, radius)
		var candidate := from + Vector3(cos(angle) * distance, 0.0, sin(angle) * distance)
		if not world.generator.is_in_bounds(candidate.x, candidate.z):
			continue
		var ground := world.generator.height_at(candidate.x, candidate.z)
		if ground < world.generator.water_level_at(candidate.x, candidate.z) + 0.4:
			continue
		if world.generator.slope_at(candidate.x, candidate.z) > MAX_CLIMB_SLOPE:
			continue
		return Vector3(candidate.x, ground, candidate.z)
	return from


## Track whether an agent has stopped making progress, so callers can re-plan.
class StuckDetector:
	var _last_position := Vector3.ZERO
	var _timer := 0.0
	var _initialised := false

	func update(position: Vector3, delta: float) -> bool:
		if not _initialised:
			_last_position = position
			_initialised = true
			return false
		_timer += delta
		if _timer < Steering.STUCK_TIME:
			return false
		var moved := _last_position.distance_to(position)
		_last_position = position
		_timer = 0.0
		return moved < Steering.STUCK_DISTANCE

	func reset() -> void:
		_timer = 0.0
		_initialised = false
