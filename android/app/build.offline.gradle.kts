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

val proguardTool by configurations.creating
dependencies {
    compileOnly(files(compileJar))
    implementation(project(":core:pet"))
    proguardTool("com.guardsquare:proguard-base:7.10.0")
}

val checkToolchain by tasks.registering {
    doLast {
        require(compileJar.exists()) { "Missing framework jar $compileJar — run android/tools/setup-offline-toolchain.sh" }
        require(resJar.exists()) { "Missing platform jar $resJar — run android/tools/setup-offline-toolchain.sh" }
    }
}

// Framework attributes newer than the API-23 res jar (android:foregroundServiceType for the Android 14+ FGS type).
// Built from android/tools/framework-extras with `aapt package -x` (package id 0x01); used only as an extra -I.
val fwExtrasDir = rootProject.file("tools/framework-extras")
val fwExtras = layout.buildDirectory.file("fw-extras/framework-extras.apk")
val buildFwExtras by tasks.registering(Exec::class) {
    inputs.dir(fwExtrasDir); outputs.file(fwExtras)
    doFirst { fwExtras.get().asFile.parentFile.mkdirs() }
    commandLine("aapt", "package", "-f", "-x", "-M", File(fwExtrasDir, "AndroidManifest.xml").path, "-S", File(fwExtrasDir, "res").path, "-F", fwExtras.get().asFile.path)
}

