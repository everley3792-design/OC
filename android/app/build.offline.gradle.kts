// OC Shimeji — offline APK pipeline (no Android Gradle Plugin required).
//
// Used where Google Maven / the Android SDK download server are unreachable (the Phase-2
// cloud container). Produces the same app as the AGP build from the same sources:
//
//   genRes      aapt  : R.java from res/ + manifest           (links against platform android.jar)
//   compile     Gradle Kotlin/JVM: app + core modules, compileOnly against a full framework jar
//   dex         dx    : classes + runtime jars → classes.dex  (--min-sdk-version=26)
//   packageRes  aapt  : manifest + res + assets/game  → base APK
//   addDex      aapt add classes.dex
//   zipalign / apksigner (debug keystore generated locally; release keystore from env vars)
//
// Toolchain paths (override with -P or env):
//   oc.compileJar  framework classes for Kotlin compile (default: Robolectric android-all API 35)
//   oc.resJar      platform jar for resource linking     (default: Ubuntu android-sdk-platform-23)
//   aapt, dalvik-exchange|dx, zipalign, apksigner on PATH (Ubuntu packages)
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins { alias(libs.plugins.kotlin.jvm) }

val vName = providers.gradleProperty("oc.versionName").get()
val vCode = providers.gradleProperty("oc.versionCode").get()
fun prop(name: String, env: String, def: String) = providers.gradleProperty(name).orNull ?: System.getenv(env) ?: def
val compileJar = file(prop("oc.compileJar", "OC_COMPILE_JAR", "/opt/oc-android/android-all-15-robolectric-14663667.jar"))
val resJar = file(prop("oc.resJar", "OC_RES_JAR", "/usr/lib/android-sdk/platforms/android-23/android.jar"))
val dxTool = if (File("/usr/bin/dalvik-exchange").exists()) "dalvik-exchange" else "dx"

val gen = layout.buildDirectory.dir("generated/source")
val apkDir = layout.buildDirectory.dir("apk")
val manifest = file("src/main/AndroidManifest.xml")
val resDir = file("src/main/res")

java { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }
kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_1_8); freeCompilerArgs.addAll("-Xlambdas=class", "-Xsam-conversions=class", "-Xno-call-assertions", "-Xno-param-assertions") } }
sourceSets["main"].kotlin.srcDir("src/main/java")
sourceSets["main"].java.srcDir(gen)

dependencies {
    compileOnly(files(compileJar))
    implementation(project(":core:pet"))
}

val checkToolchain by tasks.registering {
    doLast {
        require(compileJar.exists()) { "Missing framework jar $compileJar — run android/tools/setup-offline-toolchain.sh" }
        require(resJar.exists()) { "Missing platform jar $resJar — run android/tools/setup-offline-toolchain.sh" }
    }
}

val genRes by tasks.registering(Exec::class) {
    dependsOn(checkToolchain)
    inputs.dir(resDir); inputs.file(manifest); outputs.dir(gen)
    doFirst {
        gen.get().asFile.mkdirs()
        val bi = gen.get().file("app/ocshimeji/BuildInfo.java").asFile; bi.parentFile.mkdirs()
        bi.writeText("package app.ocshimeji;\npublic final class BuildInfo { public static final String VERSION_NAME = \"$vName\"; public static final int VERSION_CODE = $vCode; }\n")
    }
    commandLine("aapt", "package", "-f", "-m", "-J", gen.get().asFile.path, "-M", manifest.path, "-S", resDir.path, "-I", resJar.path)
}
tasks.named("compileKotlin") { dependsOn(genRes) }
tasks.named("compileJava") { dependsOn(genRes) }

val syncGame by tasks.registering(Sync::class) {
    from(rootProject.file("../game")); into(layout.buildDirectory.dir("assets/game"))
    exclude("tests/**", "**/*.md", "**/.DS_Store")
}

val dexInputs by tasks.registering(Sync::class) {
    dependsOn("classes")
    into(layout.buildDirectory.dir("dexin"))
    from(sourceSets["main"].output.classesDirs)
    from({ configurations["runtimeClasspath"].filter { it.name.endsWith(".jar") }.map { zipTree(it) } }) { exclude("META-INF/**", "**/module-info.class") }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}

val dex by tasks.registering(Exec::class) {
    dependsOn(dexInputs)
    val out = apkDir.map { it.file("classes.dex") }
    inputs.dir(layout.buildDirectory.dir("dexin")); outputs.file(out)
    doFirst { apkDir.get().asFile.mkdirs() }
    commandLine(dxTool, "--dex", "--min-sdk-version=26", "--output=${out.get().asFile.path}", layout.buildDirectory.dir("dexin").get().asFile.path)
}

