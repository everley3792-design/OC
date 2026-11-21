// render:api — what every screen draws through (Android Canvas on the phone, Java2D on the JVM for screenshot tests)
plugins { alias(libs.plugins.kotlin.jvm) }
java { sourceCompatibility = JavaVersion.VERSION_1_8; targetCompatibility = JavaVersion.VERSION_1_8 }
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8); freeCompilerArgs.addAll("-Xlambdas=class", "-Xsam-conversions=class") } }
tasks.withType<Test>().configureEach { maxHeapSize = "2g"; testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL } }
