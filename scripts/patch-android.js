// Tunes the generated Android project for building on a machine with ~8 GB RAM.
// Runs after `expo prebuild`, which regenerates these files.
const fs = require('fs');
const path = require('path');
const android = path.join(__dirname, '..', 'android');

const propsPath = path.join(android, 'gradle.properties');
let props = fs.readFileSync(propsPath, 'utf8');
const set = (key, value) => {
  const line = `${key}=${value}`;
  props = new RegExp(`^${key}=.*$`, 'm').test(props) ? props.replace(new RegExp(`^${key}=.*$`, 'm'), line) : `${props.trimEnd()}\n${line}\n`;
};
set('org.gradle.jvmargs', '-Xmx3072m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8');
set('org.gradle.workers.max', '4');
set('reactNativeArchitectures', 'arm64-v8a');
fs.writeFileSync(propsPath, props);

// Release builds run "lint vital" over every library, which needs a lot of memory; skip it for local builds.
const appGradle = path.join(android, 'app', 'build.gradle');
let gradle = fs.readFileSync(appGradle, 'utf8');
if (!gradle.includes('checkReleaseBuilds false')) {
  gradle = gradle.replace(/^android \{\s*$/m, 'android {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }\n');
  fs.writeFileSync(appGradle, gradle);
}
// CMake 3.22.1's bundled ninja (1.10) ignores Windows long-path support, and React Native's codegen
// object paths exceed 260 characters. CMake 3.31.6 ships a long-path-aware ninja; AGP downloads it.
const CMAKE_VERSION = '3.31.6';
gradle = fs.readFileSync(appGradle, 'utf8');
if (!gradle.includes(`version "${CMAKE_VERSION}"`)) {
  gradle = gradle.replace(/^android \{\s*$/m, `android {\n    externalNativeBuild {\n        cmake {\n            version "${CMAKE_VERSION}"\n        }\n    }\n`);
  fs.writeFileSync(appGradle, gradle);
}
const rootGradle = path.join(android, 'build.gradle');
let root = fs.readFileSync(rootGradle, 'utf8');
if (!root.includes('VINYLVAULT_CMAKE')) {
  root += `
// VINYLVAULT_CMAKE: use the long-path-aware CMake for every native library module too.
subprojects { p ->
    p.plugins.withId('com.android.library') {
        p.android.externalNativeBuild.cmake.version = '${CMAKE_VERSION}'
    }
}
`;
  fs.writeFileSync(rootGradle, root);
}

// Sign release builds with the Google Play upload key when it is on this machine. The key and its
// passwords live outside the project (Documents\VinylVault-signing) so they never reach git.
const KEY_PROPS = process.env.VINYLVAULT_KEYSTORE_PROPS || path.join(require('os').homedir(), 'Documents', 'VinylVault-signing', 'keystore.properties');
let signing = 'debug key (no upload key found)';
if (fs.existsSync(KEY_PROPS)) {
  gradle = fs.readFileSync(appGradle, 'utf8');
  if (!gradle.includes('VINYLVAULT_UPLOAD_KEY')) {
    const propsFile = KEY_PROPS.replace(/\\/g, '/');
    gradle = gradle.replace(
      /signingConfigs \{\s*\n/,
      (m) => `${m}        // VINYLVAULT_UPLOAD_KEY
        release {
            def p = new Properties()
            file('${propsFile}').withInputStream { p.load(it) }
            storeFile file(p['storeFile'])
            storePassword p['storePassword']
            keyAlias p['keyAlias']
            keyPassword p['keyPassword']
        }
`,
    );
    gradle = gradle.replace(
      /(release \{\s*\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );
    if (!gradle.includes('signingConfig signingConfigs.release')) throw new Error('Could not switch the release build to the upload key.');
    fs.writeFileSync(appGradle, gradle);
  }
  signing = 'upload key';
}

console.log('Patched Android project: low-memory settings, lint skipped, CMake ' + CMAKE_VERSION + ', release signed with ' + signing + '.');
