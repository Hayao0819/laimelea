package com.hayao0819.laimelea.calendar

import android.Manifest
import android.content.ContentResolver
import android.content.pm.PackageManager
import android.database.MatrixCursor
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.slot
import io.mockk.unmockkAll
import io.mockk.verify
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CalendarModuleTest {

    private lateinit var reactContext: ReactApplicationContext
    private lateinit var contentResolver: ContentResolver
    private lateinit var promise: Promise
    private lateinit var module: CalendarModule

    @Before
    fun setUp() {
        reactContext = mockk(relaxed = true)
        contentResolver = mockk(relaxed = true)
        promise = mockk(relaxed = true)

        every { reactContext.contentResolver } returns contentResolver

        // Mock Arguments static methods to avoid SoLoader dependency
        mockkStatic(Arguments::class)
        every { Arguments.createArray() } answers { JavaOnlyArray() }
        every { Arguments.createMap() } answers { JavaOnlyMap() }

        // Mock ContextCompat static methods
        mockkStatic(ContextCompat::class)

        module = CalendarModule(reactContext)
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    // --- getName ---

    @Test
    fun getName_returnsCalendarModule() {
        assertEquals("CalendarModule", module.name)
    }

    // --- getCalendars ---

    @Test
    fun getCalendars_withoutPermission_resolvesEmptyArray() {
        denyCalendarPermission()

        module.getCalendars(promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        assertEquals(0, slot.captured.size())
        verify(exactly = 0) { promise.reject(any<String>(), any<String>(), any<Throwable>()) }
    }

    @Test
    fun getCalendars_withPermission_returnsMappedData() {
        grantCalendarPermission()

        val cursor = MatrixCursor(
            arrayOf(
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.CALENDAR_COLOR,
                CalendarContract.Calendars.IS_PRIMARY,
            ),
        )
        cursor.addRow(arrayOf(1L, "Work", -16776961, 1)) // blue #0000FF
        cursor.addRow(arrayOf(2L, "Personal", -65536, 0)) // red #FF0000

        every { contentResolver.query(any(), any(), any(), any(), any()) } returns cursor

        module.getCalendars(promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        val result = slot.captured
        assertEquals(2, result.size())

        val cal1 = result.getMap(0)!!
        assertEquals("1", cal1.getString("id"))
        assertEquals("Work", cal1.getString("name"))
        assertEquals("#0000FF", cal1.getString("color"))
        assertTrue(cal1.getBoolean("isPrimary"))

        val cal2 = result.getMap(1)!!
        assertEquals("2", cal2.getString("id"))
        assertEquals("Personal", cal2.getString("name"))
        assertEquals("#FF0000", cal2.getString("color"))
        assertFalse(cal2.getBoolean("isPrimary"))
    }

    @Test
    fun getCalendars_nullCursor_resolvesEmptyArray() {
        grantCalendarPermission()

        every { contentResolver.query(any(), any(), any(), any(), any()) } returns null

        module.getCalendars(promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        assertEquals(0, slot.captured.size())
    }

    @Test
    fun getCalendars_exceptionThrown_rejectsPromise() {
        grantCalendarPermission()

        every {
            contentResolver.query(any(), any(), any(), any(), any())
        } throws SecurityException("Access denied")

        module.getCalendars(promise)

        verify {
            promise.reject(
                eq("CALENDAR_ERROR"),
                match<String> { it.contains("Access denied") },
                any<Exception>(),
            )
        }
    }

    @Test
    fun getCalendars_nullDisplayName_defaultsToEmpty() {
        grantCalendarPermission()

        val cursor = MatrixCursor(
            arrayOf(
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.CALENDAR_COLOR,
                CalendarContract.Calendars.IS_PRIMARY,
            ),
        )
        cursor.addRow(arrayOf(1L, null, null, 0))

        every { contentResolver.query(any(), any(), any(), any(), any()) } returns cursor

        module.getCalendars(promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        val cal = slot.captured.getMap(0)!!
        assertEquals("", cal.getString("name"))
    }

    @Test
    fun getCalendars_nullColor_returnsNullColorField() {
        grantCalendarPermission()

        val cursor = MatrixCursor(
            arrayOf(
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.CALENDAR_COLOR,
                CalendarContract.Calendars.IS_PRIMARY,
            ),
        )
        cursor.addRow(arrayOf(1L, "Test", null, 0))

        every { contentResolver.query(any(), any(), any(), any(), any()) } returns cursor

        module.getCalendars(promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        val cal = slot.captured.getMap(0)!!
        assertNull(cal.getString("color"))
    }

    // --- getEventInstances ---

    @Test
    fun getEventInstances_withoutPermission_resolvesEmptyArray() {
        denyCalendarPermission()

        module.getEventInstances(0.0, 86400000.0, promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        assertEquals(0, slot.captured.size())
    }

    @Test
    fun getEventInstances_withPermission_returnsMappedData() {
        grantCalendarPermission()

        val cursor = MatrixCursor(
            arrayOf(
                CalendarContract.Instances.EVENT_ID,
                CalendarContract.Instances.CALENDAR_ID,
                CalendarContract.Instances.CALENDAR_DISPLAY_NAME,
                CalendarContract.Instances.TITLE,
                CalendarContract.Instances.DESCRIPTION,
                CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.END,
                CalendarContract.Instances.ALL_DAY,
                CalendarContract.Instances.DISPLAY_COLOR,
            ),
        )
        cursor.addRow(
            arrayOf(
                100L, 1L, "Work", "Meeting", "Team standup",
                1700000000000L, 1700003600000L, 0, -16776961,
            ),
        )

        every { contentResolver.query(any(), any(), any(), any(), any()) } returns cursor

        module.getEventInstances(1700000000000.0, 1700086400000.0, promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        val event = slot.captured.getMap(0)!!

        assertEquals("100", event.getString("id"))
        assertEquals("1", event.getString("calendarId"))
        assertEquals("Work", event.getString("calendarName"))
        assertEquals("Meeting", event.getString("title"))
        assertEquals("Team standup", event.getString("description"))
        assertEquals(1700000000000.0, event.getDouble("startMs"), 0.0)
        assertEquals(1700003600000.0, event.getDouble("endMs"), 0.0)
        assertFalse(event.getBoolean("allDay"))
        assertEquals("#0000FF", event.getString("color"))
    }

    @Test
    fun getEventInstances_allDayEvent_mapsCorrectly() {
        grantCalendarPermission()

        val cursor = MatrixCursor(
            arrayOf(
                CalendarContract.Instances.EVENT_ID,
                CalendarContract.Instances.CALENDAR_ID,
                CalendarContract.Instances.CALENDAR_DISPLAY_NAME,
                CalendarContract.Instances.TITLE,
                CalendarContract.Instances.DESCRIPTION,
                CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.END,
                CalendarContract.Instances.ALL_DAY,
                CalendarContract.Instances.DISPLAY_COLOR,
            ),
        )
        cursor.addRow(
            arrayOf(
                200L, 1L, "Work", "Holiday", null,
                1700000000000L, 1700086400000L, 1, null,
            ),
        )

        every { contentResolver.query(any(), any(), any(), any(), any()) } returns cursor

        module.getEventInstances(1700000000000.0, 1700086400000.0, promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        val event = slot.captured.getMap(0)!!

        assertTrue(event.getBoolean("allDay"))
        assertEquals("", event.getString("description"))
        assertNull(event.getString("color"))
    }

    @Test
    fun getEventInstances_nullCursor_resolvesEmptyArray() {
        grantCalendarPermission()

        every { contentResolver.query(any(), any(), any(), any(), any()) } returns null

        module.getEventInstances(0.0, 86400000.0, promise)

        val slot = slot<JavaOnlyArray>()
        verify { promise.resolve(capture(slot)) }
        assertEquals(0, slot.captured.size())
    }

    @Test
    fun getEventInstances_exceptionThrown_rejectsPromise() {
        grantCalendarPermission()

        every {
            contentResolver.query(any(), any(), any(), any(), any())
        } throws RuntimeException("DB error")

        module.getEventInstances(0.0, 86400000.0, promise)

        verify {
            promise.reject(
                eq("CALENDAR_ERROR"),
                match<String> { it.contains("DB error") },
                any<Exception>(),
            )
        }
    }

    // --- Helpers ---

    private fun grantCalendarPermission() {
        every {
            ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALENDAR)
        } returns PackageManager.PERMISSION_GRANTED
    }

    private fun denyCalendarPermission() {
        every {
            ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALENDAR)
        } returns PackageManager.PERMISSION_DENIED
    }
}
