# Sound It! — App Store assets, metadata, privacy and permissions

Prepared 2026-10-28. Checklist only: no assets generated, public policy published, store fields saved, permissions added or submission attempted. Unchecked items need final-package verification or owner input.

## Assets and metadata

- [ ] Confirm seller/legal entity, app-name availability, bundle ID, version, copyright/content rights, distribution regions and languages. No invented identity/contact details.
- [ ] Prepare the 1024 × 1024 App Store icon and native icon catalog using current Xcode/Apple requirements; do not treat `public/favicon.ico` as the native icon. Validate final format/transparency in Xcode/App Store Connect.
- [ ] Capture authentic final-app screenshots of setup, actual gameplay and results. Current Apple specifications require at least one iPhone Dynamic Island (medium display) screenshot, plus one iPad 13-inch screenshot when iPadOS is supported. Follow the live table for exact pixels; iPad mini QA screenshots do not replace the required store-size assets. PNG/JPEG; 1–10 screenshots per supported size; avoid claiming unsupported functionality.
- [ ] App name: 2–30 characters. Candidate from existing branding: **Sound It!** (availability unverified).
- [ ] Subtitle: ≤30 characters; promotional text: ≤170; description: ≤4,000; keywords: ≤100 bytes. Owner approves final copy; no claim of AI judging, online multiplayer, accounts or monetization.
- [ ] Provide working public support and privacy-policy URLs, plus review contact and notes. No corresponding support/privacy content routes exist in this repository; do not submit preview-access links as permanent support URLs.
- [ ] Complete Apple's age-rating questionnaire using the full shipped prompt deck; do not guess a rating from the party-game category.
- [ ] Complete content-rights and export-compliance questions based on the final package. HTTPS alone is not a reason to guess an exemption.
- [ ] TestFlight: beta description, feedback email, review contact/instructions and processed build. No login is part of current V1, so review instructions should not invent test credentials.
- [ ] Review notes explain the real local pass-the-phone game, optional tilt, manual fallback and sound settings. Guideline 4.2 remains a review risk for a simple hosted-web wrapper; approval is not guaranteed and this batch adds no features to address it.

## Privacy evidence and decisions

| Surface             | Observed now                                                                                                                                | Required final-package check                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Players/preferences | `players.ts` and `prefs.ts` use guarded localStorage for roster, selection, settings and completed-game unlock counter                      | Verify container persistence, uninstall/clear-data behavior, and disclose device-local storage accurately                                                |
| Gameplay            | No account/cloud gameplay backend connected; no AI judging or microphone recording in reviewed game paths                                   | Verify bundled package and all dependencies; do not equate local gameplay with zero external requests                                                    |
| Fonts               | Root head loads Google Fonts CSS/font files                                                                                                 | Audit network metadata/recipients and licensing; offline asset handling remains a packaging gate                                                         |
| Errors              | `reportLovableError` conditionally forwards error/stack/route to injected runtime hooks; comment identifies one hook as editor-preview-only | Inspect final native/published traffic and actual hooks/retention. No evidence here establishes production collection, recipients or consent obligations |
| Native dependencies | No wrapper/SDK inventory yet                                                                                                                | Inspect final SDK privacy manifests/signatures and required-reason API usage; use Apple's accepted reasons only when actually applicable                 |

- [ ] Approve a privacy policy matching actual collection, sharing, retention, deletion/contact procedures and local storage. Make it accessible as Apple requires, including within the app; this batch does not add a policy screen/link.
- [ ] Complete App Store privacy labels from the final package and third parties. **Do not select “Data Not Collected” solely from the absence of accounts or gameplay APIs.**
- [ ] Determine tracking/ATT applicability from actual behavior; do not add ATT, ads or analytics by default.
- [ ] Generate/inspect the native privacy report and `PrivacyInfo.xcprivacy` requirements after packaging. Browser localStorage does not justify inventing native required-reason declarations.

## Permissions and sound

- [ ] Motion is optional: current web code requests DeviceOrientation permission from a tap and supports denial without disabling GOT IT!/PASS. Validate first allow, denial, retry and controls OFF in WKWebView.
- [ ] Native packager audits WKUIDelegate motion/orientation permission behavior and any actual native motion APIs. Add the specific motion usage description only where the chosen APIs/container require it. Draft purpose, not implemented: “Use device motion to score guesses when you tilt your phone. You can also use the on-screen buttons.”
- [ ] No microphone/camera/location/contacts/photos/Bluetooth/notification requests are needed by the reviewed V1. Playing synthesized sounds does not require microphone access. Do not request unused permissions.
- [ ] Audio must start/resume from a tap; verify silent switch, volume, background interruptions, mute/music/effects settings and end buzzer on hardware. Do not enable background-audio entitlement just to keep a paused game audible.
- [ ] Web vibration is not expected on iOS Safari. Native haptics would be separate approved work, not a required new feature in this batch.

## Official references (recheck before submission)

- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) — fetched 2026-10-28.
- [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Version metadata limits](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Privacy manifest required-reason API guidance](https://developer.apple.com/documentation/technotes/tn3183-adding-required-reason-api-entries-to-your-privacy-manifest)
- [WKWebView motion/orientation permission callback](<https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:requestdeviceorientationandmotionpermissionfor:initiatedbyframe:decisionhandler:)>)
- [Review guidelines: privacy, permissions and minimum functionality](https://developer.apple.com/app-store/review/guidelines/)
