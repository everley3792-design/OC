# Offline pipeline only: ProGuard is used as a *desugarer* (and stdlib shrinker), not an obfuscator.
# dx cannot rewrite Java 8 invokedynamic lambdas; the Kotlin stdlib / kotlinx jars contain them and
# Android's runtime has no java.lang.invoke.LambdaMetafactory → crash at launch. ProGuard backports
# lambdas to plain classes when the class-file target is lowered.
-target 1.7
-dontobfuscate
-dontoptimize
-dontpreverify
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable

# everything of ours (activities, services, providers, bridge, core modules)
-keep class app.ocshimeji.** { *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }

# library classes the framework jar does not model precisely
-dontwarn **
-dontnote **
