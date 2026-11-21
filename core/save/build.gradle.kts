// core:save — the two layers: the library (shared by every save) and the saves (one world each)
plugins { alias(libs.plugins.kotlin.jvm); alias(libs.plugins.kotlin.serialization) }
java { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8); freeCompilerArgs.addAll("-Xlambdas=class", "-Xsam-conversions=class") } }
tasks.withType<Test>().configureEach { maxHeapSize = "2g"; testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL } }
dependencies { api(project(":core:sim")); api(libs.kotlinx.serialization.json); testImplementation(libs.kotlin.test); testImplementation(libs.junit) }
