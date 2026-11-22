// OC Shimeji — offline APK pipeline (no Android Gradle Plugin: this environment cannot reach Google Maven).
//   genRes      aapt     R.java from res/ + manifest (linked against the API 23 platform jar)
//   compile     Kotlin   app + every pure module, compileOnly against a full framework jar (Robolectric android-all, API 35)
//   desugar     ProGuard backports Java 8 lambdas (dx cannot; ART would crash on invoke-custom) — NEVER shrinks (-dontshrink)
//   checkNoIndy fails the build if any LambdaMetafactory / StringConcatFactory survived
//   dex         dx       → classes.dex (min SDK 26)
//   packageRes  aapt     manifest + res + assets (fonts, character art) → base APK
//   addDex / zipalign / apksigner (debug keystore created locally, never committed; release keystore only from OC_RELEASE_* env vars)
//   verifyDebugApk  apksigner verify + checks on the COMPILED manifest
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
val assetsOut = layout.buildDirectory.dir("assets")

java { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }
kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_1_8); freeCompilerArgs.addAll("-Xlambdas=class", "-Xsam-conversions=class", "-Xno-call-assertions", "-Xno-param-assertions") } }
sourceSets["main"].kotlin.srcDir("src/main/java")
sourceSets["main"].java.srcDir(gen)

val proguardTool by configurations.creating
dependencies {
    compileOnly(files(compileJar))
    implementation(project(":ui"))
    proguardTool("com.guardsquare:proguard-base:7.10.0")
}

val checkToolchain by tasks.registering {
    doLast {
        require(compileJar.exists()) { "Missing framework jar $compileJar (Robolectric android-all API 35, Maven Central)" }
        require(resJar.exists()) { "Missing platform jar $resJar (Ubuntu package android-sdk-platform-23)" }
    }
}

// Framework attributes newer than the API-23 res jar (android:foregroundServiceType for the Android 14+ FGS type).
// Built from tools/framework-extras with `aapt package -x` (package id 0x01); used only as an extra -I, never packaged.
val fwExtrasDir = file("tools/framework-extras")
val fwExtras = layout.buildDirectory.file("fw-extras/framework-extras.apk")
val buildFwExtras by tasks.registering(Exec::class) {
    inputs.dir(fwExtrasDir); outputs.file(fwExtras)
    doFirst { fwExtras.get().asFile.parentFile.mkdirs() }
    commandLine("aapt", "package", "-f", "-x", "-M", File(fwExtrasDir, "AndroidManifest.xml").path, "-S", File(fwExtrasDir, "res").path, "-F", fwExtras.get().asFile.path)
}

val genRes by tasks.registering(Exec::class) {
    dependsOn(checkToolchain, buildFwExtras)
    inputs.file(fwExtras); inputs.dir(resDir); inputs.file(manifest); inputs.property("versionCode", vCode); inputs.property("versionName", vName); outputs.dir(gen)
    doFirst {
        gen.get().asFile.mkdirs()
        val m = manifest.readText()
        require(m.contains("android:versionCode=\"$vCode\"") && m.contains("android:versionName=\"$vName\"")) { "AndroidManifest.xml version must match gradle.properties ($vName / $vCode)" }
        val bi = gen.get().file("app/ocshimeji/BuildInfo.java").asFile; bi.parentFile.mkdirs()
        bi.writeText("package app.ocshimeji;\npublic final class BuildInfo { public static final String VERSION_NAME = \"$vName\"; public static final int VERSION_CODE = $vCode; }\n")
    }
    commandLine("aapt", "package", "-f", "-m", "-J", gen.get().asFile.path, "-M", manifest.path, "-S", resDir.path, "-I", resJar.path, "-I", fwExtras.get().asFile.path)
}
tasks.named("compileKotlin") { dependsOn(genRes) }
tasks.named("compileJava") { dependsOn(genRes) }

/* what the app reads at runtime: fonts and the built-in characters' working images (originals stay in art/, not in the APK) */
val syncAssets by tasks.registering(Sync::class) {
    into(assetsOut)
    from(rootProject.file("art/fonts")) { include("*.ttf"); into("fonts") }
    from(rootProject.file("art/chars")) { include("**/*.png"); exclude("**/original.png"); into("chars") }
}

val dexInputs by tasks.registering(Sync::class) {
    dependsOn("classes")
    into(layout.buildDirectory.dir("dexin"))
    from(sourceSets["main"].output.classesDirs)
    from({ configurations["runtimeClasspath"].filter { it.name.endsWith(".jar") }.map { zipTree(it) } }) { exclude("META-INF/**", "**/module-info.class") }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}
val desugaredJar = layout.buildDirectory.file("desugared/classes.jar")
val desugar by tasks.registering(JavaExec::class) {
    dependsOn(dexInputs, checkToolchain)
    val rules = file("proguard-offline.pro")
    inputs.dir(layout.buildDirectory.dir("dexin")); inputs.file(rules); outputs.file(desugaredJar)
    classpath = proguardTool; mainClass.set("proguard.ProGuard")
    doFirst { desugaredJar.get().asFile.parentFile.mkdirs() }
    val jbase = File(System.getProperty("java.home"), "jmods/java.base.jmod")
    val libs = mutableListOf("-libraryjars", compileJar.path)
    if (jbase.exists()) libs += listOf("-libraryjars", jbase.path + "(!**.jar;!module-info.class)")
    args(listOf("@" + rules.path, "-injars", layout.buildDirectory.dir("dexin").get().asFile.path, "-outjars", desugaredJar.get().asFile.path) + libs)
}
val checkNoIndy by tasks.registering {
    dependsOn(desugar); inputs.file(desugaredJar)
    doLast {
        val bad = zipTree(desugaredJar).matching { include("**/*.class") }.filter { f -> String(f.readBytes(), Charsets.ISO_8859_1).let { it.contains("LambdaMetafactory") || it.contains("StringConcatFactory") } }.files
        require(bad.isEmpty()) { "invokedynamic bootstrap still present in: " + bad.take(10).joinToString { it.name } }
        val inDir = layout.buildDirectory.dir("dexin").get().asFile
        val inNames = fileTree(inDir).matching { include("**/*.class"); exclude("**/module-info.class") }.files.map { it.relativeTo(inDir).invariantSeparatorsPath }.toSet()
        val outNames = mutableSetOf<String>(); zipTree(desugaredJar).visit { if (!isDirectory && name.endsWith(".class")) outNames += relativePath.pathString }
        val lost = inNames - outNames
        require(lost.isEmpty()) { "desugar removed ${lost.size} classes, e.g. " + lost.take(5) }
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
    dependsOn(syncAssets, checkToolchain, buildFwExtras)
    val out = apkDir.map { it.file("base.ap_") }
    inputs.file(fwExtras); inputs.dir(resDir); inputs.file(manifest); inputs.dir(assetsOut); inputs.property("versionCode", vCode); inputs.property("versionName", vName); outputs.file(out)
    doFirst { apkDir.get().asFile.mkdirs() }
    commandLine("aapt", "package", "-f", "--no-crunch", "-M", manifest.path, "-S", resDir.path, "-A", assetsOut.get().asFile.path,
        "-I", resJar.path, "-I", fwExtras.get().asFile.path, "-F", out.get().asFile.path, "--version-code", vCode, "--version-name", vName, "-0", "png", "-0", "ttf")
}
val unsignedApk = apkDir.map { it.file("app-unsigned.apk") }
val addDex by tasks.registering(Exec::class) {
    dependsOn(packageRes, dex)
    inputs.file(apkDir.map { it.file("base.ap_") }); inputs.file(apkDir.map { it.file("classes.dex") }); outputs.file(unsignedApk)
    workingDir(apkDir)
    doFirst { apkDir.get().file("base.ap_").asFile.copyTo(unsignedApk.get().asFile, overwrite = true) }
    commandLine("aapt", "add", "-f", unsignedApk.get().asFile.name, "classes.dex")
}
val alignedApk = apkDir.map { it.file("app-aligned.apk") }
val zipalign by tasks.registering(Exec::class) {
    dependsOn(addDex); inputs.file(unsignedApk); outputs.file(alignedApk)
    commandLine("zipalign", "-f", "-p", "4", unsignedApk.get().asFile.path, alignedApk.get().asFile.path)
}
val debugKeystore = File(System.getProperty("user.home"), ".android/debug.keystore")
val ensureDebugKeystore by tasks.registering(Exec::class) {
    onlyIf { !debugKeystore.exists() }
    doFirst { debugKeystore.parentFile.mkdirs() }
    commandLine("keytool", "-genkeypair", "-v", "-keystore", debugKeystore.path, "-storepass", "android", "-alias", "androiddebugkey", "-keypass", "android",
        "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-dname", "CN=Android Debug,O=Android,C=US")
}
val outDir = layout.buildDirectory.dir("outputs/apk")
val debugApk = outDir.map { it.file("debug/oc-shimeji-$vName-debug.apk") }
val assembleDebug by tasks.registering(Exec::class) {
    group = "build"; description = "Builds and signs the debug APK (offline pipeline)."
    dependsOn(zipalign, ensureDebugKeystore)
    inputs.file(alignedApk); outputs.file(debugApk)
    doFirst { debugApk.get().asFile.parentFile.mkdirs() }
    commandLine("apksigner", "sign", "--ks", debugKeystore.path, "--ks-pass", "pass:android", "--ks-key-alias", "androiddebugkey", "--key-pass", "pass:android",
        "--min-sdk-version", "26", "--out", debugApk.get().asFile.path, alignedApk.get().asFile.path)
    doLast { println("APK: ${debugApk.get().asFile.path}") }
}
tasks.register<Exec>("assembleRelease") {
    group = "build"; description = "Release APK signed with OC_RELEASE_KEYSTORE (never stored in the repository)."
    dependsOn(zipalign); inputs.file(alignedApk)
    val ks = System.getenv("OC_RELEASE_KEYSTORE"); val out = outDir.map { it.file("release/oc-shimeji-$vName-release.apk") }
    doFirst {   /* 2.0.0: no key = a clear stop, never a silent skip that looks like success */
        require(ks != null && File(ks).isFile) { "正式簽章需要 OC_RELEASE_KEYSTORE（金鑰檔的路徑）、OC_RELEASE_STORE_PASSWORD、OC_RELEASE_KEY_ALIAS、OC_RELEASE_KEY_PASSWORD；金鑰絕不放進專案" }
        require(System.getenv("OC_RELEASE_STORE_PASSWORD") != null && System.getenv("OC_RELEASE_KEY_PASSWORD") != null) { "缺少 OC_RELEASE_STORE_PASSWORD 或 OC_RELEASE_KEY_PASSWORD" }
        out.get().asFile.parentFile.mkdirs() }
    doLast { println("正式版 APK：${out.get().asFile.path}") }
    commandLine("apksigner", "sign", "--ks", ks ?: "", "--ks-pass", "env:OC_RELEASE_STORE_PASSWORD", "--ks-key-alias", System.getenv("OC_RELEASE_KEY_ALIAS") ?: "oc",
        "--key-pass", "env:OC_RELEASE_KEY_PASSWORD", "--out", out.get().asFile.path, alignedApk.get().asFile.path)
}
tasks.register<Exec>("verifyDebugApk") {
    group = "verification"; dependsOn(assembleDebug)
    commandLine("apksigner", "verify", "--verbose", "--min-sdk-version", "26", debugApk.get().asFile.path)
    doLast {
        fun run(vararg cmd: String): String { val p = ProcessBuilder(*cmd).redirectErrorStream(true).start(); val t = p.inputStream.bufferedReader().readText(); p.waitFor(); return t }
        val apk = debugApk.get().asFile.path
        val x = run("aapt", "dump", "xmltree", apk, "AndroidManifest.xml")
        require(Regex("targetSdkVersion\\(0x01010270\\)=\\(type 0x10\\)0x23").containsMatchIn(x)) { "targetSdkVersion is not 35" }
        require(Regex("versionCode\\(0x0101021b\\)=\\(type 0x10\\)0x" + Integer.toHexString(vCode.toInt()) + "\\b").containsMatchIn(x)) { "compiled versionCode is not $vCode" }
        require(!x.contains("BIND_ACCESSIBILITY_SERVICE") && !x.contains("QUERY_ALL_PACKAGES")) { "forbidden permission/service in manifest" }
        require(Regex("foregroundServiceType\\(0x01010599\\)=\\(type 0x1[01]\\)0x40000000").containsMatchIn(x)) { "the desktop service must be foregroundServiceType=specialUse" }
        require(!x.contains("WAKE_LOCK") && !x.contains("RECEIVE_BOOT_COMPLETED")) { "the desktop pet never keeps itself alive (plan 2.4)" }
        val files = run("aapt", "list", apk)
        for (f in listOf("classes.dex", "assets/fonts/Huninn-Regular.ttf", "assets/chars/cinnamon/idle.png")) require(files.lines().any { it.trim() == f }) { "APK lacks $f" }
        println("manifest OK: targetSdk 35, versionCode $vCode, specialUse desktop service, no accessibility / all-packages / wake lock / boot; fonts and art packaged")
    }
}
