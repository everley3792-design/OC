// OC Shimeji — Android project.
//
// Two ways to build the same app module (same sources, manifest, resources, game assets):
//   • AGP   (default when ANDROID_HOME / ANDROID_SDK_ROOT is set — Android Studio, CI with SDK)
//           ./gradlew :app:assembleDebug
//   • offline (containers without Google Maven/SDK access — uses Ubuntu's aapt/dx/zipalign/
//           apksigner + a framework jar from Maven Central; see docs/android-build.md)
//           ./gradlew -Poc.build=offline :app:assembleDebug
// Pure-Kotlin core only:  ./gradlew -PcoreOnly=true test
pluginManagement {
    repositories { gradlePluginPortal(); google(); mavenCentral() }
}
dependencyResolutionManagement {
    repositories { google(); mavenCentral() }
}
rootProject.name = "OCShimeji"

val coreOnly = providers.gradleProperty("coreOnly").orNull == "true"
val hasSdk = System.getenv("ANDROID_HOME") != null || System.getenv("ANDROID_SDK_ROOT") != null
val mode = providers.gradleProperty("oc.build").orNull ?: if (hasSdk) "agp" else "offline"

include(":core:model", ":core:event", ":core:anim", ":core:sim", ":core:assets", ":core:save", ":core:pet")
if (coreOnly || mode == "offline") rootProject.buildFileName = "build.core.gradle.kts"
if (!coreOnly) {
    include(":app")
    if (mode == "offline") project(":app").buildFileName = "build.offline.gradle.kts"
}