val genRes by tasks.registering(Exec::class) {
    dependsOn(checkToolchain, buildFwExtras)
    inputs.dir(resDir); inputs.file(manifest); inputs.file(fwExtras); outputs.dir(gen)
    doFirst {
        gen.get().asFile.mkdirs()
        val bi = gen.get().file("app/ocshimeji/BuildInfo.java").asFile; bi.parentFile.mkdirs()
        bi.writeText("package app.ocshimeji;\npublic final class BuildInfo { public static final String VERSION_NAME = \"$vName\"; public static final int VERSION_CODE = $vCode; }\n")
    }
    commandLine("aapt", "package", "-f", "-m", "-J", gen.get().asFile.path, "-M", manifest.path, "-S", resDir.path, "-I", resJar.path, "-I", fwExtras.get().asFile.path)
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

// dx passes Java 8 invokedynamic lambdas straight through (as invoke-custom → LambdaMetafactory),
// which ART does not implement: the app would crash at launch. ProGuard backports them first.
val desugaredJar = layout.buildDirectory.file("desugared/classes.jar")
val desugar by tasks.registering(JavaExec::class) {
    dependsOn(dexInputs, checkToolchain)
    val rules = file("proguard-offline.pro")
    inputs.dir(layout.buildDirectory.dir("dexin")); inputs.file(rules); outputs.file(desugaredJar)
    classpath = proguardTool; mainClass.set("proguard.ProGuard")
    doFirst { desugaredJar.get().asFile.parentFile.mkdirs() }
    // java.* is not in the framework jar → also give ProGuard the JDK's java.base so the class hierarchy is complete
    val jbase = File(System.getProperty("java.home"), "jmods/java.base.jmod")
    val libs = mutableListOf("-libraryjars", compileJar.path)
    if (jbase.exists()) libs += listOf("-libraryjars", jbase.path + "(!**.jar;!module-info.class)")
    args(listOf("@" + rules.path, "-injars", layout.buildDirectory.dir("dexin").get().asFile.path, "-outjars", desugaredJar.get().asFile.path) + libs)
}
// fail the build if any lambda bootstrap survived (would crash on device)
val checkNoIndy by tasks.registering {
    dependsOn(desugar); inputs.file(desugaredJar)
    doLast {
        val bad = zipTree(desugaredJar).matching { include("**/*.class") }.filter { f -> f.readBytes().let { b -> String(b, Charsets.ISO_8859_1).let { it.contains("LambdaMetafactory") || it.contains("StringConcatFactory") } } }.files
        require(bad.isEmpty()) { "invokedynamic bootstrap still present in: " + bad.take(10).joinToString { it.name } }
        // nothing may be removed: every input class must still exist (backported lambdas only add classes)
        val inDir = layout.buildDirectory.dir("dexin").get().asFile
        val inNames = fileTree(inDir).matching { include("**/*.class"); exclude("**/module-info.class") }.files.map { it.relativeTo(inDir).invariantSeparatorsPath }.toSet()
        val outNames = mutableSetOf<String>(); zipTree(desugaredJar).visit { if (!isDirectory && name.endsWith(".class")) outNames += relativePath.pathString }
        val lost = inNames - outNames
        require(lost.isEmpty()) { "desugar removed ${lost.size} classes, e.g. " + lost.take(5) }
        // regression guard for the 0.2.2 crash: Kotlin's Map bridge methods must survive
        val em = zipTree(desugaredJar).matching { include("kotlin/collections/EmptyMap.class") }.singleFile.readBytes()
        require(String(em, Charsets.ISO_8859_1).contains("getSize")) { "kotlin.collections.EmptyMap lost its size()/getSize() bridge" }
    }
}
val dex by tasks.registering(Exec::class) {
    dependsOn(desugar, checkNoIndy)
    val out = apkDir.map { it.file("classes.dex") }
    inputs.file(desugaredJar); outputs.file(out)
    doFirst { apkDir.get().asFile.mkdirs() }
    commandLine(dxTool, "--dex", "--min-sdk-version=26", "--output=${out.get().asFile.path}", desugaredJar.get().asFile.path)
}

val packageRes by tasks.registering(Exec::class) {
    dependsOn(syncGame, checkToolchain, buildFwExtras)
    val out = apkDir.map { it.file("base.ap_") }
    inputs.dir(resDir); inputs.file(manifest); inputs.file(fwExtras); inputs.dir(layout.buildDirectory.dir("assets")); outputs.file(out)
    doFirst { apkDir.get().asFile.mkdirs() }
    commandLine("aapt", "package", "-f", "--no-crunch", "-M", manifest.path, "-S", resDir.path, "-A", layout.buildDirectory.dir("assets").get().asFile.path,
        "-I", resJar.path, "-I", fwExtras.get().asFile.path, "-F", out.get().asFile.path, "--version-code", vCode, "--version-name", vName, "-0", "glb", "-0", "woff", "-0", "woff2", "-0", "png", "-0", "jpg")
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
    // the compiled manifest must carry what Android 14/15 check at runtime (not just the source XML)
    doLast {
        fun run(vararg cmd: String): String { val p = ProcessBuilder(*cmd).redirectErrorStream(true).start(); val t = p.inputStream.bufferedReader().readText(); p.waitFor(); return t }
        val x = run("aapt", "dump", "xmltree", debugApk.asFile.path, "AndroidManifest.xml")
        require(Regex("targetSdkVersion\\(0x01010270\\)=\\(type 0x10\\)0x23").containsMatchIn(x)) { "targetSdkVersion is not 35" }
        require(x.contains("android:foregroundServiceType(0x01010599)=@0x")) { "OverlayPetService lacks android:foregroundServiceType" }
        require(x.contains("PROPERTY_SPECIAL_USE_FGS_SUBTYPE")) { "missing PROPERTY_SPECIAL_USE_FGS_SUBTYPE" }
        require(x.contains("android.permission.FOREGROUND_SERVICE_SPECIAL_USE")) { "missing FOREGROUND_SERVICE_SPECIAL_USE" }
        require(!x.contains("BIND_ACCESSIBILITY_SERVICE") && !x.contains("QUERY_ALL_PACKAGES")) { "forbidden permission/service in manifest" }
        val res = run("aapt", "dump", "resources", debugApk.asFile.path)
        require(Regex("integer/fgs_special_use: t=0x11 d=0x40000000").containsMatchIn(res)) { "fgs_special_use must be the int 0x40000000 (FOREGROUND_SERVICE_TYPE_SPECIAL_USE)" }
        println("manifest OK: targetSdk 35, specialUse FGS type + subtype property, no accessibility / all-packages permissions")
    }
}
