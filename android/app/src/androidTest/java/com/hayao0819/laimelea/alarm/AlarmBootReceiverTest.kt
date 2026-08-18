package com.hayao0819.laimelea.alarm

import android.content.Context
import android.content.Intent
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
    fun nonSilentAudioStartsEvenWhenAlarmNotificationsAreUnavailable() {
        assertTrue(RingtoneModule.shouldStartAlarmAudio(null))
        assertTrue(RingtoneModule.shouldStartAlarmAudio("content://media/audio/1"))
        assertTrue(!RingtoneModule.shouldStartAlarmAudio("__silent__"))
    }

    @Test
    fun deviceProtectedScheduleDoesNotStoreTheCustomSoundOrLabel() {
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
    fun silentPendingIntentRecordsAReceiverDelivery() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val timestamp = System.currentTimeMillis()
        val alarmId = "silent-direct-$timestamp"
        val key = "delivery.$alarmId.$timestamp"
        val preferences = context.createDeviceProtectedStorageContext()
            .getSharedPreferences("pendingAlarmDeliveries", Context.MODE_PRIVATE)
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
    fun alarmRegistrationFailureIsContained() {
        assertTrue(!RingtoneModule.attemptAlarmClockRegistration { error("alarm manager unavailable") })
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
