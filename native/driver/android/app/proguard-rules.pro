# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

##############################################################
# Capacitor — R8 cannot see reflection, which is how Capacitor
# loads plugins at runtime (reads capacitor.plugins.json, then
# instantiates each plugin class by name and calls its
# @PluginMethod-annotated methods). Without these, minification
# strips exactly the code the WebView bridge needs to call.
##############################################################
-keep class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public *;
}
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Cordova compatibility layer — some Capacitor plugins still
# route through this.
-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin

# Google Play Services Location — used by the geolocation and
# background-geolocation plugins; ships its own obfuscated
# internals R8 shouldn't try to inline/rename.
-dontwarn com.google.android.gms.**
-keep class com.google.android.gms.location.** { *; }

# Firebase Cloud Messaging — used by the push-notifications
# plugin; also reflection-driven for message deserialization.
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
