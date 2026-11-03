// Root build file used only with -PcoreOnly=true (pure JVM core modules).
plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
