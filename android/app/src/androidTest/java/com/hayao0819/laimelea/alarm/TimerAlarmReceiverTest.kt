package com.hayao0819.laimelea.alarm

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TimerAlarmReceiverTest {

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val receiver = TimerAlarmReceiver()
    private val timerId = "timer-receiver-test"

    @After
    fun cleanUp() {
        TimerAlarmScheduler.cancel(context, timerId)
        TimerAlarmScheduler.consumeCompleted(context)
    }

    private fun firingIntent(id: String, generation: String?): Intent = Intent()
        .setAction("com.hayao0819.laimelea.TIMER_FIRING")
        .setData(
            Uri.Builder()
                .scheme("laimelea")
                .authority("timer")
                .appendPath(id)
                .build(),
        )
        .putExtra(TimerAlarmScheduler.EXTRA_GENERATION, generation)

    @Test
    fun onReceiveFiresTheTimerNamedInTheIntentData() {
        TimerAlarmScheduler.schedule(context, timerId, "Timer", 60_000)
        val generation = requireNotNull(TimerAlarmScheduler.storedTimerFor(context, timerId)?.generation)

        receiver.onReceive(context, firingIntent(timerId, generation))

        assertTrue(TimerAlarmScheduler.consumeCompleted(context).contains(timerId))
    }

    @Test
    fun onReceiveFallsBackToTheGenerationInTheUriQueryParameter() {
        TimerAlarmScheduler.schedule(context, timerId, "Timer", 60_000)
        val generation = requireNotNull(TimerAlarmScheduler.storedTimerFor(context, timerId)?.generation)
        val intent = Intent()
            .setAction("com.hayao0819.laimelea.TIMER_FIRING")
            .setData(
                Uri.Builder()
                    .scheme("laimelea")
                    .authority("timer")
                    .appendPath(timerId)
                    .appendQueryParameter(TimerAlarmScheduler.EXTRA_GENERATION, generation)
                    .build(),
            )

        receiver.onReceive(context, intent)

        assertTrue(TimerAlarmScheduler.consumeCompleted(context).contains(timerId))
    }

    @Test
    fun onReceiveIgnoresIntentsWithTheWrongAction() {
        TimerAlarmScheduler.schedule(context, timerId, "Timer", 60_000)
        val generation = requireNotNull(TimerAlarmScheduler.storedTimerFor(context, timerId)?.generation)

        receiver.onReceive(
            context,
            firingIntent(timerId, generation).setAction("com.hayao0819.laimelea.SOMETHING_ELSE"),
        )

        assertFalse(TimerAlarmScheduler.consumeCompleted(context).contains(timerId))
    }

    @Test
    fun onReceiveIgnoresIntentsWithoutTimerIdData() {
        TimerAlarmScheduler.schedule(context, timerId, "Timer", 60_000)

        receiver.onReceive(context, Intent().setAction("com.hayao0819.laimelea.TIMER_FIRING"))

        assertFalse(TimerAlarmScheduler.consumeCompleted(context).contains(timerId))
    }

    @Test
    fun onReceiveIgnoresAStaleGeneration() {
        TimerAlarmScheduler.schedule(context, timerId, "First", 60_000)
        val staleGeneration = requireNotNull(
            TimerAlarmScheduler.storedTimerFor(context, timerId)?.generation,
        )
        TimerAlarmScheduler.schedule(context, timerId, "Second", 60_000)

        receiver.onReceive(context, firingIntent(timerId, staleGeneration))

        assertFalse(TimerAlarmScheduler.consumeCompleted(context).contains(timerId))
        assertTrue(TimerAlarmScheduler.remainingMs(context, timerId) != null)
    }
}
