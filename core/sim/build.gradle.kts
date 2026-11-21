// core:sim — the one deterministic simulation (M0: random numbers and the clock; needs, AI and the rest arrive in M1+)
plugins { alias(libs.plugins.kotlin.jvm) }
java { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8); freeCompilerArgs.addAll("-Xlambdas=class", "-Xsam-conversions=class") } }
tasks.withType<Test>().configureEach { maxHeapSize = "2g"; testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL } }
dependencies { testImplementation(libs.kotlin.test); testImplementation(libs.junit) }
