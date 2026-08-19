package com.hayao0819.laimelea.alarm

import android.os.SystemClock
import android.content.SharedPreferences
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import io.mockk.every
import io.mockk.mockk
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

@RunWith(AndroidJUnit4::class)
class TimerAlarmSchedulerTest {

    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val timerId = "timer-scheduler-test"

    @After
    fun cleanUp() {
        TimerAlarmScheduler.cancel(context, timerId)
        TimerAlarmScheduler.consumeCompleted(context)
    }

    @Test
    fun firingRecordsCompletionOnceAndRemovesSchedule() {
        TimerAlarmScheduler.schedule(context, timerId, "Timer", 60_000)
        val generation = requireNotNull(TimerAlarmScheduler.storedTimerFor(context, timerId)?.generation)

        assertTrue(TimerAlarmScheduler.fire(context, timerId, generation))

        assertTrue(TimerAlarmScheduler.consumeCompleted(context).contains(timerId))
        assertEquals(emptyList<String>(), TimerAlarmScheduler.consumeCompleted(context))
    }

    @Test
    fun storedTimerPreservesSeparatorInLabel() {
        val timer = TimerAlarmScheduler.StoredTimer("Tea | coffee", 1234L)

        assertEquals(
            timer,
            TimerAlarmScheduler.decodeStoredTimer(TimerAlarmScheduler.encodeStoredTimer(timer)),
        )
    }

    @Test
    fun staleGenerationCannotCompleteRescheduledTimer() {
        TimerAlarmScheduler.schedule(context, timerId, "First", 60_000)
        val firstGeneration = requireNotNull(
            TimerAlarmScheduler.storedTimerFor(context, timerId)?.generation,
        )
        TimerAlarmScheduler.schedule(context, timerId, "Second", 60_000)
        val secondGeneration = requireNotNull(
            TimerAlarmScheduler.storedTimerFor(context, timerId)?.generation,
        )

        assertTrue(firstGeneration != secondGeneration)
        assertTrue(!TimerAlarmScheduler.fire(context, timerId, firstGeneration))
        assertTrue(TimerAlarmScheduler.remainingMs(context, timerId) != null)
        assertTrue(TimerAlarmScheduler.fire(context, timerId, secondGeneration))
    }

    @Test
    fun elapsedDeadlineIsUnavailableAfterCancellation() {
        TimerAlarmScheduler.schedule(context, timerId, "Timer", 60_000)

        assertTrue(TimerAlarmScheduler.remainingMs(context, timerId) != null)
        TimerAlarmScheduler.cancel(context, timerId)
        assertEquals(null, TimerAlarmScheduler.remainingMs(context, timerId))
    }

    @Test
    fun wallClockChangesPreserveTheElapsedDeadlineForReboot() {
        TimerAlarmScheduler.schedule(context, timerId, "Timer", 60_000)
        assertTrue(TimerAlarmScheduler.scheduledTimerIds(context).contains(timerId))
        val preferences = context.getSharedPreferences(
            "scheduledTimers",
            android.content.Context.MODE_PRIVATE,
        )
        val timer = requireNotNull(TimerAlarmScheduler.storedTimerFor(context, timerId))
        preferences.edit()
            .putString(
                "timer.$timerId",
                TimerAlarmScheduler.encodeStoredTimer(
                    timer.copy(wallDeadlineMs = System.currentTimeMillis() + 1_000),
                ),
            )
            .commit()

        TimerAlarmScheduler.rebaseWallDeadlines(context)

        val rebased = requireNotNull(TimerAlarmScheduler.storedTimerFor(context, timerId))
        val remainingMs = requireNotNull(TimerAlarmScheduler.remainingMs(context, timerId))
        assertTrue(abs(rebased.wallDeadlineMs - (System.currentTimeMillis() + remainingMs)) < 1_000)
    }

    @Test
    fun schedulingRejectsDurationsThatWouldOverflowTheElapsedDeadline() {
        try {
            TimerAlarmScheduler.schedule(context, timerId, "Timer", Long.MAX_VALUE)
            org.junit.Assert.fail("Expected an overflow-guarding duration check to throw")
        } catch (_: IllegalArgumentException) {
            // expected
        }
        assertEquals(null, TimerAlarmScheduler.remainingMs(context, timerId))
    }

    @Test
    fun legacyStoredTimersDecodeWithoutGeneration() {
        assertEquals(
            TimerAlarmScheduler.StoredTimer("Legacy", 1234L),
            TimerAlarmScheduler.decodeStoredTimer("Legacy|1234"),
        )
    }

    @Test
    fun bootRescheduleReplacesThePreviousGeneration() {
        val previous = TimerAlarmScheduler.StoredTimer(
            label = "Timer",
            wallDeadlineMs = System.currentTimeMillis() + 60_000,
            deadlineElapsedMs = SystemClock.elapsedRealtime() + 60_000,
            generation = "before-reboot",
        )
        context.getSharedPreferences("scheduledTimers", android.content.Context.MODE_PRIVATE)
            .edit()
            .putString(
                "timer.$timerId",
                TimerAlarmScheduler.encodeStoredTimer(previous),
            )
            .commit()

        TimerAlarmScheduler.rescheduleAfterBoot(context)

        val rescheduled = requireNotNull(TimerAlarmScheduler.storedTimerFor(context, timerId))
        assertNotEquals(previous.generation, rescheduled.generation)
        assertFalse(TimerAlarmScheduler.fire(context, timerId, previous.generation))
        assertTrue(TimerAlarmScheduler.fire(context, timerId, rescheduled.generation))
    }

    @Test
    fun completionIsNotRecordedWhenItsPreferenceCommitFails() {
        val preferences = mockk<SharedPreferences>()
        val editor = mockk<SharedPreferences.Editor>()
        every { preferences.edit() } returns editor
        every { editor.remove(any()) } returns editor
        every { editor.putBoolean(any(), any()) } returns editor
        every { editor.commit() } returns false

        assertFalse(TimerAlarmScheduler.recordCompletion(preferences, timerId))
    }

    @Test
    fun completedTimersRemainPendingWhenTheirRemovalCommitFails() {
        val preferences = mockk<SharedPreferences>()
        val editor = mockk<SharedPreferences.Editor>()
        every { preferences.all } returns mapOf("completed.$timerId" to true)
        every { preferences.edit() } returns editor
        every { editor.remove(any()) } returns editor
        every { editor.commit() } returns false

        assertEquals(emptyList<String>(), TimerAlarmScheduler.consumeCompletedIds(preferences))
    }
}
