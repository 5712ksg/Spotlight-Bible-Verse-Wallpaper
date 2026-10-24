# Spotlight Bible Verse Wallpaper
### Bible Wallpaper Browser for Wallpaper Engine and Lively Wallpaper

An interactive Bible verse live wallpaper with configurable backgrounds and support for browsing Bible passages. The browser-based viewer is designed for desktop wallpaper environments, with features for built-in and downloadable Bible translations where supported by the installed package.

This project focuses on the wallpaper viewer, its interface, and the integration needed to browse and display Bible content. The project maintainer does **not** claim ownership of the Bible translations, editions, or texts displayed by the wallpaper.

> [!IMPORTANT]
> **Read the security, copyright, and licensing notices before installing, running, or redistributing this package.**
>
> Releases may contain third-party software, runtime components, scripts, images, and Bible data. Their security status, usage terms, and redistribution permissions may differ. Review the exact files in the release you download.

## Features

- Interactive Bible verse wallpaper with configurable backgrounds.
- Browser-based interface for browsing and displaying Bible passages.
- Built-in Bible-version data for offline reading, subject to the rights and terms applicable to each translation.
- Ability to download supported Bible translations through the wallpaper interface for offline use.
- Storage of downloaded translations in the browser's IndexedDB storage.
- Import of compatible JSON Bible translation files through the offline translation management interface.
- No separate Python installation, standalone local server, or manual PowerShell execution is intended to be required for normal operation of the Wallpaper Engine version.

Features and behavior can vary between releases and wallpaper platforms. See the platform-specific installation notes below.

## System Requirements

### 1. Software Requirements

- **Operating system:** Windows 10 or Windows 11, 64-bit.
- **Primary platform:** Wallpaper Engine (Steam).
- **Technology:** HTML5-based interactive wallpaper.
- **Additional software for normal Wallpaper Engine use:** No separate Python installation or standalone local server is required.
- **Manual scripts and administrator privileges:** Normal operation is not intended to require manually running PowerShell or BAT scripts, registering a Windows startup task, or using administrator privileges.

Windows 11 is recommended. Requirements may differ for a Lively Wallpaper-specific package or a release that bundles additional components.

### 2. Hardware Requirements

Recommended specifications:

- **CPU:** Intel Core i3, AMD Ryzen 3, or equivalent and above.
- **RAM:** 8 GB or more.
- **Graphics:** Integrated graphics supporting DirectX 10/11, or an equivalent dedicated GPU.
- **Storage:** Approximately 50 MB or more for the wallpaper, plus additional space for downloaded Bible translations and other assets.
- **Display:** 1920 × 1080 (Full HD) or higher recommended.

A dedicated graphics card is not required. Systems with more memory and graphics performance may provide a better experience when using 2K/4K displays, multiple monitors, or other applications at the same time. Actual performance depends on the system and wallpaper settings.

### 3. Supported Display Resolutions

The background images are designed to support these common resolutions:

- **Full HD:** 1920 × 1080
- **QHD:** 2560 × 1440
- **4K UHD:** 3840 × 2160

Image quality and loading performance may vary with the selected background, network conditions, display resolution, and system performance.

### 4. Internet Connectivity

**Online Bible translations**

An internet connection is required to retrieve online Bible translations and passages from Bible.com. Supported translations can be downloaded through the wallpaper interface for offline reading, subject to the service's terms and the applicable rights.

**Offline Bible translations**

Built-in translations and previously downloaded translations can be accessed without an internet connection, provided the relevant data is available locally.

**Background images**

Some background images are retrieved from external image services and may require an internet connection. Offline Bible access does not guarantee that online content or remote background images will also be available offline.

### 5. Offline Data Storage and Compatibility

- The package may include built-in Bible translation data.
- Downloaded translations are stored in the browser's IndexedDB storage.
- Downloaded translations are stored separately in each wallpaper environment. They are **not automatically shared** between Wallpaper Engine and Lively Wallpaper.
- Compatible JSON Bible translation files can be imported through the offline translation management interface.
- Available translations and import compatibility may vary by release.

## Installation and Setup

### A. Wallpaper Engine (Steam) — Primary Installation

1. Install and launch **Wallpaper Engine** from Steam.
2. Obtain Spotlight Bible Verse Wallpaper from the distribution source for the release you intend to use (for example, its Steam Workshop listing, if that release is published there).
3. Add or subscribe to the wallpaper using the workflow provided by that distribution source.
4. Select and apply **Spotlight Bible Verse Wallpaper** in Wallpaper Engine.
5. Open the wallpaper settings, if available, and configure the background and Bible translation options.
6. Confirm that the wallpaper displays and behaves as expected.

For normal use of the Wallpaper Engine version, a separate Python installation, standalone local server, manual PowerShell/BAT execution, or Windows startup task is not intended to be necessary. If a specific release's instructions explicitly require an additional step, review that release's files and documentation before proceeding.

