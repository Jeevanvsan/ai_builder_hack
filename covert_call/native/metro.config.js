// Metro config for the monorepo: the native app imports from ../shared (incidents, video, codes), which lives
// outside the native/ project root, and its node_modules are hoisted to the covert_call/ workspace root. Without
// watchFolders + nodeModulesPaths, Metro can't resolve either. (Epic 12.)
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Watch the whole workspace so shared/ changes trigger reloads and resolve. Appended rather than assigned, so
// Expo's own default watch folders are kept (replacing them outright makes Metro miss files it expects to see).
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot]
// Resolve packages from the app's own node_modules first, then the hoisted workspace node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

// @google/genai ships three builds. Its default (cross-platform) entry is the one Metro picks for React Native,
// and that build's WebSocket factory throws "This feature requires the web or Node specific @google/genai
// implementation" as soon as live.connect() is called — so the voice call would fail at runtime, not at build
// time. The *web* build works here: React Native's WebSocket delivers binary frames as ArrayBuffer, and Expo's
// runtime installs the TextDecoder / URL / ReadableStream globals that build expects (see
// node_modules/expo/src/winter/runtime.native.ts). Point the bare specifier at it.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@google/genai') {
    return context.resolveRequest(context, '@google/genai/web', platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
