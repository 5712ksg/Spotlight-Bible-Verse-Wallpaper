# Spotlight-Bible-Verse-Wallpaper (Bible Wallpaper Browser for Lively Wallpaper)
Interactive Bible verse live wallpaper with configurable backgrounds and Bible.com translation references.
A browser-based Bible viewer designed for desktop wallpaper environments, especially [Lively Wallpaper](https://www.rocksdanister.com/lively/), with support for browsing and displaying locally available Bible content.

This project focuses on the wallpaper viewer, its browser-based interface, and the integration needed to display Bible content in a desktop wallpaper. It does **not** claim ownership of the Bible translations or texts that it may display.

> [!IMPORTANT]
> **Review the security, copyright, and licensing notices before installing, running, or redistributing this package.**
>
> The package may include third-party software, runtime components, scripts, and Bible data. Their security status and redistribution permissions may differ. Review the exact files in the release you download before using or redistributing them.

## Project Goals

- Provide a simple browser-based Bible viewer for desktop wallpaper environments.
- Make Bible content available for browsing where compatible local data is present.
- Share the viewer software and wallpaper integration with other developers and users.
- Clearly distinguish the original viewer code from third-party Bible translations, data, and software.

This is an independent project. It is not officially affiliated with or endorsed by Bible.com, any Bible publisher or translation organization, Microsoft, Google, or the Lively Wallpaper project.

## Embedded Offline Bible Versions: Sources and Copyright

The following JSON files are associated with the offline Bible versions referenced by this project. The sources below identify where the versions were referenced; **source attribution does not, by itself, grant permission to copy, publish, or redistribute the texts or data**.

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

The project maintainer does not claim ownership of the Bible texts, translations, editions, or associated data listed above. Any applicable copyright and other rights remain with the respective publishers, copyright holders, or other rights holders.

The copyright status and terms of use can differ by translation, edition, jurisdiction, and source. Listing a source or including a filename in this README does not mean that a translation is public domain or freely redistributable. Users must not assume that they have permission to copy, redistribute, publish, or commercially use a Bible text merely because it is referenced by or included with this project.

Before publishing or redistributing a release, the maintainer must verify the applicable terms and permissions for **each** included Bible text and data file. Any item for which redistribution permission has not been confirmed should be excluded from the public package or provided only through a method permitted by its rights holder.

A license for this project's original software applies only to material the maintainer has the right to license. It does not replace or override the licenses, terms, or rights that apply to Bible texts, translations, third-party data, or bundled software.

## Compatibility

This package is intended for use with:

- Chromium-based browser environments
- Microsoft Edge WebView2
- Lively Wallpaper, which uses a WebView2-based player for web wallpapers

Compatibility may vary depending on the Windows version, installed runtime, Lively Wallpaper version, and local configuration. Other wallpaper platforms may require adjustments and are not guaranteed to work.

## Installation

1. Download or clone the repository or obtain a release from a source you trust.
2. Review the package contents before running any executable or script.
3. Install and open Lively Wallpaper.
4. Use Lively Wallpaper's wallpaper-add/import workflow to select `index.html` or the package format supported by your installed version.
5. Check that the wallpaper displays and behaves as expected. Stop using it if you notice unexpected behavior.

Menu names and import methods may differ between Lively Wallpaper versions. Do not run bundled executables or scripts unless you trust their source and have reviewed them to the extent appropriate for your security needs.

## Security Notice

Some distributions of this package may include a bundled Microsoft Edge WebView2 host that has been reported to contain changes to certain security mitigations. Some protections may have been relaxed, disabled, or otherwise modified. The exact changes and their security impact have not been independently audited for this project, so no guarantee is made that the package is free of security risks, including potentially serious risks.

This notice is a disclosure, not an independent security assessment. Inspect the specific release you download, keep Windows and security software up to date, and use appropriate safeguards when testing unfamiliar software. If you do not understand or accept the potential security trade-offs, do not install or run the package.

## Repository Contents

Depending on the release, the package may include:

- Web content and assets, such as `index.html`, scripts, styles, and a preview image
- Lively Wallpaper metadata and configuration files
- Offline Bible-version data files
- A `WebView2` directory containing the player and supporting components
- Additional installer or helper scripts

The contents may change between releases. Always review the exact files in the release you download. Do not assume every file is original to this project or covered by the project's software license.

## Bug Reports

When opening an issue, include:

- Windows version
- Lively Wallpaper version
- WebView2 Runtime version, if known
- Steps to reproduce the issue
- Relevant error messages or logs, after removing sensitive information

Do not post passwords, access tokens, personal data, or other sensitive information.

## Licensing

Unless a license file is included in this repository, no license to use, modify, or redistribute the project's original software is granted by default. The maintainer should add an appropriate license for original code they have the right to license before presenting the code as open source.

Third-party software, runtimes, libraries, Bible texts, translations, and other data remain subject to their own licenses and terms. Before publishing a release, verify that every included component may legally be redistributed. Remove or separate any component for which the necessary rights have not been confirmed.

## Trademarks and Affiliation

Bible.com, Google, Chromium, Microsoft Edge, WebView2, and Lively Wallpaper are names or trademarks associated with their respective owners. Their mention is for identification and attribution only and does not imply sponsorship, endorsement, or affiliation.