### B. Lively Wallpaper — Separate Package or Compatibility Path

A separate package may be provided for Lively Wallpaper. Compatibility and installation steps can differ from the Wallpaper Engine release.

1. Install and open Lively Wallpaper.
2. Obtain the Lively-specific package from a source you trust.
3. Review the package contents and its instructions before running any executable or script.
4. Use Lively Wallpaper's add/import workflow to select `index.html` or the package format supported by your installed version.
5. Apply the wallpaper and confirm that it displays and behaves as expected.

Some previously distributed Lively-specific packages may include the following files:

- `lively_setup_x86_full_v2210.exe`
- `Preset.bat`

The Lively installer has been referenced at the following release page:  
<https://github.com/lively-community/lively/releases#release-v2.2.1.0>

These filenames are included for identification only. Do not assume that they are required for every release, and do not run `Preset.bat` or any bundled executable unless the instructions for the exact package explain its purpose and you trust its source. Installer names, import methods, and menu labels may differ by version.

## Embedded Offline Bible Versions: Sources and Copyright

The following JSON files are associated with offline Bible versions referenced by this project. The links identify the cited sources; **source attribution does not, by itself, grant permission to copy, publish, or redistribute the texts or data**.

### Versions referenced from Bible.com

Source: <https://www.bible.com/versions>

- `EN_ESV.json`
- `EN_KJV.json`
- `EN_NIV.json`
- `EN_NLT.json`
- `JA_NJB.json`
- `KO_KLVB.json`
- `KO_KRV.json`
- `KO_RNKSV.json`
- `ZH_CUV.json`

### Version referenced from GitHub

Source: <https://github.com/stranger828/bibleAPI>

- `KO_NKRV.json`

### Bible Text Copyright and Licensing

The project maintainer does not claim ownership of the Bible texts, translations, editions, or associated data listed above. Any applicable copyright and other rights remain with their respective publishers, copyright holders, or other rights holders.

Copyright status and terms of use can differ by translation, edition, jurisdiction, and source. Listing a source or filename here does not mean that a translation is public domain or freely redistributable. Users must not assume they have permission to copy, redistribute, publish, or commercially use a Bible text merely because it is referenced by or included with this project.

Before publishing or redistributing a release, the maintainer must verify the applicable terms and permissions for **each** included Bible text and data file. Any item for which redistribution permission has not been confirmed should be excluded from the public package or provided only through a method permitted by its rights holder.

A license for this project's original software applies only to material the maintainer has the right to license. It does not replace or override the licenses, terms, or rights that apply to Bible texts, translations, third-party data, images, or bundled software.

This is an independent project and is not officially affiliated with or endorsed by Bible.com, the repository maintainers listed above, any Bible publisher or translation organization, Wallpaper Engine, or the Lively Wallpaper project.

## Security Notice

Some distributions may include a bundled Microsoft Edge WebView2 host that has been reported to contain changes to certain security mitigations. Some protections may have been relaxed, disabled, or otherwise modified. The exact changes and their security impact have not been independently audited for this project, so no guarantee is made that a package containing such components is free of security risks, including potentially serious risks.

This is a disclosure, not an independent security assessment, and it may not apply to every release or platform version. Review the exact package you download, keep Windows and security software up to date, and use appropriate safeguards when testing unfamiliar software. Do not install or run a package if you do not understand or accept the potential security trade-offs.

## Repository Contents

Depending on the release, the package may include:

- Web content and assets, such as `index.html`, scripts, styles, and preview images
- Wallpaper metadata and configuration files
- Built-in offline Bible-version data
- Download and offline-storage interface components
- A `WebView2` directory containing a player or supporting components
- Optional installer or helper scripts

The contents may change between releases and between platform-specific packages. Review the exact files in the release you download. Do not assume every file is original to this project or covered by the project's software license.

## Bug Reports

When opening an issue, include:

- Windows version
- Wallpaper Engine or Lively Wallpaper version
- WebView2 Runtime version, if relevant and known
- Steps to reproduce the issue
- Relevant error messages or logs, after removing sensitive information

Do not post passwords, access tokens, personal data, or other sensitive information.

## Licensing

Unless a license file is included in this repository, no license to use, modify, or redistribute the project's original software is granted by default. Before presenting the original code as open source, the maintainer should add an appropriate license for the material they have the right to license.

Third-party software, runtimes, libraries, Bible texts, translations, images, and other data remain subject to their own licenses and terms. Before publishing a release, verify that every included component may legally be redistributed. Remove or separate any component for which the necessary rights have not been confirmed.

## Trademarks and Affiliation

Bible.com, Google, Chromium, Microsoft Edge, WebView2, Wallpaper Engine, Steam, and Lively Wallpaper are names or trademarks associated with their respective owners. Their mention is for identification and attribution only and does not imply sponsorship, endorsement, or affiliation.
