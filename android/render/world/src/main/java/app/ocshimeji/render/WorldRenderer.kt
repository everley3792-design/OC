package app.ocshimeji.render

import app.ocshimeji.core.anim.RigPose

/**
 * 2.5D world rendering contract (libGDX SpriteBatch, orthographic camera, pure 2D).
 * Implemented per art direction in Phase 2. Layers, drawn in order:
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
