// AGP build (Android Studio / machines with the Android SDK). Not exercised in the cloud
// container used for Phase 2 (no Google Maven access) — see build.offline.gradle.kts, which
// builds the identical app from the same sources and was used for the verified APK.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}
android {
    namespace = "app.ocshimeji"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.ocshimeji"
        minSdk = 26
        targetSdk = 35
        versionCode = 10
        versionName = "0.7.0-alpha"
    }
    buildFeatures { buildConfig = true }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/game-assets"))
    sourceSets["main"].java.srcDir(layout.buildDirectory.dir("generated/buildinfo"))
    signingConfigs {
        create("release") {
            val ks = System.getenv("OC_RELEASE_KEYSTORE")
            if (ks != null) { storeFile = file(ks); storePassword = System.getenv("OC_RELEASE_STORE_PASSWORD"); keyAlias = System.getenv("OC_RELEASE_KEY_ALIAS"); keyPassword = System.getenv("OC_RELEASE_KEY_PASSWORD") }
        }
    }
    buildTypes { release { isMinifyEnabled = false; if (System.getenv("OC_RELEASE_KEYSTORE") != null) signingConfig = signingConfigs.getByName("release") } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }
    kotlinOptions { jvmTarget = "1.8" }
}
val syncGame by tasks.registering(Sync::class) { from(rootProject.file("../game")); into(layout.buildDirectory.dir("generated/game-assets/game")); exclude("tests/**", "**/*.md") }
val genBuildInfo by tasks.registering {
    val out = layout.buildDirectory.dir("generated/buildinfo/app/ocshimeji"); outputs.dir(out)
    doLast { out.get().asFile.mkdirs(); out.get().file("BuildInfo.java").asFile.writeText("package app.ocshimeji;\npublic final class BuildInfo { public static final String VERSION_NAME = \"0.6.0-alpha\"; public static final int VERSION_CODE = 9; }\n") }
}
tasks.named("preBuild") { dependsOn(syncGame, genBuildInfo) }
dependencies { implementation(project(":core:pet")) }
