package com.hayao0819.laimelea

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AuthRedirectManifestTest {

    @Test
    fun usesRequiredAlarmAndMediaPermissions() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val permissions = context.packageManager.getPackageInfo(
            context.packageName,
            PackageManager.GET_PERMISSIONS,
        ).requestedPermissions.orEmpty().toSet()

        assertTrue(permissions.contains(android.Manifest.permission.USE_EXACT_ALARM))
        assertFalse(permissions.contains(android.Manifest.permission.SCHEDULE_EXACT_ALARM))
        val mediaPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            android.Manifest.permission.READ_MEDIA_AUDIO
        } else {
            android.Manifest.permission.READ_EXTERNAL_STORAGE
        }
        assertTrue(permissions.contains(mediaPermission))
    }

    @Test
    fun includesBackupRulesForEverySupportedAndroidVersion() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val resources = context.resources

        assertTrue(
            resources.getIdentifier(
                "backup_rules",
                "xml",
                context.packageName,
            ) != 0,
        )
        assertTrue(
            resources.getIdentifier(
                "data_extraction_rules",
                "xml",
                context.packageName,
            ) != 0,
        )
    }

    @Test
    fun resolvesTheHuaweiOAuthCallback() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val intent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("com.hayao0819.laimelea://oauth/callback"),
        ).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
            setPackage(context.packageName)
        }

        val resolved = context.packageManager.resolveActivity(intent, 0)

        assertNotNull(resolved)
        assertEquals("net.openid.appauth.RedirectUriReceiverActivity", resolved?.activityInfo?.name)
    }
}
