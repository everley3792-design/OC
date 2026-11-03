// OC Shimeji — Android project.
// `./gradlew -PcoreOnly=true :core:sim:test` builds only the pure-Kotlin core
// (no Android SDK needed) — used in CI containers without Google Maven access.
pluginManagement {
    repositories { gradlePluginPortal(); google(); mavenCentral() }
}
dependencyResolutionManagement {
    repositories { google(); mavenCentral() }
}
rootProject.name = "OCShimeji"

val coreOnly = providers.gradleProperty("coreOnly").orNull == "true"
include(":core:model", ":core:event", ":core:anim", ":core:sim", ":core:assets", ":core:save")
if (coreOnly) {
    rootProject.buildFileName = "build.core.gradle.kts"
} else {
    include(":app", ":platform:overlay", ":render:world", ":ui:design")
}
