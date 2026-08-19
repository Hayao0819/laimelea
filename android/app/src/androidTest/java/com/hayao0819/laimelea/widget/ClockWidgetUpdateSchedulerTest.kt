package com.hayao0819.laimelea.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class ClockWidgetUpdateSchedulerTest {
    @Test
    fun nextTickUsesTheNextMinuteBoundary() {
        assertEquals(120_250L, nextWidgetTickTimestamp(60_001L))
        assertEquals(120_250L, nextWidgetTickTimestamp(119_999L))
        assertEquals(180_250L, nextWidgetTickTimestamp(120_000L))
    }
}
