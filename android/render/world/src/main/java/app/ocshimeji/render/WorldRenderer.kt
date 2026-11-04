package app.ocshimeji.render

import app.ocshimeji.core.anim.RigPose

/**
 * World rendering contract. Round 3 decision: 3D fixed-camera world (orthographic, 50° tilt,
 * Filament or Godot) with 2D characters as camera-facing billboards; ground (x, y) maps to
 * X = x, Z = (y + level*24)/sin50°, Y = level*24/cos50° so 2D layouts stay valid.
 * For the pure-2D schemes (A–F) the layer order below applies:
 *   0 Ground tiles / painted ground  1 Decals (paths, puddles)  2 Cliff faces (elevation)
 *   3 Y-sorted actors & props (sort key = foot y, then x)  4 Overhead (canopies, roofs when inside)
 *   5 Weather particles  6 Lighting (multiply tint + additive light sprites; pixel: palette LUT)
 */
interface WorldRenderer {
    fun resize(widthPx: Int, heightPx: Int)
    fun render(frame: WorldFrame)
    fun dispose()
}

data class WorldFrame(
    val timeSec: Float,
    val camX: Float, val camY: Float, val zoom: Float,
    val night: Float,
    val weather: String,
    val actors: List<ActorDraw>,
)

data class ActorDraw(val characterId: String, val footX: Float, val footY: Float, val elevation: Int, val pose: RigPose)

/** Depth sort used by every renderer (and by the prototype): elevation, then foot y, then x. */
val ActorDepth: Comparator<ActorDraw> = compareBy<ActorDraw>({ it.elevation }, { it.footY }, { it.footX })
