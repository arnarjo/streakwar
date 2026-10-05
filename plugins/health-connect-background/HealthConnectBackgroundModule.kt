package com.streakwar.health

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.feature.ExperimentalFeatureAvailabilityApi
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Capability only. Permission UI remains in react-native-health-connect. */
class HealthConnectBackgroundModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "StreakWarHealthConnectBackground"

  @ReactMethod
  @OptIn(ExperimentalFeatureAvailabilityApi::class)
  fun isBackgroundReadSupported(promise: Promise) {
    try {
      if (HealthConnectClient.getSdkStatus(reactApplicationContext) != HealthConnectClient.SDK_AVAILABLE) {
        promise.resolve(false)
        return
      }
      val client = HealthConnectClient.getOrCreate(reactApplicationContext)
      promise.resolve(client.features.getFeatureStatus(
        HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND
      ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE)
    } catch (error: Exception) {
      promise.reject("HC_BACKGROUND_CAPABILITY", "Could not check Health Connect background support", error)
    } catch (error: LinkageError) {
      promise.reject("HC_BACKGROUND_CAPABILITY", "Health Connect background API unavailable", error)
    }
  }
}
