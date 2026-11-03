package app.ocshimeji.core.event

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.filterIsInstance

/**
 * Domain events flow one way: sim/core emit, UI/render/overlay observe.
 * Nothing in core depends on Android; the overlay service and the game screen
 * subscribe to the same bus so the floating pet reacts to the same life sim.
 */
sealed interface GameEvent {
    data class NeedChanged(val characterId: String, val need: String, val value: Float) : GameEvent
    data class ActionStarted(val characterId: String, val action: String) : GameEvent
    data class Reaction(val characterId: String, val emote: String) : GameEvent
    data class ItemUsed(val characterId: String, val itemId: String) : GameEvent
    data class Travelled(val placeId: String) : GameEvent
    data class Purchased(val itemId: String, val price: Int) : GameEvent
    data object Saved : GameEvent
}

class EventBus(replay: Int = 0, extraBuffer: Int = 64) {
    private val flow = MutableSharedFlow<GameEvent>(replay = replay, extraBufferCapacity = extraBuffer)
    val events: SharedFlow<GameEvent> = flow.asSharedFlow()

    /** Non-suspending emit; drops only if the buffer is full (UI should never block the sim). */
    fun post(e: GameEvent): Boolean = flow.tryEmit(e)
    suspend fun emit(e: GameEvent) = flow.emit(e)
    inline fun <reified T : GameEvent> of() = events.filterIsInstance<T>()
}
