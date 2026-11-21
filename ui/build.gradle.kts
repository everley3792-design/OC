// ui — design tokens, components and screens; pure Kotlin (drawn through render:api), so the JVM can take screenshots of every screen
plugins { alias(libs.plugins.kotlin.jvm) }
java { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8); freeCompilerArgs.addAll("-Xlambdas=class", "-Xsam-conversions=class") } }
tasks.withType<Test>().configureEach { maxHeapSize = "2g"; testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL } }
dependencies {
    api(project(":render:api")); api(project(":core:save"))
    testImplementation(project(":render:jvm")); testImplementation(libs.kotlin.test); testImplementation(libs.junit)
}
// screenshot tests read the real fonts and art
tasks.withType<Test>().configureEach { systemProperty("oc.root", rootProject.projectDir.path); systemProperty("oc.record", providers.gradleProperty("record").orNull ?: "false") }
