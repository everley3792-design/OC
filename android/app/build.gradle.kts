plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}
android {
    namespace = "app.ocshimeji"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.ocshimeji"
        minSdk = 26          // TYPE_APPLICATION_OVERLAY requires API 26+
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-phase1"
    }
    buildFeatures { compose = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(project(":core:sim"))
    implementation(project(":core:anim"))
    implementation(project(":core:save"))
    implementation(project(":core:assets"))
    implementation(project(":platform:overlay"))
    implementation(project(":render:world"))
    implementation(project(":ui:design"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
}
