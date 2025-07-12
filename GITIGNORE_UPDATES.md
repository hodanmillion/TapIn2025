# .gitignore Updates Summary

## Added Android/Mobile Build Artifacts

### Android APK Development
- `*.apk` - Android Package files
- `*.aab` - Android App Bundle files  
- `*.aar` - Android Archive files
- `*.ap_` - Android Package intermediate files
- `*.dex` - Dalvik Executable files
- `proguard/` - ProGuard output directories
- `lint-results.html` and `lint-results.xml` - Android Lint reports

### Android Build Directories  
- `frontend/android/app/build/` - Main app build output
- `frontend/android/build/` - Project build output
- `frontend/android/capacitor-cordova-android-plugins/build/` - Plugin build output
- `**/build/` - General pattern for any build directories
- `frontend/android/.gradle/` - Gradle cache
- `.gradle/` - General Gradle cache pattern

### Android Development Files
- `frontend/android/local.properties` - Local SDK paths
- `**/local.properties` - General pattern for local properties
- `gradlew`, `gradlew.bat` - Gradle wrapper scripts
- `gradle-wrapper.properties` - Gradle wrapper configuration

### Capacitor Specific
- `frontend/android/app/src/main/assets/public/` - Generated web assets
- `.capacitor/` - Capacitor cache
- `capacitor.config.json.bak` - Backup config files

### Mobile Development Security
- `*.keystore` - Android keystores
- `*.jks` - Java keystores  
- `keystore.properties` - Keystore configuration

### Fastlane (CI/CD for mobile)
- `fastlane/report.xml`
- `fastlane/Preview.html`
- `fastlane/screenshots/`
- `fastlane/test_output/`

## Enhanced General Build Artifacts

### Rust Improvements
- `target/` - General Rust target directory pattern
- `Cargo.lock` - General pattern (was service-specific)

### Python Improvements
- Converted from service-specific to general patterns:
  - `__pycache__/` (was `address/__pycache__/`)
  - `*.py[cod]`, `*$py.class` (was service-specific)
  - Added common virtual environment patterns:
    - `.venv/`, `venv/`, `env/`, `ENV/`
  - `*.pyc` - Python compiled files

### Additional Archive Files
- `*.tgz`, `*.tar.gz`, `*.zip` - Common archive formats
- `tmp/`, `temp/`, `.tmp/` - Temporary directories

### Future iOS Support
- `ios/` - iOS project directory
- `frontend/ios/` - Frontend iOS directory

## Benefits

1. **Cleaner Repository**: Build artifacts won't clutter git history
2. **Smaller Clone Size**: Reduces repository size significantly  
3. **Faster CI/CD**: No unnecessary artifact transfers
4. **Security**: Prevents accidental commit of keystores and sensitive files
5. **Cross-Platform**: Ready for both Android and future iOS development
6. **Team Collaboration**: Consistent ignore rules across development environments

## Verification

All patterns have been tested and verified to properly ignore:
- ✅ Android APK files (`*.apk`)
- ✅ Android build directories (`frontend/android/app/build/`)
- ✅ Gradle cache (`.gradle/`)
- ✅ Local properties files (`local.properties`)
- ✅ Python cache files (`__pycache__/`)
- ✅ Rust target directories (`target/`)

## Files Already Ignored
The debug-tests and e2e-tests directories were already being ignored, which is correct since these are development/debugging tools rather than production code.

## Next Steps
When adding iOS development:
1. The iOS patterns are already in place
2. Add specific iOS build patterns if needed:
   - `*.xcarchive`
   - `*.ipa` 
   - `DerivedData/`
   - `*.xcuserstate`