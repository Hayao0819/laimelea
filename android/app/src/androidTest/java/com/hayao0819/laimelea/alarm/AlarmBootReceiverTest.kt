package com.hayao0819.laimelea.alarm

import android.content.Context
import android.content.Intent
import android.content.ComponentName
import android.app.AlarmManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class AlarmBootReceiverTest {

    @Test
    fun acceptsBootAndClockChangeBroadcasts() {
        assertTrue(AlarmBootActions.supports(Intent.ACTION_BOOT_COMPLETED))
        assertTrue(AlarmBootActions.supports(Intent.ACTION_LOCKED_BOOT_COMPLETED))
        assertTrue(AlarmBootActions.supports(Intent.ACTION_TIME_CHANGED))
        assertTrue(AlarmBootActions.supports(Intent.ACTION_TIMEZONE_CHANGED))
    }

    @Test
    fun recognizesTheDirectBootStopAction() {
        val intent = Intent().apply {
            action = "com.hayao0819.laimelea.ALARM_STOP.alarm-1.1000000"
        }

        assertTrue(RingtoneModule.isAlarmStopIntent(intent))
    }

    @Test
    fun stopKeepsThePendingDeliveryForJavaScriptReconciliation() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("pendingAlarmDeliveries", Context.MODE_PRIVATE)
        preferences.edit()
            .putString("delivery.alarm-1.1000000", "1000000|0")
            .commit()

        RingtoneModule.markPendingAlarmDeliveryStopped(context, "alarm-1")

        assertEquals(
            "1000000|0|true",
            preferences.getString("delivery.alarm-1.1000000", null),
        )
    }

    @Test
    fun stopCreatesAReconciliationDeliveryAfterJavaScriptAcknowledgedTheAlarm() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis()
        val alarmId = "acknowledged-alarm-$timestamp"
        val key = "delivery.$alarmId.$timestamp"
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("pendingAlarmDeliveries", Context.MODE_PRIVATE)

        try {
            RingtoneModule.recordStoppedAlarmDelivery(context, alarmId, timestamp, 60_000L)

            assertEquals("$timestamp|60000|true", preferences.getString(key, null))
        } finally {
            preferences.edit().remove(key).commit()
        }
    }

    @Test
    fun firingIntentsRemainDistinctWhenAlarmIdsHaveTheSameHash() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val first = RingtoneModule.alarmFiringPendingIntent(context, "Aa", 1_000_000L)
        val second = RingtoneModule.alarmFiringPendingIntent(context, "BB", 1_000_000L)

        try {
            assertEquals("Aa".hashCode(), "BB".hashCode())
            assertNotEquals(first, second)
        } finally {
            first.cancel()
            second.cancel()
        }
    }

    @Test
    fun audioOnlySkipsSilentAlarms() {
        assertTrue(RingtoneModule.shouldStartAlarmAudio(null))
        assertTrue(RingtoneModule.shouldStartAlarmAudio("content://media/audio/1"))
        assertTrue(!RingtoneModule.shouldStartAlarmAudio("__silent__"))
    }

    @Test
    fun lockedDevicesUseTheDirectBootStopActivity() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        @Suppress("DEPRECATION")
        val activityInfo = context.packageManager.getActivityInfo(
            ComponentName(context, AlarmStopActivity::class.java),
            0,
        )

        assertTrue(activityInfo.directBootAware)
        assertEquals(AlarmStopActivity::class.java, RingtoneModule.alarmFiringActivity(false))
        assertEquals(
            com.hayao0819.laimelea.MainActivity::class.java,
            RingtoneModule.alarmFiringActivity(true),
        )
    }

    @Test
    fun firingIntentCarriesTheAlarmOccurrenceExtras() {
        val context = ApplicationProvider.getApplicationContext<Context>()

        val intent = RingtoneModule.alarmFiringIntent(context, "alarm-1", 1_000_000L, 60_000L)

        assertEquals("alarm-1", intent.getStringExtra(AlarmAudioService.EXTRA_ALARM_ID))
        assertEquals(1_000_000L, intent.getLongExtra(RingtoneModule.EXTRA_TRIGGER_TIMESTAMP_MS, 0L))
        assertEquals(60_000L, intent.getLongExtra(AlarmAudioService.EXTRA_AUTO_SILENCE_MS, 0L))
    }

    @Test
    fun autoSilenceFallsBackToABoundedCeilingWhenTheUiCouldNotBeShown() {
        assertEquals(
            AlarmAudioService.FALLBACK_MAX_RING_DURATION_MS,
            AlarmAudioService.effectiveAutoSilenceMs(0L, uiReachable = false),
        )
        assertEquals(
            AlarmAudioService.FALLBACK_MAX_RING_DURATION_MS,
            AlarmAudioService.effectiveAutoSilenceMs(30 * 60_000L, uiReachable = false),
        )
        assertEquals(
            60_000L,
            AlarmAudioService.effectiveAutoSilenceMs(60_000L, uiReachable = false),
        )
    }

    @Test
    fun autoSilenceIsUnboundedWhenTheStopUiIsReachable() {
        assertEquals(0L, AlarmAudioService.effectiveAutoSilenceMs(0L, uiReachable = true))
        assertEquals(
            30 * 60_000L,
            AlarmAudioService.effectiveAutoSilenceMs(30 * 60_000L, uiReachable = true),
        )
    }

    @Test
    fun stoppingAnAlarmDisplaysTheNextRemainingPlaybackInstead() {
        val remaining = listOf(
            AlarmAudioService.Companion.ActivePlaybackDescriptor("alarm-2", 2_000_000L, 60_000L),
        )

        assertEquals("alarm-2", AlarmStopActivity.playbackToDisplayAfterStopping(remaining)?.alarmId)
        assertNull(AlarmStopActivity.playbackToDisplayAfterStopping(emptyList()))
    }

    @Test
    fun stopActivityUsesLegacyWindowFlagsBeforeApi27() {
        assertFalse(AlarmStopActivity.supportsModernLockScreenApi(26))
        assertTrue(AlarmStopActivity.supportsModernLockScreenApi(27))
    }

    @Test
    fun stopActionsOnlyMatchTheirAlarmOccurrence() {
        assertTrue(
            AlarmAudioService.matchesPlayback("alarm-1", 1_000L, "alarm-1", 1_000L),
        )
        assertFalse(
            AlarmAudioService.matchesPlayback("alarm-1", 1_000L, "alarm-1", 2_000L),
        )
        assertFalse(
            AlarmAudioService.matchesPlayback("alarm-1", 1_000L, "alarm-2", 1_000L),
        )
    }

    @Test
    fun aNewOccurrenceOnlyReplacesPlaybackForTheSameAlarm() {
        assertTrue(AlarmAudioService.shouldReplacePlayback("alarm-1", "alarm-1"))
        assertFalse(AlarmAudioService.shouldReplacePlayback("alarm-1", "alarm-2"))
    }

    @Test
    fun deviceProtectedScheduleKeepsTheSoundModeWithoutPrivateAudioOrLabel() {
        val soundUri = "content://media/audio/private"
        val label = "Private reminder"
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            "alarm-1",
            1_000_000L,
            soundUri,
            0L,
            0L,
            false,
            null,
            emptyList(),
            0L,
            label,
            true,
        )

        val encoded = RingtoneModule.encodeScheduledAudio(scheduled)
        val decoded = RingtoneModule.decodeScheduledAudio(encoded)

        assertFalse(encoded.contains(soundUri))
        assertFalse(encoded.contains(label))
        assertNull(decoded?.soundUri)
        assertNull(decoded?.label)
        assertEquals("custom", decoded?.soundMode)
    }

    @Test
    fun silentScheduleSurvivesDeviceProtectedStorageWithoutPrivateAudio() {
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            "silent-alarm",
            1_000_000L,
            "__silent__",
            0L,
            0L,
            false,
            null,
            emptyList(),
            0L,
            "Private reminder",
            true,
        )

        val decoded = RingtoneModule.decodeScheduledAudio(RingtoneModule.encodeScheduledAudio(scheduled))

        assertEquals("silent", decoded?.soundMode)
        assertEquals("__silent__", decoded?.soundUriForMode())
        assertNull(decoded?.label)
        assertEquals(
            "__silent__",
            RingtoneModule.restorePrivateScheduledAudio(
                ApplicationProvider.getApplicationContext(),
                decoded!!,
                userUnlocked = false,
            ).soundUri,
        )
    }

    @Test
    fun credentialProtectedAudioRestoresCustomSoundAndLabel() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            "private-alarm-${System.currentTimeMillis()}",
            1_000_000L,
            "content://media/audio/private",
            0L,
            0L,
            false,
            null,
            emptyList(),
            0L,
            "Private reminder",
            true,
        )
        val deviceProtected = RingtoneModule.decodeScheduledAudio(
            RingtoneModule.encodeScheduledAudio(scheduled),
        )!!

        try {
            RingtoneModule.rememberPrivateScheduledAudio(context, scheduled)

            val restored = RingtoneModule.restorePrivateScheduledAudio(context, deviceProtected)

            assertEquals(scheduled.soundUri, restored.soundUri)
            assertEquals(scheduled.label, restored.label)
        } finally {
            RingtoneModule.forgetPrivateScheduledAudio(context, scheduled.alarmId)
        }
    }

    @Test
    fun lockedCleanupRemovesPrivateAudioAfterUnlock() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val alarmId = "cleanup-alarm-${System.currentTimeMillis()}"
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            alarmId,
            1_000_000L,
            "content://media/audio/private",
            0L,
            0L,
            false,
            null,
            emptyList(),
            0L,
            "Private reminder",
            true,
        )
        val deviceProtected = RingtoneModule.decodeScheduledAudio(
            RingtoneModule.encodeScheduledAudio(scheduled),
        )!!
        RingtoneModule.rememberPrivateScheduledAudio(context, scheduled)

        try {
            RingtoneModule.forgetPrivateScheduledAudio(context, alarmId, userUnlocked = false)
            assertEquals(
                scheduled.soundUri,
                RingtoneModule.restorePrivateScheduledAudio(context, deviceProtected).soundUri,
            )

            RingtoneModule.rescheduleAlarmAudio(context)
            assertNull(RingtoneModule.restorePrivateScheduledAudio(context, deviceProtected).soundUri)
        } finally {
            RingtoneModule.forgetPrivateScheduledAudio(context, alarmId, userUnlocked = true)
        }
    }

    @Test
    fun undeliverableNonSilentAlarmRemainsActiveForJavaScript() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis()
        val alarmId = "active-undeliverable-$timestamp"
        val key = "delivery.$alarmId.$timestamp"
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("pendingAlarmDeliveries", Context.MODE_PRIVATE)

        try {
            RingtoneModule.recordUndeliverableAlarmDelivery(
                context,
                alarmId,
                timestamp,
                0L,
                false,
            )

            assertEquals("$timestamp|0|false", preferences.getString(key, null))
        } finally {
            preferences.edit().remove(key).commit()
        }
    }

    @Test
    fun undeliverableSilentAlarmIsMarkedStopped() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis()
        val alarmId = "stopped-undeliverable-$timestamp"
        val key = "delivery.$alarmId.$timestamp"
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("pendingAlarmDeliveries", Context.MODE_PRIVATE)

        try {
            RingtoneModule.recordUndeliverableAlarmDelivery(
                context,
                alarmId,
                timestamp,
                0L,
                true,
            )

            assertEquals("$timestamp|0|true", preferences.getString(key, null))
        } finally {
            preferences.edit().remove(key).commit()
        }
    }

    @Test
    fun scheduledSilentPendingIntentRecordsAReceiverDelivery() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis()
        val alarmId = "silent-direct-$timestamp"
        val key = "delivery.$alarmId.$timestamp"
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("pendingAlarmDeliveries", Context.MODE_PRIVATE)
        val scheduledPreferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            alarmId,
            timestamp,
            "__silent__",
            0L,
            0L,
            false,
            null,
            emptyList(),
            0L,
            null,
            true,
        )
        assertTrue(
            scheduledPreferences.edit()
                .putString(
                    "scheduled.$alarmId.$timestamp",
                    RingtoneModule.encodeScheduledAudio(scheduled),
                )
                .commit(),
        )
        val pendingIntent = RingtoneModule.alarmAudioPendingIntent(
            context,
            alarmId,
            timestamp,
            "__silent__",
        )

        try {
            val delivered = CountDownLatch(1)
            pendingIntent.send(context, 0, null, { _, _, _, _, _ -> delivered.countDown() }, null)
            assertTrue(delivered.await(5, TimeUnit.SECONDS))
            assertTrue(preferences.getString(key, null)?.startsWith("$timestamp|") == true)
        } finally {
            pendingIntent.cancel()
            preferences.edit().remove(key).commit()
            scheduledPreferences.edit().remove("scheduled.$alarmId.$timestamp").commit()
        }
    }

    @Test
    fun alarmAudioCancellationUsesTheSamePendingIntentIdentity() {
        val context = ApplicationProvider.getApplicationContext<Context>()

        val scheduled = RingtoneModule.alarmAudioPendingIntent(
            context,
            "alarm-1",
            1_000_000L,
            "content://media/audio/1",
            1_000L,
            2_000L,
            true,
        )
        val cancellation = RingtoneModule.alarmAudioPendingIntent(
            context,
            "alarm-1",
            1_000_000L,
        )
        val differentOccurrence = RingtoneModule.alarmAudioPendingIntent(
            context,
            "alarm-1",
            1_000_001L,
        )

        assertEquals(scheduled, cancellation)
        assertNotEquals(scheduled, differentOccurrence)
        scheduled.cancel()
        differentOccurrence.cancel()
    }

    @Test
    fun weekdayRescheduleKeepsTheConfiguredWeekday() {
        val timestamp = RingtoneModule.nextWeekdayTimestamp(23, 59, listOf(1, 3))
        assertNotNull(timestamp)

        val calendar = java.util.Calendar.getInstance().apply { timeInMillis = timestamp!! }
        val weekday = (calendar.get(java.util.Calendar.DAY_OF_WEEK) + 6) % 7
        assertTrue(weekday == 1 || weekday == 3)
    }

    @Test
    fun migrationCancelsCredentialProtectedSchedules() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val preferences = context.getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        preferences.edit().putStringSet("old-alarm", setOf("1000000")).commit()

        RingtoneModule.migrateLegacyScheduledAudio(context, alarmManager, "old-alarm")

        assertTrue(preferences.getStringSet("old-alarm", emptySet()).isNullOrEmpty())
    }

    @Test
    fun intervalRecoveryAdvancesPastTheMissedOccurrence() {
        assertEquals(
            1_300L,
            RingtoneModule.nextIntervalTimestamp(1_000L, 100L, now = 1_250L),
        )
    }

    @Test
    fun deliveryKeepsTheNextIntervalOccurrenceInDeviceProtectedStorage() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis() - 1L
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        val key = "scheduled.interval-alarm.$timestamp"
        preferences.edit().putString(
            key,
            "interval-alarm|$timestamp|0|0|2026|0|1|0|0|false|interval||60000|",
        ).commit()

        try {
            RingtoneModule.markAlarmAudioDispatched(context, "interval-alarm", timestamp)

            assertNull(preferences.getString(key, null))
            assertTrue(preferences.all.keys.any { it.startsWith("scheduled.interval-alarm.") })
        } finally {
            cancelScheduledAlarms(context, "interval-alarm")
        }
    }

    @Test
    fun deliveryKeepsSilentModeForTheNextIntervalOccurrence() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis() - 1L
        val alarmId = "silent-interval-${System.currentTimeMillis()}"
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        val key = "scheduled.$alarmId.$timestamp"
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            alarmId,
            timestamp,
            "__silent__",
            0L,
            0L,
            false,
            "interval",
            emptyList(),
            60_000L,
            null,
            true,
        )
        preferences.edit().putString(key, RingtoneModule.encodeScheduledAudio(scheduled)).commit()

        try {
            RingtoneModule.markAlarmAudioDispatched(context, alarmId, timestamp)

            val next = preferences.all.values
                .filterIsInstance<String>()
                .mapNotNull(RingtoneModule::decodeScheduledAudio)
                .single { it.alarmId == alarmId }
            assertEquals("silent", next.soundMode)
            assertEquals("__silent__", next.soundUriForMode())
        } finally {
            cancelScheduledAlarms(context, alarmId)
        }
    }

    @Test
    fun deliveryRestoresPrivateAudioForTheNextIntervalOccurrence() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis() - 1L
        val alarmId = "custom-interval-${System.currentTimeMillis()}"
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            alarmId,
            timestamp,
            "content://media/audio/custom",
            0L,
            0L,
            false,
            "interval",
            emptyList(),
            60_000L,
            "Private reminder",
            true,
        )
        preferences.edit()
            .putString("scheduled.$alarmId.$timestamp", RingtoneModule.encodeScheduledAudio(scheduled))
            .commit()
        RingtoneModule.rememberPrivateScheduledAudio(context, scheduled)

        try {
            RingtoneModule.markAlarmAudioDispatched(context, alarmId, timestamp)

            val next = preferences.all.values
                .filterIsInstance<String>()
                .mapNotNull(RingtoneModule::decodeScheduledAudio)
                .single { it.alarmId == alarmId }
            val restored = RingtoneModule.restorePrivateScheduledAudio(context, next)
            assertEquals("custom", restored.soundMode)
            assertEquals("content://media/audio/custom", restored.soundUri)
            assertEquals("Private reminder", restored.label)
        } finally {
            cancelScheduledAlarms(context, alarmId)
            RingtoneModule.forgetPrivateScheduledAudio(context, alarmId)
        }
    }

    @Test
    fun deliveryKeepsTheNextWeekdayAndCustomCycleOccurrences() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        listOf(
            Triple("weekday-alarm", "weekdays", "1"),
            Triple("cycle-alarm", "customCycleInterval", ""),
        ).forEach { (alarmId, repeatType, weekdays) ->
            val timestamp = System.currentTimeMillis() - 1L
            val key = "scheduled.$alarmId.$timestamp"
            preferences.edit().putString(
                key,
                "$alarmId|$timestamp|0|0|2026|0|1|0|0|true|$repeatType|$weekdays|60000|",
            ).commit()

            try {
                RingtoneModule.markAlarmAudioDispatched(context, alarmId, timestamp)

                assertNull(preferences.getString(key, null))
                assertTrue(preferences.all.keys.any { it.startsWith("scheduled.$alarmId.") })
            } finally {
                cancelScheduledAlarms(context, alarmId)
            }
        }
    }

    @Test
    fun deliveryRemovesOneShotOccurrenceFromDeviceProtectedStorage() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis() - 1L
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        val key = "scheduled.one-shot.$timestamp"
        preferences.edit().putString(
            key,
            "one-shot|$timestamp|0|0|2026|0|1|0|0|true|||0|",
        ).commit()

        RingtoneModule.markAlarmAudioDispatched(context, "one-shot", timestamp)

        assertNull(preferences.getString(key, null))
        assertTrue(preferences.all.keys.none { it.startsWith("scheduled.one-shot.") })
    }

    @Test
    fun secondDispatchForTheSameOccurrenceIsRejectedByTheDedupGate() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis() - 1L
        val alarmId = "dedup-alarm-${System.currentTimeMillis()}"
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        val key = "scheduled.$alarmId.$timestamp"
        preferences.edit().putString(
            key,
            "$alarmId|$timestamp|0|0|2026|0|1|0|0|true|||0|",
        ).commit()

        try {
            assertTrue(RingtoneModule.markAlarmAudioDispatched(context, alarmId, timestamp))
            assertFalse(RingtoneModule.markAlarmAudioDispatched(context, alarmId, timestamp))
        } finally {
            cancelScheduledAlarms(context, alarmId)
        }
    }

    @Test
    fun cancelledOccurrenceIsRejectedBeforeDelivery() {
        val context = ApplicationProvider.getApplicationContext<Context>()

        assertFalse(
            RingtoneModule.markAlarmAudioDispatched(
                context,
                "cancelled-alarm",
                System.currentTimeMillis(),
            ),
        )
    }

    @Test
    fun alarmRegistrationFailureIsContained() {
        assertTrue(!RingtoneModule.attemptAlarmClockRegistration { error("alarm manager unavailable") })
    }

    @Test
    fun failedAlarmRegistrationRemainsMarkedForRetry() {
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            "retry-alarm",
            1_000_000L,
            null,
            0L,
            0L,
            false,
            "interval",
            emptyList(),
            60_000L,
            null,
            true,
        )

        val pending = scheduled.withRegistrationResult(false)
        val decoded = RingtoneModule.decodeScheduledAudio(RingtoneModule.encodeScheduledAudio(pending))

        assertTrue(decoded?.registrationPending == true)
        assertFalse(decoded?.withRegistrationResult(true)?.registrationPending == true)
    }

    @Test
    fun rescheduleRetriesARegistrationMarkedPending() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val alarmId = "retry-reschedule-${System.currentTimeMillis()}"
        val timestamp = System.currentTimeMillis() + 120_000L
        val scheduled = RingtoneModule.Companion.ScheduledAudio.fromTimestamp(
            alarmId,
            timestamp,
            null,
            0L,
            0L,
            false,
            null,
            emptyList(),
            0L,
            null,
            true,
        ).withRegistrationResult(false)
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        val key = "scheduled.$alarmId.$timestamp"
        preferences.edit().putString(key, RingtoneModule.encodeScheduledAudio(scheduled)).commit()

        try {
            RingtoneModule.rescheduleAlarmAudio(context)

            val retried = preferences.getString(key, null)?.let(RingtoneModule::decodeScheduledAudio)
            assertNotNull(retried)
            assertFalse(retried!!.registrationPending)
        } finally {
            cancelScheduledAlarms(context, alarmId)
        }
    }

    private fun cancelScheduledAlarms(context: Context, alarmId: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("scheduledAlarmAudio", Context.MODE_PRIVATE)
        val prefix = "scheduled.$alarmId."
        preferences.all.keys.filter { it.startsWith(prefix) }.forEach { key ->
            val timestamp = key.removePrefix(prefix).toLongOrNull() ?: return@forEach
            val pendingIntent = RingtoneModule.alarmAudioPendingIntent(context, alarmId, timestamp)
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
            preferences.edit().remove(key).commit()
        }
    }
}