val packageRes by tasks.registering(Exec::class) {
    dependsOn(syncGame, checkToolchain)
    val out = apkDir.map { it.file("base.ap_") }
    inputs.dir(resDir); inputs.file(manifest); inputs.dir(layout.buildDirectory.dir("assets")); outputs.file(out)
    doFirst { apkDir.get().asFile.mkdirs() }
    commandLine("aapt", "package", "-f", "--no-crunch", "-M", manifest.path, "-S", resDir.path, "-A", layout.buildDirectory.dir("assets").get().asFile.path,
        "-I", resJar.path, "-F", out.get().asFile.path, "--version-code", vCode, "--version-name", vName, "-0", "glb", "-0", "woff", "-0", "woff2", "-0", "png", "-0", "jpg")
}

val unsignedApk = apkDir.map { it.file("app-unsigned.apk") }
val addDex by tasks.registering(Exec::class) {
    dependsOn(packageRes, dex)
    inputs.file(apkDir.map { it.file("base.ap_") }); inputs.file(apkDir.map { it.file("classes.dex") })
    outputs.file(unsignedApk)
    workingDir(apkDir)
    doFirst { apkDir.get().file("base.ap_").asFile.copyTo(unsignedApk.get().asFile, overwrite = true) }
    commandLine("aapt", "add", "-f", unsignedApk.get().asFile.name, "classes.dex")
}

val alignedApk = apkDir.map { it.file("app-aligned.apk") }
val zipalign by tasks.registering(Exec::class) {
    dependsOn(addDex); inputs.file(unsignedApk); outputs.file(alignedApk)
    commandLine("zipalign", "-f", "-p", "4", unsignedApk.get().asFile.path, alignedApk.get().asFile.path)
}

// Debug keystore: the standard Android one (~/.android/debug.keystore), created on first use. Never committed.
val debugKeystore = File(System.getProperty("user.home"), ".android/debug.keystore")
val ensureDebugKeystore by tasks.registering(Exec::class) {
    onlyIf { !debugKeystore.exists() }
    doFirst { debugKeystore.parentFile.mkdirs() }
    commandLine("keytool", "-genkeypair", "-v", "-keystore", debugKeystore.path, "-storepass", "android", "-alias", "androiddebugkey", "-keypass", "android",
        "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-dname", "CN=Android Debug,O=Android,C=US")
}

val outDir = rootProject.layout.projectDirectory.dir("app/build/outputs/apk")
val debugApk = outDir.file("debug/oc-shimeji-$vName-debug.apk")
val assembleDebug by tasks.registering(Exec::class) {
    group = "build"; description = "Builds and signs the debug APK (offline pipeline)."
    dependsOn(zipalign, ensureDebugKeystore)
    inputs.file(alignedApk)
    outputs.file(debugApk)
    doFirst { debugApk.asFile.parentFile.mkdirs() }
    commandLine("apksigner", "sign", "--ks", debugKeystore.path, "--ks-pass", "pass:android", "--ks-key-alias", "androiddebugkey", "--key-pass", "pass:android",
        "--min-sdk-version", "26", "--out", debugApk.asFile.path, alignedApk.get().asFile.path)
    doLast { println("APK: ${debugApk.asFile.path}") }
}

// Release: signs with a keystore supplied via environment variables (never stored in the repo).
val assembleRelease by tasks.registering(Exec::class) {
    group = "build"; description = "Builds a release APK signed with OC_RELEASE_KEYSTORE (offline pipeline)."
    dependsOn(zipalign)
    inputs.file(alignedApk)
    val ks = System.getenv("OC_RELEASE_KEYSTORE")
    val out = outDir.file("release/oc-shimeji-$vName-release.apk")
    onlyIf { ks != null }
    doFirst { out.asFile.parentFile.mkdirs() }
    commandLine("apksigner", "sign", "--ks", ks ?: "", "--ks-pass", "env:OC_RELEASE_STORE_PASSWORD", "--ks-key-alias", System.getenv("OC_RELEASE_KEY_ALIAS") ?: "oc",
        "--key-pass", "env:OC_RELEASE_KEY_PASSWORD", "--out", out.asFile.path, alignedApk.get().asFile.path)
}

tasks.register<Exec>("verifyDebugApk") {
    group = "verification"; dependsOn(assembleDebug)
    commandLine("apksigner", "verify", "--verbose", "--min-sdk-version", "26", debugApk.asFile.path)
}
