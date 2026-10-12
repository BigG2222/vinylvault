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

console.log('Patched Android project: low-memory settings, lint skipped, CMake ' + CMAKE_VERSION + '.');
