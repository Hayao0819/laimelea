# Privacy Policy

**Last updated: March 1, 2026**

## Introduction

Laimelea is an open-source Android clock application designed for users with non-standard day cycles (such as 26-hour rhythms). It provides clock, alarm, timer, calendar, and sleep tracking features with support for custom time periods.

This Privacy Policy explains what data Laimelea collects, how it is used, and your choices regarding that data. By using Laimelea, you agree to the practices described in this policy.

## Data We Collect

### Data Stored Locally on Your Device

Laimelea stores the following data exclusively on your device using local storage (AsyncStorage). This data never leaves your device unless you explicitly use a cloud backup feature:

- **Alarm settings** -- times, repeat schedules, labels, and dismissal methods
- **Timer and stopwatch state** -- duration, running status
- **App settings** -- custom time cycle configuration, theme preferences, primary time display mode, and other user preferences
- **Sleep logs** -- manually entered sleep and wake times
- **Calendar event cache** -- locally cached calendar events for display purposes

### Data Accessed Through Google Services

If you choose to sign in with your Google account, Laimelea may access the following data. Each type of access requires your explicit consent through Google's standard authorization flow:

- **Google account information** -- your email address and profile name, used solely to identify your account within the app
- **Google Calendar events** (read-only) -- your calendar events are fetched using the `calendar.readonly` scope and displayed within the app. Laimelea does not create, modify, or delete any calendar events
- **Google Drive app data** -- backup data is stored in a private, app-specific folder on your Google Drive using the `drive.appdata` scope. Laimelea cannot access any other files on your Google Drive
- **Health Connect sleep data** -- on devices with Google Mobile Services, Laimelea can read sleep session data through the Health Connect API. This is used to populate your sleep log automatically

### Data We Do Not Collect

Laimelea does **not** collect, store, or transmit any of the following:

- Advertising identifiers or tracking IDs
- Location data
- Call logs or contacts
- Analytics or crash reports
- Usage behavior or telemetry
- Any data for the purpose of advertising or marketing

## How We Use Your Data

All data collected by Laimelea is used solely to provide app functionality:

- Alarm and timer settings are used to schedule and trigger notifications
- Calendar events are displayed within the app to help you manage your custom day cycle
- Sleep logs are used to detect your sleep cycle patterns
- Backup data is used to save and restore your app configuration
- Google account information is used to authenticate access to Google Calendar and Google Drive

Laimelea does not use your data for any purpose other than delivering the features described above.

## Where Your Data Is Stored

- **Local data** is stored on your device using AsyncStorage and is subject to your device's own security measures
- **Google Drive backups** are stored in your Google Drive account within an app-specific data folder that is not visible to other apps or users. This data is subject to [Google's Privacy Policy](https://policies.google.com/privacy)
- **Calendar and sleep data** retrieved from Google services is cached locally on your device for display purposes

Laimelea does not operate any servers. No data is sent to the developer or any third party.

## Google Services Integration

Laimelea integrates with Google services on an opt-in basis. You are never required to sign in with Google to use the core features of the app (clock, alarms, timers).

### OAuth2 Scopes

When you sign in with Google, Laimelea requests only the following OAuth2 scopes:

- `openid` -- to authenticate your identity
- `email` and `profile` -- to display your account information
- `calendar.readonly` -- to read your calendar events (read-only access)
- `drive.appdata` -- to store and retrieve backup data in a private app folder

You may revoke any of these permissions at any time through your [Google Account settings](https://myaccount.google.com/permissions).

### Platform Variants

- **GMS devices** (with Google Play Services): Authentication uses Google Sign-In natively. Calendar sync uses the Google Calendar API. Backups use Google Drive. Sleep data can be read from Health Connect.
- **AOSP devices** (without Google Play Services): Authentication uses OAuth2 with PKCE through Chrome Custom Tabs. Calendar access uses the local Android CalendarContract. Backups are stored locally. Sleep data is entered manually.

## Data Sharing

Laimelea does **not** share, sell, trade, or transfer your data to any third parties. The only external data transmission occurs when you explicitly use Google services integration, in which case data is exchanged directly between your device and Google's servers.

## Data Deletion

You can delete your data at any time:

- **Local data**: Uninstalling the app removes all locally stored data. You can also clear app data from Android Settings > Apps > Laimelea > Storage > Clear Data.
- **Google Drive backups**: You can delete backup data by revoking Laimelea's access in your [Google Account settings](https://myaccount.google.com/permissions), which removes the app-specific data folder. You can also manage your Google Drive storage directly.
- **Google account access**: You can revoke Laimelea's access to your Google account at any time through your [Google Account settings](https://myaccount.google.com/permissions). Revoking access immediately prevents Laimelea from accessing your calendar, Drive, or account information.

## Children's Privacy

Laimelea is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided personal information through the app, please contact us so we can take appropriate action.

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted in the app's repository, and the "Last updated" date at the top of this page will be revised. We encourage you to review this policy periodically.

## Open Source

Laimelea is open-source software. You can review the complete source code to verify our data practices at the [GitHub repository](https://github.com/Hayao0819/laimelea).

## Contact

If you have any questions or concerns about this Privacy Policy or Laimelea's data practices, please open an issue on our [GitHub Issues page](https://github.com/Hayao0819/laimelea/issues).

**Developer**: Hayao
**App package**: `com.hayao0819.laimelea`
