// OC Shimeji — reboot (0.1.0). Everything is Kotlin; nothing depends on AndroidX or Google Maven.
//   Pure modules + tests:   gradle -PcoreOnly=true test
//   Debug APK (offline):    gradle :app:assembleDebug :app:verifyDebugApk
pluginManagement { repositories { gradlePluginPortal(); mavenCentral() } }
dependencyResolutionManagement { repositories { mavenCentral() } }
rootProject.name = "OCShimeji"

include(":core:sim", ":core:save", ":render:api", ":render:jvm", ":ui")
if (providers.gradleProperty("coreOnly").orNull != "true") include(":app")
