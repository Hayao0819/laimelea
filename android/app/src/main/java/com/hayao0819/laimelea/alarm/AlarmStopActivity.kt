package com.hayao0819.laimelea.alarm

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.ReactApplication

private typealias PlaybackDescriptor = AlarmAudioService.Companion.ActivePlaybackDescriptor

class AlarmStopActivity : Activity() {

    companion object {
        internal fun supportsModernLockScreenApi(sdkInt: Int): Boolean =
            sdkInt >= Build.VERSION_CODES.O_MR1

        internal fun playbackToDisplayAfterStopping(
            remainingPlaybacks: List<PlaybackDescriptor>,
        ): PlaybackDescriptor? = remainingPlaybacks.firstOrNull()
    }

    private var displayedAlarmId: String? = null
    private var displayedTimestampMs: Long = 0L
    private var displayedAutoSilenceMs: Long = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        refreshDisplayedAlarm(intent)
        setContentView(createContent())
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        refreshDisplayedAlarm(intent)
    }

    private fun refreshDisplayedAlarm(intent: Intent) {
        displayedAlarmId = intent.getStringExtra(AlarmAudioService.EXTRA_ALARM_ID)
        displayedTimestampMs = intent.getLongExtra(RingtoneModule.EXTRA_TRIGGER_TIMESTAMP_MS, 0L)
        displayedAutoSilenceMs = intent.getLongExtra(AlarmAudioService.EXTRA_AUTO_SILENCE_MS, 0L)
    }

    private fun createContent(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(48, 48, 48, 48)
        addView(TextView(this@AlarmStopActivity).apply {
            text = getString(com.hayao0819.laimelea.R.string.alarm_stop_screen_description)
            textSize = 28f
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ))
        addView(Button(this@AlarmStopActivity).apply {
            text = getString(com.hayao0819.laimelea.R.string.alarm_audio_stop)
            setOnClickListener { stopAlarm() }
        }, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = 32 })
    }

    private fun stopAlarm() {
        val alarmId = displayedAlarmId
        if (alarmId == null) {
            // A clobbered PendingIntent (see the RingtoneModule identity fix) can deliver an
            // extras-less intent while audio is still playing; fall back to stopping whatever
            // the service actually has active instead of finishing without stopping anything.
            stopAndRecord(AlarmAudioService.activePlaybackDescriptors())
            showNextPlaybackOrFinish()
            return
        }
        stopAndRecord(
            listOf(PlaybackDescriptor(alarmId, displayedTimestampMs, displayedAutoSilenceMs)),
        )
        showNextPlaybackOrFinish()
    }

    private fun stopAndRecord(playbacks: List<PlaybackDescriptor>) {
        if (playbacks.isEmpty()) return
        playbacks.forEach { AlarmAudioService.stopActivePlayback(it.alarmId, it.timestampMs) }
        playbacks.forEach {
            RingtoneModule.recordStoppedAlarmDelivery(this, it.alarmId, it.timestampMs, it.autoSilenceMs)
            RingtoneModule.cancelAlarmFiringNotification(this, it.alarmId, false)
        }
        val reactContext = (applicationContext as? ReactApplication)
            ?.reactHost
            ?.currentReactContext
        RingtoneModule.emitAlarmDelivery(reactContext)
    }

    private fun showNextPlaybackOrFinish() {
        val next = playbackToDisplayAfterStopping(AlarmAudioService.activePlaybackDescriptors())
        if (next == null) {
            finish()
            return
        }
        displayedAlarmId = next.alarmId
        displayedTimestampMs = next.timestampMs
        displayedAutoSilenceMs = next.autoSilenceMs
    }
}
